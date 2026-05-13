"""
Fine-tuning script for Qwen2.5 Tool-Calling capabilities using LoRA and 4-bit Quantization.
Designed for (NVIDIA Blackwell).
"""

import gc
import json
import logging
import argparse
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple

import torch
from tqdm import tqdm
from datasets import Dataset
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    PreTrainedModel,
    PreTrainedTokenizerBase,
    TrainerCallback,
    TrainerState,
    TrainerControl,
)
from trl import SFTTrainer, SFTConfig

# -----------------------------------------------------------------------------
# Logging Configuration
# -----------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# -----------------------------------------------------------------------------
# Configuration Dataclasses
# -----------------------------------------------------------------------------
@dataclass
class TrainingConfig:
    """Dataclass holding all hyperparameters and paths for the training run."""
    
    # Data arguments
    data_path: str = "tool_calling.jsonl"
    target_count: int = 5000
    test_size: float = 0.1
    seed: int = 3407
    
    # Model arguments
    model_name: str = "unsloth/Qwen2.5-3B-Instruct-bnb-4bit"
    output_dir: str = "outputs"
    final_adapter_dir: str = "my_final_adapters"
    trust_remote_code: bool = True  # SECURITY NOTE: Ensure source is trusted before enabling
    
    # LoRA arguments
    lora_r: int = 16
    lora_alpha: int = 16
    lora_dropout: float = 0.05
    target_modules: List[str] = field(
        default_factory=lambda: ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]
    )
    
    # Training arguments
    max_length: int = 2048
    per_device_train_batch_size: int = 4
    gradient_accumulation_steps: int = 4
    learning_rate: float = 2e-4
    max_steps: int = 200
    warmup_steps: int = 10


# -----------------------------------------------------------------------------
# Callbacks
# -----------------------------------------------------------------------------
class PrintLossCallback(TrainerCallback):
    """Custom callback to log loss and learning rate at defined intervals."""
    
    def on_log(
        self,
        args: SFTConfig,
        state: TrainerState,
        control: TrainerControl,
        logs: Optional[Dict[str, float]] = None,
        **kwargs: Any
    ) -> None:
        if logs is not None and "loss" in logs:
            lr = logs.get('learning_rate', 0.0)
            logger.info(f"Step {state.global_step}: Loss = {logs['loss']:.4f}, LR = {lr:.6e}")


# -----------------------------------------------------------------------------
# Core Functions
# -----------------------------------------------------------------------------
def cleanup_memory() -> None:
    """Forces garbage collection and empties CUDA cache to prevent OOM errors."""
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        logger.info("CUDA cache cleared.")


def load_and_filter_dataset(file_path: Path, target_count: int) -> Dataset:
    """
    Scans a JSONL file and filters interactions containing assistant tool calls.
    
    Args:
        file_path (Path): Path to the JSONL dataset.
        target_count (int): Maximum number of records to ingest.
        
    Returns:
        Dataset: A HuggingFace Dataset object containing the filtered rows.
        
    Raises:
        FileNotFoundError: If the data file does not exist.
    """
    if not file_path.exists():
        raise FileNotFoundError(f"Dataset file not found at: {file_path}")

    sampled_data: List[Dict[str, Any]] = []
    logger.info(f"Scanning {file_path} for up to {target_count} tool-calling examples...")

    with file_path.open("r", encoding="utf-8") as f:
        for line in tqdm(f, desc="Processing JSONL", unit="lines"):
            try:
                row = json.loads(line)
                messages = row.get("messages", [])
                
                # Check for assistant messages that include tool_calls
                if any(m.get("role") == "assistant" and m.get("tool_calls") for m in messages):
                    sampled_data.append(row)
                
                if len(sampled_data) >= target_count:
                    break
            except json.JSONDecodeError:
                logger.warning("Encountered malformed JSON line. Skipping.")
                continue

    logger.info(f"Successfully loaded {len(sampled_data)} samples.")
    return Dataset.from_list(sampled_data)


def format_prompts(
    examples: Dict[str, List[Dict[str, Any]]], 
    tokenizer: PreTrainedTokenizerBase
) -> Dict[str, List[str]]:
    """
    Applies the model's chat template to the conversational messages.
    
    Args:
        examples (Dict): Batch of dataset examples.
        tokenizer (PreTrainedTokenizerBase): The instantiated tokenizer.
        
    Returns:
        Dict: Dictionary containing the formatted text strings.
    """
    instructions = examples.get("messages", [])
    texts = [
        tokenizer.apply_chat_template(msg, tokenize=False, add_generation_prompt=False) 
        for msg in instructions
    ]
    return {"text": texts}


def initialize_model_and_tokenizer(config: TrainingConfig) -> Tuple[PreTrainedModel, PreTrainedTokenizerBase]:
    """
    Initializes the 4-bit quantized model and tokenizer, preparing it for LoRA.
    
    Args:
        config (TrainingConfig): Configuration object.
        
    Returns:
        Tuple[PreTrainedModel, PreTrainedTokenizerBase]: The prepared model and tokenizer.
    """
    logger.info(f"Initializing Tokenizer: {config.model_name}")
    tokenizer = AutoTokenizer.from_pretrained(config.model_name)
    tokenizer.pad_token = tokenizer.eos_token

    # Verify BF16 support for Blackwell/Ampere+ architecture optimizations
    use_bf16 = torch.cuda.is_available() and torch.cuda.is_bf16_supported()
    compute_dtype = torch.bfloat16 if use_bf16 else torch.float16
    
    if use_bf16:
        logger.info("BF16 is supported on this hardware. Enabling optimized bfloat16 compute.")
    else:
        logger.warning("BF16 not supported on this hardware. Falling back to float16.")

    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=compute_dtype,
        bnb_4bit_use_double_quant=True,
    )

    logger.info(f"Loading Base Model: {config.model_name}")
    model = AutoModelForCausalLM.from_pretrained(
        config.model_name,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=config.trust_remote_code
    )

    # Prepare for LoRA mapping
    model = prepare_model_for_kbit_training(model)
    
    lora_config = LoraConfig(
        r=config.lora_r,
        lora_alpha=config.lora_alpha,
        target_modules=config.target_modules,
        lora_dropout=config.lora_dropout,
        bias="none",
        task_type="CAUSAL_LM",
    )
    
    model = get_peft_model(model, lora_config)
    model.gradient_checkpointing_enable()
    
    return model, tokenizer


def main(config: TrainingConfig) -> None:
    """Main execution pipeline."""
    logger.info("Starting fine-tuning pipeline...")
    
    # 1. Load Data
    data_path = Path(config.data_path)
    dataset = load_and_filter_dataset(data_path, config.target_count)
    
    # 2. Init Model & Tokenizer
    model, tokenizer = initialize_model_and_tokenizer(config)
    
    # Free memory before heavy preprocessing and training
    cleanup_memory()
    
    # 3. Preprocess Dataset
    logger.info("Applying chat templates to dataset...")
    dataset = dataset.map(
        format_prompts,
        batched=True,
        num_proc=2,
        remove_columns=dataset.column_names,
        fn_kwargs={"tokenizer": tokenizer},
        desc="Formatting Prompts"
    )
    
    dataset_split = dataset.train_test_split(test_size=config.test_size, seed=config.seed)
    train_ds = dataset_split["train"]
    eval_ds = dataset_split["test"]
    logger.info(f"Dataset split complete -> Train: {len(train_ds)} | Eval: {len(eval_ds)}")
    
    # 4. Training Arguments
    use_bf16 = torch.cuda.is_available() and torch.cuda.is_bf16_supported()
    
    training_args = SFTConfig(
        dataset_text_field="text",
        max_length=config.max_length,
        per_device_train_batch_size=config.per_device_train_batch_size,
        gradient_accumulation_steps=config.gradient_accumulation_steps,
        warmup_steps=config.warmup_steps,
        max_steps=config.max_steps,
        learning_rate=config.learning_rate,
        lr_scheduler_type="cosine",
        bf16=use_bf16,
        fp16=not use_bf16,
        logging_steps=5,
        eval_strategy="steps",
        eval_steps=25,
        per_device_eval_batch_size=2,
        optim="adamw_torch_fused",
        output_dir=config.output_dir,
        report_to="none",
    )
    
    # 5. Initialize Trainer
    trainer = SFTTrainer(
        model=model,
        train_dataset=train_ds,
        eval_dataset=eval_ds,
        args=training_args,
        callbacks=[PrintLossCallback()],
        # peft_config is omitted here because model is already wrapped by get_peft_model()
    )
    
    # 6. Train
    logger.info("Initializing Training Loop...")
    try:
        trainer.train()
    except Exception as e:
        logger.error(f"Training failed with error: {e}")
        raise
    finally:
        cleanup_memory()

    # 7. Save Adapters
    save_path = Path(config.final_adapter_dir)
    save_path.mkdir(parents=True, exist_ok=True)
    
    logger.info(f"Saving final model adapters and tokenizer to {save_path}...")
    trainer.model.save_pretrained(save_path)
    tokenizer.save_pretrained(save_path)
    logger.info("Pipeline completed successfully.")


if __name__ == "__main__":
    # Standard CLI integration for pipeline execution
    parser = argparse.ArgumentParser(description="Qwen2.5 LoRA Fine-Tuning Pipeline")
    parser.add_argument("--data_path", type=str, default="tool_calling.jsonl", help="Path to JSONL dataset")
    parser.add_argument("--target_count", type=int, default=5000, help="Number of rows to sample")
    parser.add_argument("--max_steps", type=int, default=200, help="Total training steps")
    parser.add_argument("--batch_size", type=int, default=4, help="Per device train batch size")
    
    args = parser.parse_args()
    
    # Merge CLI args into Dataclass config
    active_config = TrainingConfig(
        data_path=args.data_path,
        target_count=args.target_count,
        max_steps=args.max_steps,
        per_device_train_batch_size=args.batch_size
    )
    
    main(active_config)

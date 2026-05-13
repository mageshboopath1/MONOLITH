<p align="center">
  <img src="logo.png" alt="MONOLITH Logo" width="200"/>
</p>

# MONOLITH

MONOLITH is an Edge Sovereign AI orchestration system built for fully local execution on constrained hardware such as Apple Silicon (M1 8GB).

Powered by a fine-tuned Qwen2.5-3B-Instruct model, MONOLITH delivers deterministic tool-calling and agentic workflows without external cloud dependency, ensuring zero data egress, low latency, and complete operational sovereignty.

## Core Architecture
- **LLM Backbone**: Qwen2.5-3B-Instruct
- **Quantization**: 4-bit NF4 optimized for edge deployment
- **Fine-Tuning**: LoRA SFT on NVIDIA Nemotron-SFT-Agentic-v2
- **Inference Runtime**: Ollama (local-only execution)
- **Deployment Model**: Fully containerized via Docker Compose

## Inference Examples

### Standard Tool-Calling (Industrial Diagnostics)
Examples of the model performing deterministic telemetry analysis and tool orchestration:
<p align="center">
  <img src="eg1.png" alt="Inference Example 1" width="800"/>
</p>
<p align="center">
  <img src="eg2.png" alt="Inference Example 2" width="800"/>
</p>

### Out-of-Scope Handling
Demonstration of the model identifying and appropriately handling unrelated inquiries:
<p align="center">
  <img src="eg3.png" alt="Inference Example 3" width="800"/>
</p>

## Edge Sovereign Design Principles
MONOLITH is engineered around sovereign edge computing principles:
- **Local Sovereignty** — all inference and telemetry processing remain within host boundaries
- **Zero Cloud Dependency** — no external API reliance during runtime
- **Deterministic Tool Orchestration** — SFT-optimized function execution trajectories
- **Container Isolation** — reproducible and secure execution environments
- **Low Resource Footprint** — optimized for consumer-grade edge hardware
- **Network Containment** — restricted port exposure and internal host-gateway routing

## Infrastructure Stack
| Component | Description |
| :--- | :--- |
| **backend/** | FastAPI service layer (Port 8000) |
| **frontend/** | React + Vite UI served via hardened Nginx |
| **data/** | Industrial IoT Dataset (Synthetic) |
| **scripts/** | LoRA fine-tuning and training pipelines |

## Deployment
Start the full stack locally:
```bash
docker-compose up --build
```

## Fine-Tuning (SFT)
Containerized training pipeline with isolated dependencies:
```bash
docker run --rm -v $(pwd)/data:/app/data scripts/finetune-img \
python FineTuining.py --data_path data/tool_calling.jsonl
```

## Security Audit
Static analysis and vulnerability scanning using Trivy:
```bash
# Scan container images
trivy image monolith_backend:latest
trivy image monolith_frontend:latest

# Scan filesystem and configs
trivy fs .
```

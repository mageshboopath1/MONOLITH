import React, { useRef, useEffect } from 'react';
import { Send, User, Bot } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { DataTable } from './DataTable';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatAreaProps {
  messages: Message[];
  input: string;
  setInput: (val: string) => void;
  onSend: () => void;
  isLoading: boolean;
  activeModel: string;
}

export const ChatArea: React.FC<ChatAreaProps> = ({ 
  messages, 
  input, 
  setInput, 
  onSend, 
  isLoading,
  activeModel
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const renderMessageContent = (content: string) => {
    console.log("RENDER: Examining content:", content.substring(0, 50) + "...");
    try {
      const firstBracket = content.indexOf('[');
      const lastBracket = content.lastIndexOf(']');
      
      if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        let potentialJson = content.substring(firstBracket, lastBracket + 1);
        
        // Clean up escaped newlines if they are literal \n
        potentialJson = potentialJson.replace(/\\n/g, '\n');
        
        console.log("RENDER: Found potential JSON:", potentialJson.substring(0, 50) + "...");
        
        const parsed = JSON.parse(potentialJson);
        console.log("RENDER: Successfully parsed JSON array, length:", parsed.length);
        
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
          const textBefore = content.substring(0, firstBracket).trim();
          const textAfter = content.substring(lastBracket + 1).trim();
          
          return (
            <>
              {textBefore && (
                <div className="mb-4 text-zinc-400 font-mono text-[10px] uppercase tracking-widest">
                  {textBefore.split('\n').map((line, i) => <div key={i}>{line}</div>)}
                </div>
              )}
              <DataTable data={parsed} />
              {textAfter && (
                <div className="mt-4 text-zinc-400 font-mono text-[10px] uppercase tracking-widest">
                  {textAfter.split('\n').map((line, i) => <div key={i}>{line}</div>)}
                </div>
              )}
            </>
          );
        }
      }
    } catch (e) {
      console.error("RENDER: JSON Parse failed:", e);
    }
    
    return content.split('\n').map((line, i) => (
      <span key={i}>
        {line}
        <br />
      </span>
    ));
  };

  return (
    <div className="flex-1 flex flex-col bg-black h-screen">
      <header className="h-16 border-b border-zinc-900 flex items-center px-8">
        <h1 className="text-sm font-bold tracking-[0.3em] uppercase text-white">Monolith</h1>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Edge Sovereign</span>
        </div>
      </header>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-8 space-y-8 scroll-smooth"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-zinc-700">
            <Bot className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm font-mono tracking-tighter uppercase opacity-40">
              Infering {activeModel}...
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div 
            key={i} 
            className={cn(
              "flex gap-4 max-w-3xl",
              msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
            )}
          >
            <div className={cn(
              "w-8 h-8 border flex items-center justify-center shrink-0 rounded-none",
              msg.role === 'user' ? "border-zinc-700 bg-zinc-800" : "border-white/20 bg-white/5"
            )}>
              {msg.role === 'user' ? <User className="w-4 h-4 text-zinc-400" /> : <Bot className="w-4 h-4 text-white" />}
            </div>
            <div className={cn(
              "px-4 py-3 text-sm leading-relaxed rounded-none",
              msg.role === 'user' 
                ? "bg-zinc-800 text-zinc-200" 
                : "bg-zinc-900/50 border border-zinc-800 text-zinc-300"
            )}>
              {renderMessageContent(msg.content)}
              {msg.role === 'assistant' && i === messages.length - 1 && isLoading && (
                <span className="inline-block ml-1 animate-pulse font-bold text-[10px] align-middle">█</span>
              )}
            </div>
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex gap-4 mr-auto animate-pulse">
            <div className="w-8 h-8 border border-white/20 bg-white/5 flex items-center justify-center shrink-0 rounded-none">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="px-4 py-3 bg-zinc-900/50 border border-zinc-800 rounded-none">
              <span className="animate-pulse font-bold text-white text-[10px] align-middle">█</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-8">
        <div className="max-w-3xl mx-auto relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder="Enter transmission..."
            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-none px-6 py-4 pr-32 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 transition-colors resize-none h-14 min-h-[56px]"
            rows={1}
          />
          <button
            onClick={onSend}
            disabled={isLoading || !input.trim()}
            className="absolute right-3 top-1/2 -translate-y-1/2 px-6 h-10 bg-white text-black rounded-none text-[10px] font-bold tracking-widest uppercase hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600 transition-colors"
          >
            Submit
          </button>
        </div>
        <p className="text-[10px] text-center text-zinc-700 mt-4 uppercase tracking-[0.2em]">
          Local Node
        </p>
      </div>
    </div>
  );
};

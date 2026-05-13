import React, { useState, useEffect, useRef } from 'react';
import { Activity, BrainCircuit } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Metrics {
  totalToolsUsed?: number;
  totalTokens?: number;
  latency?: number;
}

interface InsightsProps {
  cot: string;
  metrics: Metrics;
  onTypingComplete?: () => void;
}

export const Insights: React.FC<InsightsProps> = ({ cot, metrics, onTypingComplete }) => {
  const [displayedCot, setDisplayedCot] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const fullCotRef = useRef('');

  useEffect(() => {
    if (cot && cot !== fullCotRef.current) {
      fullCotRef.current = cot;
      setIsTyping(true);
      
      let currentIndex = displayedCot.length;
      
      const interval = setInterval(() => {
        if (currentIndex < cot.length) {
          setDisplayedCot(cot.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          setIsTyping(false);
          clearInterval(interval);
          if (onTypingComplete) onTypingComplete();
        }
      }, 30); // Slightly slower for readability

      return () => clearInterval(interval);
    } else if (!cot) {
      setDisplayedCot('');
      fullCotRef.current = '';
      setIsTyping(false);
    }
  }, [cot]);

  return (
    <div className="w-80 bg-zinc-950 border-l border-zinc-800 p-6 flex flex-col gap-6 h-screen overflow-y-auto">
      <section>
        <div className={cn(
          "flex items-center gap-2 mb-4 transition-all duration-1000",
          isTyping ? "text-white animate-cot-glow" : "text-zinc-400"
        )}>
          <BrainCircuit className={cn(
            "w-4 h-4",
            isTyping && "animate-pulse"
          )} />
          <h2 className="text-xs font-semibold tracking-widest uppercase">Chain of Thought</h2>
        </div>
        <div className="bg-zinc-900/30 border border-zinc-800 rounded-none p-4 h-[400px] overflow-y-auto relative custom-scrollbar">
          {displayedCot ? (
            <p className="text-xs text-zinc-400 font-mono leading-relaxed whitespace-pre-wrap pb-4">
              {displayedCot}
              {isTyping && <span className="inline-block ml-1 animate-pulse font-bold text-[10px] align-middle">█</span>}
            </p>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-zinc-600 italic text-[10px]">
              Waiting for inference...
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-zinc-400" />
          <h2 className="text-xs font-semibold tracking-widest uppercase text-zinc-400">Real-time Metrics</h2>
        </div>
        <div className="grid grid-cols-1 gap-3">
          <MetricCard 
            label="Total Tools Used" 
            value={metrics.totalToolsUsed?.toString() || '0'} 
            unit="calls" 
          />
          <MetricCard 
            label="Total Tokens" 
            value={metrics.totalTokens?.toString() || '0'} 
            unit="tokens" 
          />
          <MetricCard 
            label="Inference Time" 
            value={metrics.latency ? (metrics.latency / 1000).toFixed(2) : '0.00'} 
            unit="sec" 
          />
        </div>
      </section>
    </div>
  );
};

const MetricCard = ({ label, value, unit }: { label: string; value: string; unit: string }) => (
  <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-none flex justify-between items-end">
    <div>
      <p className="text-[10px] text-zinc-500 uppercase font-medium">{label}</p>
      <p className="text-xl font-mono text-white mt-1">{value}</p>
    </div>
    <span className="text-[10px] text-zinc-600 font-mono mb-1">{unit}</span>
  </div>
);

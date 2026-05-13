import React from 'react';
import { Settings2, Trash2, MessageSquare } from 'lucide-react';

interface ChatSession {
  id: string;
  model: string;
  title: string;
  created_at: string;
}

interface SidebarProps {
  model: string;
  setModel: (val: string) => void;
  models: string[];
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onReset: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  model,
  setModel,
  models,
  sessions,
  activeSessionId,
  onSelectSession,
  onReset
}) => {
  return (
    <div className="w-64 bg-zinc-950 border-r border-zinc-800 p-6 flex flex-col h-screen relative z-50 overflow-hidden shrink-0">
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div className="flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-zinc-400" />
          <h2 className="text-sm font-semibold tracking-widest uppercase text-zinc-400">Orchestration</h2>
        </div>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            console.log("UI: Reset Clicked");
            onReset();
          }}
          className="p-1.5 hover:bg-zinc-900 rounded-none text-zinc-600 hover:text-red-400 transition-colors cursor-pointer"
          title="Clear Session"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="mb-8 shrink-0">
          <label className="block text-xs font-medium text-zinc-500 uppercase tracking-tighter mb-2">
            Active Model
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-none px-3 py-2 text-xs font-mono text-zinc-300 focus:outline-none focus:border-zinc-700 appearance-none cursor-pointer"
          >
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            {models.length === 0 && <option>No models found</option>}
          </select>
        </div>

        <label className="block text-xs font-medium text-zinc-500 uppercase tracking-tighter mb-4 shrink-0">
          Chat History
        </label>
        
        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar min-h-0">
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log("UI: Selecting session:", s.id);
                onSelectSession(s.id);
              }}
              className={`w-full text-left px-4 py-3 rounded-none text-xs font-mono truncate transition-all duration-200 border-l-2 flex items-center gap-3 cursor-pointer relative z-[60] ${
                activeSessionId === s.id 
                  ? "bg-zinc-100 text-black border-white shadow-lg" 
                  : "bg-zinc-900/50 text-zinc-400 border-transparent hover:bg-zinc-800 hover:text-zinc-200 hover:border-zinc-700"
              }`}
            >
              <MessageSquare className="w-4 h-4 shrink-0 pointer-events-none" />
              <span className="truncate font-medium pointer-events-none">{s.title}</span>
            </button>
          ))}
          {sessions.length === 0 && (
            <p className="text-[10px] text-zinc-600 italic px-3 mt-2">No sessions yet</p>
          )}
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-zinc-900 shrink-0">
        <div className="p-3 rounded-none bg-zinc-900/30 border border-zinc-800/50">
          <h3 className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Monolith</h3>
          <p className="text-[9px] text-zinc-600 leading-relaxed">
            Secure offline inference enabled.
          </p>
        </div>
      </div>
    </div>
  );
};

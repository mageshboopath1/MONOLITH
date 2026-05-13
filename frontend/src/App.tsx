import { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { Insights } from './components/Insights';
import { LoadingBar } from './components/LoadingBar';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Metrics {
  totalToolsUsed?: number;
  totalTokens?: number;
  latency?: number;
}

interface ChatSession {
  id: string;
  model: string;
  title: string;
  created_at: string;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(0.9);
  const [cot, setCot] = useState('');
  const [isCotComplete, setIsCotComplete] = useState(false);
  const [metrics, setMetrics] = useState<Metrics>({});
  const [model, setModel] = useState('gallery-agent');
  const [models, setModels] = useState<string[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const assistantReplyRef = useRef('');

  useEffect(() => {
    localStorage.removeItem('chat_history');
    setMessages([]);
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await fetch('http://localhost:8000/sessions');
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
      }
    } catch (e) {
      console.error("Failed to fetch sessions", e);
    }
  };

  const selectSession = async (id: string) => {
    console.log("APP: Requesting session data for:", id);
    try {
      const response = await fetch(`http://localhost:8000/sessions/${id}`);
      if (response.ok) {
        const data = await response.json();
        console.log("APP: Received messages:", data.length);
        setMessages(data);
        setActiveSessionId(id);
        const session = sessions.find(s => s.id === id);
        if (session) {
          console.log("APP: Updating model to:", session.model);
          setModel(session.model);
        }
      } else {
        console.error("APP: Failed to fetch session messages, status:", response.status);
      }
    } catch (e) {
      console.error("APP: Error in selectSession", e);
    }
  };

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch('http://localhost:8000/models');
        if (response.ok) {
          const data = await response.json();
          setModels(data);
          if (data.length > 0 && !data.includes(model)) {
            setModel(data[0]);
          }
        }
      } catch (e) {
        console.error("Failed to fetch models", e);
      }
    };
    fetchModels();
  }, []);

  useEffect(() => {
    localStorage.setItem('chat_history', JSON.stringify(messages));
  }, [messages]);

  // Robust handoff logic
  useEffect(() => {
    if (isCotComplete && assistantReplyRef.current) {
      console.log("HANDOFF: CoT done, showing reply.");
      const reply = assistantReplyRef.current;
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      assistantReplyRef.current = '';
      setIsLoading(false);
      setIsCotComplete(false);
    }
  }, [isCotComplete]);

  const handleReset = async () => {
    if (activeSessionId) {
      try {
        const response = await fetch(`http://localhost:8000/sessions/${activeSessionId}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          fetchSessions();
        }
      } catch (e) {
        console.error("Failed to delete session", e);
      }
    }
    
    setMessages([]);
    setCot('');
    setMetrics({});
    setActiveSessionId(null);
    localStorage.removeItem('chat_history');
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    setCot(''); 
    setIsCotComplete(false);
    assistantReplyRef.current = '';

    const cotInterval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/cot/latest`);
        if (response.ok) {
          const data = await response.json();
          if (data.cot) setCot(data.cot);
        }
      } catch (e) { }
    }, 1000);

    try {
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          temperature,
          topP,
          model,
          session_id: activeSessionId,
        }),
      });

      if (!response.ok) throw new Error('Failed to connect');
      if (!response.body) throw new Error('No body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.error) {
              assistantContent += `\nError: ${data.error}`;
              assistantReplyRef.current = assistantContent;
              setIsCotComplete(true);
            } else if (data.message && data.message.content) {
              assistantContent += data.message.content;
            }

            if (data.done) {
              const allContent = assistantContent;
              const toolCount = (messages.filter(m => m.content.includes('<tool_call>')).length) + (allContent.includes('<tool_call>') ? 1 : 0);
              
              setMetrics({
                totalToolsUsed: toolCount,
                totalTokens: data.eval_count || 0,
                latency: (data.total_duration || 0) / 1e6,
              });
              assistantReplyRef.current = assistantContent || "Inference complete.";
              // If CoT never arrived, force it here to trigger handoff
              if (!cot) setIsCotComplete(true);
            }
          } catch (e) { }
        }
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection failed.' }]);
      setIsLoading(false);
    } finally {
      clearInterval(cotInterval);
    }
  };

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden">
      <LoadingBar isLoading={isLoading} />
      <Sidebar 
        model={model} setModel={setModel}
        models={models} sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={selectSession} onReset={handleReset}
      />
      <ChatArea 
        messages={messages} input={input} setInput={setInput}
        onSend={handleSend} isLoading={isLoading} activeModel={model}
      />
      <Insights 
        cot={cot} metrics={metrics}
        onTypingComplete={() => setIsCotComplete(true)}
      />
    </div>
  );
}

export default App;

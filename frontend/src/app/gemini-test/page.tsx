"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// A conversation is a sequence of turns
interface Turn {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  isLive: boolean; // Still being spoken
}

export default function GeminiTestPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState<string | null>(null);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Current turn tracking - use refs to avoid stale closures
  const currentTurnIdRef = useRef<string | null>(null);
  const currentTurnRoleRef = useRef<"user" | "assistant" | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  // Start a new turn or update the current live turn
  // API sends INCREMENTAL words, so we ACCUMULATE them
  const updateTurn = useCallback((role: "user" | "assistant", content: string, isLive: boolean) => {
    if (!content.trim()) return;

    setTurns((prev) => {
      // Find ANY live turn for this role
      const liveTurnIndex = prev.findIndex((t) => t.role === role && t.isLive);
      
      if (liveTurnIndex !== -1) {
        // ACCUMULATE: append new content to existing
        const existingContent = prev[liveTurnIndex].content;
        const newContent = existingContent + content;
        
        return prev.map((t, i) =>
          i === liveTurnIndex ? { ...t, content: newContent, isLive } : t
        );
      }

      // No live turn - finalize other role's turn first (turn-taking)
      const otherRole = role === "user" ? "assistant" : "user";
      const otherLiveIndex = prev.findIndex((t) => t.role === otherRole && t.isLive);
      
      let updated = prev;
      if (otherLiveIndex !== -1) {
        updated = prev.map((t, i) =>
          i === otherLiveIndex ? { ...t, isLive: false } : t
        );
      }

      // Create new turn with initial content
      const newTurn: Turn = {
        id: `${Date.now()}-${Math.random()}`,
        role,
        content: content.trim(),
        isLive,
      };

      currentTurnIdRef.current = newTurn.id;
      currentTurnRoleRef.current = role;

      return [...updated, newTurn];
    });
  }, []);

  // Finalize the current turn (mark as not live)
  const finalizeTurn = useCallback((role: "user" | "assistant") => {
    setTurns((prev) => {
      const lastIndex = prev.findIndex((t) => t.role === role && t.isLive);
      if (lastIndex === -1) return prev;
      return prev.map((t, i) =>
        i === lastIndex ? { ...t, isLive: false } : t
      );
    });
    if (currentTurnRoleRef.current === role) {
      currentTurnIdRef.current = null;
      currentTurnRoleRef.current = null;
    }
  }, []);

  // Replace content of live turn (for final transcript with proper spacing)
  const replaceTurn = useCallback((role: "user" | "assistant", content: string) => {
    if (!content) return;
    
    setTurns((prev) => {
      const liveTurnIndex = prev.findIndex((t) => t.role === role && t.isLive);
      
      if (liveTurnIndex !== -1) {
        // Replace content entirely (final transcript has proper spacing)
        return prev.map((t, i) =>
          i === liveTurnIndex ? { ...t, content, isLive: true } : t
        );
      }
      
      // No live turn exists - create one
      return [...prev, {
        id: `${Date.now()}-${Math.random()}`,
        role,
        content,
        isLive: true,
      }];
    });
  }, []);

  // Add a system message
  const addSystem = useCallback((content: string) => {
    setTurns((prev) => [
      ...prev,
      { id: `sys-${Date.now()}`, role: "system", content, isLive: false },
    ]);
  }, []);

  // Audio playback queue
  const playAudio = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    isPlayingRef.current = true;

    while (audioQueueRef.current.length > 0) {
      const data = audioQueueRef.current.shift();
      if (!data) continue;
      try {
        const ctx = new AudioContext({ sampleRate: 24000 });
        const buf = ctx.createBuffer(1, data.byteLength / 2, 24000);
        const chan = buf.getChannelData(0);
        const int16 = new Int16Array(data);
        for (let i = 0; i < int16.length; i++) chan[i] = int16[i] / 32768;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        await new Promise<void>((r) => { src.onended = () => r(); src.start(); });
        ctx.close();
      } catch {}
    }
    isPlayingRef.current = false;
  }, []);

  // Handle WebSocket messages
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (event.data instanceof Blob) {
        event.data.arrayBuffer().then((buf) => {
          audioQueueRef.current.push(buf);
          playAudio();
        });
        return;
      }

      try {
        const msg = JSON.parse(event.data);
        const type = msg.type;

        if (type === "status") {
          setStatus(msg.message || msg.content || "Connected");
        } else if (type === "transcript") {
          const role = msg.role as "user" | "assistant";
          const content = msg.content || "";
          const isPartial = msg.partial !== false; // Default to partial if not specified
          
          if (content) {
            if (isPartial) {
              // Partial: accumulate words
              updateTurn(role, content, true);
            } else {
              // Final: replace with complete properly-spaced text
              replaceTurn(role, content.trim());
            }
          }
        } else if (type === "turn_complete") {
          // Assistant finished speaking
          finalizeTurn("assistant");
          setStatus("Listening...");
        } else if (type === "interrupted") {
          // User interrupted - finalize assistant's turn
          finalizeTurn("assistant");
          // Also finalize any live user turn since they're done
          finalizeTurn("user");
          setStatus("Listening...");
        } else if (type === "tool_call") {
          addSystem(`🔍 ${msg.content}`);
        } else if (type === "error") {
          setError(msg.content);
          addSystem(`❌ ${msg.content}`);
        }
      } catch (e) {
        console.error("Parse error:", e);
      }
    },
    [addSystem, finalizeTurn, playAudio, updateTurn]
  );

  // Start session
  const startSession = useCallback(async () => {
    setError(null);
    setTurns([]);
    currentTurnIdRef.current = null;
    currentTurnRoleRef.current = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      mediaStreamRef.current = stream;

      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      const clientId = `client-${Date.now()}`;
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "ws://localhost:8001";
      const ws = new WebSocket(`${backendUrl}/api/v1/gemini-live/${clientId}`);
      wsRef.current = ws;

      ws.onmessage = handleMessage;
      ws.onerror = () => { setError("Connection failed"); setStatus("Error"); };
      ws.onclose = () => {
        // Finalize any open turns
        finalizeTurn("assistant");
        finalizeTurn("user");
        setIsConnected(false);
        setIsRecording(false);
        setStatus("Disconnected");
        addSystem("Session ended");
      };

      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("Timeout")), 5000);
        ws.onopen = () => {
          clearTimeout(t);
          setIsConnected(true);
          setStatus("Connected - speak now!");
          addSystem("🟢 Connected - speak now!");
          resolve();
        };
      });

      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const input = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        ws.send(int16.buffer);
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
      setIsRecording(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setStatus("Error");
    }
  }, [addSystem, finalizeTurn, handleMessage]);

  // Stop session
  const stopSession = useCallback(() => {
    processorRef.current?.disconnect();
    audioContextRef.current?.close();
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    wsRef.current?.close();
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setIsConnected(false);
    setIsRecording(false);
    setStatus("Stopped");
  }, []);

  useEffect(() => () => stopSession(), [stopSession]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-slate-100 p-6">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-emerald-400 mb-1">Gemini Live Test</h1>
          <p className="text-slate-400 text-sm">Real-time voice with Lexie</p>
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between bg-slate-800/50 rounded-lg px-4 py-2 mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-600"}`} />
            <span className="text-sm text-slate-300">{status}</span>
          </div>
          {isRecording && (
            <div className="flex items-center gap-1.5 text-red-400">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs">REC</span>
            </div>
          )}
        </div>

        {/* Chat Area */}
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 mb-4 overflow-hidden">
          <div className="h-80 overflow-y-auto p-4 space-y-3">
            {turns.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                Click Start to begin
              </div>
            ) : (
              turns.map((turn) => (
                <div
                  key={turn.id}
                  className={`flex ${turn.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`
                      max-w-[85%] rounded-2xl px-4 py-2.5 text-sm
                      ${turn.role === "user"
                        ? "bg-emerald-600/80 text-white rounded-br-md"
                        : turn.role === "assistant"
                        ? `bg-slate-700/80 text-slate-100 rounded-bl-md ${turn.isLive ? "border border-blue-500/50" : ""}`
                        : "bg-slate-800/50 text-slate-400 text-xs italic py-1.5 px-3"
                      }
                    `}
                  >
                    {turn.role !== "system" && (
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide opacity-60 mb-1">
                        {turn.role === "user" ? "You" : "Lexie"}
                        {turn.isLive && <span className="text-blue-400 animate-pulse text-sm">●</span>}
                      </div>
                    )}
                    {turn.content}
                  </div>
                </div>
              ))
            )}
            <div ref={scrollRef} />
          </div>
        </div>

        {/* Control Button */}
        <button
          onClick={isConnected ? stopSession : startSession}
          className={`
            w-full py-4 rounded-xl font-semibold text-base transition-all
            ${isConnected
              ? "bg-red-600 hover:bg-red-700 active:bg-red-800"
              : "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800"
            }
          `}
        >
          {isConnected ? "⏹ Stop" : "▶ Start Conversation"}
        </button>

        {error && (
          <div className="mt-3 p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Tips */}
        <div className="mt-4 text-xs text-slate-500 space-y-0.5">
          <p>• Speak naturally after connecting</p>
          <p>• You can interrupt Lexie anytime</p>
        </div>
      </div>
    </div>
  );
}

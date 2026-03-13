'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { mockConversationWithDocuments, type VoiceMessage } from '@/lib/mock-data';
import { Mic, MicOff, Pause, PhoneForwarded, Upload, X, Clock, Wifi, WifiOff, ToggleLeft, ToggleRight } from 'lucide-react';
import { useLiveCase, type LiveEvidenceItem, type LiveUploadedFile } from '@/contexts/live-case-context';
import { useEvidence } from '@/contexts/evidence-context';

// Type for live data snapshot from backend
interface LiveDataSnapshot {
  caseFacts: {
    plaintiffName?: string;
    employerName?: string;
    incidentDate?: string;
    incidentLocation?: string;
    incidentDescription?: string;
    incidentType?: string;
    caseType?: string;
    injuries?: string[];
    injurySeverity?: string;
    medicalExpenses?: number;
    [key: string]: unknown;
  };
  evidenceItems: Array<{
    id: string;
    type: string;
    description: string;
    status: string;
    priority: string;
  }>;
  timelineEvents: Array<{
    id: string;
    date: string;
    event: string;
    description?: string;
    category: string;
  }>;
  medicalRecords: Array<{
    id: string;
    date: string;
    provider: string;
    service: string;
    amount?: number;
  }>;
  damagesEstimate: {
    pastMedical?: number;
    futureMedical?: number;
    lostWages?: number;
    settlementLow?: number;
    settlementHigh?: number;
  };
  checklistStatus: {
    total: number;
    required: number;
    pending: number;
    uploaded: number;
    analyzed: number;
    not_available: number;
  };
  currentDocumentRequest: {
    id: string;
    type: string;
    description: string;
    priority: string;
  } | null;
}

// Message type for unified display
interface ChatMessage {
  role: 'agent' | 'plaintiff' | 'user' | 'system';
  content: string;
  timestamp: string;
  isLive?: boolean; // For streaming transcripts
  toolCall?: {
    name: string;
    args?: Record<string, unknown>;
    result?: string;
  };
  documentRequest?: {
    id: string;
    type: string;
    description: string;
    priority: 'critical' | 'important' | 'helpful';
  };
}

// Pending document request for session resume
interface PendingDocRequest {
  id: string;
  description: string;
  messageIndex: number;
}

export default function VoiceChat() {
  // Mode toggle: 'mock' for simulation, 'live' for real backend
  const [mode, setMode] = useState<'mock' | 'live'>('live');
  
  // Debug panel state
  const [showDebug, setShowDebug] = useState(false);
  const [debugLogs, setDebugLogs] = useState<{time: string; type: string; data: string}[]>([]);
  const addDebugLog = (type: string, data: unknown) => {
    const time = new Date().toLocaleTimeString();
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    setDebugLogs(prev => [...prev.slice(-50), { time, type, data: dataStr }]); // Keep last 50
  };
  
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [error, setError] = useState<string | null>(null);
  
  // Mock mode state
  const [isListening, setIsListening] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  // Shared document response state
  const [documentResponses, setDocumentResponses] = useState<Record<number, 'uploaded' | 'dont-have' | 'later' | null>>({});
  const [pendingDocRequest, setPendingDocRequest] = useState<PendingDocRequest | null>(null);
  
  // Live mode document request (tracks the current evidence item being requested)
  const [liveDocumentRequest, setLiveDocumentRequest] = useState<{
    id: string;
    description: string;
    priority: 'critical' | 'important' | 'helpful';
  } | null>(null);
  const [liveDocResponseStatus, setLiveDocResponseStatus] = useState<'pending' | 'uploaded' | 'later' | 'dont-have'>('pending');
  
  // Shared state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [uploadedFileCounts, setUploadedFileCounts] = useState<Record<number, number>>({});
  
  // Voice streaming refs (for live mode)
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const playbackSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const interruptedRef = useRef(false);
  const lastAssistantContentRef = useRef("");
  const handleWsMsgRef = useRef<((event: MessageEvent) => void) | null>(null);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const resumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isStoppedRef = useRef(false);
  
  const { 
    startSession: startContextSession, 
    endSession: endContextSession,
    resetCase,
    updateCaseFact,
    addEvidenceItem,
    updateEvidenceStatus,
    addTimelineEvent,
    addMedicalRecord,
    updateDamages,
    setActiveTab,
    evidenceItems,
    addUploadedFile,
    updateFileStatus,
  } = useLiveCase();

  const { setMode: setEvidenceMode, resetLiveEvidence } = useEvidence();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Scroll to bottom when live document request appears
  useEffect(() => {
    if (liveDocumentRequest) {
      scrollToBottom();
    }
  }, [liveDocumentRequest]);

  // Sync evidence context mode on initial render
  useEffect(() => {
    setEvidenceMode(mode);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
      }
      if (mode === 'live') {
        stopLiveSession();
      }
    };
  }, [mode]);

  // ==================== VOICE STREAMING FUNCTIONS (LIVE MODE) ====================

  // Stop all audio playback immediately
  const stopAudio = useCallback(() => {
    audioQueueRef.current = [];
    try {
      playbackSourceRef.current?.stop();
      playbackSourceRef.current?.disconnect();
    } catch {}
    try {
      if (playbackContextRef.current?.state !== 'closed') {
        playbackContextRef.current?.close();
      }
    } catch {}
    playbackSourceRef.current = null;
    playbackContextRef.current = null;
    isPlayingRef.current = false;
  }, []);

  // Audio playback queue
  const playAudio = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    isPlayingRef.current = true;

    while (audioQueueRef.current.length > 0 && !interruptedRef.current) {
      const data = audioQueueRef.current.shift();
      if (!data) continue;
      try {
        const ctx = new AudioContext({ sampleRate: 24000 });
        playbackContextRef.current = ctx;
        const buf = ctx.createBuffer(1, data.byteLength / 2, 24000);
        const chan = buf.getChannelData(0);
        const int16 = new Int16Array(data);
        for (let i = 0; i < int16.length; i++) chan[i] = int16[i] / 32768;
        const src = ctx.createBufferSource();
        playbackSourceRef.current = src;
        src.buffer = buf;
        src.connect(ctx.destination);
        await new Promise<void>((r) => { src.onended = () => r(); src.start(); });
        if (ctx.state !== 'closed') ctx.close();
      } catch {}
    }
    playbackContextRef.current = null;
    playbackSourceRef.current = null;
    isPlayingRef.current = false;
  }, []);

  // Update turn with streaming content
  const updateLiveTurn = useCallback((role: 'user' | 'agent', content: string, isPartial: boolean) => {
    if (!content.trim()) return;
    
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    setMessages((prev) => {
      // Find live turn for this role
      const liveTurnIndex = prev.findIndex((t) => t.role === role && t.isLive);
      
      if (liveTurnIndex !== -1) {
        const existing = prev[liveTurnIndex].content;
        const newContent = isPartial 
          ? (existing + ' ' + content).trim()
          : content.trim();
        
        return prev.map((t, i) =>
          i === liveTurnIndex ? { ...t, content: newContent, isLive: isPartial } : t
        );
      }

      // No live turn - finalize other role's turn first
      const otherRole = role === 'user' ? 'agent' : 'user';
      const otherLiveIndex = prev.findIndex((t) => t.role === otherRole && t.isLive);
      
      let updated = prev;
      if (otherLiveIndex !== -1) {
        updated = prev.map((t, i) =>
          i === otherLiveIndex ? { ...t, isLive: false } : t
        );
      }

      // Create new turn
      const newTurn: ChatMessage = {
        role,
        content: content.trim(),
        timestamp,
        isLive: isPartial,
      };

      return [...updated, newTurn];
    });
  }, []);

  // Finalize live turn
  const finalizeLiveTurn = useCallback((role: 'user' | 'agent', captureContent = false) => {
    setMessages((prev) => {
      const lastIndex = prev.findIndex((t) => t.role === role && t.isLive);
      if (lastIndex === -1) return prev;
      
      if (role === 'agent' && captureContent) {
        const allAssistantContent = prev
          .filter(t => t.role === 'agent')
          .map(t => t.content)
          .join('');
        lastAssistantContentRef.current = allAssistantContent;
      }
      
      return prev.map((t, i) =>
        i === lastIndex ? { ...t, isLive: false } : t
      );
    });
  }, []);

  // Add system message
  const addSystemMessage = useCallback((content: string) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setMessages((prev) => [
      ...prev,
      { role: 'system', content, timestamp, isLive: false },
    ]);
  }, []);

  // Dispatch live data updates from backend
  const dispatchBackendLiveUpdate = useCallback((data: LiveDataSnapshot) => {
    // Debug: log to UI panel
    addDebugLog('LIVE_UPDATE', { 
      evidenceCount: data.evidenceItems?.length || 0,
      hasChecklist: !!data.evidenceItems?.length,
      mode 
    });
    
    // Update case facts
    if (data.caseFacts) {
      const cf = data.caseFacts;
      if (cf.plaintiffName) updateCaseFact('plaintiffName', cf.plaintiffName);
      if (cf.employerName) updateCaseFact('employerName', cf.employerName);
      if (cf.incidentDate) updateCaseFact('incidentDate', cf.incidentDate);
      if (cf.incidentLocation) updateCaseFact('incidentLocation', cf.incidentLocation);
      if (cf.incidentDescription) updateCaseFact('incidentDescription', cf.incidentDescription);
      if (cf.incidentType) updateCaseFact('incidentType', cf.incidentType);
      if (cf.caseType) updateCaseFact('caseType', cf.caseType);
      if (cf.injuries) updateCaseFact('injuries', cf.injuries);
      if (cf.injurySeverity) updateCaseFact('injurySeverity', cf.injurySeverity);
      if (cf.medicalExpenses) updateCaseFact('medicalExpenses', cf.medicalExpenses);
    }
    
    // Handle current document request (from backend's request_evidence_upload)
    // DEBUG: Log what we received
    addDebugLog('DOC_REQ_RECEIVED', data.currentDocumentRequest ? `${data.currentDocumentRequest.id}` : 'null');
    
    if (data.currentDocumentRequest && mode === 'live') {
      const req = data.currentDocumentRequest;
      addDebugLog('SETTING_CARD', `${req.id}: ${req.description?.slice(0, 20)}`);
      setLiveDocumentRequest({
        id: req.id,
        description: req.description,
        priority: req.priority.toLowerCase() as 'critical' | 'important' | 'helpful',
      });
      setLiveDocResponseStatus('pending');
    } else if (data.currentDocumentRequest === null && mode === 'live') {
      // Explicitly cleared by backend
      addDebugLog('CLEARING_CARD', 'null received');
      setLiveDocumentRequest(null);
    }
    // If currentDocumentRequest is undefined, keep existing state
    
    // Update evidence items
    if (data.evidenceItems) {
      // Debug log evidence items
      addDebugLog('EVIDENCE_ITEMS', data.evidenceItems.map(i => `${i.type}: ${i.status}`).slice(0, 5));
      
      data.evidenceItems.forEach(item => {
        // Map backend status to frontend status (backend sends lowercase)
        let frontendStatus: 'required' | 'pending' | 'uploaded' | 'not_available' = 'required';
        switch (item.status) {
          case 'required': frontendStatus = 'required'; break;
          case 'pending': frontendStatus = 'pending'; break;
          case 'uploaded': case 'analyzed': frontendStatus = 'uploaded'; break;
          case 'not_available': frontendStatus = 'not_available'; break;
        }
        
        // Check if item exists
        const existing = evidenceItems.find(e => e.id === item.id);
        if (existing) {
          updateEvidenceStatus(item.id, frontendStatus);
        } else {
          addEvidenceItem({
            id: item.id,
            type: item.type,
            description: item.description,
            status: frontendStatus,
            priority: item.priority.toLowerCase() as 'critical' | 'important' | 'helpful',
          });
        }
      });
    }
    
    // Update timeline
    if (data.timelineEvents) {
      data.timelineEvents.forEach(event => {
        // Map backend category to frontend type
        const categoryMap: Record<string, 'incident' | 'medical' | 'legal' | 'insurance'> = {
          'incident': 'incident',
          'medical': 'medical',
          'legal': 'legal',
          'evidence': 'legal', // Map evidence to legal for now
          'insurance': 'insurance',
        };
        addTimelineEvent({
          id: event.id,
          date: event.date,
          event: event.event,
          description: event.description || '',
          category: categoryMap[event.category] || 'incident',
        });
      });
    }
    
    // Update medical records
    if (data.medicalRecords) {
      data.medicalRecords.forEach(record => {
        addMedicalRecord({
          id: record.id,
          date: record.date,
          provider: record.provider,
          service: record.service,
          amount: record.amount || 0,
        });
      });
    }
    
    // Update damages
    if (data.damagesEstimate && Object.keys(data.damagesEstimate).length > 0) {
      updateDamages({
        pastMedical: data.damagesEstimate.pastMedical,
        futureMedical: data.damagesEstimate.futureMedical,
        lostWages: data.damagesEstimate.lostWages,
        settlementLow: data.damagesEstimate.settlementLow,
        settlementHigh: data.damagesEstimate.settlementHigh,
      });
    }
  }, [mode, updateCaseFact, addEvidenceItem, updateEvidenceStatus, addTimelineEvent, addMedicalRecord, updateDamages, evidenceItems]);

  // Handle WebSocket messages
  const handleWsMessage = useCallback(
    (event: MessageEvent) => {
      if (event.data instanceof Blob) {
        // Audio data - don't queue if interrupted
        if (interruptedRef.current) return;
        event.data.arrayBuffer().then((buf) => {
          if (interruptedRef.current) return;
          audioQueueRef.current.push(buf);
          playAudio();
        });
        return;
      }

      try {
        const msg = JSON.parse(event.data);
        const type = msg.type;
        
        // DEBUG: Log EVERY message type received
        if (type !== 'transcript') {
          addDebugLog('WS_MSG', `type=${type}`);
        }

        if (type === 'status') {
          setStatus(msg.message || msg.content || 'Connected');
        } else if (type === 'transcript') {
          const role = msg.role === 'assistant' ? 'agent' : 'user';
          let content = msg.content || '';
          const isPartial = msg.partial !== false;
          
          // Ignore assistant transcripts after interruption
          if (role === 'agent' && interruptedRef.current) {
            return;
          }
          
          // User speaking = clear interrupted state
          if (role === 'user') {
            interruptedRef.current = false;
          }
          
          // Strip cumulative content from assistant transcripts
          if (role === 'agent' && lastAssistantContentRef.current) {
            if (content.startsWith(lastAssistantContentRef.current)) {
              content = content.slice(lastAssistantContentRef.current.length).trim();
            }
          }
          
          if (content) {
            updateLiveTurn(role, content, isPartial);
          }
        } else if (type === 'turn_complete') {
          setStatus('Listening...');
        } else if (type === 'interrupted') {
          // USER INTERRUPTED! Stop everything immediately
          interruptedRef.current = true;
          stopAudio();
          finalizeLiveTurn('agent', true);
          setStatus('Listening...');
        } else if (type === 'tool_call') {
          addSystemMessage(`🔧 ${msg.content}`);
          addDebugLog('TOOL_CALL', msg.tool || msg.content);
        } else if (type === 'live_update') {
          // Update live views with new data from backend
          addDebugLog('WS_LIVE_UPDATE', 'Received');
          if (msg.data) {
            dispatchBackendLiveUpdate(msg.data as LiveDataSnapshot);
          }
        } else if (type === 'error') {
          setError(msg.content);
          addSystemMessage(`❌ ${msg.content}`);
        }
      } catch (e) {
        console.error('Parse error:', e);
      }
    },
    [addDebugLog, addSystemMessage, finalizeLiveTurn, playAudio, stopAudio, updateLiveTurn, dispatchBackendLiveUpdate]
  );

  // Keep ref updated so WebSocket always uses latest handler
  useEffect(() => {
    handleWsMsgRef.current = handleWsMessage;
  }, [handleWsMessage]);

  // Start live session
  const startLiveSession = useCallback(async () => {
    setError(null);
    setMessages([]);
    interruptedRef.current = false;
    lastAssistantContentRef.current = '';
    setLiveDocumentRequest(null);
    setLiveDocResponseStatus('pending');
    
    resetCase();
    startContextSession();

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      mediaStreamRef.current = stream;

      // Set up audio processing
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      // Connect to WebSocket
      const clientId = `client-${Date.now()}`;
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const wsUrl = backendUrl.replace('http', 'ws');
      const ws = new WebSocket(`${wsUrl}/api/v1/gemini-live/${clientId}`);
      wsRef.current = ws;

      // Use ref so we always call the latest version of the handler
      ws.onmessage = (event) => {
        if (handleWsMsgRef.current) {
          handleWsMsgRef.current(event);
        }
      };
      ws.onerror = () => { 
        setError('Connection failed'); 
        setStatus('Error'); 
      };
      ws.onclose = () => {
        finalizeLiveTurn('agent');
        finalizeLiveTurn('user');
        setIsConnected(false);
        setIsRecording(false);
        setStatus('Disconnected');
        addSystemMessage('--- Session ended ---');
        endContextSession();
      };

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('Connection timeout')), 5000);
        ws.onopen = () => {
          clearTimeout(t);
          setIsConnected(true);
          setStatus('Connected');
          addSystemMessage('Connected');
          resolve();
        };
      });

      // Stream audio to backend
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
      setError(e instanceof Error ? e.message : 'Failed to start');
      setStatus('Error');
    }
  }, [addSystemMessage, finalizeLiveTurn, resetCase, startContextSession, endContextSession]);

  // Stop live session
  const stopLiveSession = useCallback(() => {
    processorRef.current?.disconnect();
    audioContextRef.current?.close();
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    wsRef.current?.close();
    stopAudio();
    interruptedRef.current = false;
    setIsConnected(false);
    setIsRecording(false);
    setStatus('Ready');
    endContextSession();
  }, [stopAudio, endContextSession]);

  // Toggle live session
  const toggleLiveSession = useCallback(() => {
    if (isConnected) {
      stopLiveSession();
    } else {
      startLiveSession();
    }
  }, [isConnected, startLiveSession, stopLiveSession]);

  // ==================== MOCK MODE LOGIC ====================

  // Helper to map document response to evidence status
  const getEvidenceStatus = (response: 'uploaded' | 'dont-have' | 'later' | null | undefined): 'uploaded' | 'pending' | 'not_available' | 'required' => {
    if (response === 'uploaded') return 'uploaded';
    if (response === 'later') return 'pending';
    if (response === 'dont-have') return 'not_available';
    return 'required';
  };
  
  const dispatchLiveUpdate = useCallback((messageIndex: number, message: VoiceMessage) => {
    const baseDelay = 500;
    
    switch (messageIndex) {
      case 0:
        setTimeout(() => setActiveTab('summary'), baseDelay);
        break;
        
      case 1:
        setTimeout(() => {
          updateCaseFact('incidentType', 'Construction Fall');
          updateCaseFact('incidentDescription', 'Fell from a scaffold at a construction site');
        }, baseDelay);
        setTimeout(() => {
          addTimelineEvent({
            id: 'incident-1',
            date: new Date().toISOString().split('T')[0],
            event: 'Workplace Injury Reported',
            description: 'Worker fell from scaffold at construction site',
            category: 'incident',
          });
        }, baseDelay + 800);
        break;
        
      case 3:
        setTimeout(() => {
          updateCaseFact('incidentDate', 'February 20, 2024');
          updateCaseFact('incidentLocation', '5th Avenue - New Office Building Project');
          updateCaseFact('caseType', 'Workplace Injury - Construction');
        }, baseDelay);
        setTimeout(() => {
          updateCaseFact('employerName', 'Construction Site - 5th Avenue');
        }, baseDelay + 600);
        break;
        
      case 4:
        setTimeout(() => setActiveTab('evidence'), baseDelay);
        break;
        
      case 5:
        setTimeout(() => {
          addEvidenceItem({
            id: 'incident_report_0',
            type: 'incident_report',
            description: "Employer's incident/accident report",
            status: 'required',
            priority: 'critical',
          });
        }, baseDelay);
        break;
        
      case 6:
        setTimeout(() => {
          updateEvidenceStatus('incident_report_0', getEvidenceStatus(documentResponses[5]));
          addEvidenceItem({
            id: 'medical_records_er_1',
            type: 'medical_records_er',
            description: 'Emergency room records from day of injury',
            status: 'required',
            priority: 'critical',
          });
        }, baseDelay);
        setTimeout(() => {
          addTimelineEvent({
            id: 'er-visit-1',
            date: '2024-02-20',
            time: '14:30',
            event: 'Emergency Room Visit',
            description: 'Patient transported to ER following scaffold fall',
            category: 'medical',
          });
        }, baseDelay + 800);
        break;
        
      case 7:
        setTimeout(() => {
          updateEvidenceStatus('medical_records_er_1', getEvidenceStatus(documentResponses[6]));
          addEvidenceItem({
            id: 'photos_scene_2',
            type: 'photos_scene',
            description: 'Photos of the accident scene/location',
            status: 'required',
            priority: 'important',
          });
        }, baseDelay);
        break;
        
      case 8:
        setTimeout(() => {
          updateEvidenceStatus('photos_scene_2', getEvidenceStatus(documentResponses[7]));
          addEvidenceItem({
            id: 'photos_injuries_3',
            type: 'photos_injuries',
            description: 'Photos of injuries',
            status: 'required',
            priority: 'important',
          });
        }, baseDelay);
        break;
        
      case 9:
        setTimeout(() => {
          updateEvidenceStatus('photos_injuries_3', getEvidenceStatus(documentResponses[8]));
          addEvidenceItem({
            id: 'witness_statements_4',
            type: 'witness_statements',
            description: 'Written statements from witnesses',
            status: 'required',
            priority: 'important',
          });
        }, baseDelay);
        break;
        
      case 10:
        setTimeout(() => {
          updateEvidenceStatus('witness_statements_4', getEvidenceStatus(documentResponses[9]));
        }, baseDelay);
        break;
        
      case 11:
        setTimeout(() => setActiveTab('medical'), baseDelay);
        setTimeout(() => {
          updateCaseFact('injuries', ['Fractured vertebrae (3)', 'Back trauma', 'Potential nerve damage']);
          updateCaseFact('injurySeverity', 'severe');
        }, baseDelay + 500);
        setTimeout(() => {
          addMedicalRecord({
            id: 'er-record-1',
            date: '2024-02-20',
            provider: 'City General Hospital - ER',
            service: 'Emergency Room Visit',
            diagnosis: 'Multiple vertebral fractures',
            amount: 8500,
          });
        }, baseDelay + 1000);
        setTimeout(() => {
          addMedicalRecord({
            id: 'imaging-1',
            date: '2024-02-20',
            provider: 'City General Hospital - Radiology',
            service: 'Spinal X-Ray & CT Scan',
            diagnosis: 'T11, T12, L1 compression fractures',
            amount: 3200,
          });
        }, baseDelay + 1500);
        break;
        
      case 12:
        setTimeout(() => setActiveTab('damages'), baseDelay);
        setTimeout(() => {
          updateCaseFact('medicalExpenses', 11700);
          updateDamages({
            pastMedical: 11700,
            futureMedical: 85000,
            lostWages: 15000,
            painAndSuffering: 150000,
            settlementLow: 180000,
            settlementHigh: 320000,
          });
        }, baseDelay + 800);
        break;
    }
  }, [updateCaseFact, addEvidenceItem, updateEvidenceStatus, addTimelineEvent, addMedicalRecord, updateDamages, setActiveTab, documentResponses]);

  const playNextMessage = useCallback(async (startIndex: number) => {
    for (let i = startIndex; i < mockConversationWithDocuments.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Convert VoiceMessage to ChatMessage
      const mockMsg = mockConversationWithDocuments[i];
      const chatMsg: ChatMessage = {
        role: mockMsg.role === 'plaintiff' ? 'user' : mockMsg.role,
        content: mockMsg.content,
        timestamp: mockMsg.timestamp,
        toolCall: mockMsg.toolCall,
        documentRequest: mockMsg.documentRequest ? {
          id: mockMsg.documentRequest.type, // Use type as id
          ...mockMsg.documentRequest,
        } : undefined,
      };
      
      setMessages(prev => [...prev, chatMsg]);
      setCurrentMessageIndex(i);
      
      dispatchLiveUpdate(i, mockConversationWithDocuments[i]);

      if (mockConversationWithDocuments[i].documentRequest) {
        setIsPaused(true);
        const docReq = mockConversationWithDocuments[i].documentRequest;
        if (docReq) {
          setPendingDocRequest({
            id: docReq.type,
            description: docReq.description,
            messageIndex: i,
          });
        }
        return;
      }
    }

    setIsSimulating(false);
    setIsListening(false);
    endContextSession();
    setPendingDocRequest(null);
    
    setMessages(prev => [...prev, {
      role: 'agent' as const,
      content: '--- Intake session completed ---',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }]);
  }, [dispatchLiveUpdate, endContextSession]);

  useEffect(() => {
    if (mode === 'mock' && isPaused && documentResponses[currentMessageIndex] !== undefined && documentResponses[currentMessageIndex] !== null) {
      setIsPaused(false);
      setPendingDocRequest(null);
      
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
      }
      
      resumeTimeoutRef.current = setTimeout(() => {
        if (!isStoppedRef.current) {
          playNextMessage(currentMessageIndex + 1);
        }
      }, 1000);
    }
  }, [mode, documentResponses, currentMessageIndex, isPaused, playNextMessage]);

  const simulateConversation = () => {
    isStoppedRef.current = false;
    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = null;
    }
    
    resetCase();
    startContextSession();
    
    setIsSimulating(true);
    setIsListening(true);
    setIsPaused(false);
    setMessages([]);
    setCurrentMessageIndex(0);
    setDocumentResponses({});
    setUploadedFileCounts({});
    setPendingDocRequest(null);
    playNextMessage(0);
  };

  const resumeConversation = () => {
    isStoppedRef.current = false;
    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = null;
    }
    
    setIsSimulating(true);
    setIsListening(true);
    setIsPaused(false);
    playNextMessage(currentMessageIndex + 1);
  };

  const handleToggleListening = () => {
    if (!isListening && !isSimulating) {
      const lastMessage = messages.length > 0 ? messages[messages.length - 1].content : '';
      const hasSessionEnd = lastMessage === '--- Session ended ---' || lastMessage === '--- Intake session completed ---';
      const canResume = currentMessageIndex < mockConversationWithDocuments.length - 1;

      if (hasSessionEnd && canResume) {
        startContextSession();
        
        if (pendingDocRequest) {
          setMessages(prev => [...prev, {
            role: 'agent' as const,
            content: `Welcome back! Last time I was asking for "${pendingDocRequest.description}" but the session ended. Can you provide that document now?`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          }]);
          
          const originalMessage = mockConversationWithDocuments[pendingDocRequest.messageIndex];
          if (originalMessage?.documentRequest) {
            const resumeMsg: ChatMessage = {
              role: originalMessage.role === 'plaintiff' ? 'user' : originalMessage.role,
              content: '',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              toolCall: originalMessage.toolCall,
              documentRequest: {
                id: originalMessage.documentRequest.type,
                ...originalMessage.documentRequest,
              },
            };
            setMessages(prev => [...prev, resumeMsg]);
          }
          
          setIsSimulating(true);
          setIsListening(true);
          setIsPaused(true);
        } else {
          resumeConversation();
        }
      } else if (hasSessionEnd && !canResume) {
        setPendingDocRequest(null);
        simulateConversation();
      } else {
        setPendingDocRequest(null);
        simulateConversation();
      }
    } else {
      // Stop
      isStoppedRef.current = true;
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
        resumeTimeoutRef.current = null;
      }
      
      if (isPaused) {
        const currentMsg = mockConversationWithDocuments[currentMessageIndex];
        if (currentMsg?.documentRequest) {
          setPendingDocRequest({
            id: currentMsg.documentRequest.type,
            description: currentMsg.documentRequest.description,
            messageIndex: currentMessageIndex,
          });
        }
      }
      
      setIsListening(false);
      setIsSimulating(false);
      setIsPaused(false);
      endContextSession();
      
      setMessages(prev => [...prev, {
        role: 'agent' as const,
        content: '--- Session ended ---',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      }]);
    }
  };

  // ==================== DOCUMENT HANDLING ====================

  // Helper to get file type from filename
  const getFileType = (filename: string): LiveUploadedFile['type'] => {
    const lower = filename.toLowerCase();
    if (lower.includes('medical') || lower.includes('hospital') || lower.includes('doctor')) return 'medical';
    if (lower.match(/\.(jpg|jpeg|png|gif)$/)) return 'photo';
    if (lower.includes('insurance')) return 'insurance';
    if (lower.includes('police') || lower.includes('report')) return 'police';
    if (lower.includes('deposition') || lower.includes('testimony')) return 'deposition';
    return 'other';
  };

  // Helper to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const handleDocumentUpload = (messageIndex: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      // Add files to the explorer panel with processing status (live mode)
      if (mode === 'live') {
        Array.from(files).forEach(file => {
          const fileId = addUploadedFile({
            name: file.name,
            size: formatFileSize(file.size),
            type: getFileType(file.name),
            status: 'processing',
          });
          
          // Simulate processing (in real app, this would be backend processing)
          setTimeout(() => {
            updateFileStatus(fileId, 'processed');
          }, 2000 + Math.random() * 2000);
        });
      }
      
      setUploadedFileCounts(prev => ({ 
        ...prev, 
        [messageIndex]: (prev[messageIndex] || 0) + files.length 
      }));
      setDocumentResponses(prev => ({ ...prev, [messageIndex]: 'uploaded' }));
    }
  };

  const handleDontHave = (messageIndex: number) => {
    setDocumentResponses(prev => ({ ...prev, [messageIndex]: 'dont-have' }));
  };

  const handleLater = (messageIndex: number) => {
    setDocumentResponses(prev => ({ ...prev, [messageIndex]: 'later' }));
  };

  // Live mode document handlers
  const handleLiveDocUpload = (files: FileList) => {
    if (liveDocumentRequest && files.length > 0) {
      const fileNames = Array.from(files).map(f => f.name);
      
      // Add files to explorer
      Array.from(files).forEach(file => {
        const fileId = addUploadedFile({
          name: file.name,
          size: formatFileSize(file.size),
          type: getFileType(file.name),
          status: 'processing',
        });
        
        setTimeout(() => {
          updateFileStatus(fileId, 'processed');
        }, 2000 + Math.random() * 2000);
      });
      
      setLiveDocResponseStatus('uploaded');
      
      // CRITICAL: Notify the agent that user ACTUALLY uploaded a document (via card)
      // Use specific phrasing so agent knows to call handle_evidence_response with document_uploaded=True
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const docType = liveDocumentRequest.description || liveDocumentRequest.id;
        const msg = `[DOCUMENT UPLOADED] I have uploaded the ${docType} via the upload card. The file is: ${fileNames.join(', ')}.`;
        addDebugLog('DOC_UPLOAD_MSG', `Sending to agent: "${msg}"`);
        wsRef.current.send(JSON.stringify({ type: 'text', content: msg }));
      }
      
      // Clear document request after sending
      setTimeout(() => {
        setLiveDocumentRequest(null);
        setLiveDocResponseStatus('pending');
      }, 1500);
    }
  };

  const handleLiveDontHave = () => {
    if (liveDocumentRequest) {
      setLiveDocResponseStatus('dont-have');
      
      // CRITICAL: Notify the agent that user doesn't have this document
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const docType = liveDocumentRequest.description || liveDocumentRequest.id;
        const msg = `I don't have the ${docType}. I cannot provide this document.`;
        addDebugLog('DOC_DONTHAVE_MSG', `Sending to agent: "${msg}"`);
        wsRef.current.send(JSON.stringify({ type: 'text', content: msg }));
      }
      
      // Clear after a moment so the next request can be shown
      setTimeout(() => {
        setLiveDocumentRequest(null);
        setLiveDocResponseStatus('pending');
      }, 1500);
    }
  };

  const handleLiveLater = () => {
    if (liveDocumentRequest) {
      setLiveDocResponseStatus('later');
      
      // CRITICAL: Notify the agent that user will provide later
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const docType = liveDocumentRequest.description || liveDocumentRequest.id;
        const msg = `I'll provide the ${docType} later. I don't have it with me right now.`;
        addDebugLog('DOC_LATER_MSG', `Sending to agent: "${msg}"`);
        wsRef.current.send(JSON.stringify({ type: 'text', content: msg }));
      }
      
      // Clear after a moment so the next request can be shown
      setTimeout(() => {
        setLiveDocumentRequest(null);
        setLiveDocResponseStatus('pending');
      }, 1500);
    }
  };

  const handleUploadClick = (messageIndex: number) => {
    fileInputRefs.current[messageIndex]?.click();
  };

  const handleDragEnter = (messageIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(messageIndex);
  };

  const handleDragLeave = (messageIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (messageIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(null);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const acceptableTypes = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.zip'];
      const validFiles: File[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        if (acceptableTypes.includes(fileExtension)) {
          validFiles.push(file);
        }
      }

      if (validFiles.length > 0) {
        // Add files to the explorer panel with processing status (live mode)
        if (mode === 'live') {
          validFiles.forEach(file => {
            const fileId = addUploadedFile({
              name: file.name,
              size: formatFileSize(file.size),
              type: getFileType(file.name),
              status: 'processing',
            });
            
            // Simulate processing
            setTimeout(() => {
              updateFileStatus(fileId, 'processed');
            }, 2000 + Math.random() * 2000);
          });
        }
        
        setUploadedFileCounts(prev => ({ 
          ...prev, 
          [messageIndex]: (prev[messageIndex] || 0) + validFiles.length 
        }));
        setDocumentResponses(prev => ({ ...prev, [messageIndex]: 'uploaded' }));
      }
    }
  };

  // Mode toggle handler
  const handleModeToggle = () => {
    // Stop any active session first
    if (mode === 'mock') {
      if (isListening || isSimulating) {
        isStoppedRef.current = true;
        if (resumeTimeoutRef.current) {
          clearTimeout(resumeTimeoutRef.current);
        }
        setIsListening(false);
        setIsSimulating(false);
        setIsPaused(false);
      }
    } else {
      if (isConnected) {
        stopLiveSession();
      }
    }
    
    const newMode = mode === 'mock' ? 'live' : 'mock';
    setMode(newMode);
    
    // Sync evidence context mode
    setEvidenceMode(newMode);
    
    // Reset state when switching modes
    setMessages([]);
    resetCase();
    resetLiveEvidence(); // Reset live evidence files
    setDocumentResponses({});
    setUploadedFileCounts({});
    setPendingDocRequest(null);
    setLiveDocumentRequest(null);
    setLiveDocResponseStatus('pending');
    setError(null);
    setStatus('Ready');
  };

  // Determine if session is active
  const isSessionActive = mode === 'mock' ? (isListening || isSimulating) : isConnected;

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      {/* Mode Toggle Header */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {mode === 'live' ? (
              isConnected ? (
                <Wifi className="w-4 h-4 text-emerald-600" />
              ) : (
                <WifiOff className="w-4 h-4 text-gray-400" />
              )
            ) : null}
            <span className="text-xs font-medium text-gray-600">
              {mode === 'mock' ? 'Demo Mode' : isConnected ? status : 'Live Mode'}
            </span>
            {mode === 'live' && isRecording && (
              <div className="flex items-center gap-1 text-red-500">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px]">REC</span>
              </div>
            )}
          </div>
          <button
            onClick={handleModeToggle}
            disabled={isSessionActive}
            className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mode === 'mock' ? (
              <>
                <ToggleLeft className="w-4 h-4" />
                <span>Switch to Live</span>
              </>
            ) : (
              <>
                <ToggleRight className="w-4 h-4 text-emerald-600" />
                <span>Switch to Demo</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 flex items-center justify-center mb-4">
              <PhoneForwarded className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Ready to Start</h3>
            <p className="text-xs text-gray-500 max-w-xs">
              Click the microphone below to begin voice intake
            </p>
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <div key={index} className="space-y-2">
                {/* System messages */}
                {message.role === 'system' ? (
                  <div className="flex justify-center my-2">
                    <p className="text-xs text-gray-400 font-medium">{message.content}</p>
                  </div>
                ) : (message.content === '--- Session ended ---' || message.content === '--- Intake session completed ---') ? (
                  <div className="flex justify-center my-4">
                    <p className="text-xs text-gray-400 font-medium">{message.content}</p>
                  </div>
                ) : (
                  <div
                    className={`flex ${message.role === 'agent' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[80%] px-3 py-2 border rounded-lg ${
                        message.role === 'agent'
                          ? `bg-white border-gray-300 ${message.isLive ? 'border-blue-400' : ''}`
                          : 'bg-true-turquoise border-true-turquoise text-white'
                      }`}
                    >
                      {message.isLive && (
                        <div className="flex items-center gap-1 text-[10px] text-blue-500 mb-1">
                          <span className="animate-pulse">●</span>
                          <span>Speaking...</span>
                        </div>
                      )}
                      <p className={`text-xs leading-relaxed ${message.role === 'agent' ? 'text-gray-900' : 'text-white'}`}>
                        {message.content}
                      </p>
                    </div>
                  </div>
                )}

                {/* Document Request Interactive Card (Mock mode only) */}
                {message.documentRequest && (
                  <div className="flex justify-start">
                    <div className="w-full max-w-[85%] border border-gray-200 rounded-lg bg-white overflow-hidden">
                      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                          {message.documentRequest.priority === 'critical' ? 'Required' : message.documentRequest.priority === 'important' ? 'Important' : 'Helpful'}
                        </div>
                        <div className="text-xs text-gray-700">
                          {message.documentRequest.description}
                        </div>
                      </div>

                      {!documentResponses[index] ? (
                        <div className="p-3 space-y-2">
                          <input
                            ref={(el) => { fileInputRefs.current[index] = el; }}
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(e) => handleDocumentUpload(index, e)}
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.zip"
                          />

                          <div
                            onClick={() => handleUploadClick(index)}
                            onDragEnter={(e) => handleDragEnter(index, e)}
                            onDragLeave={(e) => handleDragLeave(index, e)}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(index, e)}
                            className={`w-full border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors ${
                              dragOver === index
                                ? 'border-gray-900 bg-gray-100'
                                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex flex-col items-center gap-1.5 pointer-events-none text-center">
                              <Upload className="w-4 h-4 text-gray-400" />
                              <div className="text-xs font-medium text-gray-700">Upload Documents</div>
                              <div className="text-[10px] text-gray-500">
                                Click to browse or drag & drop
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDontHave(index)}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                            >
                              <X className="w-3 h-3" />
                              I don't have this
                            </button>
                            <button
                              onClick={() => handleLater(index)}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                            >
                              <Clock className="w-3 h-3" />
                              I'll provide later
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3">
                          <div className={`flex items-center gap-2 px-3 py-2 border rounded-md ${
                            documentResponses[index] === 'uploaded'
                              ? 'bg-emerald-50 border-emerald-700'
                              : documentResponses[index] === 'dont-have'
                              ? 'bg-gray-50 border-gray-300'
                              : 'bg-amber-50 border-amber-700'
                          }`}>
                            {documentResponses[index] === 'uploaded' && (
                              <>
                                <Upload className="w-3.5 h-3.5 text-emerald-700" />
                                <span className="text-xs text-emerald-700">
                                  {uploadedFileCounts[index] && uploadedFileCounts[index] > 1 
                                    ? `${uploadedFileCounts[index]} documents uploaded` 
                                    : 'Document uploaded'}
                                </span>
                              </>
                            )}
                            {documentResponses[index] === 'dont-have' && (
                              <>
                                <X className="w-3.5 h-3.5 text-gray-600" />
                                <span className="text-xs text-gray-600">Marked as not available</span>
                              </>
                            )}
                            {documentResponses[index] === 'later' && (
                              <>
                                <Clock className="w-3.5 h-3.5 text-amber-700" />
                                <span className="text-xs text-amber-700">Will provide later</span>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {/* Debug: Current card state */}
            {mode === 'live' && (
              <div className="text-[10px] bg-blue-50 border border-blue-200 rounded px-2 py-1 mx-2">
                Card state: {liveDocumentRequest ? `✅ ${liveDocumentRequest.id}` : '❌ null'}
              </div>
            )}
            {/* Live Mode Document Request Card */}
            {mode === 'live' && liveDocumentRequest && (
              <div className="flex justify-start">
                <div className="w-full max-w-[85%] border border-gray-200 rounded-lg bg-white overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                    <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      {liveDocumentRequest.priority === 'critical' ? 'Required' : liveDocumentRequest.priority === 'important' ? 'Important' : 'Helpful'}
                    </div>
                    <div className="text-xs text-gray-700">
                      {liveDocumentRequest.description}
                    </div>
                  </div>

                  {liveDocResponseStatus === 'pending' ? (
                    <div className="p-3 space-y-2">
                      <input
                        ref={(el) => { fileInputRefs.current[-1] = el; }}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => e.target.files && handleLiveDocUpload(e.target.files)}
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.zip"
                      />

                      <div
                        onClick={() => fileInputRefs.current[-1]?.click()}
                        onDragEnter={(e) => { e.preventDefault(); setDragOver(-1); }}
                        onDragLeave={(e) => { e.preventDefault(); setDragOver(null); }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragOver(null);
                          if (e.dataTransfer.files) handleLiveDocUpload(e.dataTransfer.files);
                        }}
                        className={`w-full border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors ${
                          dragOver === -1
                            ? 'border-gray-900 bg-gray-100'
                            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex flex-col items-center gap-1.5 pointer-events-none text-center">
                          <Upload className="w-4 h-4 text-gray-400" />
                          <div className="text-xs font-medium text-gray-700">Upload Documents</div>
                          <div className="text-[10px] text-gray-500">
                            Click to browse or drag & drop
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={handleLiveDontHave}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                        >
                          <X className="w-3 h-3" />
                          I don't have this
                        </button>
                        <button
                          onClick={handleLiveLater}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                        >
                          <Clock className="w-3 h-3" />
                          I'll provide later
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3">
                      <div className={`flex items-center gap-2 px-3 py-2 border rounded-md ${
                        liveDocResponseStatus === 'uploaded'
                          ? 'bg-emerald-50 border-emerald-700'
                          : liveDocResponseStatus === 'dont-have'
                          ? 'bg-gray-50 border-gray-300'
                          : 'bg-amber-50 border-amber-700'
                      }`}>
                        {liveDocResponseStatus === 'uploaded' && (
                          <>
                            <Upload className="w-3.5 h-3.5 text-emerald-700" />
                            <span className="text-xs text-emerald-700">Document uploaded</span>
                          </>
                        )}
                        {liveDocResponseStatus === 'dont-have' && (
                          <>
                            <X className="w-3.5 h-3.5 text-gray-600" />
                            <span className="text-xs text-gray-600">Marked as not available</span>
                          </>
                        )}
                        {liveDocResponseStatus === 'later' && (
                          <>
                            <Clock className="w-3.5 h-3.5 text-amber-700" />
                            <span className="text-xs text-amber-700">Will provide later</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="mx-4 mb-2 p-2 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {/* Debug Panel */}
      {mode === 'live' && (
        <div className="mx-4 mb-2">
          <button 
            onClick={() => setShowDebug(!showDebug)}
            className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-1"
          >
            {showDebug ? '▼' : '▶'} Debug ({debugLogs.length})
          </button>
          {showDebug && (
            <div className="mt-1 p-2 bg-gray-900 rounded-lg max-h-40 overflow-y-auto font-mono text-[10px]">
              {debugLogs.length === 0 ? (
                <div className="text-gray-500">No logs yet. Start a session to see debug info.</div>
              ) : (
                debugLogs.map((log, i) => (
                  <div key={i} className="text-gray-300 mb-1">
                    <span className="text-gray-500">{log.time}</span>
                    {' '}
                    <span className={`font-bold ${
                      log.type === 'SET_DOC_REQUEST' ? 'text-green-400' :
                      log.type === 'FIRST_REQUIRED' ? 'text-yellow-400' :
                      log.type === 'LIVE_UPDATE' ? 'text-blue-400' :
                      log.type === 'EVIDENCE_ITEMS' ? 'text-purple-400' :
                      'text-gray-400'
                    }`}>[{log.type}]</span>
                    {' '}
                    <span className="text-white whitespace-pre-wrap">{log.data}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Controls - Same UI for both modes */}
      <div className="flex-shrink-0 p-4 border-t border-gray-200">
        <div className="flex flex-col items-center gap-3">
          {/* Microphone Button */}
          <button
            onClick={mode === 'mock' ? handleToggleListening : toggleLiveSession}
            className={`relative w-12 h-12 border-2 rounded-lg flex items-center justify-center transition-all ${
              liveDocumentRequest && mode === 'live'
                ? 'bg-amber-400 border-amber-400'  // Waiting for document input
                : isSessionActive
                  ? 'bg-true-turquoise border-true-turquoise'
                  : 'bg-white border-gray-300 hover:border-gray-400'
            }`}
          >
            {/* Pulse rings when active (not when waiting for document) */}
            {isSessionActive && !liveDocumentRequest && (
              <>
                <div className="absolute inset-0 border-2 border-true-turquoise rounded-lg animate-pulse-ring"></div>
                <div className="absolute inset-0 border-2 border-true-turquoise rounded-lg animate-pulse-ring" style={{ animationDelay: '1s' }}></div>
              </>
            )}

            {/* Icon */}
            {liveDocumentRequest && mode === 'live' ? (
              <Pause className="w-5 h-5 text-white relative z-10" />
            ) : isSessionActive ? (
              <MicOff className="w-5 h-5 text-white relative z-10" />
            ) : (
              <Mic className="w-5 h-5 text-offblack relative z-10" />
            )}
          </button>

          {/* Equalizer when active (not when waiting for document) */}
          {isSessionActive && !liveDocumentRequest && (
            <div className="flex items-center gap-1 h-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-true-turquoise animate-equalizer"
                  style={{
                    animationDelay: `${i * 0.1}s`,
                  }}
                ></div>
              ))}
            </div>
          )}

          {/* Status text */}
          <p className="text-[10px] text-gray-500">
            {liveDocumentRequest && mode === 'live' 
              ? 'Waiting for document' 
              : isSessionActive 
                ? 'Click to end session' 
                : 'Click to begin'}
          </p>
        </div>
      </div>
    </div>
  );
}

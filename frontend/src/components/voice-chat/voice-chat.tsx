'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { mockConversationWithDocuments, type VoiceMessage } from '@/lib/mock-data';
import { Mic, MicOff, Pause, PhoneForwarded, Upload, X, Clock, Wifi, WifiOff, ToggleLeft, ToggleRight, Framer, CloudCheck, PenOff } from 'lucide-react';
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
    service?: string;
    diagnosis?: string;
    icd10?: string;
    amount?: number;
  }>;
  damagesEstimate: {
    pastMedical?: number;
    futureMedical?: number;
    lostWages?: number;
    economicDamages?: number;
    nonEconomicDamages?: number;
    totalEstimate?: number;
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
  icon?: 'tool' | 'success' | 'error'; // Icon type for system messages
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
  const [debugFilter, setDebugFilter] = useState<'all' | 'transcript' | 'decisions' | 'audio'>('all');
  const [debugLogs, setDebugLogs] = useState<{time: string; type: string; data: string}[]>([]);
  const addDebugLog = useCallback((type: string, data: unknown) => {
    const time = new Date().toLocaleTimeString();
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    setDebugLogs(prev => [...prev.slice(-400), { time, type, data: dataStr }]); // Keep last 400
  }, []);
  const copyDebugLogs = () => {
    const text = debugLogs.map(log => `${log.time} [${log.type}] ${log.data}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      alert('Debug logs copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  };
  const filteredDebugLogs = debugFilter === 'all' ? debugLogs : debugLogs.filter(log => {
    if (debugFilter === 'transcript') return ['TRANSCRIPT', 'TRANSCRIPT_DROP', 'TRANSCRIPT_EMPTY', 'CUMUL_STRIP', 'MERGE', 'TURN_NEW', 'TURN_DROP', 'FINALIZE', 'REF_UPDATE'].includes(log.type);
    if (debugFilter === 'decisions') return ['MERGE', 'TURN_DROP', 'TURN_NEW', 'CUMUL_STRIP', 'TRANSCRIPT_DROP', 'TRANSCRIPT_EMPTY', 'FINALIZE', 'REF_UPDATE', 'AUDIO_CLEAR'].includes(log.type);
    if (debugFilter === 'audio') return ['AUDIO_GATE', 'AUDIO_CLEAR', 'DOC_PROCESSING', 'DOC_PROCESSING_DONE', 'DOC_PROCESSING_HOLD', 'TURN_COMPLETE', 'INTERRUPTED'].includes(log.type);
    return true;
  });
  
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
  const userTurnCountRef = useRef(0);  // Tracks user turns for filtering stale responses
  const lastAcceptedTurnRef = useRef(-1);  // Which turn we're accepting responses for
  const waitingForDocRef = useRef(false);  // True when document card is showing - pauses audio
  const processingDocRef = useRef(false);  // True after doc upload - pauses audio while agent processes
  const lastAudioGateReasonRef = useRef('');
  const lastAudioGateLogAtRef = useRef(0);
  
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
    uploadedFiles,
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

  // Sync waitingForDocRef with liveDocumentRequest state
  useEffect(() => {
    waitingForDocRef.current = liveDocumentRequest !== null;
    addDebugLog('AUDIO_GATE', liveDocumentRequest ? 'Mic paused: waiting for document input card' : 'Document card cleared');
  }, [liveDocumentRequest, addDebugLog]);

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

  const getCommonPrefixLength = useCallback((a: string, b: string) => {
    const max = Math.min(a.length, b.length);
    let i = 0;
    while (i < max && a[i] === b[i]) i += 1;
    return i;
  }, []);

  // Dedup Gemini self-duplication in final transcripts (safety net — backend also deduplicates)
  // Handles two patterns:
  //   Pattern 1: "Hello world. Hello world." → simple prefix duplication
  //   Pattern 2: "...wrist fracture. Is that correct? Thank you...wrist fracture. Is that correct?"
  //              → partial text prepended to the full corrected version (suffix overlap)
  const dedupTranscript = useCallback((text: string): string => {
    if (text.length < 80) return text;

    // Strategy 1: Simple prefix duplication — first ~40 chars reappear later
    const prefixLen = Math.min(40, Math.floor(text.length / 3));
    const prefix = text.slice(0, prefixLen);
    const secondStart = text.indexOf(prefix, prefixLen);
    if (secondStart > 0) {
      const secondPartLen = text.length - secondStart;
      if (secondPartLen >= secondStart * 0.6) {
        return text.slice(secondStart).trim();
      }
    }

    // Strategy 2: Suffix-overlap — the partial text at the start is a SUFFIX of the full
    // corrected text that follows. Split at sentence boundaries and check.
    // Example: "...Is that correct? Thank you for uploading...Is that correct?"
    const boundaryRegex = /[.!?]\s+/g;
    let match;
    while ((match = boundaryRegex.exec(text)) !== null) {
      const boundary = match.index + match[0].length;
      if (boundary < 30 || boundary > text.length * 0.6) continue;
      const firstPart = text.slice(0, boundary).trim();
      const secondPart = text.slice(boundary).trim();
      if (secondPart.length > firstPart.length && secondPart.endsWith(firstPart)) {
        return secondPart;
      }
    }

    return text;
  }, []);

  // Update turn with streaming content
  const updateLiveTurn = useCallback((role: 'user' | 'agent', content: string, isPartial: boolean) => {
    if (!content.trim()) return;
    
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    // Collect log info outside setMessages to avoid double-logging in React strict mode
    // (React strict mode runs updater functions twice; logging inside would duplicate every entry)
    const pendingLogs: { type: string; data: string }[] = [];
    
    setMessages((prev) => {
      pendingLogs.length = 0; // Reset each invocation (strict mode may call updater twice)
      
      // Find live turn for this role
      const liveTurnIndex = prev.findIndex((t) => t.role === role && t.isLive);
      
      if (liveTurnIndex !== -1) {
        const existing = prev[liveTurnIndex].content;
        let newContent = content.trim();
        let mergeAction = 'replace'; // track which merge branch was taken
        
        // Dedup final transcripts before merge (Gemini self-duplication)
        if (!isPartial && role === 'agent') {
          const deduped = dedupTranscript(newContent);
          if (deduped !== newContent) {
            mergeAction = `dedup(${newContent.length}→${deduped.length})`;
            newContent = deduped;
          }
        }
        
        if (isPartial) {
          const trimmedExisting = existing.trim();
          const trimmedIncoming = content.trim();
          const commonPrefixLength = getCommonPrefixLength(trimmedExisting, trimmedIncoming);
          
          if (trimmedIncoming.startsWith(trimmedExisting)) {
            // Backend sometimes sends cumulative partials.
            newContent = trimmedIncoming;
            mergeAction = 'cumulative_extend';
          } else if (trimmedExisting.startsWith(trimmedIncoming)) {
            // Older/smaller partial after a larger one: keep the larger content.
            newContent = trimmedExisting;
            mergeAction = 'keep_existing(shorter_incoming)';
          } else if (
            role === 'agent' &&
            commonPrefixLength >= 24 &&
            trimmedIncoming.length >= Math.max(20, Math.floor(trimmedExisting.length * 0.6))
          ) {
            // Gemini partials sometimes revise earlier words mid-sentence.
            // When the new chunk clearly shares the same long prefix, treat it as
            // a corrected snapshot of the same response rather than appending it.
            newContent = trimmedIncoming.length >= trimmedExisting.length
              ? trimmedIncoming
              : trimmedExisting;
            mergeAction = `revised_snapshot(prefix=${commonPrefixLength},kept=${newContent === trimmedIncoming ? 'incoming' : 'existing'})`;
          } else if (trimmedExisting.includes(trimmedIncoming) && trimmedIncoming.length < 40) {
            // Ignore tiny repeated fragments like "for uploading".
            newContent = trimmedExisting;
            mergeAction = `keep_existing(tiny_repeat:${trimmedIncoming.length}ch)`;
          } else {
            newContent = `${trimmedExisting} ${trimmedIncoming}`.trim();
            mergeAction = 'append';
          }
        }
        
        pendingLogs.push({ type: 'MERGE', data: `${role} liveTurn[${liveTurnIndex}] ${mergeAction}: existing=${existing.length}ch→new=${newContent.length}ch "${newContent.slice(-80)}"` });
        
        return prev.map((t, i) =>
          i === liveTurnIndex ? { ...t, content: newContent, isLive: isPartial } : t
        );
      }

      if (role === 'agent' && isPartial) {
        const lastAgentTurn = [...prev].reverse().find((t) => t.role === 'agent');
        const trimmedIncoming = content.trim();
        const startsLikeFragment = /^[a-z,.;:!?'" )\]]/.test(trimmedIncoming);
        const isTinyFragment = trimmedIncoming.length < 40;
        const alreadyCovered = !!lastAgentTurn && (
          lastAgentTurn.content.includes(trimmedIncoming) ||
          trimmedIncoming.includes(lastAgentTurn.content)
        );
        
        // Drop stray post-response tail fragments that should not become standalone messages.
        if ((startsLikeFragment && isTinyFragment) || alreadyCovered) {
          pendingLogs.push({ type: 'TURN_DROP', data: `Dropped agent partial: fragment=${startsLikeFragment} tiny=${isTinyFragment} covered=${alreadyCovered} "${trimmedIncoming.slice(0, 100)}"` });
          return prev;
        }
      }

      if (role === 'agent' && !isPartial) {
        // Dedup final content before comparing
        const deduped = dedupTranscript(content.trim());
        const lastAgentTurn = [...prev].reverse().find((t) => t.role === 'agent');
        if (lastAgentTurn && lastAgentTurn.content.trim() === deduped) {
          pendingLogs.push({ type: 'TURN_DROP', data: `Dropped agent final (exact dup of last turn): "${deduped.slice(0, 100)}"` });
          return prev;
        }
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

      // Create new turn (dedup if final)
      const finalContent = (!isPartial && role === 'agent') ? dedupTranscript(content.trim()) : content.trim();
      const newTurn: ChatMessage = {
        role,
        content: finalContent,
        timestamp,
        isLive: isPartial,
      };

      pendingLogs.push({ type: 'TURN_NEW', data: `${role} ${isPartial ? 'partial' : 'final'} (${finalContent.length}ch): "${finalContent.slice(0, 150)}"` });

      return [...updated, newTurn];
    });
    
    // Log AFTER setMessages to avoid double-logging in React strict mode
    pendingLogs.forEach(log => addDebugLog(log.type, log.data));
  }, [getCommonPrefixLength, addDebugLog, dedupTranscript]);

  // Finalize live turn
  const finalizeLiveTurn = useCallback((role: 'user' | 'agent', captureContent = false) => {
    let pendingLogs: { type: string; data: string }[] = [];
    
    setMessages((prev) => {
      pendingLogs = []; // Reset (strict mode may call twice)
      
      const lastIndex = prev.findIndex((t) => t.role === role && t.isLive);
      if (lastIndex === -1) return prev;
      
      const finalContent = prev[lastIndex].content;
      pendingLogs.push({ type: 'FINALIZE', data: `${role} turn[${lastIndex}] (${finalContent.length}ch): "${finalContent.slice(0, 200)}${finalContent.length > 200 ? '…' : ''}"` });
      
      if (role === 'agent' && captureContent) {
        const allAssistantContent = prev
          .filter(t => t.role === 'agent')
          .map(t => t.content)
          .join('');
        lastAssistantContentRef.current = allAssistantContent;
        pendingLogs.push({ type: 'REF_UPDATE', data: `lastAssistantContentRef now ${allAssistantContent.length}ch` });
      }
      
      return prev.map((t, i) =>
        i === lastIndex ? { ...t, isLive: false } : t
      );
    });
    
    // Log AFTER setMessages to avoid double-logging in React strict mode
    pendingLogs.forEach(log => addDebugLog(log.type, log.data));
  }, [addDebugLog]);

  // Add system message
  const addSystemMessage = useCallback((content: string, icon?: 'tool' | 'success' | 'error') => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setMessages((prev) => [
      ...prev,
      { role: 'system', content, timestamp, isLive: false, icon },
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
    
    // Update timeline - auto-switch on first significant timeline event
    if (data.timelineEvents && data.timelineEvents.length > 0) {
      const isFirstTimeline = data.timelineEvents.length >= 2; // Switch when we have multiple events
      data.timelineEvents.forEach((event, idx) => {
        // Map backend category to frontend type
        const categoryMap: Record<string, 'incident' | 'medical' | 'legal' | 'insurance'> = {
          'incident': 'incident',
          'medical': 'medical',
          'legal': 'legal',
          'evidence': 'legal', // Map evidence to legal for now
          'insurance': 'insurance',
        };
        // Auto-switch on last event if this is significant
        addTimelineEvent({
          id: event.id,
          date: event.date,
          event: event.event,
          description: event.description || '',
          category: categoryMap[event.category] || 'incident',
        }, isFirstTimeline && idx === data.timelineEvents!.length - 1);
      });
    }
    
    // Update medical records - auto-switch when we have significant medical data
    if (data.medicalRecords && data.medicalRecords.length > 0) {
      const isSignificantMedical = data.medicalRecords.length >= 2; // Switch when we have multiple records
      data.medicalRecords.forEach((record, idx) => {
        addMedicalRecord({
          id: record.id,
          date: record.date,
          provider: record.provider,
          service: record.service || record.diagnosis,
          diagnosis: record.diagnosis,
          icd10: record.icd10,
          amount: record.amount || 0,
        }, isSignificantMedical && idx === data.medicalRecords!.length - 1);
      });
    }
    
    // Update damages - auto-switch to damages tab when calculated (significant event)
    if (data.damagesEstimate && Object.keys(data.damagesEstimate).length > 0) {
      const hasSignificantDamages = !!(data.damagesEstimate.settlementLow || data.damagesEstimate.totalEstimate);
      updateDamages({
        pastMedical: data.damagesEstimate.pastMedical,
        futureMedical: data.damagesEstimate.futureMedical,
        lostWages: data.damagesEstimate.lostWages,
        economicDamages: data.damagesEstimate.economicDamages,
        nonEconomicDamages: data.damagesEstimate.nonEconomicDamages,
        totalEstimate: data.damagesEstimate.totalEstimate,
        settlementLow: data.damagesEstimate.settlementLow,
        settlementHigh: data.damagesEstimate.settlementHigh,
      }, hasSignificantDamages); // Only auto-switch if we have actual settlement values
    }
  }, [mode, updateCaseFact, addEvidenceItem, updateEvidenceStatus, addTimelineEvent, addMedicalRecord, updateDamages, evidenceItems]);

  // Handle WebSocket messages
  const handleWsMessage = useCallback(
    (event: MessageEvent) => {
      if (event.data instanceof Blob) {
        // Audio data - don't queue if interrupted
        if (interruptedRef.current) return;
        event.data.arrayBuffer().then((buf) => {
          // Double-check interruption state (may have changed during async)
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
          const rawContent = msg.content || '';
          let content = rawContent;
          const isPartial = msg.partial !== false;
          // Show full content (up to 300 chars) plus total length so truncation is visible
          const displayContent = rawContent.length > 300 ? rawContent.slice(0, 300) + '…' : rawContent;
          addDebugLog('TRANSCRIPT', `${role}:${isPartial ? 'partial' : 'final'} (${rawContent.length}ch): ${displayContent}`);
          
          // Ignore assistant transcripts after interruption
          if (role === 'agent' && interruptedRef.current) {
            addDebugLog('TRANSCRIPT_DROP', `Dropped (interrupted): ${rawContent.slice(0, 120)}`);
            return;
          }
          
          // User speaking = new turn, clear interrupted state and increment turn
          if (role === 'user') {
            if (!isPartial) {
              // User finished speaking - this is a new turn
              userTurnCountRef.current += 1;
              lastAcceptedTurnRef.current = userTurnCountRef.current;
            }
            interruptedRef.current = false;
            // Clear the audio queue - we don't want old audio playing
            audioQueueRef.current = [];
          }
          
          // When a new agent response starts (not partial continuation), clear old audio
          if (role === 'agent' && !isPartial && !content.startsWith(lastAssistantContentRef.current)) {
            // This is a NEW response, not a continuation - ensure old audio is cleared
            addDebugLog('AUDIO_CLEAR', `New non-partial agent response, clearing audio queue (${audioQueueRef.current.length} chunks)`);
            audioQueueRef.current = [];
          }
          
          // Strip cumulative content from assistant transcripts
          if (role === 'agent' && lastAssistantContentRef.current) {
            if (content.startsWith(lastAssistantContentRef.current)) {
              const stripped = content.slice(lastAssistantContentRef.current.length).trim();
              addDebugLog('CUMUL_STRIP', `Stripped ${lastAssistantContentRef.current.length}ch prefix → remaining ${stripped.length}ch: "${stripped.slice(0, 150)}"`);
              content = stripped;
            }
          }
          
          if (content) {
            updateLiveTurn(role, content, isPartial);
          } else {
            addDebugLog('TRANSCRIPT_EMPTY', `Content empty after stripping (raw=${rawContent.length}ch, ref=${lastAssistantContentRef.current.length}ch)`);
          }
        } else if (type === 'turn_complete') {
          setStatus('Listening...');
          addDebugLog('TURN_COMPLETE', `processing=${processingDocRef.current} waiting=${waitingForDocRef.current} audioQ=${audioQueueRef.current.length} playing=${isPlayingRef.current} interrupted=${interruptedRef.current}`);
          // CRITICAL: Clear interrupted state on turn_complete.
          // The turn is done — any subsequent agent speech is for a NEW turn and must be accepted.
          // Without this, "don't have" / "later" button clicks (which send text, not speech)
          // would leave interruptedRef=true forever since no user transcript arrives to clear it.
          if (interruptedRef.current) {
            interruptedRef.current = false;
            addDebugLog('INTERRUPT_CLEAR', 'Cleared interrupted state on turn_complete');
          }
          finalizeLiveTurn('agent', true);
          finalizeLiveTurn('user');
          // Resume audio after a brief grace period (prevents false interrupts from ambient noise)
          if (processingDocRef.current) {
            setTimeout(() => {
              if (!waitingForDocRef.current) {
                processingDocRef.current = false;
                addDebugLog('DOC_PROCESSING_DONE', 'Mic resumed after assistant finished turn');
              } else {
                addDebugLog('DOC_PROCESSING_HOLD', 'Mic remains paused because a document card is active');
              }
            }, 2500); // Hold a bit longer so Lexie audio cannot trip a false interrupt
          }
        } else if (type === 'interrupted') {
          // USER INTERRUPTED! Stop everything immediately
          interruptedRef.current = true;
          addDebugLog('INTERRUPTED', 'Received interrupt from backend');
          // Clear audio queue to prevent stale audio from playing
          audioQueueRef.current = [];
          stopAudio();
          finalizeLiveTurn('agent', true);
          setStatus('Listening...');
        } else if (type === 'tool_call') {
          // Dedupe tool calls - don't show same tool twice in quick succession
          const toolName = msg.tool || 'unknown';
          const now = Date.now();
          const recentKey = `tool_${toolName}`;
          const lastCall = (window as unknown as Record<string, number>)[recentKey] || 0;
          
          // Skip if same tool called within 1 second
          if (now - lastCall < 1000) {
            addDebugLog('TOOL_CALL_SKIP', `Skipped duplicate: ${toolName}`);
          } else {
            (window as unknown as Record<string, number>)[recentKey] = now;
            addSystemMessage(msg.content, 'tool');
            addDebugLog('TOOL_CALL', toolName);
          }
        } else if (type === 'extraction_complete') {
          // Document extraction completed - show results
          const fileName = msg.file_name || 'document';
          const fileId = msg.file_id;
          const timeMs = msg.extraction_time_ms || 0;
          const facts = msg.facts || {};
          
          addDebugLog('EXTRACTION', `${fileName} extracted in ${timeMs}ms`);
          addSystemMessage(`Extracted facts from ${fileName} (${(timeMs/1000).toFixed(1)}s)`, 'success');
          
          // Show key extracted facts
          const keyFacts = ['plaintiff_name', 'patient_name', 'incident_date', 'total_amount', 'diagnoses'];
          for (const key of keyFacts) {
            if (facts[key]) {
              const value = Array.isArray(facts[key]) ? facts[key].slice(0, 2).join(', ') : facts[key];
              addDebugLog('FACT', `${key}: ${value}`);
            }
          }
          
          // Update file status to processed - try file_id first, then fall back to name
          if (fileId) {
            updateFileStatus(fileId, 'processed');
            addDebugLog('FILE_STATUS', `Updated ${fileId} to processed`);
          } else if (msg.file_name) {
            // Fall back to finding by name
            const matchingFile = uploadedFiles.find(f => f.name === msg.file_name);
            if (matchingFile) {
              updateFileStatus(matchingFile.id, 'processed');
              addDebugLog('FILE_STATUS', `Updated ${matchingFile.id} (by name) to processed`);
            }
          }
        } else if (type === 'live_update') {
          // Update live views with new data from backend
          addDebugLog('WS_LIVE_UPDATE', 'Received');
          if (msg.data) {
            dispatchBackendLiveUpdate(msg.data as LiveDataSnapshot);
          }
        } else if (type === 'error') {
          setError(msg.content);
          addSystemMessage(msg.content, 'error');
        }
      } catch (e) {
        console.error('Parse error:', e);
      }
    },
    [addDebugLog, addSystemMessage, finalizeLiveTurn, playAudio, stopAudio, updateLiveTurn, dispatchBackendLiveUpdate, uploadedFiles, updateFileStatus]
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
    userTurnCountRef.current = 0;
    lastAcceptedTurnRef.current = -1;
    audioQueueRef.current = [];
    processingDocRef.current = false;
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

      // Stream audio to backend — send SILENCE when mic is gated to keep
      // Gemini's audio pipeline active (critical for proper turn management).
      // Without continuous audio, Gemini can't transition from "speaking" to
      // "listening" mode, requiring the user to speak twice.
      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        // When waiting for document input or processing a document,
        // send SILENCE instead of mic audio. This prevents the agent's
        // speaker audio from being picked up while keeping Gemini's
        // turn management active.
        if (waitingForDocRef.current || processingDocRef.current) {
          const reason = waitingForDocRef.current
            ? 'waiting_for_document'
            : 'processing_document_or_assistant_response';
          const now = Date.now();
          if (lastAudioGateReasonRef.current !== reason || now - lastAudioGateLogAtRef.current > 3000) {
            addDebugLog('AUDIO_GATE', `Mic blocked: ${reason} (sending silence)`);
            lastAudioGateReasonRef.current = reason;
            lastAudioGateLogAtRef.current = now;
          }
          // Send silence (all zeros) to keep Gemini's audio stream continuous
          const silence = new Int16Array(e.inputBuffer.length);
          ws.send(silence.buffer);
          return;
        }
        lastAudioGateReasonRef.current = '';
        
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
  }, [addDebugLog, addSystemMessage, finalizeLiveTurn, resetCase, startContextSession, endContextSession]);

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
  const handleLiveDocUpload = async (files: FileList) => {
    if (liveDocumentRequest && files.length > 0) {
      const fileNames: string[] = [];
      const fileIds: string[] = [];
      
      // Add files to explorer and track IDs
      const filesToProcess: { file: File; fileId: string }[] = [];
      
      Array.from(files).forEach(file => {
        fileNames.push(file.name);
        // Create object URL for viewing the file
        const fileUrl = URL.createObjectURL(file);
        const fileId = addUploadedFile({
          name: file.name,
          size: formatFileSize(file.size),
          type: getFileType(file.name),
          status: 'processing',
          url: fileUrl,
        });
        fileIds.push(fileId);
        filesToProcess.push({ file, fileId });
      });
      
      setLiveDocResponseStatus('uploaded');
      
      // PAUSE audio input while document is being processed and until the assistant finishes responding
      processingDocRef.current = true;
      addDebugLog('DOC_PROCESSING', 'Mic paused while agent processes document and prepares response');
      
      // Send document with actual file content for INSTANT extraction
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const docType = liveDocumentRequest.id || 'document';
        const docDescription = liveDocumentRequest.description || docType;
        
        // Process ALL files - send each one for instant extraction
        for (let i = 0; i < filesToProcess.length; i++) {
          const fileItem = filesToProcess[i];
          try {
            const arrayBuffer = await fileItem.file.arrayBuffer();
            const base64 = btoa(
              new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
            );
            
            // Send document upload message with file content
            const uploadMsg = {
              type: 'document_upload',
              doc_type: docType,
              description: docDescription,
              file_name: fileItem.file.name,
              file_id: fileItem.fileId,
              file_ids: fileIds,
              content_base64: base64,
              mime_type: fileItem.file.type || 'application/octet-stream',
              is_batch: filesToProcess.length > 1,
              batch_index: i,
              batch_total: filesToProcess.length,
            };
            
            addDebugLog('DOC_UPLOAD', `Sending ${fileItem.file.name} (${i+1}/${filesToProcess.length}, ${(base64.length / 1024).toFixed(1)}KB)`);
            wsRef.current.send(JSON.stringify(uploadMsg));
            
            // Small delay between files to avoid overwhelming backend
            if (i < filesToProcess.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          } catch (e) {
            addDebugLog('DOC_UPLOAD_ERROR', `Failed to process ${fileItem.file.name}: ${e}`);
            updateFileStatus(fileItem.fileId, 'error', 'Failed to process file');
          }
        }
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
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                      {message.icon === 'tool' && <Framer className="w-3.5 h-3.5" />}
                      {message.icon === 'success' && <CloudCheck className="w-3.5 h-3.5" />}
                      {message.icon === 'error' && <PenOff className="w-3.5 h-3.5" />}
                      <span>{message.content}</span>
                    </div>
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
                          ? 'bg-white border-gray-300'
                          : 'bg-true-turquoise border-true-turquoise text-white'
                      }`}
                    >
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
          <div className="flex items-center gap-2 flex-wrap">
            <button 
              onClick={() => setShowDebug(!showDebug)}
              className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-1"
            >
              {showDebug ? '▼' : '▶'} Debug ({debugLogs.length})
            </button>
            {showDebug && (
              <>
                {debugLogs.length > 0 && (
                  <button
                    onClick={copyDebugLogs}
                    className="text-[10px] px-2 py-0.5 bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white rounded transition-colors"
                  >
                    📋 Copy All
                  </button>
                )}
                {(['all', 'transcript', 'decisions', 'audio'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setDebugFilter(f)}
                    className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                      debugFilter === f
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-gray-200'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </>
            )}
          </div>
          {showDebug && (
            <div className="mt-1 p-2 bg-gray-900 rounded-lg max-h-96 overflow-y-auto font-mono text-[10px]">
              {filteredDebugLogs.length === 0 ? (
                <div className="text-gray-500">No logs yet. Start a session to see debug info.</div>
              ) : (
                filteredDebugLogs.map((log, i) => (
                  <div key={i} className={`mb-0.5 ${
                    log.type.includes('DROP') || log.type.includes('EMPTY') ? 'bg-red-950/30' :
                    log.type === 'FINALIZE' || log.type === 'REF_UPDATE' ? 'bg-yellow-950/20' :
                    ''
                  }`}>
                    <span className="text-gray-500">{log.time}</span>
                    {' '}
                    <span className={`font-bold ${
                      log.type === 'TRANSCRIPT' ? 'text-cyan-400' :
                      log.type === 'MERGE' ? 'text-teal-400' :
                      log.type === 'TURN_NEW' ? 'text-green-400' :
                      log.type === 'FINALIZE' ? 'text-yellow-400' :
                      log.type === 'REF_UPDATE' ? 'text-amber-400' :
                      log.type === 'CUMUL_STRIP' ? 'text-orange-300' :
                      log.type === 'TURN_DROP' || log.type === 'TRANSCRIPT_DROP' || log.type === 'TRANSCRIPT_EMPTY' ? 'text-red-400' :
                      log.type === 'AUDIO_GATE' || log.type === 'AUDIO_CLEAR' ? 'text-pink-400' :
                      log.type === 'TURN_COMPLETE' ? 'text-indigo-400' :
                      log.type === 'SET_DOC_REQUEST' ? 'text-green-400' :
                      log.type === 'FIRST_REQUIRED' ? 'text-yellow-400' :
                      log.type === 'LIVE_UPDATE' ? 'text-blue-400' :
                      log.type === 'EVIDENCE_ITEMS' ? 'text-purple-400' :
                      log.type.includes('ERROR') ? 'text-red-400' :
                      log.type.includes('DOC') ? 'text-orange-400' :
                      'text-gray-400'
                    }`}>[{log.type}]</span>
                    {' '}
                    <span className="text-white whitespace-pre-wrap break-all">{log.data}</span>
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

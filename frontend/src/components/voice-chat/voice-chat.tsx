'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { mockConversationWithDocuments, type VoiceMessage } from '@/lib/mock-data';
import { Mic, MicOff, PhoneForwarded, Upload, X, Clock } from 'lucide-react';
import { useLiveCase } from '@/contexts/live-case-context';

export default function VoiceChat() {
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [documentResponses, setDocumentResponses] = useState<Record<number, 'uploaded' | 'dont-have' | 'later' | null>>({});
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const resumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isStoppedRef = useRef(false);
  
  const { 
    startSession, 
    resetCase,
    updateCaseFact,
    addEvidenceItem,
    updateEvidenceStatus,
    addTimelineEvent,
    addMedicalRecord,
    updateDamages,
    setActiveTab,
  } = useLiveCase();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
      }
    };
  }, []);

  // Helper to map document response to evidence status
  const getEvidenceStatus = (response: 'uploaded' | 'dont-have' | 'later' | null | undefined): 'uploaded' | 'pending' | 'not_available' | 'required' => {
    if (response === 'uploaded') return 'uploaded';
    if (response === 'later') return 'pending';
    if (response === 'dont-have') return 'not_available';
    return 'required';
  };

  // Dispatch live data updates based on message index
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
      setMessages(prev => [...prev, mockConversationWithDocuments[i]]);
      setCurrentMessageIndex(i);
      
      dispatchLiveUpdate(i, mockConversationWithDocuments[i]);

      if (mockConversationWithDocuments[i].documentRequest) {
        setIsPaused(true);
        return;
      }
    }

    // Conversation completed naturally - data stays visible
    setIsSimulating(false);
    setIsListening(false);
    
    // Add completion message
    setMessages(prev => [...prev, {
      role: 'agent' as const,
      content: '--- Intake session completed ---',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }]);
  }, [dispatchLiveUpdate]);

  useEffect(() => {
    if (isPaused && documentResponses[currentMessageIndex] !== undefined && documentResponses[currentMessageIndex] !== null) {
      setIsPaused(false);
      
      // Clear any existing timeout
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
      }
      
      // Schedule next message, but check if stopped before executing
      resumeTimeoutRef.current = setTimeout(() => {
        if (!isStoppedRef.current) {
          playNextMessage(currentMessageIndex + 1);
        }
      }, 1000);
    }
  }, [documentResponses, currentMessageIndex, isPaused, playNextMessage]);

  const simulateConversation = () => {
    // Clear stopped flag and any pending timeout
    isStoppedRef.current = false;
    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = null;
    }
    
    resetCase();
    startSession();
    
    setIsSimulating(true);
    setIsListening(true);
    setIsPaused(false);
    setMessages([]);
    setCurrentMessageIndex(0);
    setDocumentResponses({});
    playNextMessage(0);
  };

  const resumeConversation = () => {
    // Clear stopped flag and any pending timeout
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
        // Resume from where we left off
        startSession();
        resumeConversation();
      } else if (hasSessionEnd && !canResume) {
        // Start a new conversation (previous one completed)
        simulateConversation();
      } else {
        // Start fresh
        simulateConversation();
      }
    } else {
      // User clicked stop - set stopped flag and clear pending timeout
      isStoppedRef.current = true;
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
        resumeTimeoutRef.current = null;
      }
      
      setIsListening(false);
      setIsSimulating(false);
      setIsPaused(false);
      
      setMessages(prev => [...prev, {
        role: 'agent' as const,
        content: '--- Session ended ---',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      }]);
    }
  };

  const handleDocumentUpload = (messageIndex: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setDocumentResponses(prev => ({ ...prev, [messageIndex]: 'uploaded' }));
    }
  };

  const handleDontHave = (messageIndex: number) => {
    setDocumentResponses(prev => ({ ...prev, [messageIndex]: 'dont-have' }));
  };

  const handleLater = (messageIndex: number) => {
    setDocumentResponses(prev => ({ ...prev, [messageIndex]: 'later' }));
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
      const file = files[0];
      const acceptableTypes = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.zip'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

      if (acceptableTypes.includes(fileExtension)) {
        setDocumentResponses(prev => ({ ...prev, [messageIndex]: 'uploaded' }));
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
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
                {/* Message Bubble */}
                {message.content === '--- Session ended ---' ? (
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

                {/* Document Request Interactive Card */}
                {message.documentRequest && (
                  <div className="flex justify-start">
                    <div className="w-full max-w-[85%] border border-gray-200 rounded-lg bg-white overflow-hidden">
                      {/* Header */}
                      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                          {message.documentRequest.priority === 'critical' ? 'Required' : message.documentRequest.priority === 'important' ? 'Important' : 'Helpful'}
                        </div>
                        <div className="text-xs text-gray-700">
                          {message.documentRequest.description}
                        </div>
                      </div>

                      {/* Response UI */}
                      {!documentResponses[index] ? (
                        <div className="p-3 space-y-2">
                          {/* Hidden file input */}
                          <input
                            ref={(el) => { fileInputRefs.current[index] = el; }}
                            type="file"
                            className="hidden"
                            onChange={(e) => handleDocumentUpload(index, e)}
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.zip"
                          />

                          {/* Upload Zone */}
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
                            <div className="flex flex-col items-center gap-1.5 pointer-events-none">
                              <Upload className="w-4 h-4 text-gray-400" />
                              <div className="text-xs font-medium text-gray-700">Upload Document</div>
                              <div className="text-[10px] text-gray-500">Click to browse or drag & drop</div>
                            </div>
                          </div>

                          {/* Action Buttons */}
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
                                <span className="text-xs text-emerald-700">Document uploaded</span>
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
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Voice Control */}
      <div className="flex-shrink-0 p-4 border-t border-gray-200">
        <div className="flex flex-col items-center gap-3">
          {/* Microphone Button */}
          <button
            onClick={handleToggleListening}
            className={`relative w-12 h-12 border-2 rounded-lg flex items-center justify-center transition-all ${
              isListening
                ? 'bg-true-turquoise border-true-turquoise'
                : 'bg-white border-gray-300 hover:border-gray-400'
            }`}
          >
            {/* Pulse rings when listening */}
            {isListening && (
              <>
                <div className="absolute inset-0 border-2 border-true-turquoise rounded-lg animate-pulse-ring"></div>
                <div className="absolute inset-0 border-2 border-true-turquoise rounded-lg animate-pulse-ring" style={{ animationDelay: '1s' }}></div>
              </>
            )}

            {/* Icon */}
            {isListening ? (
              <MicOff className="w-5 h-5 text-white relative z-10" />
            ) : (
              <Mic className="w-5 h-5 text-offblack relative z-10" />
            )}
          </button>

          {/* Equalizer when listening */}
          {isListening && (
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
        </div>
      </div>
    </div>
  );
}

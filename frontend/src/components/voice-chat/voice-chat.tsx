'use client';

import { useState, useEffect, useRef } from 'react';
import { mockConversationWithDocuments, type VoiceMessage } from '@/lib/mock-data';
import { Mic, MicOff, Phone, Upload, X, Clock } from 'lucide-react';

export default function VoiceChat() {
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [documentResponses, setDocumentResponses] = useState<Record<number, 'uploaded' | 'dont-have' | 'later' | null>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const simulateConversation = async () => {
    setIsSimulating(true);
    setMessages([]);
    setIsListening(true);

    for (let i = 0; i < mockConversationWithDocuments.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      setMessages(prev => [...prev, mockConversationWithDocuments[i]]);
    }

    setIsSimulating(false);
    setIsListening(false);
  };

  const handleToggleListening = () => {
    if (!isListening && !isSimulating) {
      simulateConversation();
    } else if (!isSimulating) {
      setIsListening(false);
      setMessages([]);
      setDocumentResponses({});
    }
  };

  const handleDocumentUpload = (messageIndex: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setDocumentResponses(prev => ({ ...prev, [messageIndex]: 'uploaded' }));
      // In real app, would upload file here
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

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-gray-200">
        <div>
          <h2 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Voice Intake</h2>
          <p className="text-[10px] text-gray-500 mt-0.5">
            {isListening ? 'Active' : 'Ready'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 border-2 border-gray-300 rounded-lg flex items-center justify-center mb-4">
              <Phone className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">No Active Session</h3>
            <p className="text-xs text-gray-500 max-w-xs">
              Start voice intake to begin conversation simulation
            </p>
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <div key={index} className="space-y-2">
                {/* Message Bubble */}
                <div
                  className={`flex ${message.role === 'agent' ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 border rounded-lg ${
                      message.role === 'agent'
                        ? 'bg-white border-gray-300'
                        : 'bg-black border-black text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                        {message.role === 'agent' ? 'Agent' : 'Client'}
                      </span>
                      <span className="text-[10px] text-gray-400">{message.timestamp}</span>
                    </div>
                    <p className={`text-xs leading-relaxed ${message.role === 'agent' ? 'text-gray-900' : 'text-white'}`}>
                      {message.content}
                    </p>
                  </div>
                </div>

                {/* Document Request Interactive Card */}
                {message.documentRequest && (
                  <div className="flex justify-start">
                    <div className="w-full max-w-[85%] border border-gray-200 rounded-lg bg-white overflow-hidden">
                      {/* Header */}
                      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                            {message.documentRequest.priority === 'critical' ? 'Required' : message.documentRequest.priority === 'important' ? 'Important' : 'Helpful'}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            {message.documentRequest.type}
                          </div>
                        </div>
                        <div className="text-xs text-gray-700 mt-1">
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
                          <button
                            onClick={() => handleUploadClick(index)}
                            className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-gray-400 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex flex-col items-center gap-1.5">
                              <Upload className="w-4 h-4 text-gray-400" />
                              <div className="text-xs font-medium text-gray-700">Upload Document</div>
                              <div className="text-[10px] text-gray-500">Click to browse or drag & drop</div>
                            </div>
                          </button>

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
                          <div className={`flex items-center gap-2 px-3 py-2 rounded-md ${
                            documentResponses[index] === 'uploaded'
                              ? 'bg-green-50 text-green-700'
                              : documentResponses[index] === 'dont-have'
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-blue-50 text-blue-700'
                          }`}>
                            {documentResponses[index] === 'uploaded' && (
                              <>
                                <Upload className="w-3.5 h-3.5" />
                                <span className="text-xs font-medium">Document uploaded</span>
                              </>
                            )}
                            {documentResponses[index] === 'dont-have' && (
                              <>
                                <X className="w-3.5 h-3.5" />
                                <span className="text-xs font-medium">Marked as not available</span>
                              </>
                            )}
                            {documentResponses[index] === 'later' && (
                              <>
                                <Clock className="w-3.5 h-3.5" />
                                <span className="text-xs font-medium">Will provide later</span>
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
            disabled={isSimulating}
            className={`relative w-12 h-12 border-2 rounded-lg flex items-center justify-center transition-all ${
              isListening
                ? 'bg-black border-black'
                : 'bg-white border-gray-300 hover:border-gray-400'
            } ${isSimulating ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {/* Pulse rings when listening */}
            {isListening && (
              <>
                <div className="absolute inset-0 border-2 border-black rounded-lg animate-pulse-ring"></div>
                <div className="absolute inset-0 border-2 border-black rounded-lg animate-pulse-ring" style={{ animationDelay: '1s' }}></div>
              </>
            )}

            {/* Icon */}
            {isListening ? (
              <MicOff className="w-5 h-5 text-white relative z-10" />
            ) : (
              <Mic className="w-5 h-5 text-gray-900 relative z-10" />
            )}
          </button>

          {/* Equalizer when listening */}
          {isListening && (
            <div className="flex items-center gap-1 h-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-black animate-equalizer"
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

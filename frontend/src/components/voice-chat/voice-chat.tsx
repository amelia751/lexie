'use client';

import { useState, useEffect, useRef } from 'react';
import { mockConversation, type VoiceMessage } from '@/lib/mock-data';
import { Mic, MicOff, Volume2, VolumeX, Phone } from 'lucide-react';

export default function VoiceChat() {
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

    for (let i = 0; i < mockConversation.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setMessages(prev => [...prev, mockConversation[i]]);
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
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Voice Intake</h2>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {isListening ? 'Active' : 'Ready'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-1 border border-gray-300 hover:border-gray-400 transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <VolumeX className="w-3.5 h-3.5 text-gray-600" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-gray-600" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 border-2 border-gray-300 flex items-center justify-center mb-4">
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
              <div
                key={index}
                className={`flex ${message.role === 'agent' ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 border ${
                    message.role === 'agent'
                      ? 'bg-white border-gray-300 text-gray-900'
                      : 'bg-black border-black text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide">
                      {message.role === 'agent' ? 'Agent' : 'Client'}
                    </span>
                    <span className="text-[10px] opacity-70">{message.timestamp}</span>
                  </div>
                  <p className="text-xs leading-relaxed">{message.content}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Voice Control */}
      <div className="flex-shrink-0 p-6 border-t border-gray-200 bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          {/* Microphone Button */}
          <button
            onClick={handleToggleListening}
            disabled={isSimulating}
            className={`relative w-16 h-16 border-2 flex items-center justify-center transition-all ${
              isListening
                ? 'bg-black border-black'
                : 'bg-white border-gray-300 hover:border-gray-400'
            } ${isSimulating ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {/* Pulse rings when listening */}
            {isListening && (
              <>
                <div className="absolute inset-0 border-2 border-black animate-pulse-ring"></div>
                <div className="absolute inset-0 border-2 border-black animate-pulse-ring" style={{ animationDelay: '1s' }}></div>
              </>
            )}

            {/* Icon */}
            {isListening ? (
              <MicOff className="w-6 h-6 text-white relative z-10" />
            ) : (
              <Mic className="w-6 h-6 text-gray-900 relative z-10" />
            )}
          </button>

          {/* Status Text */}
          <div className="text-center">
            <p className="text-xs font-medium text-gray-900">
              {isSimulating
                ? 'Processing...'
                : isListening
                ? 'Recording'
                : 'Start Intake'}
            </p>
            {isListening && !isSimulating && (
              <p className="text-[10px] text-gray-500 mt-1">Click to stop</p>
            )}
          </div>

          {/* Equalizer when listening */}
          {isListening && (
            <div className="flex items-center gap-1 h-6">
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

      {/* Conversation Stats */}
      {messages.length > 0 && (
        <div className="flex-shrink-0 px-4 py-2 border-t border-gray-200 bg-white">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{messages.length} messages</span>
            <span>Duration: {Math.floor(messages.length * 1.5 / 60)}:{((messages.length * 1.5) % 60).toString().padStart(2, '0')}</span>
          </div>
        </div>
      )}
    </div>
  );
}

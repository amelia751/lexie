'use client';

import { useState, useCallback, useEffect } from 'react';
import FileExplorer from '@/components/file-explorer/file-explorer';
import TabCanvas from '@/components/tab-canvas/tab-canvas';
import VoiceChat from '@/components/voice-chat/voice-chat';
import { type Evidence } from '@/lib/mock-data';
import { Layers, MessageSquare, FolderOpen } from 'lucide-react';

interface ResizeHandleProps {
  onResize: (width: number) => void;
  side: 'left' | 'right';
}

function ResizeHandle({ onResize, side }: ResizeHandleProps) {
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      if (side === 'left') {
        const newWidth = e.clientX;
        onResize(newWidth);
      } else {
        const newWidth = window.innerWidth - e.clientX;
        onResize(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isResizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, onResize, side]);

  return (
    <div
      className={`absolute top-0 ${side === 'left' ? 'right-0' : 'left-0'} w-1 h-full cursor-col-resize group z-50 hover:bg-accent/30 transition-colors`}
      onMouseDown={() => setIsResizing(true)}
    />
  );
}

export default function InterfaceLayout() {
  const [explorerWidth, setExplorerWidth] = useState(320);
  const [voiceChatWidth, setVoiceChatWidth] = useState(400);
  const [selectedFile, setSelectedFile] = useState<Evidence | null>(null);
  const [showExplorer, setShowExplorer] = useState(true);
  const [showVoiceChat, setShowVoiceChat] = useState(true);

  const handleExplorerWidthChange = useCallback((newWidth: number) => {
    const minWidth = 250;
    const maxWidth = 500;
    const constrainedWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
    setExplorerWidth(constrainedWidth);
  }, []);

  const handleVoiceChatWidthChange = useCallback((newWidth: number) => {
    const minWidth = 350;
    const maxWidth = 600;
    const constrainedWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
    setVoiceChatWidth(constrainedWidth);
  }, []);

  const handleFileSelect = (evidence: Evidence) => {
    setSelectedFile(evidence);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="flex-shrink-0 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-black rounded-md flex items-center justify-center">
              <span className="text-white font-bold text-sm">L</span>
            </div>
            <div>
              <h1 className="text-base font-semibold text-gray-900">Lexie</h1>
              <p className="text-[10px] text-gray-500">Case Intelligence Platform</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowExplorer(!showExplorer)}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium border rounded-md transition-colors ${
                showExplorer
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Explorer</span>
            </button>
            <button
              onClick={() => setShowVoiceChat(!showVoiceChat)}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium border rounded-md transition-colors ${
                showVoiceChat
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Voice</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* File Explorer */}
        {showExplorer && (
          <div
            className="flex-shrink-0 relative"
            style={{ width: `${explorerWidth}px` }}
          >
            <FileExplorer
              onFileSelect={handleFileSelect}
              selectedFileId={selectedFile?.id}
            />
            <ResizeHandle onResize={handleExplorerWidthChange} side="left" />
          </div>
        )}

        {/* Main Canvas */}
        <div className="flex-1 min-w-0 relative">
          <TabCanvas />
        </div>

        {/* Voice Chat */}
        {showVoiceChat && (
          <div
            className="flex-shrink-0 relative"
            style={{ width: `${voiceChatWidth}px` }}
          >
            <ResizeHandle onResize={handleVoiceChatWidthChange} side="right" />
            <VoiceChat />
          </div>
        )}
      </div>
    </div>
  );
}

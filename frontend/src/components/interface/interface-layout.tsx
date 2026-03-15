'use client';

import { useState, useCallback, useEffect } from 'react';
import FileExplorer from '@/components/file-explorer/file-explorer';
import TabCanvas from '@/components/tab-canvas/tab-canvas';
import VoiceChat from '@/components/voice-chat/voice-chat';
import { type Evidence } from '@/lib/mock-data';
import { RotateCcw, Signature } from 'lucide-react';
import { EvidenceProvider } from '@/contexts/evidence-context';
import { LiveCaseProvider } from '@/contexts/live-case-context';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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

function InterfaceLayoutInner() {
  const [explorerWidth, setExplorerWidth] = useState(320);
  const [voiceChatWidth, setVoiceChatWidth] = useState(400);
  const [selectedFile, setSelectedFile] = useState<Evidence | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);

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
            <div className="w-7 h-7 bg-true-turquoise rounded-md flex items-center justify-center">
              <Signature className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-offblack">Lexie</h1>
              <p className="text-[10px] text-gray-500">Case Intelligence Platform</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowResetDialog(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium border rounded-md transition-colors bg-white text-gray-700 border-gray-300 hover:border-gray-400 hover:bg-gray-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* File Explorer */}
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

        {/* Main Canvas */}
        <div className="flex-1 min-w-0 relative">
          <TabCanvas />
        </div>

        {/* Voice Chat */}
        <div
          className="flex-shrink-0 relative"
          style={{ width: `${voiceChatWidth}px` }}
        >
          <ResizeHandle onResize={handleVoiceChatWidthChange} side="right" />
          <VoiceChat />
        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent className="bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-offblack text-base font-semibold">Reset Case</DialogTitle>
            <DialogDescription className="text-gray-600 text-sm">
              Are you sure you want to reset? This will clear all current data and reload the page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setShowResetDialog(false)}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                try {
                  // Reset backend state first
                  await fetch('http://localhost:8000/api/v1/intake/reset', { method: 'POST' });
                } catch (e) {
                  console.error('Failed to reset backend:', e);
                }
                window.location.reload();
              }}
              className="px-3 py-1.5 text-xs font-medium text-white bg-true-turquoise border border-true-turquoise rounded-md hover:bg-telly-blue transition-colors"
            >
              Reset
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function InterfaceLayout() {
  return (
    <EvidenceProvider>
      <LiveCaseProvider>
        <InterfaceLayoutInner />
      </LiveCaseProvider>
    </EvidenceProvider>
  );
}

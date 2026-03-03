'use client';

import { mockEvidence, type Evidence } from '@/lib/mock-data';
import { FileSearch } from 'lucide-react';

interface FileExplorerProps {
  onFileSelect?: (evidence: Evidence) => void;
  selectedFileId?: string;
}

const getFileIcon = (type: Evidence['type']) => {
  return <FileSearch className="w-3.5 h-3.5 text-gray-600" />;
};

const getStatusBadge = (status: Evidence['status']) => {
  return (
    <span className="px-1.5 py-0.5 text-[10px] font-medium border border-gray-300 text-gray-600">
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

export default function FileExplorer({ onFileSelect, selectedFileId }: FileExplorerProps) {
  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-gray-200">
        <h2 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Evidence</h2>
        <p className="text-[10px] text-gray-500 mt-0.5">
          {mockEvidence.length} files
        </p>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="p-2 space-y-px">
          {mockEvidence.map((evidence) => (
            <button
              key={evidence.id}
              onClick={() => onFileSelect?.(evidence)}
              className={`w-full text-left px-3 py-2 border transition-colors ${
                selectedFileId === evidence.id
                  ? 'bg-gray-50 border-gray-900'
                  : 'bg-white border-transparent hover:border-gray-200'
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 mt-0.5">
                  {getFileIcon(evidence.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-900 truncate">
                    {evidence.name}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] text-gray-500">{evidence.size}</span>
                    <span className="text-[10px] text-gray-400">•</span>
                    <span className="text-[10px] text-gray-500">{evidence.uploadedAt}</span>
                  </div>
                  <div className="mt-1">
                    {getStatusBadge(evidence.status)}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-4 py-2.5 border-t border-gray-200">
        <button className="w-full px-3 py-1.5 text-xs font-medium text-white bg-black border border-black hover:bg-gray-900 transition-colors">
          Upload
        </button>
      </div>
    </div>
  );
}

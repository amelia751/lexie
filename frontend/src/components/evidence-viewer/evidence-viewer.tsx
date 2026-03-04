'use client';

import { useState } from 'react';
import { X, ExternalLink } from 'lucide-react';

interface EvidenceViewerProps {
  source: string;
  url: string;
  type: 'pdf' | 'image';
  onClose: () => void;
}

export default function EvidenceViewer({ source, url, type, onClose }: EvidenceViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const handleLoad = () => {
    setLoading(false);
    setError(false);
  };

  const handleError = () => {
    setLoading(false);
    setError(true);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-5xl h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{source}</h2>
            <p className="text-[10px] text-gray-500 mt-0.5">Evidence Document</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 border border-gray-300 rounded hover:border-gray-400 transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="w-4 h-4 text-gray-600" />
            </a>
            <button
              onClick={onClose}
              className="p-1 border border-gray-300 rounded hover:border-gray-400 transition-colors"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Document Viewer */}
        <div className="flex-1 relative overflow-hidden">
          {loading && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Loading {type === 'pdf' ? 'PDF' : 'image'}...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
              <div className="text-center p-6">
                <p className="text-sm text-gray-700 mb-4">Unable to load document</p>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-900 transition-colors inline-flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open in New Tab
                </a>
              </div>
            </div>
          )}

          {type === 'pdf' ? (
            <iframe
              src={url}
              className="w-full h-full border-0"
              onLoad={handleLoad}
              onError={handleError}
              title={source}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
              <img
                src={url}
                alt={source}
                className="max-w-full max-h-full object-contain"
                onLoad={handleLoad}
                onError={handleError}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

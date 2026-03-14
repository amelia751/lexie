'use client';

import { useState } from 'react';
import { useLiveCase } from '@/contexts/live-case-context';
import EvidenceViewer from '@/components/evidence-viewer/evidence-viewer';
import { ExternalLink } from 'lucide-react';

export default function LiveTimelineView() {
  const { timelineEvents, lastUpdatedField, highlightFile, uploadedFiles } = useLiveCase();
  const [viewingEvidence, setViewingEvidence] = useState<{ source: string; url: string; type: 'pdf' | 'image' } | null>(null);
  
  const hasAnyData = timelineEvents.length > 0;
  
  const isEventUpdating = (id: string) => lastUpdatedField === `timeline.${id}`;

  const getCategoryColor = (category: string) => {
    switch(category) {
      case 'incident': return 'border-true-turquoise text-true-turquoise bg-sky/10';
      case 'medical': return 'border-aquamarine text-peacock bg-sky/10';
      case 'legal': return 'border-peacock text-peacock bg-sky/10';
      case 'insurance': return 'border-pale-blue text-peacock bg-sky/10';
      default: return 'border-gray-300 text-gray-600';
    }
  };

  const getSourceName = (event: typeof timelineEvents[0]) => {
    // Use explicit source if provided, otherwise derive from category
    if (event.source) {
      return event.source;
    }
    switch(event.category) {
      case 'incident': return 'Incident Report';
      case 'medical': return 'Medical Records';
      case 'legal': return 'Legal Documentation';
      case 'insurance': return 'Insurance Records';
      default: return 'Source Document';
    }
  };

  const handleViewSource = (event: typeof timelineEvents[0]) => {
    // If we have a sourceFileId, highlight it in the file explorer
    if (event.sourceFileId) {
      highlightFile(event.sourceFileId);
      return;
    }
    
    // Otherwise, try to find a matching file by source name
    const sourceName = getSourceName(event).toLowerCase();
    const matchingFile = uploadedFiles.find(f => 
      f.name.toLowerCase().includes(sourceName.replace(' ', '-').replace(' ', '_')) ||
      sourceName.includes(f.name.toLowerCase().split('.')[0])
    );
    
    if (matchingFile) {
      highlightFile(matchingFile.id);
      return;
    }
    
    // Fallback: show evidence viewer with placeholder
    const isPhoto = event.category === 'incident' && event.event.toLowerCase().includes('photo');
    setViewingEvidence({
      source: getSourceName(event),
      url: isPhoto 
        ? 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&h=600&fit=crop'
        : '/sample.pdf',
      type: isPhoto ? 'image' : 'pdf',
    });
  };

  // Get photos associated with event (only if explicitly added)
  const getEventPhotos = (_event: typeof timelineEvents[0]): string[] | null => {
    // In live mode, photos would be from actual uploaded files
    // Only return photos if they exist in the event data
    // Future: check event.photos or similar field
    return null;
  };

  if (!hasAnyData) {
    return (
      <div className="h-full overflow-y-auto scrollbar-thin bg-white">
        <div className="max-w-5xl mx-auto p-8 space-y-6">
          <div className="border-b border-gray-200 pb-4">
            <div className="h-5 w-32 bg-gray-100 rounded animate-pulse"></div>
            <div className="h-3 w-48 bg-gray-100 rounded mt-2 animate-pulse"></div>
          </div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4">
                <div className="h-3 w-24 bg-gray-100 rounded mb-2"></div>
                <div className="h-4 w-48 bg-gray-100 rounded mb-2 animate-shimmer"></div>
                <div className="h-3 w-full bg-gray-100 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin bg-white">
      <div className="max-w-5xl mx-auto p-8 space-y-6">
        {/* Header */}
        <div className="border-b border-gray-200 pb-4">
          <h1 className="text-lg font-semibold text-gray-900">Case Timeline</h1>
          <p className="text-xs text-gray-500 mt-1">Chronological sequence of events</p>
        </div>

        {/* Timeline */}
        <div className="space-y-4">
          {timelineEvents.map((event) => {
            const photos = getEventPhotos(event);
            
            return (
              <div
                key={event.id}
                className={`border border-gray-200 rounded-lg p-4 transition-all ${isEventUpdating(event.id) ? 'animate-fadeSlideIn' : ''}`}
              >
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex items-center gap-3">
                    <div className="text-xs font-semibold text-gray-900">
                      {new Date(event.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </div>
                    {event.time && (
                      <div className="text-xs text-gray-600">{event.time}</div>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 border rounded text-[10px] font-medium uppercase ${getCategoryColor(event.category)}`}>
                    {event.category}
                  </span>
                </div>
                
                <h3 className="text-sm font-semibold text-gray-900 mb-2">{event.event}</h3>
                
                {event.description && (
                  <p className="text-xs text-gray-700 leading-relaxed mb-3">{event.description}</p>
                )}
                
                {/* Source section */}
                <div className="pt-2 border-t border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Source:</span>
                    <button
                      onClick={() => handleViewSource(event)}
                      className="inline-flex items-center px-2 py-1 text-[10px] font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 hover:border-gray-300 hover:text-gray-900 transition-all"
                    >
                      {getSourceName(event)}
                    </button>
                  </div>
                  
                  {/* Photo thumbnails for incident events */}
                  {photos && (
                    <div className="mt-2 flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                      {photos.map((url, idx) => (
                        <button
                          key={idx}
                          onClick={() => setViewingEvidence({ source: `${event.event} Photo ${idx + 1}`, url, type: 'image' })}
                          className="flex-shrink-0 border border-gray-200 rounded overflow-hidden hover:border-gray-300 transition-all hover:shadow-sm"
                        >
                          <img
                            src={url}
                            alt={`${event.event} ${idx + 1}`}
                            className="h-20 w-28 object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Evidence Viewer Modal */}
      {viewingEvidence && (
        <EvidenceViewer
          source={viewingEvidence.source}
          url={viewingEvidence.url}
          type={viewingEvidence.type}
          onClose={() => setViewingEvidence(null)}
        />
      )}
    </div>
  );
}

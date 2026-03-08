'use client';

import { useLiveCase } from '@/contexts/live-case-context';

export default function LiveTimelineView() {
  const { timelineEvents, lastUpdatedField } = useLiveCase();
  
  const hasAnyData = timelineEvents.length > 0;
  
  const isEventUpdating = (id: string) => lastUpdatedField === `timeline.${id}`;

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
          <h1 className="text-lg font-semibold text-true-turquoise">Case Timeline</h1>
          <p className="text-xs text-gray-500 mt-1">Chronological sequence of events</p>
        </div>

        {/* Timeline */}
        <div className="space-y-4">
          {timelineEvents.map((event) => (
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
                <span className="px-2 py-0.5 border border-gray-300 rounded text-[10px] font-medium text-gray-600 uppercase">
                  {event.category}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">{event.event}</h3>
              {event.description && (
                <p className="text-xs text-gray-700 leading-relaxed">{event.description}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';

type EventCategory = 'all' | 'incident' | 'medical' | 'legal' | 'insurance';

export default function TimelineView() {
  const [selectedCategory, setSelectedCategory] = useState<EventCategory>('all');

  const detailedTimeline = [
    {
      date: '2024-01-15',
      time: '15:30',
      event: 'Motor Vehicle Accident',
      description: 'Plaintiff vehicle stopped at red light. Defendant vehicle failed to stop, rear-ended plaintiff at estimated 25-30 mph.',
      source: 'Police Report #2024-1234',
      category: 'incident' as const,
    },
    {
      date: '2024-01-15',
      time: '15:45',
      event: 'Emergency Medical Services Dispatch',
      description: 'Plaintiff reported neck pain (7/10), back pain (6/10), and headache. Transported via ambulance to General Hospital.',
      source: 'EMS Report',
      category: 'medical' as const,
    },
    {
      date: '2024-01-15',
      time: '16:20',
      event: 'Emergency Room Admission',
      description: 'Initial evaluation by Dr. Amanda Chen, MD. Cervical spine X-rays ordered. Diagnosis: Whiplash (Grade II), lumbar strain.',
      source: 'Medical Records - ER',
      category: 'medical' as const,
    },
    {
      date: '2024-01-16',
      time: '10:00',
      event: 'Follow-up with Primary Care Physician',
      description: 'Persistent neck pain (7/10), limited range of motion. Physical therapy recommended 3x weekly.',
      source: 'Medical Records - PCP',
      category: 'medical' as const,
    },
    {
      date: '2024-01-18',
      time: '14:00',
      event: 'MRI Cervical Spine',
      description: 'MRI without contrast. Results: Soft tissue injury, no disc herniation, no fractures.',
      source: 'Medical Records - Imaging',
      category: 'medical' as const,
    },
    {
      date: '2024-01-22',
      time: '09:30',
      event: 'Orthopedic Specialist Consultation',
      description: 'Comprehensive orthopedic evaluation. Physical therapy prescribed for 8 weeks. Prognosis: Good with treatment.',
      source: 'Medical Records - Specialist',
      category: 'medical' as const,
    },
    {
      date: '2024-02-04',
      time: '16:45',
      event: 'Defendant Admission of Fault',
      description: 'Email from defendant\'s insurance adjuster: "Our insured has accepted responsibility for the accident."',
      source: 'Insurance Correspondence',
      category: 'legal' as const,
    },
    {
      date: '2024-03-15',
      time: '15:00',
      event: 'Physical Therapy Discharge',
      description: 'Completed 24 PT sessions. Final assessment: Cervical ROM 90% normal, pain 2/10. Residual symptoms present.',
      source: 'Medical Records - PT',
      category: 'medical' as const,
    },
  ];

  const filteredTimeline = detailedTimeline.filter((event) => {
    if (selectedCategory === 'all') return true;
    return event.category === selectedCategory;
  });

  const categoryStats = {
    all: detailedTimeline.length,
    incident: detailedTimeline.filter(e => e.category === 'incident').length,
    medical: detailedTimeline.filter(e => e.category === 'medical').length,
    legal: detailedTimeline.filter(e => e.category === 'legal').length,
    insurance: detailedTimeline.filter(e => e.category === 'insurance').length,
  };

  return (
    <div className="h-full overflow-y-auto scrollbar-thin bg-white">
      <div className="max-w-5xl mx-auto p-8 space-y-6">
        {/* Header */}
        <div className="border-b border-gray-200 pb-4">
          <h1 className="text-lg font-semibold text-gray-900">Case Timeline</h1>
          <p className="text-xs text-gray-500 mt-1">Chronological sequence of events</p>
        </div>

        {/* Filters */}
        <div className="border border-gray-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Filter:</span>
            <div className="flex gap-2">
              {(Object.keys(categoryStats) as EventCategory[]).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2 py-1 text-[10px] font-medium border rounded-md transition-colors uppercase ${
                    selectedCategory === cat
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {cat} ({categoryStats[cat]})
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-4">
          {filteredTimeline.map((event, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex items-center gap-3">
                  <div className="text-xs font-semibold text-gray-900">
                    {new Date(event.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                  <div className="text-xs text-gray-600">
                    {event.time}
                  </div>
                </div>
                <div className="px-2 py-0.5 border border-gray-300 rounded text-[10px] font-medium text-gray-600 uppercase">
                  {event.category}
                </div>
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">{event.event}</h3>
              <p className="text-xs text-gray-700 leading-relaxed mb-3">{event.description}</p>
              <div className="pt-2 border-t border-gray-200">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Source: </span>
                <span className="text-[10px] text-gray-700">{event.source}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Timeline Summary</h2>
          <ul className="space-y-2 text-xs text-gray-700">
            <li>• Total duration: 59 days (Jan 15 - Mar 15, 2024)</li>
            <li>• Immediate medical attention received (ambulance transport within 15 minutes)</li>
            <li>• Consistent treatment pattern with documented follow-up care</li>
            <li>• Defendant admission of fault documented (Feb 4, 2024)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

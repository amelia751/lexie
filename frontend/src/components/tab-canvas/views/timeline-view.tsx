'use client';

import { useState } from 'react';
import EvidenceViewer from '@/components/evidence-viewer/evidence-viewer';
import { getEvidenceDocument } from '@/lib/evidence-mapping';

type EventCategory = 'all' | 'incident' | 'medical' | 'legal' | 'insurance';

export default function TimelineView() {
  const [selectedCategory, setSelectedCategory] = useState<EventCategory>('all');
  const [viewingEvidence, setViewingEvidence] = useState<{ source: string; url: string; type: 'pdf' | 'image' } | null>(null);

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
      time: '15:35',
      event: 'Accident Scene Documentation',
      description: 'Photos taken by responding officer showing vehicle positions, damage, and intersection layout. Rear damage to plaintiff vehicle consistent with high-speed impact.',
      source: 'Accident Scene Photos',
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
      date: '2024-02-15',
      time: '09:00',
      event: 'Insurance Claim Filed',
      description: 'Third-party bodily injury claim submitted to State Farm Insurance. Claim #SF-2024-8847291.',
      source: 'Insurance Correspondence',
      category: 'insurance' as const,
    },
    {
      date: '2024-03-15',
      time: '15:00',
      event: 'Physical Therapy Discharge',
      description: 'Completed 24 PT sessions. Final assessment: Cervical ROM 90% normal, pain 2/10. Residual symptoms present.',
      source: 'Medical Records - PT',
      category: 'medical' as const,
    },
    {
      date: '2024-03-20',
      time: '10:00',
      event: 'Maximum Medical Improvement (MMI)',
      description: 'Dr. Robert Chen declares plaintiff has reached MMI. Permanent impairment rating: 0%. Full recovery expected with residual symptoms.',
      source: 'Medical Records - Specialist',
      category: 'medical' as const,
    },
    {
      date: '2024-04-01',
      time: '14:00',
      event: 'Demand Letter Sent',
      description: 'Formal demand letter sent to State Farm Insurance requesting $125,000 settlement. 30-day response deadline.',
      source: 'Attorney Correspondence',
      category: 'legal' as const,
    },
    {
      date: '2024-04-15',
      time: '11:30',
      event: 'Initial Settlement Offer Received',
      description: 'State Farm responds with initial offer of $45,000. Offer rejected as insufficient.',
      source: 'Insurance Correspondence',
      category: 'insurance' as const,
    },
    {
      date: '2024-04-22',
      time: '16:00',
      event: 'Counter-Demand Sent',
      description: 'Counter-demand of $110,000 submitted with detailed damages breakdown and comparable verdicts.',
      source: 'Attorney Correspondence',
      category: 'legal' as const,
    },
    {
      date: '2024-05-10',
      time: '10:00',
      event: 'Second Settlement Offer',
      description: 'State Farm increases offer to $62,000. Negotiations ongoing.',
      source: 'Insurance Correspondence',
      category: 'insurance' as const,
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

  const getCategoryColor = (category: string) => {
    return 'border-gray-300 text-gray-600';
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
            <div className="flex gap-2 flex-wrap">
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
            <div key={index} className="border rounded-lg p-4 border-gray-200">
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
                <div className={`px-2 py-0.5 border rounded text-[10px] font-medium uppercase ${getCategoryColor(event.category)}`}>
                  {event.category}
                </div>
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">{event.event}</h3>
              <p className="text-xs text-gray-700 leading-relaxed mb-3">{event.description}</p>
              <div className="pt-2 border-t border-gray-200 flex items-center gap-2">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Source:</span>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    const doc = getEvidenceDocument(event.source);
                    if (doc) {
                      setViewingEvidence({ source: event.source, url: doc.url, type: doc.type });
                    }
                  }}
                  className="inline-flex items-center px-2 py-1 text-[10px] font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 hover:border-gray-300 hover:text-gray-900 transition-all"
                >
                  {event.source}
                </button>
              </div>
            </div>
          ))}
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

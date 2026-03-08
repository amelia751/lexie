'use client';

import { useState } from 'react';
import EvidenceViewer from '@/components/evidence-viewer/evidence-viewer';
import { getEvidenceDocument } from '@/lib/evidence-mapping';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

export default function MedicalSummaryView() {
  const [viewingEvidence, setViewingEvidence] = useState<{ source: string; url: string; type: 'pdf' | 'image' } | null>(null);
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const medicalBilling = [
    { date: '01/15/2024', provider: 'General Hospital Emergency Dept', service: 'Emergency Room Visit', cpt: '99285', icd: 'S13.4XXA', amount: 2850.00, status: 'Billed', source: 'Medical Records - ER' },
    { date: '01/15/2024', provider: 'General Hospital Radiology', service: 'Cervical Spine X-Ray (3 views)', cpt: '72040', icd: 'S13.4XXA', amount: 425.00, status: 'Billed', source: 'Medical Records - Imaging' },
    { date: '01/15/2024', provider: 'General Hospital Radiology', service: 'Lumbar Spine X-Ray (2 views)', cpt: '72100', icd: 'M54.5', amount: 380.00, status: 'Billed', source: 'Medical Records - Imaging' },
    { date: '01/16/2024', provider: 'Dr. Sarah Mitchell, MD (PCP)', service: 'Office Visit - Established Patient', cpt: '99214', icd: 'S13.4XXA', amount: 185.00, status: 'Paid', source: 'Medical Records - PCP' },
    { date: '01/18/2024', provider: 'Advanced Imaging Center', service: 'MRI Cervical Spine w/o Contrast', cpt: '72141', icd: 'S13.4XXA', amount: 1950.00, status: 'Billed', source: 'Medical Records - Imaging' },
    { date: '01/22/2024', provider: 'Dr. Robert Chen, MD (Orthopedic)', service: 'Orthopedic Consultation', cpt: '99244', icd: 'S13.4XXA, M54.5', amount: 425.00, status: 'Paid', source: 'Medical Records - Specialist' },
    { date: '01/22 - 03/15', provider: 'Elite Physical Therapy', service: 'Physical Therapy (24 sessions)', cpt: '97110, 97140', icd: 'S13.4XXA', amount: 4800.00, status: 'Billed', source: 'Medical Records - PT' },
    { date: '01/15 - 02/15', provider: 'Pharmacy - CVS', service: 'Prescription Medications', cpt: 'N/A', icd: 'Various', amount: 385.00, status: 'Paid', source: 'Medical Records - ER' },
  ];

  const totalBilled = medicalBilling.reduce((sum, item) => sum + item.amount, 0);

  // Future Medical Expenses
  const futureMedical = {
    total: 15000,
    breakdown: [
      {
        item: 'Follow-up orthopedic visits (4x)',
        cost: 1200,
        justification: 'Dr. Robert Chen recommended quarterly orthopedic evaluations for 12 months post-MMI to monitor cervical spine recovery and address any residual symptoms.',
        source: 'Medical Records - Specialist'
      },
      {
        item: 'Maintenance physical therapy (12 sessions)',
        cost: 2400,
        justification: 'Physical therapist prescribed 12 maintenance sessions over 6 months to prevent recurrence of cervical strain and maintain range of motion improvements.',
        source: 'Medical Records - PT'
      },
      {
        item: 'Potential trigger point injections',
        cost: 3500,
        justification: 'Orthopedic specialist noted patient may require trigger point injections if residual myofascial pain persists beyond conservative treatment.',
        source: 'Medical Records - Specialist'
      },
      {
        item: 'Annual monitoring (2 years)',
        cost: 600,
        justification: 'Standard follow-up care for whiplash injuries includes annual check-ups for 2 years to monitor for delayed complications or degenerative changes.',
        source: 'Medical Records - Specialist'
      },
      {
        item: 'Medication/OTC pain management',
        cost: 1800,
        justification: 'Ongoing need for NSAIDs, muscle relaxants, and OTC pain management based on intermittent pain reports during flare-ups.',
        source: 'Medical Records - PCP'
      },
      {
        item: 'Contingency for flare-ups',
        cost: 5500,
        justification: 'Reserved amount for potential flare-ups requiring additional imaging, emergency care, or intensive physical therapy based on similar case outcomes.',
        source: 'Future Medical Report'
      },
    ],
    basis: 'Based on treating physician recommendations and similar case outcomes',
    physicianSupport: true,
  };

  // Medical Liens
  const liens = {
    healthInsurance: {
      carrier: 'Blue Cross Blue Shield',
      amountPaid: 32500,
      subrogationClaim: 12450,
      negotiable: true,
      estimatedReduction: '40-60%',
      netLienEstimate: 6225,
    },
    medicare: null,
    medicaid: null,
    totalLiens: 12450,
    estimatedNetLiens: 6225,
  };

  // Permanent Impairment
  const permanentImpairment = {
    wholePersonRating: 0,
    regionRating: 'Cervical: 0% | Lumbar: 0%',
    methodology: 'AMA Guides 5th Edition',
    evaluator: 'Dr. Robert Chen, MD (Treating Orthopedist)',
    date: '2024-03-15',
    prognosis: 'Full recovery expected. Residual symptoms may persist intermittently but not permanent.',
    mmi: true,
    mmiDate: '2024-03-15',
  };

  // Pre-existing Conditions
  const preExisting = {
    identified: false,
    conditions: [] as string[],
    analysis: 'Medical records review shows no documented pre-existing cervical or lumbar conditions. No prior chiropractic or orthopedic treatment in 5 years preceding accident.',
    defenseRisk: 'Low',
  };

  const diagnoses = [
    { icd: 'S13.4XXA', diagnosis: 'Cervical Spine Whiplash (Grade II)', severity: 'Moderate', status: 'Improved, residual pain', source: 'Medical Records - ER' },
    { icd: 'M54.5', diagnosis: 'Lumbar Strain', severity: 'Mild-Moderate', status: 'Significant improvement', source: 'Medical Records - Specialist' },
    { icd: 'M79.1', diagnosis: 'Myalgia (Soft Tissue)', severity: 'Mild', status: 'Resolved', source: 'Medical Records - PT' },
  ];

  const treatmentGaps = [
    { number: 1, dateRange: 'Jan 18-22 (4 days)', reason: 'Waiting for orthopedic specialist appointment', defensible: true, risk: 'Low', source: 'Medical Records - Specialist' },
    { number: 2, dateRange: 'Feb 5-12 (7 days)', reason: 'Patient out of town for work obligation', defensible: true, risk: 'Low', source: 'Medical Records - PCP' },
    { number: 3, dateRange: 'Feb 20-28 (8 days)', reason: 'Insurance authorization delay for continued PT', defensible: true, risk: 'Low', source: 'Medical Records - PT' },
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-full overflow-y-auto scrollbar-thin bg-white">
        <div className="max-w-6xl mx-auto p-8 space-y-6">
        {/* Header */}
        <div className="border-b border-gray-200 pb-4">
          <h1 className="text-lg font-semibold text-gray-900">Medical Summary Report</h1>
          <p className="text-xs text-gray-500 mt-1">Case PI-2024-001234 • Sarah Johnson • DOI: January 15, 2024</p>
        </div>

        {/* Medical Liens */}
        <div className="border border-gray-200 rounded-lg">
          <div className="border-b border-gray-200 px-4 py-3 bg-gray-50 rounded-t-lg">
            <h2 className="text-sm font-semibold text-peacock uppercase tracking-wide">Medical Liens & Subrogation</h2>
          </div>
          <div className="p-4">
            {liens.healthInsurance && (
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{liens.healthInsurance.carrier}</div>
                    <div className="text-[10px] text-gray-500">Health Insurance Subrogation</div>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        const doc = getEvidenceDocument('Lien Documentation');
                        if (doc) {
                          setViewingEvidence({ source: 'Lien Documentation', url: doc.url, type: doc.type });
                        }
                      }}
                      className="inline-flex items-center px-2 py-1 mt-2 text-[10px] font-medium text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-100 hover:border-gray-300 hover:text-gray-900 transition-all"
                    >
                      View Documentation
                    </button>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">{formatCurrency(liens.healthInsurance.subrogationClaim)}</div>
                    <div className="text-[10px] text-gray-500">Asserted Lien</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="font-semibold text-gray-600">Amount Paid:</span>
                    <span className="ml-1 text-gray-900">{formatCurrency(liens.healthInsurance.amountPaid)}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-600">Negotiable:</span>
                    <span className="ml-1 text-gray-900 font-semibold">{liens.healthInsurance.negotiable ? 'Yes' : 'No'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-600">Est. Reduction:</span>
                    <span className="ml-1 text-gray-900">{liens.healthInsurance.estimatedReduction}</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                  <span className="text-xs font-semibold text-gray-700">Estimated Net Lien After Negotiation:</span>
                  <span className="text-sm font-bold text-gray-900">{formatCurrency(liens.healthInsurance.netLienEstimate)}</span>
                </div>
              </div>
            )}
            <div className="mt-3 p-3 border border-gray-200 rounded-lg bg-gray-50">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className="font-semibold">Medicare/Medicaid:</span> None
                <span className="mx-2">•</span>
                <span className="font-semibold">ERISA:</span> N/A
                <span className="mx-2">•</span>
                <span className="font-semibold">Hospital Liens:</span> None
              </div>
            </div>
          </div>
        </div>

        {/* Future Medical Expenses */}
        <div className="border border-gray-200 rounded-lg">
          <div className="border-b border-gray-200 px-4 py-3 bg-gray-50 rounded-t-lg">
            <h2 className="text-sm font-semibold text-peacock uppercase tracking-wide">Future Medical Expenses</h2>
          </div>
          <div className="p-4">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="text-left text-[10px] font-semibold text-gray-600 uppercase pb-2">Item</th>
                  <th className="text-right text-[10px] font-semibold text-gray-600 uppercase pb-2">Estimated Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {futureMedical.breakdown.map((item, index) => (
                  <tr key={index} className="text-xs">
                    <td className="py-2 text-gray-900">
                      <div className="flex items-center gap-2">
                        <span>{item.item}</span>
                        <Tooltip delayDuration={200}>
                          <TooltipTrigger asChild>
                            <button
                              className="inline-flex items-center justify-center h-4 w-4 text-[10px] font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded transition-colors flex-shrink-0 cursor-pointer"
                            >
                              {index + 1}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            className="max-w-sm p-0 bg-white text-gray-900 border border-gray-300 shadow-lg"
                          >
                            <div className="space-y-0">
                              <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                                <p className="text-xs font-semibold text-gray-900">
                                  {item.item}
                                </p>
                              </div>
                              <div className="px-3 py-2">
                                <p className="text-xs leading-relaxed text-gray-700 mb-2">
                                  {item.justification}
                                </p>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    const doc = getEvidenceDocument(item.source);
                                    if (doc) {
                                      setViewingEvidence({ source: item.source, url: doc.url, type: doc.type });
                                    }
                                  }}
                                  className="inline-flex items-center px-2 py-1 text-[10px] font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 hover:border-gray-300 hover:text-gray-900 transition-all"
                                >
                                  View Source: {item.source}
                                </button>
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </td>
                    <td className="py-2 text-right font-semibold text-gray-900">{formatCurrency(item.cost)}</td>
                  </tr>
                ))}
                <tr className="font-semibold border-t-2 border-gray-300">
                  <td className="py-2 text-sm text-gray-900">TOTAL FUTURE MEDICAL</td>
                  <td className="py-2 text-right text-sm text-gray-900">{formatCurrency(futureMedical.total)}</td>
                </tr>
              </tbody>
            </table>
            <div className="mt-3 pt-3 border-t border-gray-200">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  const doc = getEvidenceDocument('Future Medical Report');
                  if (doc) {
                    setViewingEvidence({ source: 'Future Medical Report', url: doc.url, type: doc.type });
                  }
                }}
                className="inline-flex items-center px-2 py-1 text-[10px] font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 hover:border-gray-300 hover:text-gray-900 transition-all"
              >
                View Source
              </button>
            </div>
          </div>
        </div>

        {/* Pre-existing Conditions */}
        <div className={`border rounded-lg ${preExisting.identified ? 'border-gray-900 bg-gray-100' : 'border-gray-200 bg-gray-50'}`}>
          <div className={`border-b px-4 py-3 rounded-t-lg ${preExisting.identified ? 'border-gray-900 bg-gray-200' : 'border-gray-200 bg-gray-100'}`}>
            <h2 className="text-sm font-semibold text-peacock uppercase tracking-wide">Pre-existing Conditions Analysis</h2>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className={`px-3 py-1 rounded text-xs font-semibold border ${preExisting.identified ? 'bg-gray-100 border-gray-900 text-gray-900' : 'bg-white border-gray-300 text-gray-900'}`}>
                {preExisting.identified ? 'Pre-existing Conditions Found' : 'No Pre-existing Conditions'}
              </div>
              <div className="px-2 py-1 border border-gray-300 rounded text-[10px] font-medium text-gray-600">
                Defense Risk: {preExisting.defenseRisk}
              </div>
            </div>
            <p className="text-xs text-gray-700 mb-3">{preExisting.analysis}</p>
            <div className="pt-3 border-t border-gray-200">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  const doc = getEvidenceDocument('Medical Records Review');
                  if (doc) {
                    setViewingEvidence({ source: 'Medical Records Review', url: doc.url, type: doc.type });
                  }
                }}
                className="inline-flex items-center px-2 py-1 text-[10px] font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 hover:border-gray-300 hover:text-gray-900 transition-all"
              >
                View Source
              </button>
            </div>
          </div>
        </div>

        {/* Itemized Medical Bills */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
            <h2 className="text-sm font-semibold text-peacock uppercase tracking-wide">Itemized Medical Billing</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase">Date</th>
                  <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase">Provider</th>
                  <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase">Service</th>
                  <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase">CPT</th>
                  <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase">ICD-10</th>
                  <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-600 uppercase">Amount</th>
                  <th className="px-4 py-2 text-center text-[10px] font-semibold text-gray-600 uppercase">Status</th>
                  <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase">Source</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {medicalBilling.map((bill, index) => (
                  <tr key={index} className="text-[11px]">
                    <td className="px-4 py-2 whitespace-nowrap text-gray-700">{bill.date}</td>
                    <td className="px-4 py-2 text-gray-900">{bill.provider}</td>
                    <td className="px-4 py-2 text-gray-700">{bill.service}</td>
                    <td className="px-4 py-2 text-gray-600 font-mono text-[10px]">{bill.cpt}</td>
                    <td className="px-4 py-2 text-gray-600 font-mono text-[10px]">{bill.icd}</td>
                    <td className="px-4 py-2 text-right text-gray-900 font-semibold">{formatCurrency(bill.amount)}</td>
                    <td className="px-4 py-2 text-center">
                      <span className="px-2 py-0.5 text-[10px] border border-gray-300 rounded text-gray-600">{bill.status}</span>
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          const doc = getEvidenceDocument(bill.source);
                          if (doc) {
                            setViewingEvidence({ source: bill.source, url: doc.url, type: doc.type });
                          }
                        }}
                        className="inline-flex items-center px-2 py-1 text-[10px] font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 hover:border-gray-300 hover:text-gray-900 transition-all"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
                  <td className="px-4 py-2 text-xs text-gray-900" colSpan={6}>TOTAL PAST MEDICAL EXPENSES</td>
                  <td className="px-4 py-2 text-right text-sm text-gray-900">{formatCurrency(totalBilled)}</td>
                  <td className="px-4 py-2"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Diagnoses */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
            <h2 className="text-sm font-semibold text-peacock uppercase tracking-wide">Primary Diagnoses</h2>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase">ICD-10</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase">Diagnosis</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase">Severity</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase">Status</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase">Source</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {diagnoses.map((dx, index) => (
                <tr key={index} className="text-xs">
                  <td className="px-4 py-3 font-mono text-gray-900">{dx.icd}</td>
                  <td className="px-4 py-3 text-gray-900">{dx.diagnosis}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 border border-gray-300 rounded text-[10px] text-gray-600">{dx.severity}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{dx.status}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        const doc = getEvidenceDocument(dx.source);
                        if (doc) {
                          setViewingEvidence({ source: dx.source, url: doc.url, type: doc.type });
                        }
                      }}
                      className="inline-flex items-center px-2 py-1 text-[10px] font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 hover:border-gray-300 hover:text-gray-900 transition-all"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Treatment Gaps */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
            <h2 className="text-sm font-semibold text-peacock uppercase tracking-wide">Treatment Gap Analysis</h2>
          </div>
          <div className="p-4 space-y-3">
            {treatmentGaps.map((gap) => (
              <div key={gap.number} className="border border-gray-200 rounded-md p-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 border border-gray-300 rounded flex items-center justify-center text-xs font-semibold">
                      {gap.number}
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-gray-900">{gap.dateRange}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 border rounded ${gap.defensible ? 'border-gray-300 bg-gray-50 text-gray-700' : 'border-gray-900 bg-gray-100 text-gray-900'}`}>
                      {gap.defensible ? 'Defensible' : 'Problematic'}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 border border-gray-300 rounded text-gray-600">
                      Risk: {gap.risk}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-gray-700 mb-2">
                  <span className="font-semibold">Reason:</span> {gap.reason}
                </div>
                <div className="pt-2 border-t border-gray-200">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      const doc = getEvidenceDocument(gap.source);
                      if (doc) {
                        setViewingEvidence({ source: gap.source, url: doc.url, type: doc.type });
                      }
                    }}
                    className="inline-flex items-center px-2 py-1 text-[10px] font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 hover:border-gray-300 hover:text-gray-900 transition-all"
                  >
                    View Source
                  </button>
                </div>
              </div>
            ))}
          </div>
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
    </TooltipProvider>
  );
}

'use client';

export default function MedicalSummaryView() {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const medicalBilling = [
    { date: '01/15/2024', provider: 'General Hospital Emergency Dept', service: 'Emergency Room Visit', cpt: '99285', icd: 'S13.4XXA', amount: 2850.00, status: 'Billed' },
    { date: '01/15/2024', provider: 'General Hospital Radiology', service: 'Cervical Spine X-Ray (3 views)', cpt: '72040', icd: 'S13.4XXA', amount: 425.00, status: 'Billed' },
    { date: '01/15/2024', provider: 'General Hospital Radiology', service: 'Lumbar Spine X-Ray (2 views)', cpt: '72100', icd: 'M54.5', amount: 380.00, status: 'Billed' },
    { date: '01/16/2024', provider: 'Dr. Sarah Mitchell, MD (PCP)', service: 'Office Visit - Established Patient', cpt: '99214', icd: 'S13.4XXA', amount: 185.00, status: 'Paid' },
    { date: '01/18/2024', provider: 'Advanced Imaging Center', service: 'MRI Cervical Spine w/o Contrast', cpt: '72141', icd: 'S13.4XXA', amount: 1950.00, status: 'Billed' },
    { date: '01/22/2024', provider: 'Dr. Robert Chen, MD (Orthopedic)', service: 'Orthopedic Consultation', cpt: '99244', icd: 'S13.4XXA, M54.5', amount: 425.00, status: 'Paid' },
    { date: '01/22 - 03/15', provider: 'Elite Physical Therapy', service: 'Physical Therapy (24 sessions)', cpt: '97110, 97140', icd: 'S13.4XXA', amount: 4800.00, status: 'Billed' },
    { date: '01/15 - 02/15', provider: 'Pharmacy - CVS', service: 'Prescription Medications', cpt: 'N/A', icd: 'Various', amount: 385.00, status: 'Paid' },
  ];

  const totalBilled = medicalBilling.reduce((sum, item) => sum + item.amount, 0);

  // Future Medical Expenses
  const futureMedical = {
    total: 15000,
    breakdown: [
      { item: 'Follow-up orthopedic visits (4x)', cost: 1200 },
      { item: 'Maintenance physical therapy (12 sessions)', cost: 2400 },
      { item: 'Potential trigger point injections', cost: 3500 },
      { item: 'Annual monitoring (2 years)', cost: 600 },
      { item: 'Medication/OTC pain management', cost: 1800 },
      { item: 'Contingency for flare-ups', cost: 5500 },
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
    { icd: 'S13.4XXA', diagnosis: 'Cervical Spine Whiplash (Grade II)', severity: 'Moderate', status: 'Improved, residual pain' },
    { icd: 'M54.5', diagnosis: 'Lumbar Strain', severity: 'Mild-Moderate', status: 'Significant improvement' },
    { icd: 'M79.1', diagnosis: 'Myalgia (Soft Tissue)', severity: 'Mild', status: 'Resolved' },
  ];

  const treatmentGaps = [
    { number: 1, dateRange: 'Jan 18-22 (4 days)', reason: 'Waiting for orthopedic specialist appointment', defensible: true, risk: 'Low' },
    { number: 2, dateRange: 'Feb 5-12 (7 days)', reason: 'Patient out of town for work obligation', defensible: true, risk: 'Low' },
    { number: 3, dateRange: 'Feb 20-28 (8 days)', reason: 'Insurance authorization delay for continued PT', defensible: true, risk: 'Low' },
  ];

  return (
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
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Medical Liens & Subrogation</h2>
          </div>
          <div className="p-4">
            {liens.healthInsurance && (
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{liens.healthInsurance.carrier}</div>
                    <div className="text-[10px] text-gray-500">Health Insurance Subrogation</div>
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
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Future Medical Expenses</h2>
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
                    <td className="py-2 text-gray-900">{item.item}</td>
                    <td className="py-2 text-right font-semibold text-gray-900">{formatCurrency(item.cost)}</td>
                  </tr>
                ))}
                <tr className="font-semibold border-t-2 border-gray-300">
                  <td className="py-2 text-sm text-gray-900">TOTAL FUTURE MEDICAL</td>
                  <td className="py-2 text-right text-sm text-gray-900">{formatCurrency(futureMedical.total)}</td>
                </tr>
              </tbody>
            </table>
            <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600">
              <span className="font-semibold">Basis:</span> {futureMedical.basis}
              {futureMedical.physicianSupport && (
                <span className="ml-2 px-2 py-0.5 bg-gray-100 border border-gray-300 rounded text-[10px] font-semibold text-gray-900">
                  Physician Supported
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Pre-existing Conditions */}
        <div className={`border rounded-lg ${preExisting.identified ? 'border-gray-900 bg-gray-100' : 'border-gray-200 bg-gray-50'}`}>
          <div className={`border-b px-4 py-3 rounded-t-lg ${preExisting.identified ? 'border-gray-900 bg-gray-200' : 'border-gray-200 bg-gray-100'}`}>
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Pre-existing Conditions Analysis</h2>
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
            <p className="text-xs text-gray-700">{preExisting.analysis}</p>
          </div>
        </div>

        {/* Itemized Medical Bills */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Itemized Medical Billing</h2>
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
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
                  <td className="px-4 py-2 text-xs text-gray-900" colSpan={5}>TOTAL PAST MEDICAL EXPENSES</td>
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
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Primary Diagnoses</h2>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase">ICD-10</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase">Diagnosis</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase">Severity</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase">Status</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Treatment Gaps */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Treatment Gap Analysis</h2>
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
                <div className="text-xs text-gray-700">
                  <span className="font-semibold">Reason:</span> {gap.reason}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

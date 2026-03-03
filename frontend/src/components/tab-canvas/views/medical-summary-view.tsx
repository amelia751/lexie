'use client';

export default function MedicalSummaryView() {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
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

        {/* Key Metrics */}
        <div className="grid grid-cols-4 gap-4">
          <div className="border border-gray-200 p-4">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Total Medical Bills</div>
            <div className="text-lg font-semibold text-gray-900">{formatCurrency(totalBilled)}</div>
            <div className="text-[10px] text-gray-500 mt-1">{medicalBilling.length} line items</div>
          </div>
          <div className="border border-gray-200 p-4">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Treatment Duration</div>
            <div className="text-lg font-semibold text-gray-900">8 weeks</div>
            <div className="text-[10px] text-gray-500 mt-1">Jan 15 - Mar 15</div>
          </div>
          <div className="border border-gray-200 p-4">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Provider Visits</div>
            <div className="text-lg font-semibold text-gray-900">28</div>
            <div className="text-[10px] text-gray-500 mt-1">24 PT + 4 MD</div>
          </div>
          <div className="border border-gray-200 p-4">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Treatment Gaps</div>
            <div className="text-lg font-semibold text-gray-900">3</div>
            <div className="text-[10px] text-gray-500 mt-1">All defensible</div>
          </div>
        </div>

        {/* Itemized Medical Bills */}
        <div className="border border-gray-200">
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
                      <span className="px-2 py-0.5 text-[10px] border border-gray-300 text-gray-600">{bill.status}</span>
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
                  <td className="px-4 py-2 text-xs text-gray-900" colSpan={5}>TOTAL MEDICAL EXPENSES</td>
                  <td className="px-4 py-2 text-right text-sm text-gray-900">{formatCurrency(totalBilled)}</td>
                  <td className="px-4 py-2"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Diagnoses */}
        <div className="border border-gray-200">
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
                    <span className="px-2 py-0.5 border border-gray-300 text-[10px] text-gray-600">{dx.severity}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{dx.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Treatment Gaps */}
        <div className="border border-gray-200">
          <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Treatment Gap Analysis</h2>
          </div>
          <div className="p-4 space-y-3">
            {treatmentGaps.map((gap) => (
              <div key={gap.number} className="border border-gray-200 p-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 border border-gray-300 flex items-center justify-center text-xs font-semibold">
                      {gap.number}
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-gray-900">{gap.dateRange}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 border border-gray-300 text-gray-600">
                      {gap.defensible ? 'Defensible' : 'Problematic'}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 border border-gray-300 text-gray-600">
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

        {/* Summary */}
        <div className="border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Summary Assessment</h2>
          <ul className="space-y-2 text-xs text-gray-700">
            <li>• Strong causal link established between accident and all diagnosed injuries</li>
            <li>• Medical treatment was medically necessary and appropriate</li>
            <li>• All treatment gaps are defensible with documentation</li>
            <li>• No pre-existing conditions identified</li>
            <li>• Charges reasonable and customary for services rendered</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

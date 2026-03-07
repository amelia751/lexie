'use client';

import { useState } from 'react';
import { mockDamages } from '@/lib/mock-data';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import EvidenceViewer from '@/components/evidence-viewer/evidence-viewer';
import { getEvidenceDocument } from '@/lib/evidence-mapping';

export default function DamagesView() {
  const [selectedScenario, setSelectedScenario] = useState<'worst' | 'base' | 'best'>('base');
  const [contingencyFee, setContingencyFee] = useState(33);
  const [trialCosts, setTrialCosts] = useState(15000);
  const [viewingEvidence, setViewingEvidence] = useState<{ source: string; url: string; type: 'pdf' | 'image' } | null>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Extended damages data with justifications
  const damageJustifications = {
    pastMedical: {
      amount: 48200,
      justification: 'Total billed medical expenses from ER visit ($2,850), imaging studies ($2,755), PCP visits ($185), orthopedic consultation ($425), MRI ($1,950), physical therapy ($4,800), and prescription medications ($385). All treatment was reasonable, necessary, and causally related to the accident.',
      source: 'Medical Records - ER'
    },
    futureMedical: {
      amount: 15000,
      justification: 'Physician-supported projection including follow-up orthopedic visits, maintenance physical therapy, potential trigger point injections, annual monitoring, ongoing pain management, and contingency for flare-ups based on treating physician recommendations.',
      source: 'Future Medical Report'
    },
    pastLostWages: {
      amount: 12400,
      justification: '31 days of missed work at $400/day average daily wage. Supported by employer verification letter and pay stubs showing regular earnings. Time off directly related to medical treatment and recovery from accident injuries.',
      source: 'Attorney Correspondence'
    },
    futureLostEarningCapacity: {
      amount: 0,
      justification: 'No future lost earning capacity claimed. Plaintiff returned to full work capacity with no permanent impairment rating (0% WPI). Full recovery expected with no ongoing work restrictions.',
      source: 'Medical Records - Specialist'
    },
    propertyDamage: {
      amount: 8500,
      justification: 'Vehicle repair costs ($7,200) plus rental car expenses during 18-day repair period ($1,300). Supported by body shop estimate, final invoice, and rental car receipts. Vehicle sustained significant rear-end damage.',
      source: 'Insurance Correspondence'
    },
    painAndSuffering: {
      amount: 85000,
      justification: 'Based on 1.8x multiplier of total medical expenses ($63,200). Justified by 3 months of treatment, moderate soft tissue injuries (Grade II whiplash), documented pain levels, treatment gaps explained, clear liability, and comparable verdicts in Los Angeles County ($95K-$142K for similar injuries).',
      source: 'Attorney Correspondence'
    },
  };

  const extendedDamages = {
    pastMedical: damageJustifications.pastMedical.amount,
    futureMedical: damageJustifications.futureMedical.amount,
    pastLostWages: damageJustifications.pastLostWages.amount,
    futureLostEarningCapacity: damageJustifications.futureLostEarningCapacity.amount,
    propertyDamage: damageJustifications.propertyDamage.amount,
    painAndSuffering: damageJustifications.painAndSuffering.amount,
    liens: {
      healthInsurance: 12450,
      medicare: 0,
      medicaid: 0,
      total: 12450,
      estimatedNet: 6225,
    },
  };

  // Comparable Verdicts
  const comparableVerdicts = [
    {
      caseType: 'Rear-end MVA - Whiplash',
      jurisdiction: 'Los Angeles County',
      year: 2023,
      medicals: 52000,
      verdict: 125000,
      notes: 'Similar soft tissue injuries, 8 weeks treatment',
    },
    {
      caseType: 'Rear-end MVA - Cervical Strain',
      jurisdiction: 'Los Angeles County',
      year: 2023,
      medicals: 38000,
      verdict: 95000,
      notes: 'Grade II whiplash, no surgery',
    },
    {
      caseType: 'Rear-end MVA - Whiplash + Lumbar',
      jurisdiction: 'Orange County',
      year: 2024,
      medicals: 61000,
      verdict: 142000,
      notes: 'Comparable injuries, clear liability',
    },
  ];

  const scenarios = {
    worst: {
      pastMedical: extendedDamages.pastMedical * 0.85,
      futureMedical: extendedDamages.futureMedical * 0.50,
      pastWages: extendedDamages.pastLostWages * 0.70,
      futureWages: 0,
      property: extendedDamages.propertyDamage,
      painSuffering: extendedDamages.painAndSuffering * 0.60,
      probability: 55,
    },
    base: {
      pastMedical: extendedDamages.pastMedical,
      futureMedical: extendedDamages.futureMedical,
      pastWages: extendedDamages.pastLostWages,
      futureWages: extendedDamages.futureLostEarningCapacity,
      property: extendedDamages.propertyDamage,
      painSuffering: extendedDamages.painAndSuffering,
      probability: mockDamages.probability,
    },
    best: {
      pastMedical: extendedDamages.pastMedical * 1.10,
      futureMedical: extendedDamages.futureMedical * 1.25,
      pastWages: extendedDamages.pastLostWages * 1.15,
      futureWages: 5000,
      property: extendedDamages.propertyDamage,
      painSuffering: extendedDamages.painAndSuffering * 1.40,
      probability: 85,
    },
  };

  const currentScenario = scenarios[selectedScenario];
  const grossTotal = currentScenario.pastMedical + currentScenario.futureMedical + 
                     currentScenario.pastWages + currentScenario.futureWages + 
                     currentScenario.property + currentScenario.painSuffering;
  const economicDamages = currentScenario.pastMedical + currentScenario.futureMedical + 
                          currentScenario.pastWages + currentScenario.futureWages + 
                          currentScenario.property;
  const netAfterLiens = grossTotal - extendedDamages.liens.estimatedNet;
  const attorneyFees = netAfterLiens * (contingencyFee / 100);
  const clientNet = netAfterLiens - attorneyFees - trialCosts;

  // Pain & Suffering multiplier calculation
  const psMultiplier = (currentScenario.painSuffering / (currentScenario.pastMedical + currentScenario.futureMedical)).toFixed(2);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-full overflow-y-auto scrollbar-thin bg-white">
        <div className="max-w-6xl mx-auto p-8 space-y-6">
        {/* Header */}
        <div className="border-b border-gray-200 pb-4">
          <h1 className="text-lg font-semibold text-true-turquoise">Damages Analysis</h1>
          <p className="text-xs text-gray-500 mt-1">Financial valuation and settlement analysis</p>
        </div>

        {/* Full Damages Breakdown */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
            <h2 className="text-sm font-semibold text-peacock uppercase tracking-wide">Complete Damages Breakdown</h2>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase">Category</th>
                <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-600 uppercase">Amount</th>
                <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-600 uppercase">% of Total</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {/* Economic Damages Section */}
              <tr className="bg-gray-100">
                <td className="px-4 py-2 text-xs font-semibold text-gray-900" colSpan={3}>ECONOMIC DAMAGES</td>
              </tr>
              <tr className="text-xs">
                <td className="px-4 py-3 text-gray-900 pl-8">
                  <div className="flex items-center gap-2">
                    <span>Past Medical Expenses</span>
                    <Tooltip delayDuration={200}>
                      <TooltipTrigger asChild>
                        <button className="inline-flex items-center justify-center h-4 w-4 text-[10px] font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded transition-colors flex-shrink-0 cursor-pointer">
                          1
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-sm p-0 bg-white text-gray-900 border border-gray-300 shadow-lg">
                        <div className="space-y-0">
                          <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                            <p className="text-xs font-semibold text-gray-900">Past Medical Expenses</p>
                          </div>
                          <div className="px-3 py-2">
                            <p className="text-xs leading-relaxed text-gray-700 mb-2">{damageJustifications.pastMedical.justification}</p>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                const doc = getEvidenceDocument(damageJustifications.pastMedical.source);
                                if (doc) {
                                  setViewingEvidence({ source: damageJustifications.pastMedical.source, url: doc.url, type: doc.type });
                                }
                              }}
                              className="inline-flex items-center px-2 py-1 text-[10px] font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 hover:border-gray-300 hover:text-gray-900 transition-all"
                            >
                              View Source: {damageJustifications.pastMedical.source}
                            </button>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(currentScenario.pastMedical)}</td>
                <td className="px-4 py-3 text-right text-gray-600">{((currentScenario.pastMedical / grossTotal) * 100).toFixed(1)}%</td>
              </tr>
              <tr className="text-xs">
                <td className="px-4 py-3 text-gray-900 pl-8">
                  <div className="flex items-center gap-2">
                    <span>Future Medical Expenses</span>
                    <Tooltip delayDuration={200}>
                      <TooltipTrigger asChild>
                        <button className="inline-flex items-center justify-center h-4 w-4 text-[10px] font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded transition-colors flex-shrink-0 cursor-pointer">
                          2
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-sm p-0 bg-white text-gray-900 border border-gray-300 shadow-lg">
                        <div className="space-y-0">
                          <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                            <p className="text-xs font-semibold text-gray-900">Future Medical Expenses</p>
                          </div>
                          <div className="px-3 py-2">
                            <p className="text-xs leading-relaxed text-gray-700 mb-2">{damageJustifications.futureMedical.justification}</p>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                const doc = getEvidenceDocument(damageJustifications.futureMedical.source);
                                if (doc) {
                                  setViewingEvidence({ source: damageJustifications.futureMedical.source, url: doc.url, type: doc.type });
                                }
                              }}
                              className="inline-flex items-center px-2 py-1 text-[10px] font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 hover:border-gray-300 hover:text-gray-900 transition-all"
                            >
                              View Source: {damageJustifications.futureMedical.source}
                            </button>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(currentScenario.futureMedical)}</td>
                <td className="px-4 py-3 text-right text-gray-600">{((currentScenario.futureMedical / grossTotal) * 100).toFixed(1)}%</td>
              </tr>
              <tr className="text-xs">
                <td className="px-4 py-3 text-gray-900 pl-8">
                  <div className="flex items-center gap-2">
                    <span>Past Lost Wages</span>
                    <Tooltip delayDuration={200}>
                      <TooltipTrigger asChild>
                        <button className="inline-flex items-center justify-center h-4 w-4 text-[10px] font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded transition-colors flex-shrink-0 cursor-pointer">
                          3
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-sm p-0 bg-white text-gray-900 border border-gray-300 shadow-lg">
                        <div className="space-y-0">
                          <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                            <p className="text-xs font-semibold text-gray-900">Past Lost Wages</p>
                          </div>
                          <div className="px-3 py-2">
                            <p className="text-xs leading-relaxed text-gray-700 mb-2">{damageJustifications.pastLostWages.justification}</p>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                const doc = getEvidenceDocument(damageJustifications.pastLostWages.source);
                                if (doc) {
                                  setViewingEvidence({ source: damageJustifications.pastLostWages.source, url: doc.url, type: doc.type });
                                }
                              }}
                              className="inline-flex items-center px-2 py-1 text-[10px] font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 hover:border-gray-300 hover:text-gray-900 transition-all"
                            >
                              View Source: {damageJustifications.pastLostWages.source}
                            </button>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(currentScenario.pastWages)}</td>
                <td className="px-4 py-3 text-right text-gray-600">{((currentScenario.pastWages / grossTotal) * 100).toFixed(1)}%</td>
              </tr>
              <tr className="text-xs">
                <td className="px-4 py-3 text-gray-900 pl-8">
                  <div className="flex items-center gap-2">
                    <span>Future Lost Earning Capacity</span>
                    <Tooltip delayDuration={200}>
                      <TooltipTrigger asChild>
                        <button className="inline-flex items-center justify-center h-4 w-4 text-[10px] font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded transition-colors flex-shrink-0 cursor-pointer">
                          4
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-sm p-0 bg-white text-gray-900 border border-gray-300 shadow-lg">
                        <div className="space-y-0">
                          <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                            <p className="text-xs font-semibold text-gray-900">Future Lost Earning Capacity</p>
                          </div>
                          <div className="px-3 py-2">
                            <p className="text-xs leading-relaxed text-gray-700 mb-2">{damageJustifications.futureLostEarningCapacity.justification}</p>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                const doc = getEvidenceDocument(damageJustifications.futureLostEarningCapacity.source);
                                if (doc) {
                                  setViewingEvidence({ source: damageJustifications.futureLostEarningCapacity.source, url: doc.url, type: doc.type });
                                }
                              }}
                              className="inline-flex items-center px-2 py-1 text-[10px] font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 hover:border-gray-300 hover:text-gray-900 transition-all"
                            >
                              View Source: {damageJustifications.futureLostEarningCapacity.source}
                            </button>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(currentScenario.futureWages)}</td>
                <td className="px-4 py-3 text-right text-gray-600">{((currentScenario.futureWages / grossTotal) * 100).toFixed(1)}%</td>
              </tr>
              <tr className="text-xs">
                <td className="px-4 py-3 text-gray-900 pl-8">
                  <div className="flex items-center gap-2">
                    <span>Property Damage</span>
                    <Tooltip delayDuration={200}>
                      <TooltipTrigger asChild>
                        <button className="inline-flex items-center justify-center h-4 w-4 text-[10px] font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded transition-colors flex-shrink-0 cursor-pointer">
                          5
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-sm p-0 bg-white text-gray-900 border border-gray-300 shadow-lg">
                        <div className="space-y-0">
                          <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                            <p className="text-xs font-semibold text-gray-900">Property Damage</p>
                          </div>
                          <div className="px-3 py-2">
                            <p className="text-xs leading-relaxed text-gray-700 mb-2">{damageJustifications.propertyDamage.justification}</p>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                const doc = getEvidenceDocument(damageJustifications.propertyDamage.source);
                                if (doc) {
                                  setViewingEvidence({ source: damageJustifications.propertyDamage.source, url: doc.url, type: doc.type });
                                }
                              }}
                              className="inline-flex items-center px-2 py-1 text-[10px] font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 hover:border-gray-300 hover:text-gray-900 transition-all"
                            >
                              View Source: {damageJustifications.propertyDamage.source}
                            </button>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(currentScenario.property)}</td>
                <td className="px-4 py-3 text-right text-gray-600">{((currentScenario.property / grossTotal) * 100).toFixed(1)}%</td>
              </tr>
              <tr className="bg-gray-100 text-xs font-semibold">
                <td className="px-4 py-2 text-gray-900 pl-8">Subtotal Economic</td>
                <td className="px-4 py-2 text-right text-gray-900">{formatCurrency(economicDamages)}</td>
                <td className="px-4 py-2 text-right text-gray-900">{((economicDamages / grossTotal) * 100).toFixed(1)}%</td>
              </tr>
              
              {/* Non-Economic Damages Section */}
              <tr className="bg-gray-100">
                <td className="px-4 py-2 text-xs font-semibold text-gray-900" colSpan={3}>NON-ECONOMIC DAMAGES</td>
              </tr>
              <tr className="text-xs">
                <td className="px-4 py-3 text-gray-900 pl-8">
                  <div className="flex items-center gap-2">
                    <span>
                      Pain & Suffering
                      <span className="ml-2 text-[10px] text-gray-500">({psMultiplier}x medical multiplier)</span>
                    </span>
                    <Tooltip delayDuration={200}>
                      <TooltipTrigger asChild>
                        <button className="inline-flex items-center justify-center h-4 w-4 text-[10px] font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded transition-colors flex-shrink-0 cursor-pointer">
                          6
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-sm p-0 bg-white text-gray-900 border border-gray-300 shadow-lg">
                        <div className="space-y-0">
                          <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                            <p className="text-xs font-semibold text-gray-900">Pain & Suffering (Non-Economic Damages)</p>
                          </div>
                          <div className="px-3 py-2">
                            <p className="text-xs leading-relaxed text-gray-700 mb-2">{damageJustifications.painAndSuffering.justification}</p>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                const doc = getEvidenceDocument(damageJustifications.painAndSuffering.source);
                                if (doc) {
                                  setViewingEvidence({ source: damageJustifications.painAndSuffering.source, url: doc.url, type: doc.type });
                                }
                              }}
                              className="inline-flex items-center px-2 py-1 text-[10px] font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 hover:border-gray-300 hover:text-gray-900 transition-all"
                            >
                              View Source: {damageJustifications.painAndSuffering.source}
                            </button>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(currentScenario.painSuffering)}</td>
                <td className="px-4 py-3 text-right text-gray-600">{((currentScenario.painSuffering / grossTotal) * 100).toFixed(1)}%</td>
              </tr>
              
              {/* Gross Total */}
              <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
                <td className="px-4 py-3 text-sm text-gray-900">GROSS TOTAL DAMAGES</td>
                <td className="px-4 py-3 text-right text-sm text-gray-900">{formatCurrency(grossTotal)}</td>
                <td className="px-4 py-3 text-right text-sm text-gray-900">100%</td>
              </tr>
              
              {/* Liens Deduction */}
              <tr className="bg-gray-50 text-xs">
                <td className="px-4 py-3 text-gray-900 pl-8">Less: Medical Liens (estimated net)</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">-{formatCurrency(extendedDamages.liens.estimatedNet)}</td>
                <td className="px-4 py-3"></td>
              </tr>
              
              {/* Net Total */}
              <tr className="bg-gray-100 font-semibold border-t border-gray-400">
                <td className="px-4 py-3 text-sm text-gray-900">NET DAMAGES (Available for Distribution)</td>
                <td className="px-4 py-3 text-right text-sm text-gray-900">{formatCurrency(netAfterLiens)}</td>
                <td className="px-4 py-3"></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Comparable Verdicts */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
            <h2 className="text-sm font-semibold text-peacock uppercase tracking-wide">Comparable Verdicts & Settlements</h2>
          </div>
          <div className="p-4">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="text-left text-[10px] font-semibold text-gray-600 uppercase pb-2">Case Type</th>
                  <th className="text-left text-[10px] font-semibold text-gray-600 uppercase pb-2">Jurisdiction</th>
                  <th className="text-center text-[10px] font-semibold text-gray-600 uppercase pb-2">Year</th>
                  <th className="text-right text-[10px] font-semibold text-gray-600 uppercase pb-2">Medicals</th>
                  <th className="text-right text-[10px] font-semibold text-gray-600 uppercase pb-2">Verdict</th>
                  <th className="text-left text-[10px] font-semibold text-gray-600 uppercase pb-2 pl-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {comparableVerdicts.map((verdict, index) => (
                  <tr key={index} className="text-xs">
                    <td className="py-2 text-gray-900">{verdict.caseType}</td>
                    <td className="py-2 text-gray-700">{verdict.jurisdiction}</td>
                    <td className="py-2 text-center text-gray-700">{verdict.year}</td>
                    <td className="py-2 text-right font-medium text-gray-900">{formatCurrency(verdict.medicals)}</td>
                    <td className="py-2 text-right font-semibold text-gray-900">{formatCurrency(verdict.verdict)}</td>
                    <td className="py-2 text-gray-600 pl-4 text-[10px]">{verdict.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600">
              <span className="font-semibold">Analysis:</span> Based on comparable verdicts, cases with similar medicals ({formatCurrency(40000)}-{formatCurrency(60000)}) resulted in verdicts ranging from {formatCurrency(95000)} to {formatCurrency(142000)}. Our case value of {formatCurrency(grossTotal)} aligns with market data.
            </div>
          </div>
        </div>

        {/* Scenario Analysis */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
            <h2 className="text-sm font-semibold text-peacock uppercase tracking-wide">Scenario Analysis</h2>
          </div>
          <div className="p-3">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Select Scenario:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedScenario('worst')}
                  className={`px-3 py-1 text-[10px] font-medium border rounded-md transition-colors uppercase ${
                    selectedScenario === 'worst'
                      ? 'bg-true-turquoise text-white border-true-turquoise'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  Worst Case
                </button>
                <button
                  onClick={() => setSelectedScenario('base')}
                  className={`px-3 py-1 text-[10px] font-medium border rounded-md transition-colors uppercase ${
                    selectedScenario === 'base'
                      ? 'bg-true-turquoise text-white border-true-turquoise'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  Base Case
                </button>
                <button
                  onClick={() => setSelectedScenario('best')}
                  className={`px-3 py-1 text-[10px] font-medium border rounded-md transition-colors uppercase ${
                    selectedScenario === 'best'
                      ? 'bg-true-turquoise text-white border-true-turquoise'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  Best Case
                </button>
              </div>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase">Component</th>
                  <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-600 uppercase">Worst Case</th>
                  <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-600 uppercase">Base Case</th>
                  <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-600 uppercase">Best Case</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 text-xs">
                <tr>
                  <td className="px-4 py-2 text-gray-900">Past Medical</td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(scenarios.worst.pastMedical)}</td>
                  <td className="px-4 py-2 text-right font-semibold text-gray-900">{formatCurrency(scenarios.base.pastMedical)}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(scenarios.best.pastMedical)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-900">Future Medical</td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(scenarios.worst.futureMedical)}</td>
                  <td className="px-4 py-2 text-right font-semibold text-gray-900">{formatCurrency(scenarios.base.futureMedical)}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(scenarios.best.futureMedical)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-900">Lost Wages (Past + Future)</td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(scenarios.worst.pastWages + scenarios.worst.futureWages)}</td>
                  <td className="px-4 py-2 text-right font-semibold text-gray-900">{formatCurrency(scenarios.base.pastWages + scenarios.base.futureWages)}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(scenarios.best.pastWages + scenarios.best.futureWages)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-900">Property Damage</td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(scenarios.worst.property)}</td>
                  <td className="px-4 py-2 text-right font-semibold text-gray-900">{formatCurrency(scenarios.base.property)}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(scenarios.best.property)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-900">Pain & Suffering</td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(scenarios.worst.painSuffering)}</td>
                  <td className="px-4 py-2 text-right font-semibold text-gray-900">{formatCurrency(scenarios.base.painSuffering)}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(scenarios.best.painSuffering)}</td>
                </tr>
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-4 py-2 text-gray-900">Gross Total</td>
                  <td className="px-4 py-2 text-right text-gray-900">{formatCurrency(scenarios.worst.pastMedical + scenarios.worst.futureMedical + scenarios.worst.pastWages + scenarios.worst.futureWages + scenarios.worst.property + scenarios.worst.painSuffering)}</td>
                  <td className="px-4 py-2 text-right text-gray-900">{formatCurrency(scenarios.base.pastMedical + scenarios.base.futureMedical + scenarios.base.pastWages + scenarios.base.futureWages + scenarios.base.property + scenarios.base.painSuffering)}</td>
                  <td className="px-4 py-2 text-right text-gray-900">{formatCurrency(scenarios.best.pastMedical + scenarios.best.futureMedical + scenarios.best.pastWages + scenarios.best.futureWages + scenarios.best.property + scenarios.best.painSuffering)}</td>
                </tr>
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-4 py-2 text-gray-900">Success Probability</td>
                  <td className="px-4 py-2 text-right text-gray-900">{scenarios.worst.probability}%</td>
                  <td className="px-4 py-2 text-right text-gray-900">{scenarios.base.probability}%</td>
                  <td className="px-4 py-2 text-right text-gray-900">{scenarios.best.probability}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Client Net Recovery Calculator */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
            <h2 className="text-sm font-semibold text-peacock uppercase tracking-wide">Client Net Recovery Calculator</h2>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4 pb-4 border-b border-gray-200">
              <div>
                <label className="block text-[10px] font-semibold text-gray-600 uppercase mb-2">
                  Contingency Fee: {contingencyFee}%
                </label>
                <Slider
                  min={25}
                  max={40}
                  step={1}
                  value={[contingencyFee]}
                  onValueChange={(values) => setContingencyFee(values[0])}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-600 uppercase mb-2">
                  Trial Costs: {formatCurrency(trialCosts)}
                </label>
                <Slider
                  min={5000}
                  max={50000}
                  step={5000}
                  value={[trialCosts]}
                  onValueChange={(values) => setTrialCosts(values[0])}
                  className="w-full"
                />
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-700">Gross Damages</span>
                <span className="font-semibold text-gray-900">{formatCurrency(grossTotal)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200 bg-gray-50 px-2 -mx-2">
                <span className="text-gray-900">Less: Medical Liens (estimated net)</span>
                <span className="font-semibold text-gray-900">-{formatCurrency(extendedDamages.liens.estimatedNet)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-700">Net Available for Distribution</span>
                <span className="font-semibold text-gray-900">{formatCurrency(netAfterLiens)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-700">Less: Attorney Fees ({contingencyFee}%)</span>
                <span className="text-gray-600">-{formatCurrency(attorneyFees)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-700">Less: Trial Costs</span>
                <span className="text-gray-600">-{formatCurrency(trialCosts)}</span>
              </div>
              <div className="flex justify-between py-3 border border-gray-400 rounded-md bg-gray-50 px-3">
                <span className="font-semibold text-gray-900">Client Net Recovery</span>
                <span className="text-lg font-bold text-true-turquoise">{formatCurrency(clientNet)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Settlement Range */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">Settlement Valuation Range</h2>
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <div className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Conservative</div>
              <div className="text-lg font-semibold text-gray-900">{formatCurrency(mockDamages.settlementRange.low)}</div>
              <div className="text-[10px] text-gray-500 mt-1">Minimum settlement</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Target</div>
              <div className="text-lg font-semibold text-gray-900">{formatCurrency((mockDamages.settlementRange.low + mockDamages.settlementRange.high) / 2)}</div>
              <div className="text-[10px] text-gray-500 mt-1">Recommended demand</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Optimistic</div>
              <div className="text-lg font-semibold text-gray-900">{formatCurrency(mockDamages.settlementRange.high)}</div>
              <div className="text-[10px] text-gray-500 mt-1">Maximum settlement</div>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Settlement Recommendations</h2>
          <ul className="space-y-2 text-xs text-gray-700">
            <li>• <strong>Initial demand:</strong> {formatCurrency(mockDamages.settlementRange.high)} (supported by comparable verdicts)</li>
            <li>• <strong>Walk-away floor:</strong> {formatCurrency(95000)} (covers client net + trial cost risk)</li>
            <li>• <strong>Leverage:</strong> Defendant admission of fault, clear liability, strong documentation</li>
            <li>• <strong>P&S multiplier:</strong> {psMultiplier}x medical expenses (within market range of 1.5-2.5x)</li>
            <li>• <strong>Lien strategy:</strong> Negotiate health insurance lien down from {formatCurrency(extendedDamages.liens.total)} to ~{formatCurrency(extendedDamages.liens.estimatedNet)}</li>
            <li>• <strong>Policy limits:</strong> $100,000 BI limit - case value exceeds limits, consider policy limits demand</li>
          </ul>
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
    </TooltipProvider>
  );
}

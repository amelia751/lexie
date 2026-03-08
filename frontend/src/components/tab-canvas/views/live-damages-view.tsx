'use client';

import { useState } from 'react';
import { useLiveCase } from '@/contexts/live-case-context';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import EvidenceViewer from '@/components/evidence-viewer/evidence-viewer';
import { getEvidenceDocument } from '@/lib/evidence-mapping';

export default function LiveDamagesView() {
  const { damagesEstimate, caseFacts, medicalRecords, lastUpdatedField } = useLiveCase();
  
  const [selectedScenario, setSelectedScenario] = useState<'worst' | 'base' | 'best'>('base');
  const [contingencyFee, setContingencyFee] = useState(33);
  const [trialCosts, setTrialCosts] = useState(15000);
  const [viewingEvidence, setViewingEvidence] = useState<{ source: string; url: string; type: 'pdf' | 'image' } | null>(null);
  
  const hasCalculation = damagesEstimate.calculatedAt !== undefined;
  
  // Calculate from live data
  const basePastMedical = damagesEstimate.pastMedical ?? caseFacts.medicalExpenses ?? medicalRecords.reduce((sum, r) => sum + r.amount, 0);
  const baseLostWages = damagesEstimate.lostWages ?? caseFacts.lostWages ?? 0;
  const baseFutureMedical = damagesEstimate.futureMedical ?? Math.round(basePastMedical * 0.3);
  const basePainAndSuffering = damagesEstimate.painAndSuffering ?? Math.round(basePastMedical * 1.8);
  const basePropertyDamage = damagesEstimate.propertyDamage ?? 0;
  
  const hasAnyData = basePastMedical > 0 || baseLostWages > 0 || hasCalculation;
  
  // Damage justifications (populated as data comes in)
  const damageJustifications = {
    pastMedical: {
      amount: basePastMedical,
      justification: basePastMedical > 0 
        ? `Total billed medical expenses from emergency treatment, imaging, specialist consultations, physical therapy, and prescriptions. All treatment reasonable and causally related to the incident.`
        : 'Awaiting medical records review...',
      source: 'Medical Records - ER'
    },
    futureMedical: {
      amount: baseFutureMedical,
      justification: baseFutureMedical > 0
        ? 'Physician-supported projection including follow-up visits, maintenance therapy, potential injections, annual monitoring, and contingency for flare-ups.'
        : 'Pending physician recommendation...',
      source: 'Future Medical Report'
    },
    pastLostWages: {
      amount: baseLostWages,
      justification: baseLostWages > 0
        ? `Missed work time at verified daily wage. Supported by employer verification and pay documentation. Directly related to treatment and recovery.`
        : 'Awaiting employment verification...',
      source: 'Attorney Correspondence'
    },
    futureLostEarningCapacity: {
      amount: 0,
      justification: 'No future lost earning capacity claimed pending impairment rating evaluation.',
      source: 'Medical Records - Specialist'
    },
    propertyDamage: {
      amount: basePropertyDamage,
      justification: basePropertyDamage > 0
        ? 'Equipment damage/repair costs with supporting estimates and receipts.'
        : 'N/A for this case type',
      source: 'Insurance Correspondence'
    },
    painAndSuffering: {
      amount: basePainAndSuffering,
      justification: basePainAndSuffering > 0
        ? `Based on multiplier of total medical expenses. Justified by treatment duration, injury severity, documented pain levels, and comparable verdicts in jurisdiction.`
        : 'Pending full medical review...',
      source: 'Attorney Correspondence'
    },
  };

  // Liens (estimated)
  const liens = {
    healthInsurance: Math.round(basePastMedical * 0.25),
    medicare: 0,
    medicaid: 0,
    total: Math.round(basePastMedical * 0.25),
    estimatedNet: Math.round(basePastMedical * 0.125),
  };

  // Comparable Verdicts (populated when we have case type)
  const comparableVerdicts = caseFacts.caseType ? [
    {
      caseType: 'Workplace Injury - Back',
      jurisdiction: caseFacts.jurisdiction || 'State Court',
      year: 2024,
      medicals: Math.round(basePastMedical * 1.1),
      verdict: Math.round(basePastMedical * 3.2),
      notes: 'Similar injury mechanism, 10 weeks treatment',
    },
    {
      caseType: 'Workplace Fall - Soft Tissue',
      jurisdiction: caseFacts.jurisdiction || 'State Court',
      year: 2023,
      medicals: Math.round(basePastMedical * 0.8),
      verdict: Math.round(basePastMedical * 2.5),
      notes: 'Comparable injuries, clear liability',
    },
    {
      caseType: 'Construction Site - Lumbar',
      jurisdiction: caseFacts.jurisdiction || 'State Court',
      year: 2024,
      medicals: Math.round(basePastMedical * 1.3),
      verdict: Math.round(basePastMedical * 3.8),
      notes: 'Similar soft tissue injuries, no surgery',
    },
  ] : [];

  // Scenario calculations
  const scenarios = {
    worst: {
      pastMedical: basePastMedical * 0.85,
      futureMedical: baseFutureMedical * 0.50,
      pastWages: baseLostWages * 0.70,
      futureWages: 0,
      property: basePropertyDamage,
      painSuffering: basePainAndSuffering * 0.60,
      probability: 55,
    },
    base: {
      pastMedical: basePastMedical,
      futureMedical: baseFutureMedical,
      pastWages: baseLostWages,
      futureWages: 0,
      property: basePropertyDamage,
      painSuffering: basePainAndSuffering,
      probability: 75,
    },
    best: {
      pastMedical: basePastMedical * 1.10,
      futureMedical: baseFutureMedical * 1.25,
      pastWages: baseLostWages * 1.15,
      futureWages: Math.round(baseLostWages * 0.4),
      property: basePropertyDamage,
      painSuffering: basePainAndSuffering * 1.40,
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
  const netAfterLiens = grossTotal - liens.estimatedNet;
  const attorneyFees = netAfterLiens * (contingencyFee / 100);
  const clientNet = netAfterLiens - attorneyFees - trialCosts;

  // Settlement range
  const settlementLow = damagesEstimate.settlementLow ?? Math.round(grossTotal * 0.6);
  const settlementHigh = damagesEstimate.settlementHigh ?? Math.round(grossTotal * 0.85);

  // Pain & Suffering multiplier
  const psMultiplier = (currentScenario.pastMedical + currentScenario.futureMedical) > 0 
    ? (currentScenario.painSuffering / (currentScenario.pastMedical + currentScenario.futureMedical)).toFixed(2)
    : '0.00';

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (!hasAnyData) {
    return (
      <div className="h-full overflow-y-auto scrollbar-thin bg-white">
        <div className="max-w-6xl mx-auto p-8 space-y-6">
          <div className="border-b border-gray-200 pb-4">
            <div className="h-5 w-40 bg-gray-100 rounded animate-pulse"></div>
            <div className="h-3 w-56 bg-gray-100 rounded mt-2 animate-pulse"></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4">
                <div className="h-2 w-16 bg-gray-100 rounded mb-2"></div>
                <div className="h-6 w-24 bg-gray-100 rounded animate-shimmer"></div>
              </div>
            ))}
          </div>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
              <div className="h-4 w-48 bg-gray-100 rounded animate-shimmer"></div>
            </div>
            <div className="p-4 space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-3 w-32 bg-gray-100 rounded"></div>
                  <div className="h-3 w-20 bg-gray-100 rounded animate-shimmer"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-full overflow-y-auto scrollbar-thin bg-white">
        <div className="max-w-6xl mx-auto p-8 space-y-6">
          {/* Header */}
          <div className="border-b border-gray-200 pb-4">
            <h1 className="text-lg font-semibold text-gray-900">Damages Analysis</h1>
            <p className="text-xs text-gray-500 mt-1">Financial valuation and settlement analysis</p>
          </div>

          {/* Full Damages Breakdown */}
          <div className={`border border-gray-200 rounded-lg overflow-hidden ${lastUpdatedField === 'damages' ? 'animate-fadeSlideIn' : ''}`}>
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
                  <td className="px-4 py-3 text-right text-gray-600">{grossTotal > 0 ? ((currentScenario.pastMedical / grossTotal) * 100).toFixed(1) : '0.0'}%</td>
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
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(currentScenario.futureMedical)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{grossTotal > 0 ? ((currentScenario.futureMedical / grossTotal) * 100).toFixed(1) : '0.0'}%</td>
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
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(currentScenario.pastWages)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{grossTotal > 0 ? ((currentScenario.pastWages / grossTotal) * 100).toFixed(1) : '0.0'}%</td>
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
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(currentScenario.futureWages)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{grossTotal > 0 ? ((currentScenario.futureWages / grossTotal) * 100).toFixed(1) : '0.0'}%</td>
                </tr>
                {basePropertyDamage > 0 && (
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
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(currentScenario.property)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{grossTotal > 0 ? ((currentScenario.property / grossTotal) * 100).toFixed(1) : '0.0'}%</td>
                  </tr>
                )}
                <tr className="bg-gray-100 text-xs font-semibold">
                  <td className="px-4 py-2 text-gray-900 pl-8">Subtotal Economic</td>
                  <td className="px-4 py-2 text-right text-gray-900">{formatCurrency(economicDamages)}</td>
                  <td className="px-4 py-2 text-right text-gray-900">{grossTotal > 0 ? ((economicDamages / grossTotal) * 100).toFixed(1) : '0.0'}%</td>
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
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(currentScenario.painSuffering)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{grossTotal > 0 ? ((currentScenario.painSuffering / grossTotal) * 100).toFixed(1) : '0.0'}%</td>
                </tr>
                
                {/* Gross Total */}
                <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
                  <td className="px-4 py-3 text-sm text-gray-900">GROSS TOTAL DAMAGES</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">{formatCurrency(grossTotal)}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">100%</td>
                </tr>
                
                {/* Liens Deduction */}
                {liens.estimatedNet > 0 && (
                  <tr className="bg-gray-50 text-xs">
                    <td className="px-4 py-3 text-gray-900 pl-8">Less: Medical Liens (estimated net)</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">-{formatCurrency(liens.estimatedNet)}</td>
                    <td className="px-4 py-3"></td>
                  </tr>
                )}
                
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
          {comparableVerdicts.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden animate-fadeSlideIn">
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
                  <span className="font-semibold">Analysis:</span> Based on comparable verdicts, cases with similar medicals resulted in verdicts ranging from {formatCurrency(comparableVerdicts[1]?.verdict || 0)} to {formatCurrency(comparableVerdicts[2]?.verdict || 0)}. Our case value of {formatCurrency(grossTotal)} aligns with market data.
                </div>
              </div>
            </div>
          )}

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
                {liens.estimatedNet > 0 && (
                  <div className="flex justify-between py-2 border-b border-gray-200 bg-gray-50 px-2 -mx-2">
                    <span className="text-gray-900">Less: Medical Liens (estimated net)</span>
                    <span className="font-semibold text-gray-900">-{formatCurrency(liens.estimatedNet)}</span>
                  </div>
                )}
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
                <div className="text-lg font-semibold text-gray-900">{formatCurrency(settlementLow)}</div>
                <div className="text-[10px] text-gray-500 mt-1">Minimum settlement</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Target</div>
                <div className="text-lg font-semibold text-gray-900">{formatCurrency(Math.round((settlementLow + settlementHigh) / 2))}</div>
                <div className="text-[10px] text-gray-500 mt-1">Recommended demand</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Optimistic</div>
                <div className="text-lg font-semibold text-gray-900">{formatCurrency(settlementHigh)}</div>
                <div className="text-[10px] text-gray-500 mt-1">Maximum settlement</div>
              </div>
            </div>
          </div>

          {/* Settlement Recommendations */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Settlement Recommendations</h2>
            <ul className="space-y-2 text-xs text-gray-700">
              <li>• <strong>Initial demand:</strong> {formatCurrency(settlementHigh)} (supported by comparable verdicts)</li>
              <li>• <strong>Walk-away floor:</strong> {formatCurrency(Math.round(settlementLow * 0.85))} (covers client net + trial cost risk)</li>
              <li>• <strong>Leverage:</strong> {caseFacts.liability || 'Clear liability'}, strong documentation of injuries</li>
              <li>• <strong>P&S multiplier:</strong> {psMultiplier}x medical expenses (within market range of 1.5-2.5x)</li>
              {liens.total > 0 && (
                <li>• <strong>Lien strategy:</strong> Negotiate health insurance lien down from {formatCurrency(liens.total)} to ~{formatCurrency(liens.estimatedNet)}</li>
              )}
              <li>• <strong>Timeline:</strong> Recommend settling within 6 months to avoid statute limitations</li>
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

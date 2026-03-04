// Mock data for legal case intelligence demo

export interface Evidence {
  id: string;
  name: string;
  type: 'medical' | 'photo' | 'insurance' | 'police' | 'deposition';
  uploadedAt: string;
  size: string;
  status: 'processed' | 'processing' | 'pending';
}

export interface CaseTimeline {
  date: string;
  event: string;
  source: string;
}

export interface DamagesCalculation {
  medicalExpenses: number;
  lostWages: number;
  painAndSuffering: number;
  total: number;
  settlementRange: {
    low: number;
    high: number;
  };
  probability: number;
}

export interface VoiceMessage {
  role: 'agent' | 'plaintiff';
  content: string;
  timestamp: string;
}

export const mockEvidence: Evidence[] = [
  {
    id: '1',
    name: 'Medical Records - General Hospital.pdf',
    type: 'medical',
    uploadedAt: '2024-02-20 14:32',
    size: '2.4 MB',
    status: 'processed',
  },
  {
    id: '2',
    name: 'Accident Scene Photos.zip',
    type: 'photo',
    uploadedAt: '2024-02-20 14:35',
    size: '15.8 MB',
    status: 'processed',
  },
  {
    id: '3',
    name: 'Insurance Correspondence.pdf',
    type: 'insurance',
    uploadedAt: '2024-02-20 14:38',
    size: '856 KB',
    status: 'processed',
  },
  {
    id: '4',
    name: 'Police Report #2024-1234.pdf',
    type: 'police',
    uploadedAt: '2024-02-20 14:40',
    size: '1.2 MB',
    status: 'processed',
  },
  {
    id: '5',
    name: 'X-Ray Results - Dr. Smith.pdf',
    type: 'medical',
    uploadedAt: '2024-02-20 15:02',
    size: '3.1 MB',
    status: 'processed',
  },
  {
    id: '6',
    name: 'Physical Therapy Records.pdf',
    type: 'medical',
    uploadedAt: '2024-02-20 15:15',
    size: '1.8 MB',
    status: 'processing',
  },
];

export const mockTimeline: CaseTimeline[] = [
  {
    date: '2024-01-15',
    event: 'Motor vehicle accident occurred at intersection of Main St & Oak Ave',
    source: 'Police Report',
  },
  {
    date: '2024-01-15',
    event: 'Transported to General Hospital via ambulance',
    source: 'Medical Records',
  },
  {
    date: '2024-01-15',
    event: 'Initial diagnosis: Whiplash, lower back strain, contusions',
    source: 'Medical Records',
  },
  {
    date: '2024-01-16',
    event: 'Follow-up with primary care physician',
    source: 'Medical Records',
  },
  {
    date: '2024-01-18',
    event: 'X-rays ordered - Results show no fractures',
    source: 'Medical Records',
  },
  {
    date: '2024-01-22',
    event: 'Physical therapy prescribed - 3x weekly for 8 weeks',
    source: 'Medical Records',
  },
  {
    date: '2024-02-04',
    event: 'Defendant insurance company contacted plaintiff',
    source: 'Insurance Correspondence',
  },
  {
    date: '2024-02-04',
    event: 'Defendant admitted fault in email dated April 4',
    source: 'Insurance Correspondence',
  },
];

export const mockDamages: DamagesCalculation = {
  medicalExpenses: 48200,
  lostWages: 12400,
  painAndSuffering: 85000,
  total: 145600,
  settlementRange: {
    low: 85000,
    high: 130000,
  },
  probability: 72,
};

export const mockDamagesExtended = {
  // Past Economic Damages
  pastMedicalExpenses: 48200,
  pastLostWages: 12400,
  propertyDamage: 8500,
  
  // Future Economic Damages
  futureMedicalExpenses: 15000,
  futureLostEarningCapacity: 0,
  
  // Non-Economic Damages
  painAndSuffering: 85000,
  
  // Liens & Deductions
  liens: {
    medicareLien: 0,
    medicaidLien: 0,
    healthInsuranceSubrogation: 12450,
    erisa: 0,
    hospitalLien: 0,
    totalLiens: 12450,
  },
  
  // Permanent Impairment
  permanentImpairment: {
    rating: 0,
    description: 'No permanent impairment. Full recovery expected.',
    impactOnSettlement: 'neutral',
  },
  
  // Comparable Verdicts in Jurisdiction
  comparableVerdicts: [
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
  ],
  
  // Settlement Analysis
  grossTotal: 169100,
  netAfterLiens: 156650,
};

export const mockMedicalSummary = {
  totalBills: 48200,
  treatmentGaps: 3,
  treatmentDuration: '8 weeks',
  keyDiagnoses: [
    'Cervical spine whiplash (Grade II)',
    'Lumbar strain',
    'Soft tissue contusions',
  ],
  keyFindings: [
    'Patient reported persistent neck pain (7/10) for 3 weeks post-accident',
    'Limited range of motion in cervical spine',
    'Physical therapy showed gradual improvement',
    'No permanent impairment noted',
  ],
};

export const mockMedicalSummaryExtended = {
  // Past Medical Expenses
  pastMedicalTotal: 48200,
  
  // Future Medical Expenses
  futureMedical: {
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
  },
  
  // Permanent Impairment
  permanentImpairment: {
    wholePersonRating: 0,
    regionRating: 'Cervical: 0% | Lumbar: 0%',
    methodology: 'AMA Guides 5th Edition',
    evaluator: 'Dr. Robert Chen, MD (Treating Orthopedist)',
    date: '2024-03-15',
    prognosis: 'Full recovery expected. Residual symptoms may persist intermittently but not permanent.',
    maxMedicalImprovement: true,
    mmiDate: '2024-03-15',
  },
  
  // Medical Liens
  liens: {
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
    erisa: null,
    hospitalLien: null,
    totalLiens: 12450,
    estimatedNetLiens: 6225,
  },
  
  // Pre-existing Conditions
  preExistingConditions: {
    identified: false,
    conditions: [],
    analysis: 'Medical records review shows no documented pre-existing cervical or lumbar conditions. No prior chiropractic or orthopedic treatment in 5 years preceding accident.',
    defenseRisk: 'Low',
  },
  
  // Causation Analysis
  causation: {
    rating: 'Strong',
    factors: [
      'Immediate symptom onset post-collision',
      'Mechanism of injury consistent with diagnoses',
      'No gap between accident and initial treatment',
      'No prior complaints of similar symptoms',
      'Objective findings on imaging',
    ],
  },
};

export const mockConversation: VoiceMessage[] = [
  {
    role: 'agent',
    content: "Hello, I'm Lexie, your AI legal intake assistant. I'm here to help gather information about your case. Can you tell me what happened?",
    timestamp: '10:30:15',
  },
  {
    role: 'plaintiff',
    content: "Hi, yes. I was in a car accident about a month ago. I was stopped at a red light and someone rear-ended me.",
    timestamp: '10:30:32',
  },
  {
    role: 'agent',
    content: "I'm sorry to hear that. Let's gather some important details. Can you tell me the exact date and location of the accident?",
    timestamp: '10:30:45',
  },
  {
    role: 'plaintiff',
    content: "It was January 15th, 2024, at around 3:30 PM. It happened at the intersection of Main Street and Oak Avenue.",
    timestamp: '10:31:02',
  },
  {
    role: 'agent',
    content: "Thank you. Were you injured in the accident? Did you seek medical attention?",
    timestamp: '10:31:15',
  },
  {
    role: 'plaintiff',
    content: "Yes, I was taken to the hospital by ambulance. I had really bad neck and back pain. They diagnosed me with whiplash.",
    timestamp: '10:31:35',
  },
  {
    role: 'agent',
    content: "I understand. Have you been receiving ongoing treatment for your injuries? Can you describe your current symptoms?",
    timestamp: '10:31:48',
  },
  {
    role: 'plaintiff',
    content: "I've been going to physical therapy three times a week. The pain is getting better, but I still can't turn my head all the way without discomfort.",
    timestamp: '10:32:10',
  },
];

export const mockCaseSummary = {
  caseId: 'PI-2024-001234',
  plaintiffName: 'Sarah Johnson',
  incidentDate: '2024-01-15',
  incidentType: 'Motor Vehicle Accident',
  status: 'Active - Discovery Phase',
  attorney: 'Unassigned',
  estimatedValue: '$85,000 - $130,000',
  // New fields for legal completeness
  defendant: {
    name: 'Michael R. Thompson',
    insuranceCarrier: 'State Farm Insurance',
    policyNumber: 'SF-2024-8847291',
    policyLimits: {
      bodilyInjury: 100000,
      perAccident: 300000,
    },
    adjusterName: 'Karen Williams',
    adjusterPhone: '(555) 234-5678',
    adjusterEmail: 'kwilliams@statefarm.com',
  },
  jurisdiction: {
    state: 'California',
    county: 'Los Angeles',
    venue: 'Los Angeles Superior Court',
  },
  statuteOfLimitations: {
    deadline: '2026-01-15',
    type: 'Personal Injury',
    yearsAllowed: 2,
    daysRemaining: 320,
  },
  comparativeFault: {
    plaintiffFault: 0,
    defendantFault: 100,
    analysis: 'Clear rear-end collision with defendant admission. No contributory negligence identified.',
  },
  narrative: `On January 15, 2024, at approximately 3:30 PM, plaintiff Sarah Johnson was operating her vehicle while stopped at a red light at the intersection of Main Street and Oak Avenue. The defendant's vehicle failed to stop and rear-ended the plaintiff's vehicle, causing significant impact.

Plaintiff was immediately transported to General Hospital via ambulance, where she was diagnosed with cervical spine whiplash (Grade II), lumbar strain, and soft tissue contusions. Initial pain levels were reported at 7/10 for neck pain.

Following the accident, plaintiff underwent a comprehensive treatment plan including follow-up visits with her primary care physician, diagnostic X-rays (showing no fractures), and a prescribed physical therapy regimen of 3 sessions per week for 8 weeks.

On February 4, 2024, the defendant's insurance company contacted the plaintiff, and in subsequent email correspondence dated the same day, the defendant admitted fault in the accident.

Total medical expenses to date: $48,200
Estimated lost wages: $12,400
Treatment gaps identified: 3 instances

The case presents strong liability with the defendant's admission of fault. Medical documentation supports the claimed injuries with objective findings and consistent treatment patterns.`,
};

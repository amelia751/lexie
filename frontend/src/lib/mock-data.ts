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

export const mockMedicalSummary = {
  totalBills: 48200,
  treatmentGaps: 3,
  treatmentDuration: '6 weeks',
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
  narrative: `On January 15, 2024, at approximately 3:30 PM, plaintiff Sarah Johnson was operating her vehicle while stopped at a red light at the intersection of Main Street and Oak Avenue. The defendant's vehicle failed to stop and rear-ended the plaintiff's vehicle, causing significant impact.

Plaintiff was immediately transported to General Hospital via ambulance, where she was diagnosed with cervical spine whiplash (Grade II), lumbar strain, and soft tissue contusions. Initial pain levels were reported at 7/10 for neck pain.

Following the accident, plaintiff underwent a comprehensive treatment plan including follow-up visits with her primary care physician, diagnostic X-rays (showing no fractures), and a prescribed physical therapy regimen of 3 sessions per week for 8 weeks.

On February 4, 2024, the defendant's insurance company contacted the plaintiff, and in subsequent email correspondence dated the same day, the defendant admitted fault in the accident.

Total medical expenses to date: $48,200
Estimated lost wages: $12,400
Treatment gaps identified: 3 instances

The case presents strong liability with the defendant's admission of fault. Medical documentation supports the claimed injuries with objective findings and consistent treatment patterns.`,
};

// Map evidence sources to document URLs
// Using placeholder documents for demo purposes

export interface EvidenceDocument {
  url: string;
  type: 'pdf' | 'image';
}

export const evidenceMap: Record<string, EvidenceDocument> = {
  // Police and EMS Reports
  'Police Report #2024-1234': {
    url: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
    type: 'pdf',
  },
  'EMS Report': {
    url: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
    type: 'pdf',
  },

  // Medical Records
  'Medical Records - ER': {
    url: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
    type: 'pdf',
  },
  'Medical Records - PCP': {
    url: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
    type: 'pdf',
  },
  'Medical Records - Imaging': {
    url: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
    type: 'pdf',
  },
  'Medical Records - Specialist': {
    url: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
    type: 'pdf',
  },
  'Medical Records - PT': {
    url: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
    type: 'pdf',
  },

  // Insurance and Legal
  'Insurance Correspondence': {
    url: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
    type: 'pdf',
  },
  'Attorney Correspondence': {
    url: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
    type: 'pdf',
  },

  // Photos
  'Accident Scene Photos': {
    url: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=1600&h=900&fit=crop',
    type: 'image',
  },
  'Vehicle Damage Photos': {
    url: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=1600&h=900&fit=crop',
    type: 'image',
  },

  // Medical Analysis
  'Medical Records Review': {
    url: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
    type: 'pdf',
  },
  'Lien Documentation': {
    url: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
    type: 'pdf',
  },
  'Future Medical Report': {
    url: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
    type: 'pdf',
  },
};

export function getEvidenceDocument(source: string): EvidenceDocument | null {
  return evidenceMap[source] || null;
}

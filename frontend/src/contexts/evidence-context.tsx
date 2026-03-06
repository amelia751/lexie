'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { mockEvidence, type Evidence } from '@/lib/mock-data';

interface EvidenceItem {
  id: string;
  title: string;
  notes: string;
  dateAdded: string;
  completed: boolean;
  evidenceId?: string; // Links to Evidence in file explorer
}

interface EvidenceContextType {
  evidence: Evidence[];
  evidenceItems: EvidenceItem[];
  addEvidence: (evidence: Evidence) => void;
  addEvidenceItem: (item: EvidenceItem) => void;
  updateEvidenceItem: (id: string, updates: Partial<EvidenceItem>) => void;
  deleteEvidenceItem: (id: string) => void;
  linkEvidenceToItem: (itemId: string, evidenceId: string) => void;
}

const EvidenceContext = createContext<EvidenceContextType | undefined>(undefined);

export function EvidenceProvider({ children }: { children: ReactNode }) {
  const [evidence, setEvidence] = useState<Evidence[]>(mockEvidence);
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([
    {
      id: '1',
      title: 'Medical Records - January Visit',
      notes: 'Initial consultation documents and diagnosis',
      dateAdded: '2024-03-01',
      completed: true,
      evidenceId: '1', // Linked to first evidence
    },
    {
      id: '2',
      title: 'Witness Statement - John Doe',
      notes: 'Witness account of the incident, needs follow-up',
      dateAdded: '2024-03-02',
      completed: false,
    },
  ]);

  const addEvidence = (newEvidence: Evidence) => {
    setEvidence((prev) => [...prev, newEvidence]);
  };

  const addEvidenceItem = (item: EvidenceItem) => {
    setEvidenceItems((prev) => [...prev, item]);
  };

  const updateEvidenceItem = (id: string, updates: Partial<EvidenceItem>) => {
    setEvidenceItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const deleteEvidenceItem = (id: string) => {
    setEvidenceItems((prev) => prev.filter((item) => item.id !== id));
  };

  const linkEvidenceToItem = (itemId: string, evidenceId: string) => {
    updateEvidenceItem(itemId, { evidenceId });
  };

  return (
    <EvidenceContext.Provider
      value={{
        evidence,
        evidenceItems,
        addEvidence,
        addEvidenceItem,
        updateEvidenceItem,
        deleteEvidenceItem,
        linkEvidenceToItem,
      }}
    >
      {children}
    </EvidenceContext.Provider>
  );
}

export function useEvidence() {
  const context = useContext(EvidenceContext);
  if (context === undefined) {
    throw new Error('useEvidence must be used within an EvidenceProvider');
  }
  return context;
}

'use client';

import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { mockEvidence, type Evidence } from '@/lib/mock-data';

interface EvidenceItem {
  id: string;
  title: string;
  notes: string;
  dateAdded: string;
  completed: boolean;
  evidenceId?: string; // Links to Evidence in file explorer
}

type EvidenceMode = 'mock' | 'live';

interface EvidenceContextType {
  mode: EvidenceMode;
  setMode: (mode: EvidenceMode) => void;
  evidence: Evidence[];
  evidenceItems: EvidenceItem[];
  addEvidence: (evidence: Evidence) => void;
  addEvidenceItem: (item: EvidenceItem) => void;
  updateEvidenceItem: (id: string, updates: Partial<EvidenceItem>) => void;
  deleteEvidenceItem: (id: string) => void;
  linkEvidenceToItem: (itemId: string, evidenceId: string) => void;
  updateEvidenceStatus: (id: string, status: Evidence['status']) => void;
  resetLiveEvidence: () => void;
}

const EvidenceContext = createContext<EvidenceContextType | undefined>(undefined);

const mockEvidenceItems: EvidenceItem[] = [
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
];

export function EvidenceProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<EvidenceMode>('live'); // Default to live mode
  
  // Live mode state (starts empty)
  const [liveEvidence, setLiveEvidence] = useState<Evidence[]>([]);
  const [liveEvidenceItems, setLiveEvidenceItems] = useState<EvidenceItem[]>([]);
  
  // Mock mode state
  const [mockEvidenceState, setMockEvidenceState] = useState<Evidence[]>(mockEvidence);
  const [mockEvidenceItemsState, setMockEvidenceItemsState] = useState<EvidenceItem[]>(mockEvidenceItems);

  // Get current evidence based on mode
  const evidence = mode === 'live' ? liveEvidence : mockEvidenceState;
  const evidenceItems = mode === 'live' ? liveEvidenceItems : mockEvidenceItemsState;

  const addEvidence = useCallback((newEvidence: Evidence) => {
    const setEvidence = mode === 'live' ? setLiveEvidence : setMockEvidenceState;
    setEvidence((prev) => {
      const existingIndex = prev.findIndex(item => item.id === newEvidence.id);
      if (existingIndex >= 0) {
        // Update existing item
        const updated = [...prev];
        updated[existingIndex] = newEvidence;
        return updated;
      }
      // Add new item
      return [...prev, newEvidence];
    });
  }, [mode]);

  const addEvidenceItem = useCallback((item: EvidenceItem) => {
    const setItems = mode === 'live' ? setLiveEvidenceItems : setMockEvidenceItemsState;
    setItems((prev) => [...prev, item]);
  }, [mode]);

  const updateEvidenceItem = useCallback((id: string, updates: Partial<EvidenceItem>) => {
    const setItems = mode === 'live' ? setLiveEvidenceItems : setMockEvidenceItemsState;
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  }, [mode]);

  const deleteEvidenceItem = useCallback((id: string) => {
    const setItems = mode === 'live' ? setLiveEvidenceItems : setMockEvidenceItemsState;
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, [mode]);

  const linkEvidenceToItem = useCallback((itemId: string, evidenceId: string) => {
    updateEvidenceItem(itemId, { evidenceId });
  }, [updateEvidenceItem]);

  const updateEvidenceStatus = useCallback((id: string, status: Evidence['status']) => {
    const setEvidence = mode === 'live' ? setLiveEvidence : setMockEvidenceState;
    setEvidence((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status } : item))
    );
  }, [mode]);

  const resetLiveEvidence = useCallback(() => {
    setLiveEvidence([]);
    setLiveEvidenceItems([]);
  }, []);

  return (
    <EvidenceContext.Provider
      value={{
        mode,
        setMode,
        evidence,
        evidenceItems,
        addEvidence,
        addEvidenceItem,
        updateEvidenceItem,
        deleteEvidenceItem,
        linkEvidenceToItem,
        updateEvidenceStatus,
        resetLiveEvidence,
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

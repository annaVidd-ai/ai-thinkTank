'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Tab = 'pipeline' | 'alerts' | 'clusters' | 'debates' | 'backtest' | 'config';

interface DashboardState {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  selectedDebateId: string | null;
  setSelectedDebateId: (id: string | null) => void;
  readAlertIds: string[];
  markAlertRead: (id: string) => void;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      activeTab: 'pipeline',
      setActiveTab: (tab) => set({ activeTab: tab }),
      selectedDebateId: null,
      setSelectedDebateId: (id) => set({ selectedDebateId: id }),
      readAlertIds: [],
      markAlertRead: (id) =>
        set((s) => ({
          readAlertIds: s.readAlertIds.includes(id)
            ? s.readAlertIds
            : [...s.readAlertIds, id],
        })),
    }),
    { name: 'dashboard-store' },
  ),
);

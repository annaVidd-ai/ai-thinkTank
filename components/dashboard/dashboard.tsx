'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useDashboardStore } from '@/lib/dashboard-store';
import { cn } from '@/lib/utils';
import { PipelineTab } from './pipeline-tab';
import { AlertsTab }   from './alerts-tab';
import { ClustersTab } from './clusters-tab';
import { DebatesTab }  from './debates-tab';
import { BacktestTab } from './backtest-tab';
import { ConfigTab }   from './config-tab';

const TABS = [
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'alerts',   label: 'Alerts'   },
  { id: 'clusters', label: 'Clusters' },
  { id: 'debates',  label: 'Debates'  },
  { id: 'backtest', label: 'Backtest' },
  { id: 'config',   label: 'Config'   },
] as const;

type Tab = typeof TABS[number]['id'];

const TAB_COMPONENTS: Record<Tab, React.ComponentType> = {
  pipeline: PipelineTab,
  alerts:   AlertsTab,
  clusters: ClustersTab,
  debates:  DebatesTab,
  backtest: BacktestTab,
  config:   ConfigTab,
};

export function Dashboard() {
  const { activeTab, setActiveTab } = useDashboardStore();

  const ActiveComponent = TAB_COMPONENTS[activeTab as Tab] ?? PipelineTab;

  return (
    <div className="flex flex-col flex-1">
      {/* Tab bar */}
      <nav className="flex border-b border-zinc-800 px-6 gap-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'relative px-4 py-3 text-xs font-mono font-medium whitespace-nowrap transition-colors',
              activeTab === tab.id
                ? 'text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300',
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="tab-underline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400"
              />
            )}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            <ActiveComponent />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

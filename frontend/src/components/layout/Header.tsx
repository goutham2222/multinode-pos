import React from 'react';
import { Server, RefreshCw } from 'lucide-react';
import { NodeStatus } from '../../types';

interface HeaderProps {
  activeTab: string;
  targetNode: string;
  setTargetNode: (node: string) => void;
  nodes: NodeStatus[];
  onRefresh: () => void;
  loading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  targetNode,
  setTargetNode,
  nodes,
  onRefresh,
  loading
}) => {
  const titles: Record<string, { title: string; subtitle: string }> = {
    pos: {
      title: 'POS Checkout Terminal',
      subtitle: 'Transactional multi-item order placement & trigger constraints'
    },
    products: {
      title: 'Catalog & Inventory Management',
      subtitle: 'Real-time stock adjustments and audit history triggered on price updates'
    },
    orders: {
      title: 'Orders Explorer & Analytics',
      subtitle: 'Parameterized SQL queries and line-item financial breakdowns'
    },
    cluster: {
      title: 'Multi-Node & CAP Theorem Verifier',
      subtitle: 'Peer-to-peer synchronous multi-master topology and live replication probes'
    },
    security: {
      title: 'SQL Injection Defense Playground',
      subtitle: 'Comparing parameterized prepared statements against injection attempts'
    }
  };

  const current = titles[activeTab] || { title: 'Dashboard', subtitle: '' };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10 shadow-xs">
      {/* Current Page Title */}
      <div>
        <h1 className="text-lg font-bold text-slate-900 tracking-tight">{current.title}</h1>
        <p className="text-xs text-slate-500">{current.subtitle}</p>
      </div>

      {/* Target Node Controller */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2 bg-slate-100/80 border border-slate-200 p-1 rounded-xl">
          <div className="flex items-center space-x-1.5 px-2 text-xs font-semibold text-slate-600">
            <Server className="h-3.5 w-3.5 text-emerald-600" />
            <span>Target Node:</span>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setTargetNode('auto')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                targetNode === 'auto'
                  ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Auto Failover
            </button>

            {nodes.map((node) => {
              const isSelected = targetNode === node.id.toString();
              return (
                <button
                  key={node.id}
                  onClick={() => setTargetNode(node.id.toString())}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isSelected ? 'bg-white' : node.online ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  />
                  <span>{node.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Refresh telemetry button */}
        <button
          onClick={onRefresh}
          title="Refresh Node Telemetry"
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
        </button>
      </div>
    </header>
  );
};

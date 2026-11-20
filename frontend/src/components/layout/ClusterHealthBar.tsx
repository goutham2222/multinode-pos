import React from 'react';
import { NodeStatus } from '../../types';
import { Server } from 'lucide-react';

interface ClusterHealthBarProps {
  nodes: NodeStatus[];
  quorumHealthy: boolean;
  selectedNode: string;
}

export const ClusterHealthBar: React.FC<ClusterHealthBarProps> = ({
  nodes,
  quorumHealthy,
  selectedNode
}) => {
  return (
    <div className="bg-slate-900/60 border-b border-slate-800/80 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Quorum Overview */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5">
            {quorumHealthy ? (
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            ) : (
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500"></span>
            )}
            <span className="font-semibold text-slate-200">
              Galera Quorum: {quorumHealthy ? 'Active (3/3 Nodes Synced)' : 'Degraded'}
            </span>
          </div>

          <span className="text-slate-600">|</span>

          <span className="text-slate-400">
            CAP Guarantee: <strong className="text-emerald-400">CP (Strict Causal Consistency)</strong>
          </span>

          <span className="text-slate-600">|</span>

          <span className="text-slate-400">
            wsrep_sync_wait: <code className="text-emerald-300 font-mono bg-slate-800 px-1.5 py-0.5 rounded">7 (Bitmask: Read/Write/Update)</code>
          </span>
        </div>

        {/* Nodes Grid */}
        <div className="flex items-center space-x-2">
          {nodes.map((node) => {
            const isSelected = selectedNode === node.id.toString() || (selectedNode === 'auto' && node.id === 1);
            return (
              <div
                key={node.id}
                className={`flex items-center space-x-2 px-2.5 py-1 rounded-md border text-xs transition-all ${
                  node.online
                    ? isSelected
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 shadow-sm'
                      : 'bg-slate-800/50 border-slate-700/60 text-slate-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                }`}
              >
                <Server className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-semibold">{node.name}</span>
                <span className="text-slate-400 font-mono text-[11px]">{node.host}</span>
                {node.online ? (
                  <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/60 px-1 rounded">
                    {node.ping_ms}ms
                  </span>
                ) : (
                  <span className="text-[10px] text-rose-400 font-mono bg-rose-950/60 px-1 rounded">
                    OFFLINE
                  </span>
                )}
                {isSelected && (
                  <span className="text-[9px] uppercase tracking-wider bg-emerald-500 text-slate-950 px-1 rounded font-bold">
                    Active Target
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

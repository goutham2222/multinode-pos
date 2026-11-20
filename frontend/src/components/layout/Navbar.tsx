import React from 'react';
import { ShoppingCart, Package, FileText, Database, ShieldCheck, Server, RefreshCw } from 'lucide-react';
import { NodeStatus } from '../../types';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  targetNode: string;
  setTargetNode: (node: string) => void;
  nodes: NodeStatus[];
  onRefresh: () => void;
  loading: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  targetNode,
  setTargetNode,
  nodes,
  onRefresh,
  loading
}) => {
  const tabs = [
    { id: 'pos', label: 'POS Terminal', icon: ShoppingCart },
    { id: 'products', label: 'Product Catalog & Audit', icon: Package },
    { id: 'orders', label: 'Orders Explorer', icon: FileText },
    { id: 'cluster', label: 'Multi-Node & CAP Verifier', icon: Database },
    { id: 'security', label: 'SQL Injection Defense', icon: ShieldCheck },
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Database className="h-5 w-5 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-white tracking-tight">MultiNode POS</span>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Galera CP Cluster
                </span>
              </div>
              <p className="text-xs text-slate-400">Azure 3-Node Synchronous Multi-Master</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex space-x-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Cluster Node Selector */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-lg">
              <Server className="h-4 w-4 text-emerald-400" />
              <label htmlFor="node-select" className="text-xs text-slate-400 font-medium">Target Node:</label>
              <select
                id="node-select"
                value={targetNode}
                onChange={(e) => setTargetNode(e.target.value)}
                className="bg-transparent text-xs text-slate-200 font-semibold focus:outline-none cursor-pointer"
              >
                <option value="auto" className="bg-slate-900 text-slate-200">Auto Failover</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id.toString()} className="bg-slate-900 text-slate-200">
                    {n.name} ({n.host.split('.')[0]}.* {n.online ? '🟢' : '🔴'})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={onRefresh}
              title="Refresh Cluster Telemetry"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Mobile Tab Row */}
        <div className="flex md:hidden overflow-x-auto py-2 space-x-1 border-t border-slate-800/60">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};

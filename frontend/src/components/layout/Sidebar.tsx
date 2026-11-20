import React from 'react';
import { ShoppingCart, Package, FileText, Database, ShieldCheck } from 'lucide-react';
import { NodeStatus } from '../../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  nodes: NodeStatus[];
  quorumHealthy: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  nodes,
  quorumHealthy
}) => {
  const onlineCount = nodes.filter(n => n.online).length;

  const sections = [
    {
      title: 'POINT OF SALE',
      items: [
        { id: 'pos', label: 'POS Checkout', icon: ShoppingCart },
        { id: 'products', label: 'Catalog & Inventory', icon: Package },
        { id: 'orders', label: 'Orders Explorer', icon: FileText },
      ]
    },
    {
      title: 'DISTRIBUTED CLUSTER',
      items: [
        { id: 'cluster', label: 'Cluster & CAP Verifier', icon: Database },
        { id: 'security', label: 'SQL Injection Defense', icon: ShieldCheck },
      ]
    }
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between h-screen shrink-0 shadow-sm z-20">
      <div>
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-600 flex items-center justify-center shadow-md shadow-emerald-600/20">
              <Database className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-base text-slate-900 tracking-tight">MultiNode POS</span>
              </div>
              <span className="text-[11px] font-medium text-slate-400">MariaDB Galera Multi-Master</span>
            </div>
          </div>
        </div>

        {/* Navigation Groups */}
        <nav className="p-4 space-y-6">
          {sections.map((sec, secIdx) => (
            <div key={secIdx}>
              <div className="px-3 mb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {sec.title}
              </div>
              <div className="space-y-1">
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom Cluster Health Card */}
      <div className="p-4 border-t border-slate-100">
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${quorumHealthy ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${quorumHealthy ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
              </span>
              <span className="font-bold text-slate-700">Galera Cluster</span>
            </div>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded">
              {onlineCount}/3 Synced
            </span>
          </div>

          <div className="text-[11px] text-slate-500 space-y-0.5 pt-1 border-t border-slate-200/60 font-mono">
            <div>Mode: <strong className="text-slate-700">Strict CP</strong></div>
            <div>Sync Wait: <strong className="text-slate-700">Bitmask 7</strong></div>
          </div>
        </div>
      </div>
    </aside>
  );
};

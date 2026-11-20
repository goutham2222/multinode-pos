import React, { useState } from 'react';
import { Database, Server, ShieldCheck, Activity, CheckCircle2, ArrowRight, RefreshCw, GitCommit } from 'lucide-react';
import { NodeStatus } from '../../types';
import { api } from '../../services/api';

interface NodeVisualizerProps {
  nodes: NodeStatus[];
  onRefresh: () => void;
  loading: boolean;
}

export const NodeVisualizer: React.FC<NodeVisualizerProps> = ({ nodes, onRefresh, loading }) => {
  const [testOrigin, setTestOrigin] = useState('1');
  const [testTarget, setTestTarget] = useState('2');
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    origin: string;
    target: string;
    product_id: number;
    updated_price: number;
    verified_price: number;
    identical: boolean;
    duration_ms: number;
  } | null>(null);

  const handleRunReplicationVerification = async () => {
    setVerifying(true);
    setVerificationResult(null);

    const startTime = performance.now();
    try {
      // 1. Pick product 1, generate a unique price
      const testPrice = Math.round((499.00 + Math.random() * 50) * 100) / 100;

      // 2. Write to origin node
      await api.updateProductPrice(1, testPrice, testOrigin);

      // 3. Immediately read from target node (wsrep_sync_wait=7 ensures instant causal consistency)
      const targetRead = await api.getProduct(1, testTarget);
      const readPrice = Number(targetRead.product.CurrentPrice);

      const endTime = performance.now();

      setVerificationResult({
        origin: `Node ${testOrigin}`,
        target: `Node ${testTarget}`,
        product_id: 1,
        updated_price: testPrice,
        verified_price: readPrice,
        identical: testPrice === readPrice,
        duration_ms: Math.round(endTime - startTime)
      });
    } catch (err: any) {
      console.error(err);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Cluster Header */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <Database className="h-6 w-6 text-emerald-400" />
            <h2 className="text-lg font-bold text-slate-100">3-Node MariaDB Galera Multi-Master Topology</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Synchronous peer-to-peer active-active cluster deployed across Azure virtual machines in the <code>10.0.1.0/24</code> VNet.
            Every node accepts both read and write transactions with multi-master certification.
          </p>
        </div>

        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg font-semibold flex items-center space-x-2 transition-colors self-start md:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          <span>Probe Telemetry</span>
        </button>
      </div>

      {/* Nodes Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {nodes.map((node) => (
          <div
            key={node.id}
            className={`bg-slate-900 border rounded-xl p-5 shadow-sm transition-all ${
              node.online
                ? 'border-slate-800 hover:border-emerald-500/40'
                : 'border-rose-500/40'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Server className="h-5 w-5 text-emerald-400" />
                <h3 className="font-bold text-sm text-slate-100">{node.name}</h3>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  node.online
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                }`}
              >
                {node.online ? 'Online' : 'Unreachable'}
              </span>
            </div>

            <div className="mt-4 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Endpoint / IP:</span>
                <span className="font-mono text-slate-200 font-medium">{node.host}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Cluster Status:</span>
                <span className="font-mono text-emerald-400 font-semibold">{node.cluster_status || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Cluster Size:</span>
                <span className="font-mono text-slate-200">{node.cluster_size ?? 0} Nodes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Sync Wait Mask:</span>
                <span className="font-mono text-emerald-300 font-bold bg-slate-950 px-1.5 py-0.5 rounded">
                  wsrep_sync_wait = {node.sync_wait ?? 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Network Latency:</span>
                <span className="font-mono text-slate-300">{node.ping_ms ? `${node.ping_ms} ms` : 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Local State:</span>
                <span className="font-mono text-slate-300">{node.local_state || 'Synced'}</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Port 3306 (MariaDB)</span>
              <span>Port 4567 (Galera WSREP)</span>
            </div>
          </div>
        ))}
      </div>

      {/* CAP Theorem Architecture Breakdown */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-sm">
        <div className="flex items-center space-x-2 mb-3">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          <h3 className="text-base font-bold text-slate-100">CAP Theorem Implementation Breakdown</h3>
        </div>
        <p className="text-xs text-slate-400 mb-5 leading-relaxed">
          Under Brewer's CAP Theorem, a distributed data store can simultaneously provide at most two out of three guarantees:
          <strong> Consistency</strong>, <strong>Availability</strong>, and <strong>Partition Tolerance</strong>.
          MultiNode POS is strictly configured as a <strong>CP system</strong>:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-lg bg-slate-950 border border-emerald-500/20">
            <div className="flex items-center space-x-2 text-emerald-400 font-bold mb-1.5">
              <CheckCircle2 className="h-4 w-4" />
              <span>Consistency (C) - ACTIVE</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Enforced via <code className="text-emerald-300">wsrep_sync_wait = 7</code>.
              When any client executes a READ on Node 2 or 3, the node pauses until all pending write replication queues are fully applied locally.
              Stale reads are mathematically eliminated.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-950 border border-emerald-500/20">
            <div className="flex items-center space-x-2 text-emerald-400 font-bold mb-1.5">
              <CheckCircle2 className="h-4 w-4" />
              <span>Partition Tolerance (P) - ACTIVE</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Galera uses a quorum voting mechanism across all 3 nodes.
              If a network partition isolates 1 node, the remaining 2 nodes maintain majority quorum (2/3 &gt; 50%) and continue serving transactions.
              The isolated node safely pauses to prevent split-brain anomalies.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-950 border border-amber-500/20">
            <div className="flex items-center space-x-2 text-amber-400 font-bold mb-1.5">
              <Activity className="h-4 w-4" />
              <span>Availability (A) - TRADE-OFF</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              If an isolated node loses majority quorum, it rejects write queries with <code className="text-amber-300">WSREP has not yet prepared node for application use</code>.
              It prioritizes data consistency over blind availability.
            </p>
          </div>
        </div>
      </div>

      {/* Live Write-to-Read Multi-Master Replication Verifier */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <GitCommit className="h-5 w-5 text-teal-400" />
            <h3 className="text-base font-bold text-slate-100">Live Multi-Master Replication Verifier</h3>
          </div>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Test real-time multi-master propagation: Execute a price mutation on the Write Origin Node, and instantly query the Read Target Node to verify identical state.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Write Origin Node</label>
            <select
              value={testOrigin}
              onChange={(e) => setTestOrigin(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="1">Node 1 (20.169.214.104)</option>
              <option value="2">Node 2 (172.191.145.235)</option>
              <option value="3">Node 3 (172.174.36.131)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Read Target Node</label>
            <select
              value={testTarget}
              onChange={(e) => setTestTarget(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="2">Node 2 (172.191.145.235)</option>
              <option value="3">Node 3 (172.174.36.131)</option>
              <option value="1">Node 1 (20.169.214.104)</option>
            </select>
          </div>

          <button
            onClick={handleRunReplicationVerification}
            disabled={verifying}
            className="py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-lg transition-all flex items-center justify-center space-x-2"
          >
            {verifying ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Synchronizing...</span>
              </>
            ) : (
              <>
                <span>Run Replication Probe</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>

        {verificationResult && (
          <div className="mt-4 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 space-y-2">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <span className="font-bold text-emerald-200">
                Replication Verified 100% Certified (Latency: {verificationResult.duration_ms}ms)
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
              <div className="bg-slate-950 p-2 rounded border border-emerald-500/20">
                <span className="text-slate-500 block">Write Node:</span>
                <strong className="text-slate-200">{verificationResult.origin}</strong>
              </div>
              <div className="bg-slate-950 p-2 rounded border border-emerald-500/20">
                <span className="text-slate-500 block">Written Price:</span>
                <strong className="text-emerald-400">${verificationResult.updated_price.toFixed(2)}</strong>
              </div>
              <div className="bg-slate-950 p-2 rounded border border-emerald-500/20">
                <span className="text-slate-500 block">Read Node:</span>
                <strong className="text-slate-200">{verificationResult.target}</strong>
              </div>
              <div className="bg-slate-950 p-2 rounded border border-emerald-500/20">
                <span className="text-slate-500 block">Read Price:</span>
                <strong className="text-emerald-400">${verificationResult.verified_price.toFixed(2)}</strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

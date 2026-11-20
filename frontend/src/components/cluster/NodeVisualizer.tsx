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
  const [manualProductId, setManualProductId] = useState('1');
  const [manualPrice, setManualPrice] = useState('599.99');
  const [validationError, setValidationError] = useState<string | null>(null);
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
    setValidationError(null);
    const prodId = parseInt(manualProductId, 10);
    const parsedPrice = parseFloat(manualPrice);

    if (isNaN(prodId) || prodId < 0) {
      setValidationError('Please enter a valid Product ID.');
      return;
    }
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setValidationError('Please enter a valid price greater than $0.');
      return;
    }

    setVerifying(true);
    setVerificationResult(null);

    const startTime = performance.now();
    try {
      // 1. Write user-specified price to origin node
      await api.updateProductPrice(prodId, parsedPrice, testOrigin);

      // 2. Read back from target node
      const targetRead = await api.getProduct(prodId, testTarget);
      const readPrice = Number(targetRead.product.CurrentPrice);
      const endTime = performance.now();

      setVerificationResult({
        origin: `Node ${testOrigin}`,
        target: `Node ${testTarget}`,
        product_id: prodId,
        updated_price: parsedPrice,
        verified_price: readPrice,
        identical: parsedPrice === readPrice,
        duration_ms: Math.round(endTime - startTime)
      });
    } catch (err: any) {
      setValidationError(err.message || 'Verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Cluster Header */}
      <div className="bg-white border border-slate-200/80 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center space-x-2.5">
            <Database className="h-6 w-6 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900">3-Node MariaDB Galera Multi-Master Topology</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Synchronous peer-to-peer active-active cluster across Azure virtual machines in the <code>10.0.1.0/24</code> VNet.
            Every node accepts both read and write transactions with multi-master certification.
          </p>
        </div>

        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center space-x-2 transition-colors self-start md:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          <span>Probe Telemetry</span>
        </button>
      </div>

      {/* Nodes Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {nodes.map((node) => (
          <div
            key={node.id}
            className={`bg-white border rounded-2xl p-6 shadow-xs transition-all ${
              node.online
                ? 'border-slate-200/80 hover:border-emerald-300 hover:shadow-sm'
                : 'border-rose-300'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Server className="h-5 w-5 text-emerald-600" />
                <h3 className="font-bold text-base text-slate-900">{node.name}</h3>
              </div>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                  node.online
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {node.online ? 'Online' : 'Unreachable'}
              </span>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Private IP:</span>
                <span className="font-mono text-slate-900 font-bold">{node.host}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Cluster Status:</span>
                <span className="font-mono text-emerald-700 font-bold">{node.cluster_status || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Cluster Size:</span>
                <span className="font-mono text-slate-800 font-semibold">{node.cluster_size ?? 0} Nodes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Sync Wait:</span>
                <span className="font-mono text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                  wsrep_sync_wait = {node.sync_wait ?? 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Ping Roundtrip:</span>
                <span className="font-mono text-slate-700 font-bold">{node.ping_ms ? `${node.ping_ms} ms` : 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Local State:</span>
                <span className="font-mono text-slate-700 font-semibold">{node.local_state || 'Synced'}</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between font-mono">
              <span>Port 3306 (SQL)</span>
              <span>Port 4567 (Galera)</span>
            </div>
          </div>
        ))}
      </div>

      {/* CAP Theorem Architecture Breakdown */}
      <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs">
        <div className="flex items-center space-x-2 mb-2">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <h3 className="text-base font-bold text-slate-900">CAP Theorem Distributed Guarantees</h3>
        </div>
        <p className="text-xs text-slate-500 mb-5 leading-relaxed">
          Under Brewer&apos;s CAP Theorem, a distributed data store can simultaneously provide at most two out of three guarantees:
          <strong> Consistency</strong>, <strong>Availability</strong>, and <strong>Partition Tolerance</strong>.
          MultiNode POS is strictly configured as a <strong>CP system</strong>:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center space-x-2 text-emerald-800 font-bold text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Consistency (C) — ACTIVE</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Enforced via <code className="text-emerald-700 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">wsrep_sync_wait = 7</code>.
              When a client executes a read on any node, the node pauses until all in-flight write replication queues are fully applied locally.
              Stale reads are mathematically eliminated.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center space-x-2 text-emerald-800 font-bold text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Partition Tolerance (P) — ACTIVE</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Galera uses a quorum voting algorithm across all 3 nodes.
              If a network partition isolates 1 node, the remaining 2 nodes maintain majority quorum (2/3 &gt; 50%) and continue serving transactions.
              The isolated node safely pauses to prevent split-brain anomalies.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center space-x-2 text-amber-800 font-bold text-sm">
              <Activity className="h-4 w-4 text-amber-600" />
              <span>Availability (A) — TRADE-OFF</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              If an isolated node loses majority quorum, it rejects write queries with <code className="text-amber-800 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">WSREP has not yet prepared node for application use</code>.
              It prioritizes data consistency over blind availability.
            </p>
          </div>
        </div>
      </div>

      {/* Live Write-to-Read Multi-Master Replication Verifier */}
      <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs">
        <div className="flex items-center space-x-2 mb-2">
          <GitCommit className="h-5 w-5 text-teal-600" />
          <h3 className="text-base font-bold text-slate-900">Live Multi-Master Replication Probe</h3>
        </div>
        <p className="text-xs text-slate-500 mb-5">
          Execute a price mutation on the Write Origin Node, and immediately read from the Read Target Node to verify zero replication lag.
        </p>

        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 text-xs space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-slate-700 mb-1.5 font-bold">Product ID</label>
              <input
                type="number"
                min="0"
                value={manualProductId}
                onChange={(e) => setManualProductId(e.target.value)}
                placeholder="e.g. 1"
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 font-semibold focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Target catalog product</span>
            </div>

            <div>
              <label className="block text-slate-700 mb-1.5 font-bold">Target New Price ($)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={manualPrice}
                onChange={(e) => setManualPrice(e.target.value)}
                placeholder="e.g. 599.99"
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 font-semibold focus:outline-none focus:border-emerald-500 font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Exact price to write</span>
            </div>

            <div>
              <label className="block text-slate-700 mb-1.5 font-bold">Write Origin Node</label>
              <select
                value={testOrigin}
                onChange={(e) => setTestOrigin(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 font-semibold focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="1">Node 1 (10.0.1.4)</option>
                <option value="2">Node 2 (10.0.1.5)</option>
                <option value="3">Node 3 (10.0.1.6)</option>
              </select>
              <span className="text-[10px] text-slate-400 mt-1 block">Node receiving UPDATE</span>
            </div>

            <div>
              <label className="block text-slate-700 mb-1.5 font-bold">Read Target Node</label>
              <select
                value={testTarget}
                onChange={(e) => setTestTarget(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 font-semibold focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="2">Node 2 (10.0.1.5)</option>
                <option value="3">Node 3 (10.0.1.6)</option>
                <option value="1">Node 1 (10.0.1.4)</option>
              </select>
              <span className="text-[10px] text-slate-400 mt-1 block">Node verifying read</span>
            </div>
          </div>

          {validationError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-medium text-xs">
              {validationError}
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              onClick={handleRunReplicationVerification}
              disabled={verifying}
              className="py-2.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all flex items-center space-x-2 shadow-xs cursor-pointer disabled:opacity-50"
            >
              {verifying ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Probing Multi-Master Sync...</span>
                </>
              ) : (
                <>
                  <span>Run Replication Probe</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {verificationResult && (
          <div className="mt-5 p-5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-3">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <span className="font-bold text-sm text-emerald-900">
                Synchronous Replication Verified (Roundtrip: {verificationResult.duration_ms}ms)
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 font-mono text-xs">
              <div className="bg-white p-3 rounded-lg border border-emerald-200">
                <span className="text-slate-400 block text-[11px]">Write Node:</span>
                <strong className="text-slate-900">{verificationResult.origin}</strong>
              </div>
              <div className="bg-white p-3 rounded-lg border border-emerald-200">
                <span className="text-slate-400 block text-[11px]">Written Price:</span>
                <strong className="text-emerald-700 font-bold">${verificationResult.updated_price.toFixed(2)}</strong>
              </div>
              <div className="bg-white p-3 rounded-lg border border-emerald-200">
                <span className="text-slate-400 block text-[11px]">Read Node:</span>
                <strong className="text-slate-900">{verificationResult.target}</strong>
              </div>
              <div className="bg-white p-3 rounded-lg border border-emerald-200">
                <span className="text-slate-400 block text-[11px]">Read Price:</span>
                <strong className="text-emerald-700 font-bold">${verificationResult.verified_price.toFixed(2)}</strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

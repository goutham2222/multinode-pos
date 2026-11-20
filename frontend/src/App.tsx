import { useState, useEffect } from 'react';
import { Navbar } from './components/layout/Navbar';
import { ClusterHealthBar } from './components/layout/ClusterHealthBar';
import { Terminal } from './components/pos/Terminal';
import { Catalog } from './components/products/Catalog';
import { OrdersExplorer } from './components/orders/OrdersExplorer';
import { NodeVisualizer } from './components/cluster/NodeVisualizer';
import { SqlDemo } from './components/security/SqlDemo';
import { NodeStatus } from './types';
import { api } from './services/api';

export function App() {
  const [activeTab, setActiveTab] = useState('pos');
  const [targetNode, setTargetNode] = useState('auto');
  const [nodes, setNodes] = useState<NodeStatus[]>([]);
  const [quorumHealthy, setQuorumHealthy] = useState(true);
  const [loadingCluster, setLoadingCluster] = useState(false);

  useEffect(() => {
    fetchClusterStatus();
    const interval = setInterval(fetchClusterStatus, 15000); // Poll telemetry every 15s
    return () => clearInterval(interval);
  }, []);

  const fetchClusterStatus = async () => {
    try {
      setLoadingCluster(true);
      const res = await api.getClusterStatus();
      setNodes(res.nodes);
      setQuorumHealthy(res.quorum_healthy);
    } catch (err) {
      console.error('Cluster status fetch error:', err);
    } finally {
      setLoadingCluster(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        targetNode={targetNode}
        setTargetNode={setTargetNode}
        nodes={nodes}
        onRefresh={fetchClusterStatus}
        loading={loadingCluster}
      />

      {/* Cluster Health Strip */}
      <ClusterHealthBar
        nodes={nodes}
        quorumHealthy={quorumHealthy}
        selectedNode={targetNode}
      />

      {/* Main Tab Content */}
      <main className="flex-1 pb-12">
        {activeTab === 'pos' && <Terminal targetNode={targetNode} />}
        {activeTab === 'products' && <Catalog targetNode={targetNode} />}
        {activeTab === 'orders' && <OrdersExplorer targetNode={targetNode} />}
        {activeTab === 'cluster' && (
          <NodeVisualizer
            nodes={nodes}
            onRefresh={fetchClusterStatus}
            loading={loadingCluster}
          />
        )}
        {activeTab === 'security' && <SqlDemo targetNode={targetNode} />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>MultiNode POS — High-Availability Distributed Transaction Engine</span>
          <span className="font-mono text-[11px] text-slate-600">
            MariaDB Galera 3-Node Cluster | wsrep_sync_wait=7 (Strict CP) | Azure East US
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;

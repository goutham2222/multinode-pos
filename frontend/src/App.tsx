import { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
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
    const interval = setInterval(fetchClusterStatus, 15000);
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
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-800 font-sans">
      {/* Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        nodes={nodes}
        quorumHealthy={quorumHealthy}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Minimal Top Header with Node Selector */}
        <Header
          activeTab={activeTab}
          targetNode={targetNode}
          setTargetNode={setTargetNode}
          nodes={nodes}
          onRefresh={fetchClusterStatus}
          loading={loadingCluster}
        />

        {/* Scrollable Working Workspace */}
        <main className="flex-1 overflow-y-auto">
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
      </div>
    </div>
  );
}

export default App;

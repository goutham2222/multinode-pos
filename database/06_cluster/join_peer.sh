#!/usr/bin/env bash
# ==============================================================================
# Script: join_peer.sh
# Purpose: Configure and join a secondary peer (Node 2 or Node 3) to the Galera cluster
# Usage: Run on Node 2: bash ~/database/06_cluster/join_peer.sh 2
#        Run on Node 3: bash ~/database/06_cluster/join_peer.sh 3
# ==============================================================================
set -euo pipefail

NODE_NUM="${1:-}"

if [ "$NODE_NUM" != "2" ] && [ "$NODE_NUM" != "3" ]; then
  echo "Usage: $0 <2|3>"
  echo "  Pass 2 for Node 2 (10.0.1.5)"
  echo "  Pass 3 for Node 3 (10.0.1.6)"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/galera.cnf.node${NODE_NUM}"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Error: Configuration file $CONFIG_FILE not found."
  exit 1
fi

echo "=================================================================="
echo "MultiNode POS: Joining Node $NODE_NUM to Galera Cluster..."
echo "Config File: $CONFIG_FILE"
echo "=================================================================="

# 1. Stop MariaDB if running
echo "[1/4] Stopping MariaDB service..."
sudo systemctl stop mariadb || true

# 2. Deploy Galera configuration
echo "[2/4] Deploying /etc/mysql/mariadb.conf.d/60-galera.cnf..."
sudo cp "$CONFIG_FILE" /etc/mysql/mariadb.conf.d/60-galera.cnf

# Ensure bind-address is 0.0.0.0
sudo sed -i 's/^bind-address\s*=.*/bind-address = 0.0.0.0/' /etc/mysql/mariadb.conf.d/50-server.cnf

# 3. Start MariaDB to initiate State Snapshot Transfer (SST) from primary
echo "[3/4] Starting MariaDB (joining cluster and synchronizing data via SST)..."
sudo systemctl start mariadb

# 4. Verify cluster connection
echo "[4/4] Verifying node connection and cluster size..."
sudo mariadb -t -e "
  SHOW STATUS LIKE 'wsrep_cluster_size';
  SHOW STATUS LIKE 'wsrep_cluster_status';
  SHOW STATUS LIKE 'wsrep_local_state_comment';
  SHOW STATUS LIKE 'wsrep_ready';
"

echo "=================================================================="
echo "Node $NODE_NUM successfully joined the Galera Cluster!"
echo "=================================================================="

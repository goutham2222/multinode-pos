#!/usr/bin/env bash
# ==============================================================================
# Script: bootstrap_node1.sh
# Purpose: Configure and bootstrap the Galera Cluster primary node on Node 1 (10.0.1.4)
# Usage: Run on Node 1: bash ~/database/06_cluster/bootstrap_node1.sh
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=================================================================="
echo "MultiNode POS: Bootstrapping Galera Cluster on Node 1 (10.0.1.4)"
echo "=================================================================="

# 1. Stop standalone MariaDB
echo "[1/4] Stopping standalone MariaDB..."
sudo systemctl stop mariadb

# 2. Deploy Galera configuration for Node 1
echo "[2/4] Deploying /etc/mysql/mariadb.conf.d/60-galera.cnf..."
sudo cp "$SCRIPT_DIR/galera.cnf.node1" /etc/mysql/mariadb.conf.d/60-galera.cnf

# Ensure bind-address is 0.0.0.0
sudo sed -i 's/^bind-address\s*=.*/bind-address = 0.0.0.0/' /etc/mysql/mariadb.conf.d/50-server.cnf

# 3. Bootstrap initial cluster component
echo "[3/4] Initializing new Galera cluster with galera_new_cluster..."
sudo galera_new_cluster

# 4. Verify cluster bootstrap
echo "[4/4] Verifying cluster bootstrap status..."
sudo mariadb -t -e "
  SHOW STATUS LIKE 'wsrep_cluster_size';
  SHOW STATUS LIKE 'wsrep_cluster_status';
  SHOW STATUS LIKE 'wsrep_ready';
  SHOW STATUS LIKE 'wsrep_connected';
"

echo "=================================================================="
echo "Node 1 successfully bootstrapped as Galera Primary Component!"
echo "Ready for Node 2 and Node 3 to join."
echo "=================================================================="

#!/usr/bin/env bash
# ==============================================================================
# Script: enable_strict_consistency.sh
# Purpose: Enable strict causal consistency (wsrep_sync_wait = 7) on all 3 nodes
# Usage: ./database/06_cluster/enable_strict_consistency.sh [NODE1_IP] [NODE2_IP] [NODE3_IP]
# ==============================================================================
set -euo pipefail

NODE1_IP="${1:-20.169.214.104}"
NODE2_IP="${2:-172.191.145.235}"
NODE3_IP="${3:-172.174.36.131}"

echo "=================================================================="
echo "Enabling Strict Causal Consistency (wsrep_sync_wait = 7)"
echo "Cluster Nodes: $NODE1_IP, $NODE2_IP, $NODE3_IP"
echo "=================================================================="

# 1. Apply dynamically at runtime on all nodes (zero downtime)
for IP in "$NODE1_IP" "$NODE2_IP" "$NODE3_IP"; do
  echo "Setting wsrep_sync_wait = 7 on $IP..."
  ssh -o StrictHostKeyChecking=no "azureuser@$IP" "sudo mariadb -e 'SET GLOBAL wsrep_sync_wait = 7; SELECT @@wsrep_sync_wait AS active_sync_wait;'"
done

# 2. Persist configuration across service restarts
echo ""
echo "Persisting configuration in /etc/mysql/mariadb.conf.d/60-galera.cnf..."
scp -o StrictHostKeyChecking=no database/06_cluster/galera.cnf.node1 "azureuser@$NODE1_IP:~/"
ssh -o StrictHostKeyChecking=no "azureuser@$NODE1_IP" "sudo cp ~/galera.cnf.node1 /etc/mysql/mariadb.conf.d/60-galera.cnf"

scp -o StrictHostKeyChecking=no database/06_cluster/galera.cnf.node2 "azureuser@$NODE2_IP:~/"
ssh -o StrictHostKeyChecking=no "azureuser@$NODE2_IP" "sudo cp ~/galera.cnf.node2 /etc/mysql/mariadb.conf.d/60-galera.cnf"

scp -o StrictHostKeyChecking=no database/06_cluster/galera.cnf.node3 "azureuser@$NODE3_IP:~/"
ssh -o StrictHostKeyChecking=no "azureuser@$NODE3_IP" "sudo cp ~/galera.cnf.node3 /etc/mysql/mariadb.conf.d/60-galera.cnf"

echo "=================================================================="
echo "Strict Causal Consistency is now 100% active and persisted!"
echo "=================================================================="

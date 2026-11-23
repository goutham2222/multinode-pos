#!/usr/bin/env bash
# ==============================================================================
# MultiNode POS: Azure Cluster Management & Cost Teardown Controller
# File: infra/azure/cluster_control.sh
# Purpose: Start, Stop/Deallocate, Inspect, or Permanently Destroy Azure Cluster.
# ==============================================================================
set -euo pipefail

RESOURCE_GROUP="${RESOURCE_GROUP:-rg-multinode-pos}"
ACTION="${1:-status}"

echo "================================================================================"
echo "MultiNode POS: Azure Cluster Control"
echo "Resource Group: ${RESOURCE_GROUP}"
echo "Action:         ${ACTION}"
echo "Timestamp:      $(date)"
echo "================================================================================"

case "${ACTION}" in
  status)
    echo "[*] Querying VM Power States and Public IPs..."
    az vm list -d -g "${RESOURCE_GROUP}" \
      --query "[].{Name:name, PowerState:powerState, PublicIP:publicIps, PrivateIP:privateIps}" \
      -o table
    ;;

  stop|deallocate)
    echo "[*] Deallocating Azure VMs to stop compute billing (\$0.00/hour)..."
    az vm deallocate -g "${RESOURCE_GROUP}" --name vm-pos-node1 --no-wait
    az vm deallocate -g "${RESOURCE_GROUP}" --name vm-pos-node2 --no-wait
    az vm deallocate -g "${RESOURCE_GROUP}" --name vm-pos-node3 --no-wait
    echo "✓ Deallocation signals dispatched. Waiting for VMs to power down..."
    sleep 5
    az vm list -d -g "${RESOURCE_GROUP}" --query "[].{Name:name, PowerState:powerState}" -o table
    echo "✓ VMs are deallocated. Compute billing has stopped."
    ;;

  start)
    echo "[*] Starting all 3 Azure Cluster VMs..."
    az vm start -g "${RESOURCE_GROUP}" --name vm-pos-node1 --no-wait
    az vm start -g "${RESOURCE_GROUP}" --name vm-pos-node2 --no-wait
    az vm start -g "${RESOURCE_GROUP}" --name vm-pos-node3 --no-wait
    echo "--> Waiting for VMs to reach 'VM running' state..."
    az vm wait -g "${RESOURCE_GROUP}" --name vm-pos-node1 --created
    sleep 10
    
    echo "[*] Bootstrapping Galera cluster on Node 1..."
    az vm run-command invoke -g "${RESOURCE_GROUP}" -n vm-pos-node1 \
      --command-id RunShellScript \
      --scripts "sed -i 's/safe_to_bootstrap: 0/safe_to_bootstrap: 1/' /var/lib/mysql/grastate.dat && galera_new_cluster && systemctl restart multinode-pos.service" >/dev/null

    echo "[*] Joining Node 2 and Node 3 to the Galera cluster..."
    az vm run-command invoke -g "${RESOURCE_GROUP}" -n vm-pos-node2 \
      --command-id RunShellScript --scripts "systemctl start mariadb" >/dev/null &
    az vm run-command invoke -g "${RESOURCE_GROUP}" -n vm-pos-node3 \
      --command-id RunShellScript --scripts "systemctl start mariadb" >/dev/null &
    wait

    echo "✓ Cluster successfully started and synchronized!"
    az vm list -d -g "${RESOURCE_GROUP}" --query "[].{Name:name, PowerState:powerState, PublicIP:publicIps}" -o table
    ;;

  teardown|destroy)
    echo "⚠️ WARNING: This will PERMANENTLY DELETE the resource group '${RESOURCE_GROUP}' and all its VMs, disks, and data!"
    read -r -p "Are you sure you want to completely destroy all cloud resources? [y/N]: " CONFIRM
    if [[ "$CONFIRM" =~ ^[Yy]$ ]]; then
      echo "[*] Deleting Azure Resource Group '${RESOURCE_GROUP}'..."
      az group delete --name "${RESOURCE_GROUP}" --yes --no-wait
      echo "✓ Resource group deletion initiated."
    else
      echo "Teardown aborted."
    fi
    ;;

  *)
    echo "Usage: $0 {status|start|stop|deallocate|teardown}"
    exit 1
    ;;
esac

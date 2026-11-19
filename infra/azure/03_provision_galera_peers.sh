#!/usr/bin/env bash
# ==============================================================================
# Script: 03_provision_galera_peers.sh
# Purpose: Provision Secondary Cluster Peer VMs (Node 2 & Node 3) for Galera
# Configuration: Standard_B1s, Static Private IPs 10.0.1.5 (Node 2) and 10.0.1.6 (Node 3)
# Note: Reserved for Phase 6 (Galera Clustering). Run after Phase 1-5 validation.
# ==============================================================================
set -euo pipefail

# Configuration Defaults
RESOURCE_GROUP="${RESOURCE_GROUP:-rg-multinode-pos}"
LOCATION="${LOCATION:-eastus}"
VNET_NAME="${VNET_NAME:-vnet-pos}"
SUBNET_NAME="${SUBNET_NAME:-snet-pos-nodes}"
VM_SIZE="${VM_SIZE:-Standard_D2as_v4}"
ADMIN_USERNAME="${ADMIN_USERNAME:-azureuser}"
SSH_KEY_PATH="${SSH_KEY_PATH:-$HOME/.ssh/id_rsa.pub}"

NODES="vm-pos-node2:10.0.1.5 vm-pos-node3:10.0.1.6"

echo "=================================================================="
echo "MultiNode POS: Provisioning Galera Cluster Peers (Nodes 2 & 3)"
echo "Resource Group: $RESOURCE_GROUP"
echo "VM Sizing:      $VM_SIZE"
echo "=================================================================="

for NODE_ENTRY in $NODES; do
  VM_NAME="${NODE_ENTRY%%:*}"
  PRIVATE_IP="${NODE_ENTRY##*:}"
  NIC_NAME="nic-${VM_NAME}"
  PIP_NAME="pip-${VM_NAME}"

  echo "------------------------------------------------------------------"
  echo "Provisioning $VM_NAME ($PRIVATE_IP)..."
  echo "------------------------------------------------------------------"

  # Check if VM is already provisioned
  if az vm show --resource-group "$RESOURCE_GROUP" --name "$VM_NAME" >/dev/null 2>&1; then
    PUB_IP=$(az network public-ip show \
      --resource-group "$RESOURCE_GROUP" \
      --name "$PIP_NAME" \
      --query ipAddress \
      --output tsv)
    echo "-> $VM_NAME is already provisioned and running: Public IP $PUB_IP | Private IP $PRIVATE_IP"
    continue
  fi

  # Determine SKU family (Node 3 uses Standard_D2s_v4 to avoid standardDASv4Family 4-core quota)
  NODE_VM_SIZE="$VM_SIZE"
  if [ "$VM_NAME" = "vm-pos-node3" ]; then
    NODE_VM_SIZE="${VM3_SIZE:-Standard_D2s_v4}"
  fi
  echo "Allocated VM SKU: $NODE_VM_SIZE"

  # Create Public IP
  az network public-ip create \
    --resource-group "$RESOURCE_GROUP" \
    --name "$PIP_NAME" \
    --location "$LOCATION" \
    --sku Standard \
    --allocation-method Static \
    --output table

  # Create NIC with Static Private IP
  az network nic create \
    --resource-group "$RESOURCE_GROUP" \
    --name "$NIC_NAME" \
    --location "$LOCATION" \
    --vnet-name "$VNET_NAME" \
    --subnet "$SUBNET_NAME" \
    --public-ip-address "$PIP_NAME" \
    --private-ip-address "$PRIVATE_IP" \
    --output table

  # Create VM
  az vm create \
    --resource-group "$RESOURCE_GROUP" \
    --name "$VM_NAME" \
    --location "$LOCATION" \
    --nics "$NIC_NAME" \
    --image "Canonical:0001-com-ubuntu-server-jammy:22_04-lts-gen2:latest" \
    --size "$NODE_VM_SIZE" \
    --admin-username "$ADMIN_USERNAME" \
    --ssh-key-values "$SSH_KEY_PATH" \
    --os-disk-size-gb 32 \
    --storage-sku StandardSSD_LRS \
    --output table

  PUB_IP=$(az network public-ip show \
    --resource-group "$RESOURCE_GROUP" \
    --name "$PIP_NAME" \
    --query ipAddress \
    --output tsv)
  echo "-> Deployed $VM_NAME: Public IP $PUB_IP | Private IP $PRIVATE_IP"
done

echo "=================================================================="
echo "All cluster peer nodes successfully provisioned!"
echo "=================================================================="


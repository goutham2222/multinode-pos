#!/usr/bin/env bash
# ==============================================================================
# Script: 02_provision_primary_vm.sh
# Purpose: Provision Primary VM (Node 1) on Azure for Students
# Configuration: Standard_B1s (1 vCPU, 1 GiB RAM), Ubuntu 22.04 LTS, Static Private IP 10.0.1.4
# ==============================================================================
set -euo pipefail

# Configuration Defaults
RESOURCE_GROUP="${RESOURCE_GROUP:-rg-multinode-pos}"
LOCATION="${LOCATION:-eastus}"
VNET_NAME="${VNET_NAME:-vnet-pos}"
SUBNET_NAME="${SUBNET_NAME:-snet-pos-nodes}"
VM_NAME="${VM_NAME:-vm-pos-node1}"
NIC_NAME="nic-${VM_NAME}"
PIP_NAME="pip-${VM_NAME}"
PRIVATE_IP="10.0.1.4"
VM_SIZE="${VM_SIZE:-Standard_D2as_v4}"
ADMIN_USERNAME="${ADMIN_USERNAME:-azureuser}"
SSH_KEY_PATH="${SSH_KEY_PATH:-$HOME/.ssh/id_rsa.pub}"

echo "=================================================================="
echo "MultiNode POS: Provisioning Primary VM ($VM_NAME)"
echo "Resource Group: $RESOURCE_GROUP"
echo "VM Sizing:      $VM_SIZE (Azure for Students Tier)"
echo "Assigned IP:    $PRIVATE_IP"
echo "Admin User:     $ADMIN_USERNAME"
echo "SSH Key Path:   $SSH_KEY_PATH"
echo "=================================================================="

# Check for SSH key
if [ ! -f "$SSH_KEY_PATH" ]; then
  echo "Error: SSH Public Key not found at '$SSH_KEY_PATH'."
  echo "Generate one using: ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa"
  exit 1
fi

# 1. Create Public IP for Node 1
echo "[1/3] Creating Static Public IP..."
az network public-ip create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$PIP_NAME" \
  --location "$LOCATION" \
  --sku Standard \
  --allocation-method Static \
  --output table

# 2. Create Network Interface (NIC) with Static Private IP
echo "[2/3] Creating Network Interface with static IP $PRIVATE_IP..."
az network nic create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$NIC_NAME" \
  --location "$LOCATION" \
  --vnet-name "$VNET_NAME" \
  --subnet "$SUBNET_NAME" \
  --public-ip-address "$PIP_NAME" \
  --private-ip-address "$PRIVATE_IP" \
  --output table

# 3. Create the Virtual Machine
echo "[3/3] Deploying Ubuntu 22.04 LTS VM ($VM_SIZE)..."
az vm create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$VM_NAME" \
  --location "$LOCATION" \
  --nics "$NIC_NAME" \
  --image "Canonical:0001-com-ubuntu-server-jammy:22_04-lts-gen2:latest" \
  --size "$VM_SIZE" \
  --admin-username "$ADMIN_USERNAME" \
  --ssh-key-values "$SSH_KEY_PATH" \
  --os-disk-size-gb 32 \
  --storage-sku StandardSSD_LRS \
  --output table

# Output IP and connection string
PUBLIC_IP=$(az network public-ip show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$PIP_NAME" \
  --query ipAddress \
  --output tsv)

echo "=================================================================="
echo "VM Deployment Complete!"
echo "Primary Node Public IP:  $PUBLIC_IP"
echo "Primary Node Private IP: $PRIVATE_IP"
echo ""
echo "Connect using SSH:"
echo "  ssh $ADMIN_USERNAME@$PUBLIC_IP"
echo ""
echo "Next step: Run host initialization script on the VM:"
echo "  scp -i ${SSH_KEY_PATH%.pub} infra/scripts/host_setup.sh $ADMIN_USERNAME@$PUBLIC_IP:~/"
echo "  ssh $ADMIN_USERNAME@$PUBLIC_IP 'bash ~/host_setup.sh'"
echo "=================================================================="


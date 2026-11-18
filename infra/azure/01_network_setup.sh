#!/usr/bin/env bash
# ==============================================================================
# Script: 01_network_setup.sh
# Purpose: Provision Resource Group, VNet, Subnet, and NSG Rules on Azure
# Constraints: Azure for Students (B1s VM tier, VNet peering/internal routing)
# ==============================================================================
set -euo pipefail

# Configuration Defaults (Can be overridden via environment variables)
RESOURCE_GROUP="${RESOURCE_GROUP:-rg-multinode-pos}"
LOCATION="${LOCATION:-eastus}"
VNET_NAME="${VNET_NAME:-vnet-pos}"
VNET_PREFIX="${VNET_PREFIX:-10.0.0.0/16}"
SUBNET_NAME="${SUBNET_NAME:-snet-pos-nodes}"
SUBNET_PREFIX="${SUBNET_PREFIX:-10.0.1.0/24}"
NSG_NAME="${NSG_NAME:-nsg-pos}"

echo "=================================================================="
echo "MultiNode POS: Network Infrastructure Provisioning"
echo "Resource Group: $RESOURCE_GROUP"
echo "Location:       $LOCATION"
echo "VNet:           $VNET_NAME ($VNET_PREFIX)"
echo "Subnet:         $SUBNET_NAME ($SUBNET_PREFIX)"
echo "NSG:            $NSG_NAME"
echo "=================================================================="

# 1. Create Resource Group
echo "[1/5] Creating Resource Group..."
az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --output table

# 2. Create Virtual Network and Subnet
echo "[2/5] Creating Virtual Network and Subnet..."
az network vnet create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$VNET_NAME" \
  --address-prefixes "$VNET_PREFIX" \
  --subnet-name "$SUBNET_NAME" \
  --subnet-prefixes "$SUBNET_PREFIX" \
  --output table

# 3. Create Network Security Group (NSG)
echo "[3/5] Creating Network Security Group..."
az network nsg create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$NSG_NAME" \
  --location "$LOCATION" \
  --output table

# 4. Associate NSG with Subnet
echo "[4/5] Associating NSG with Subnet..."
az network vnet subnet update \
  --resource-group "$RESOURCE_GROUP" \
  --vnet-name "$VNET_NAME" \
  --name "$SUBNET_NAME" \
  --network-security-group "$NSG_NAME" \
  --output table

# 5. Define Security Rules
echo "[5/5] Provisioning NSG Rules..."

# Rule 100: SSH Administration Access
az network nsg rule create \
  --resource-group "$RESOURCE_GROUP" \
  --nsg-name "$NSG_NAME" \
  --name "Allow-Inbound-SSH" \
  --priority 100 \
  --direction Inbound \
  --access Allow \
  --protocol Tcp \
  --source-address-prefixes '*' \
  --source-port-ranges '*' \
  --destination-address-prefixes '*' \
  --destination-port-ranges 22 \
  --output table

# Rule 200: Internal MariaDB & Galera Cluster Traffic (Nodes subnet to subnet)
# Ports:
# 3306: MariaDB standard client / replication
# 4567: Galera Cluster replication traffic (TCP & UDP)
# 4568: Incremental State Transfer (IST)
# 4444: State Snapshot Transfer (SST)
az network nsg rule create \
  --resource-group "$RESOURCE_GROUP" \
  --nsg-name "$NSG_NAME" \
  --name "Allow-Internal-Galera-Cluster" \
  --priority 200 \
  --direction Inbound \
  --access Allow \
  --protocol '*' \
  --source-address-prefixes "$SUBNET_PREFIX" \
  --source-port-ranges '*' \
  --destination-address-prefixes "$SUBNET_PREFIX" \
  --destination-port-ranges 3306 4567 4568 4444 \
  --output table

# Rule 300: Application API & Web Traffic (FastAPI 8000, Web 80, Dev Vite 5173)
az network nsg rule create \
  --resource-group "$RESOURCE_GROUP" \
  --nsg-name "$NSG_NAME" \
  --name "Allow-Inbound-App-Traffic" \
  --priority 300 \
  --direction Inbound \
  --access Allow \
  --protocol Tcp \
  --source-address-prefixes '*' \
  --source-port-ranges '*' \
  --destination-address-prefixes '*' \
  --destination-port-ranges 80 8000 5173 \
  --output table

echo "=================================================================="
echo "Network provisioning complete! Subnet is ready for VM deployments."
echo "=================================================================="


#!/usr/bin/env bash
# ==============================================================================
# Script: cleanup.sh
# Purpose: Clean up Azure resources for MultiNode POS
# Usage: ./infra/azure/cleanup.sh [RESOURCE_GROUP_NAME]
# ==============================================================================
set -euo pipefail

RESOURCE_GROUP="${1:-${RESOURCE_GROUP:-rg-multinode-pos}}"

echo "=================================================================="
echo "MultiNode POS: Resource Cleanup"
echo "Target Resource Group: $RESOURCE_GROUP"
echo "=================================================================="

if ! az group exists --name "$RESOURCE_GROUP" | grep -q true; then
  echo "Resource group '$RESOURCE_GROUP' does not exist. Nothing to clean up."
  exit 0
fi

echo "Warning: This will delete '$RESOURCE_GROUP' and all its associated VMs, VNets, and disks."
read -p "Are you sure you want to delete this resource group? (y/N): " -r CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Cleanup cancelled."
  exit 0
fi

echo "Deleting resource group '$RESOURCE_GROUP' in the background..."
az group delete --name "$RESOURCE_GROUP" --yes --no-wait

echo "Cleanup initiated! You can monitor deletion with:"
echo "  az group exists --name $RESOURCE_GROUP"


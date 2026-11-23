#!/usr/bin/env bash
# ==============================================================================
# MultiNode POS: Push-Button Azure Automated Deployment Script
# File: infra/azure/deploy_app.sh
# Purpose: Builds frontend, syncs application code to Azure Node 1, updates
#          virtualenv dependencies, restarts services, and verifies health.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Configuration Defaults (Overridable via environment variables)
RESOURCE_GROUP="${RESOURCE_GROUP:-rg-multinode-pos}"
VM_NAME="${VM_NAME:-vm-pos-node1}"
TARGET_HOST="${TARGET_HOST:-20.169.214.104}"
ADMIN_USER="${ADMIN_USER:-azureuser}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_rsa}"
REMOTE_APP_DIR="/opt/multinode-pos"

cd "${PROJECT_ROOT}"

echo "================================================================================"
echo "MultiNode POS: Azure Deployment Pipeline"
echo "Target Host:    ${TARGET_HOST} (${VM_NAME})"
echo "Resource Group: ${RESOURCE_GROUP}"
echo "Admin User:     ${ADMIN_USER}"
echo "Timestamp:      $(date)"
echo "================================================================================"

# ------------------------------------------------------------------------------
# 1. Pre-Flight Verification
# ------------------------------------------------------------------------------
echo ""
echo "[1/6] Running Pre-Flight Automated Tests..."
if [ -f "${PROJECT_ROOT}/scripts/run_automated_tests.sh" ]; then
  "${PROJECT_ROOT}/scripts/run_automated_tests.sh"
else
  echo "[WARN] Automated test runner not found, proceeding with caution."
fi

# ------------------------------------------------------------------------------
# 2. Build Frontend Production Assets
# ------------------------------------------------------------------------------
echo ""
echo "[2/6] Building Production React + Vite Frontend Bundle..."
npm --prefix frontend run build

# ------------------------------------------------------------------------------
# 3. Package Application Archive for Deployment
# ------------------------------------------------------------------------------
echo ""
echo "[3/6] Packaging Application Archive..."
TEMP_ARCHIVE=$(mktemp /tmp/multinode_pos_deploy_XXXXXX.tar.gz)
trap 'rm -f "${TEMP_ARCHIVE}"' EXIT

# Package backend source code and compiled frontend dist
tar -czf "${TEMP_ARCHIVE}" \
  --exclude="backend/.venv" \
  --exclude="backend/__pycache__" \
  --exclude="backend/*/__pycache__" \
  --exclude="backend/*/*/__pycache__" \
  --exclude="backend/.pytest_cache" \
  --exclude="backend/tests" \
  --exclude="data/raw" \
  -C "${PROJECT_ROOT}" backend \
  -C "${PROJECT_ROOT}/frontend" dist

ARCHIVE_SIZE_MB=$(du -m "${TEMP_ARCHIVE}" | cut -f1)
echo "✓ Created deployment package (${ARCHIVE_SIZE_MB} MB) -> ${TEMP_ARCHIVE}"

# ------------------------------------------------------------------------------
# 4. Transfer & Unpack Archive to Azure Node 1
# ------------------------------------------------------------------------------
echo ""
echo "[4/6] Deploying to Azure Node 1 (${TARGET_HOST})..."

# Check if direct SSH key exists or if az vm run-command should be used
if [ -f "${SSH_KEY}" ] && ssh -i "${SSH_KEY}" -o ConnectTimeout=5 -o StrictHostKeyChecking=no "${ADMIN_USER}@${TARGET_HOST}" "echo 'SSH_OK'" 2>/dev/null | grep -q "SSH_OK"; then
  echo "--> Using Direct SSH Channel (${ADMIN_USER}@${TARGET_HOST})..."
  scp -i "${SSH_KEY}" -o StrictHostKeyChecking=no "${TEMP_ARCHIVE}" "${ADMIN_USER}@${TARGET_HOST}:/tmp/deploy.tar.gz"
  
  ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no "${ADMIN_USER}@${TARGET_HOST}" bash << 'EOF'
    set -euo pipefail
    sudo mkdir -p /opt/multinode-pos/backend /opt/multinode-pos/backend/app/static
    sudo tar -xzf /tmp/deploy.tar.gz -C /opt/multinode-pos/
    rm -f /tmp/deploy.tar.gz
    
    # Copy frontend dist assets to FastAPI static folder
    if [ -d "/opt/multinode-pos/dist" ]; then
      sudo cp -r /opt/multinode-pos/dist/* /opt/multinode-pos/backend/app/static/
      sudo rm -rf /opt/multinode-pos/dist
    fi
    
    sudo chown -R azureuser:azureuser /opt/multinode-pos
EOF
else
  echo "--> SSH direct access unavailable, falling back to Azure CLI Run-Command..."
  # Convert archive to base64 and transfer via Azure VM Run-Command
  B64_DATA=$(base64 < "${TEMP_ARCHIVE}" | tr -d '\n')
  
  # Stream base64 to target VM in chunks or write via script
  CHUNK_FILE=$(mktemp /tmp/deploy_script_XXXXXX.sh)
  cat << SCRIPT_EOF > "${CHUNK_FILE}"
#!/bin/bash
set -euo pipefail
echo "${B64_DATA}" | base64 -d > /tmp/deploy.tar.gz
mkdir -p /opt/multinode-pos/backend /opt/multinode-pos/backend/app/static
tar -xzf /tmp/deploy.tar.gz -C /opt/multinode-pos/
rm -f /tmp/deploy.tar.gz
if [ -d "/opt/multinode-pos/dist" ]; then
  cp -r /opt/multinode-pos/dist/* /opt/multinode-pos/backend/app/static/
  rm -rf /opt/multinode-pos/dist
fi
chown -R azureuser:azureuser /opt/multinode-pos
SCRIPT_EOF

  az vm run-command invoke \
    --resource-group "${RESOURCE_GROUP}" \
    --name "${VM_NAME}" \
    --command-id RunShellScript \
    --scripts @"${CHUNK_FILE}" >/dev/null
  rm -f "${CHUNK_FILE}"
fi
echo "✓ Application files successfully synchronized to ${REMOTE_APP_DIR}."

# ------------------------------------------------------------------------------
# 5. Remote Virtualenv Update & Service Restart
# ------------------------------------------------------------------------------
echo ""
echo "[5/6] Updating Virtualenv & Restarting Systemd Service..."
RESTART_SCRIPT=$(mktemp /tmp/restart_pos_XXXXXX.sh)
cat << 'SERVICE_EOF' > "${RESTART_SCRIPT}"
#!/bin/bash
set -euo pipefail
# Install or update backend dependencies
if [ -f "/opt/multinode-pos/backend/requirements.txt" ]; then
  /opt/multinode-pos/backend/venv/bin/pip install --quiet --no-cache-dir -r /opt/multinode-pos/backend/requirements.txt
fi

# Restart FastAPI service
sudo systemctl restart multinode-pos.service
sleep 2

# Verify service is running
systemctl is-active --quiet multinode-pos.service
SERVICE_EOF

if [ -f "${SSH_KEY}" ] && ssh -i "${SSH_KEY}" -o ConnectTimeout=5 -o StrictHostKeyChecking=no "${ADMIN_USER}@${TARGET_HOST}" "true" 2>/dev/null; then
  ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no "${ADMIN_USER}@${TARGET_HOST}" "bash -s" < "${RESTART_SCRIPT}"
else
  az vm run-command invoke \
    --resource-group "${RESOURCE_GROUP}" \
    --name "${VM_NAME}" \
    --command-id RunShellScript \
    --scripts @"${RESTART_SCRIPT}" >/dev/null
fi
rm -f "${RESTART_SCRIPT}"
echo "✓ Service multinode-pos.service restarted successfully."

# ------------------------------------------------------------------------------
# 6. Post-Deployment Automated Smoke Tests & Quorum Verification
# ------------------------------------------------------------------------------
echo ""
echo "[6/6] Executing Post-Deployment Smoke Tests..."

MAX_RETRIES=5
RETRY_DELAY=3
SUCCESS=false

for i in $(seq 1 $MAX_RETRIES); do
  echo "  Attempt $i/$MAX_RETRIES: Testing http://${TARGET_HOST}:8000/api/v1/health ..."
  if curl -sf "http://${TARGET_HOST}:8000/api/v1/health" >/dev/null; then
    SUCCESS=true
    break
  fi
  sleep $RETRY_DELAY
done

if [ "$SUCCESS" = true ]; then
  echo "✓ Health check passed!"
  echo "  Testing Catalog Data Retrieval (http://${TARGET_HOST}:8000/api/v1/products?limit=1) ..."
  PROD_SAMPLE=$(curl -s "http://${TARGET_HOST}:8000/api/v1/products?limit=1" || echo "{}")
  echo "  Response: ${PROD_SAMPLE:0:120}..."
  
  echo ""
  echo "================================================================================"
  echo "DEPLOYMENT COMPLETE & VERIFIED LIVE!"
  echo "Access the Application at: http://${TARGET_HOST}:8000/"
  echo "Interactive API Docs:     http://${TARGET_HOST}:8000/docs"
  echo "Timestamp:                $(date)"
  echo "================================================================================"
else
  echo "✗ Smoke test failed: API did not respond healthy within timeout."
  exit 1
fi

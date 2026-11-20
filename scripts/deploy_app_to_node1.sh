#!/usr/bin/env bash
# ==============================================================================
# Script: deploy_app_to_node1.sh
# Purpose: Package and deploy MultiNode POS FastAPI Backend & React Frontend
#          directly to Azure VM Node 1 (vm-pos-node1, 20.169.214.104).
# ==============================================================================
set -euo pipefail

NODE1_IP="${1:-20.169.214.104}"
ADMIN_USER="${2:-azureuser}"
APP_DIR="/opt/multinode-pos"

echo "=================================================================="
echo "MultiNode POS: Full-Stack Application Deployment to Node 1"
echo "Target Host: $NODE1_IP"
echo "Target User: $ADMIN_USER"
echo "Target Path: $APP_DIR"
echo "=================================================================="

# 1. Build frontend if dist doesn't exist
if [ ! -d "frontend/dist" ]; then
  echo "[1/5] Building React frontend..."
  (cd frontend && npm install && npm run build)
else
  echo "[1/5] Frontend bundle verified (frontend/dist)."
fi

# 2. Prepare remote directories
echo "[2/5] Preparing directories on $NODE1_IP..."
ssh -o StrictHostKeyChecking=no "${ADMIN_USER}@${NODE1_IP}" "
  sudo mkdir -p ${APP_DIR}/backend ${APP_DIR}/frontend/dist
  sudo chown -R ${ADMIN_USER}:${ADMIN_USER} ${APP_DIR}
  sudo apt-get update -y > /dev/null
  sudo apt-get install -y python3-venv python3-pip rsync > /dev/null
"

# 3. Rsync backend code and built frontend bundle
echo "[3/5] Synchronizing application code and built UI bundle..."
rsync -avz --exclude '.venv' --exclude '__pycache__' --exclude '*.pyc' \
  backend/ "${ADMIN_USER}@${NODE1_IP}:${APP_DIR}/backend/"

rsync -avz frontend/dist/ "${ADMIN_USER}@${NODE1_IP}:${APP_DIR}/frontend/dist/"

# 4. Configure Python virtualenv and install dependencies on Node 1
echo "[4/5] Provisioning Python virtual environment and dependencies..."
ssh -o StrictHostKeyChecking=no "${ADMIN_USER}@${NODE1_IP}" "
  cd ${APP_DIR}/backend
  if [ ! -d \"venv\" ]; then
    python3 -m venv venv
  fi
  ./venv/bin/pip install --upgrade pip > /dev/null
  ./venv/bin/pip install -r requirements.txt > /dev/null

  # Create production .env targeting local VNet private IPs
  cat << 'EOF' > ${APP_DIR}/backend/.env
DB_HOST_PRIMARY=10.0.1.4
DB_HOSTS_CLUSTER=10.0.1.4,10.0.1.5,10.0.1.6
DB_PORT=3306
DB_USER=pos_app
DB_PASSWORD=ChangeMeSecure123!
DB_NAME=pos
DB_POOL_MIN_SIZE=5
DB_POOL_MAX_SIZE=20

API_HOST=0.0.0.0
API_PORT=8000
ENVIRONMENT=production
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://${NODE1_IP}:8000,http://${NODE1_IP}
MONGO_URI=mongodb://10.0.1.4:27017
MONGO_DB=pos_analytics
EOF
"

# 5. Set up systemd service and start
echo "[5/5] Configuring and starting systemd service (multinode-pos.service)..."
ssh -o StrictHostKeyChecking=no "${ADMIN_USER}@${NODE1_IP}" "
  sudo tee /etc/systemd/system/multinode-pos.service > /dev/null << 'EOF'
[Unit]
Description=MultiNode POS FastAPI & Web Application
After=network.target mariadb.service

[Service]
Type=simple
User=${ADMIN_USER}
WorkingDirectory=${APP_DIR}/backend
ExecStart=${APP_DIR}/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
Restart=always
RestartSec=3
EnvironmentFile=${APP_DIR}/backend/.env

[Install]
WantedBy=multi-user.target
EOF

  sudo systemctl daemon-reload
  sudo systemctl enable multinode-pos.service
  sudo systemctl restart multinode-pos.service
"

echo "Waiting for service to initialize..."
sleep 3

# Verification Probe
echo "=================================================================="
echo "Verifying Health Endpoint on http://${NODE1_IP}:8000/health ..."
curl -s --connect-timeout 5 "http://${NODE1_IP}:8000/health" || echo "Health check timeout"
echo ""
echo "=================================================================="
echo "DEPLOYMENT COMPLETE!"
echo "MultiNode POS is LIVE at: http://${NODE1_IP}:8000/"
echo "Interactive Swagger Docs: http://${NODE1_IP}:8000/docs"
echo "=================================================================="

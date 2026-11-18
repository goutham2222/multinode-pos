#!/usr/bin/env bash
# ==============================================================================
# Script: host_setup.sh
# Purpose: Initialize OS, Swap, and MariaDB on an Azure B1s Ubuntu Node
# Usage: Run on each VM instance after provisioning.
# ==============================================================================
set -euo pipefail

echo "=================================================================="
echo "Starting Node Host Initialization..."
echo "=================================================================="

# 1. Configure 2GB Swap (Mandatory for Standard_B1s 1GB RAM stability)
if ! grep -q '/swapfile' /etc/fstab; then
  echo "[1/4] Configuring 2GB Swap Memory..."
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  echo "vm.swappiness=10" | sudo tee -a /etc/sysctl.conf
  sudo sysctl -p
else
  echo "[1/4] Swap is already configured."
fi

# 2. Package Updates & Utilities
echo "[2/4] Installing System Updates and Cluster Utilities..."
sudo apt-get update
sudo apt-get install -y --no-install-recommends \
  curl \
  wget \
  gnupg \
  software-properties-common \
  rsync \
  socat \
  tar \
  gzip \
  unzip \
  jq \
  ufw

# 3. Install MariaDB Server and Client
echo "[3/4] Installing MariaDB (with Galera support)..."
sudo apt-get install -y \
  mariadb-server \
  mariadb-client \
  mariadb-backup

# 4. Configure MariaDB to listen on all interfaces (secured via Azure NSG)
echo "[4/4] Configuring MariaDB Network Binding..."
sudo sed -i 's/^bind-address\s*=.*/bind-address = 0.0.0.0/' /etc/mysql/mariadb.conf.d/50-server.cnf

# Enable local infile for CSV staging (Phase 2 ETL requirement)
if ! grep -q 'local_infile' /etc/mysql/mariadb.conf.d/50-server.cnf; then
  sudo sed -i '/\[mysqld\]/a local_infile = ON' /etc/mysql/mariadb.conf.d/50-server.cnf
fi

sudo systemctl enable mariadb
sudo systemctl restart mariadb

echo "=================================================================="
echo "Host Initialization Complete!"
echo "MariaDB Status:"
sudo systemctl status mariadb --no-pager -n 5
echo "=================================================================="


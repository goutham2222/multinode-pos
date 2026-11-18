#!/usr/bin/env bash
# ==============================================================================
# Script: run_phase5.sh
# Purpose: Execute Phase 5 Triggers, Tax System Integration, and Test Suite
# Usage:
#   Run on the VM: bash database/05_triggers/run_phase5.sh
#   Or run locally via SSH:
#     ssh azureuser@<NODE1_IP> "bash ~/database/05_triggers/run_phase5.sh"
# ==============================================================================
set -euo pipefail

DB_NAME="pos"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=================================================================="
echo "MultiNode POS: Executing Phase 5 Triggers & Business Constraints"
echo "Target Database: $DB_NAME"
echo "Working Root:    $PROJECT_ROOT"
echo "=================================================================="

# Check if data/raw exists
if [ ! -d "$PROJECT_ROOT/data/raw" ]; then
  if [ -d "$HOME/data/raw" ]; then
    mkdir -p "$PROJECT_ROOT/data"
    ln -sf "$HOME/data/raw" "$PROJECT_ROOT/data/raw"
  else
    echo "Error: data/raw directory not found."
    exit 1
  fi
fi

# Step 1: Deploy TaxRates ETL, Schema Migrations, and Triggers
echo ""
echo "[Step 1/3] Deploying Tax System, Migrations & Automated Triggers (trig.sql)..."
cd "$PROJECT_ROOT"
sudo mariadb --local-infile=1 "$DB_NAME" < "$PROJECT_ROOT/database/05_triggers/trig.sql"
echo "-> Triggers and tax system deployed."

# Step 2: Run Trigger Verification Suite
echo ""
echo "[Step 2/3] Running Phase 5 Business Constraints & Trigger Test Suite..."
sudo mariadb "$DB_NAME" -t < "$PROJECT_ROOT/database/05_triggers/test_triggers.sql"

# Step 3: Display Trigger Definitions & Verification Summary
echo ""
echo "[Step 3/3] Phase 5 System Telemetry & Summary..."
sudo mariadb "$DB_NAME" -t <<'EOF'
-- 1. Verify Active Triggers
SELECT 
  TRIGGER_NAME AS `TriggerName`, 
  EVENT_MANIPULATION AS `Event`, 
  EVENT_OBJECT_TABLE AS `TargetTable`, 
  ACTION_TIMING AS `Timing`
FROM information_schema.TRIGGERS 
WHERE TRIGGER_SCHEMA = 'pos'
ORDER BY EVENT_OBJECT_TABLE, ACTION_TIMING, EVENT_MANIPULATION;

-- 2. Verify TaxRates table count and sample
SELECT 'TaxRates' AS `Table`, COUNT(*) AS `TotalZipTaxRates` FROM TaxRates;
SELECT ZipCode, State, TaxRegionName, EstimatedCombinedRate FROM TaxRates LIMIT 3;

-- 3. Verify Order schema with OrderSubtotal, SalesTax, OrderTotal (virtual)
DESCRIBE `Order`;

-- 4. Verify historical orders SalesTax populated
SELECT OrderID, datePlaced, CustomerID, OrderSubtotal, SalesTax, OrderTotal 
FROM `Order` 
LIMIT 3;
EOF

echo ""
echo "=================================================================="
echo "Phase 5 Triggers & Business Constraints completed successfully!"
echo "=================================================================="

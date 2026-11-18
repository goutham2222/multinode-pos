#!/usr/bin/env bash
# ==============================================================================
# Script: run_phase4.sh
# Purpose: Execute Phase 4 Table Alterations, Stored Procedures, and
#          Transaction Isolation Testing Suite on MariaDB.
# Usage:
#   Run on the VM: bash database/04_routines/run_phase4.sh
#   Or run locally via SSH:
#     ssh azureuser@<NODE1_IP> "bash ~/database/04_routines/run_phase4.sh"
# ==============================================================================
set -euo pipefail

DB_NAME="pos"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=================================================================="
echo "MultiNode POS: Executing Phase 4 Stored Procedures & Transactions"
echo "Target Database: $DB_NAME"
echo "Working Root:    $PROJECT_ROOT"
echo "=================================================================="

# Step 1: Deploy Table Alterations and Stored Procedures
echo ""
echo "[Step 1/3] Applying Schema Alterations & Deploying Stored Procedures..."
sudo mariadb "$DB_NAME" < "$PROJECT_ROOT/database/04_routines/proc.sql"
echo "-> Procedures and table modifications applied."

# Step 2: Execute Initial Backfill Procedures
echo ""
echo "[Step 2/3] Executing Initial Backfills (proc_FillUnitPrice & proc_FillOrderTotal)..."
sudo mariadb "$DB_NAME" -t <<'EOF'
-- Backfill UnitPrices
CALL proc_FillUnitPrice(@updated_lines);
SELECT @updated_lines AS `OrderLinesUnitPriceBackfilled`;

-- Backfill OrderTotals
CALL proc_FillOrderTotal(@updated_orders);
SELECT @updated_orders AS `OrdersTotalBackfilled`;
EOF

# Step 3: Run Transaction & Isolation Test Suite
echo ""
echo "[Step 3/3] Running Transaction Isolation & ACID Test Suite..."
sudo mariadb "$DB_NAME" -t < "$PROJECT_ROOT/database/04_routines/test_transactions.sql"

echo ""
echo "=================================================================="
echo "Phase 4 Verification & Status Summary:"
echo "=================================================================="
sudo mariadb "$DB_NAME" -t <<'EOF'
-- 1. Verify Customer schema (Phone dropped)
DESCRIBE Customer;

-- 2. Verify OrderLine schema (UnitPrice & LineTotal virtual column)
DESCRIBE OrderLine;

-- 3. Sample OrderLine with populated UnitPrice and auto-computed LineTotal
SELECT OrderID, ProductID, Quantity, UnitPrice, LineTotal 
FROM OrderLine 
LIMIT 3;

-- 4. Sample Order with calculated OrderTotal
SELECT OrderID, datePlaced, dateShipped, CustomerID, OrderTotal 
FROM `Order` 
LIMIT 3;
EOF

echo ""
echo "=================================================================="
echo "Phase 4 Stored Procedures & Transactions completed successfully!"
echo "=================================================================="

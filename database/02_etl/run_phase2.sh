#!/usr/bin/env bash
# ==============================================================================
# Script: run_phase2.sh
# Purpose: Execute Phase 2 Relational Schema and ETL Pipeline on MariaDB
# Usage:
#   Run on the VM: bash database/02_etl/run_phase2.sh
#   Or run locally via SSH:
#     ssh azureuser@<NODE1_IP> "cd ~ && bash ~/database/02_etl/run_phase2.sh"
# ==============================================================================
set -euo pipefail

DB_NAME="pos"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=================================================================="
echo "MultiNode POS: Executing Phase 2 Schema & ETL Pipeline"
echo "Target Database: $DB_NAME"
echo "Working Root:    $PROJECT_ROOT"
echo "=================================================================="

# Check if data/raw exists
if [ ! -d "$PROJECT_ROOT/data/raw" ]; then
  if [ -d "$HOME/data/raw" ]; then
    # Create symlink if executed from homedir
    mkdir -p "$PROJECT_ROOT/data"
    ln -sf "$HOME/data/raw" "$PROJECT_ROOT/data/raw"
  else
    echo "Error: data/raw directory not found."
    exit 1
  fi
fi

# Step 1: Execute Schema DDL
echo ""
echo "[Step 1/3] Deploying Relational Schema (structure.sql)..."
sudo mariadb < "$PROJECT_ROOT/database/01_schema/structure.sql"
echo "-> Schema tables created successfully."

# Step 2: Execute ETL (Staging, Cleansing, Type Coercion, Aggregation)
echo ""
echo "[Step 2/3] Running ETL Pipeline (etl.sql)..."
cd "$PROJECT_ROOT"
sudo mariadb --local-infile=1 < "$PROJECT_ROOT/database/02_etl/etl.sql"

# Step 3: Run Integrity & Validation Suite
echo ""
echo "[Step 3/3] Running Phase 2 Validation Suite..."
sudo mariadb "$DB_NAME" -t <<'EOF'
-- 1. Table Row Counts
SELECT 'City' AS `Table`, COUNT(*) AS `TotalRecords` FROM City
UNION ALL
SELECT 'Customer', COUNT(*) FROM Customer
UNION ALL
SELECT 'Product', COUNT(*) FROM Product
UNION ALL
SELECT 'Order', COUNT(*) FROM `Order`
UNION ALL
SELECT 'OrderLine', COUNT(*) FROM OrderLine
UNION ALL
SELECT 'PriceHistory', COUNT(*) FROM PriceHistory;

-- 2. Verify Zero-Padded Zip Codes
SELECT CustomerID, FirstName, LastName, Zip 
FROM Customer 
WHERE CAST(Zip AS UNSIGNED) < 1000 
LIMIT 3;

-- 3. Verify Cancelled Order Date Coercion (dateShipped is NULL)
SELECT OrderID, datePlaced, dateShipped, CustomerID 
FROM `Order` 
WHERE dateShipped IS NULL 
LIMIT 3;

-- 4. Verify Multi-Quantity Aggregated Orderlines
SELECT OrderID, ProductID, Quantity 
FROM OrderLine 
WHERE Quantity > 1 
LIMIT 3;
EOF

echo ""
echo "=================================================================="
echo "Phase 2 Schema & ETL Pipeline completed successfully!"
echo "=================================================================="

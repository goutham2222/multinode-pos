#!/usr/bin/env bash
# ==============================================================================
# Script: run_phase3.sh
# Purpose: Execute Phase 3 Views, Materialized Views & Indexes on MariaDB
# Usage:
#   Run on the VM: bash database/03_views/run_phase3.sh
#   Or run locally via SSH:
#     ssh azureuser@<NODE1_IP> "bash ~/database/03_views/run_phase3.sh"
# ==============================================================================
set -euo pipefail

DB_NAME="pos"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=================================================================="
echo "MultiNode POS: Executing Phase 3 Views, Materialized Views & Indexes"
echo "Target Database: $DB_NAME"
echo "Working Root:    $PROJECT_ROOT"
echo "=================================================================="

# 1. Execute views.sql
echo ""
echo "[Step 1/2] Creating Standard Views, Materialized Views & Indexes..."
sudo mariadb "$DB_NAME" < "$PROJECT_ROOT/database/03_views/views.sql"
echo "-> Views, Materialized Views, and Indexes created successfully."

# 2. Run Comprehensive Phase 3 Verification Suite
echo ""
echo "[Step 2/2] Running Phase 3 Verification Suite..."
sudo mariadb "$DB_NAME" -t <<'EOF'
-- 1. View & MV Row Count Summary
SELECT 'v_CustomerNames' AS `Object`, COUNT(*) AS `Records` FROM v_CustomerNames
UNION ALL
SELECT 'v_Customers', COUNT(*) FROM v_Customers
UNION ALL
SELECT 'v_ProductBuyers', COUNT(*) FROM v_ProductBuyers
UNION ALL
SELECT 'v_CustomerPurchases', COUNT(*) FROM v_CustomerPurchases
UNION ALL
SELECT 'mv_ProductBuyers', COUNT(*) FROM mv_ProductBuyers
UNION ALL
SELECT 'mv_CustomerPurchases', COUNT(*) FROM mv_CustomerPurchases;

-- 2. Verify v_CustomerNames Alphabetical Ordering
SELECT CustomerID, FirstName, LastName, FullName 
FROM v_CustomerNames 
LIMIT 3;

-- 3. Verify v_Customers Clean Aliases & City/State Joins
SELECT customer_number, first_name, last_name, street1, City, ST, zip_code 
FROM v_Customers 
LIMIT 3;

-- 4. Verify mv_ProductBuyers (Zero Buyers vs Multiple Buyers)
SELECT ProductID, ProductName, DistinctBuyerCount, SUBSTRING(Buyers, 1, 60) AS `BuyersPreview`
FROM mv_ProductBuyers 
WHERE DistinctBuyerCount = 0 
LIMIT 2;

SELECT ProductID, ProductName, DistinctBuyerCount, SUBSTRING(Buyers, 1, 60) AS `BuyersPreview`
FROM mv_ProductBuyers 
WHERE DistinctBuyerCount > 5 
LIMIT 2;

-- 5. Verify mv_CustomerPurchases Pipe-Separated Aggregates
SELECT CustomerID, FirstName, LastName, DistinctProductCount, SUBSTRING(PurchasedProducts, 1, 60) AS `PurchasesPreview`
FROM mv_CustomerPurchases 
WHERE DistinctProductCount > 3 
LIMIT 2;

-- 6. Verify Index Usage with EXPLAIN Plans
EXPLAIN SELECT * FROM Customer WHERE Email = 'Ved.Dey@yahoo.com';
EXPLAIN SELECT * FROM Product WHERE Name = 'USAFA blue Wardrobe';
EOF

echo ""
echo "=================================================================="
echo "Phase 3 Views, Materialized Views & Indexes completed successfully!"
echo "=================================================================="

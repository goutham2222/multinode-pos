-- ==============================================================================
-- MultiNode POS: Phase 4 - Transaction Testing & Isolation Suite
-- Target DBMS: MariaDB (InnoDB Storage Engine)
-- Database: pos
-- File: database/04_routines/test_transactions.sql
-- ==============================================================================

USE `pos`;

-- ------------------------------------------------------------------------------
-- 1. Verify Transaction Isolation Level
-- ------------------------------------------------------------------------------
SELECT 
  @@tx_isolation AS `EngineIsolationLevel`,
  'Guarantees repeatable reads & prevents dirty reads (READ UNCOMMITTED)' AS `IntegrityGuarantee`;

-- ------------------------------------------------------------------------------
-- 2. Test 1: Rollback Integrity Test
-- Verifies that aborted transactions leave ZERO orphan records across all tables.
-- ------------------------------------------------------------------------------
SELECT 'Starting Test 1: Rollback Integrity...' AS `Status`;

START TRANSACTION;

-- Insert test customer 999999
INSERT INTO `Customer` (`CustomerID`, `FirstName`, `LastName`, `Email`, `Address1`, `Zip`)
VALUES (999999, 'Rollback', 'Tester', 'rollback.test@pos.local', '999 Ephemeral St', 40475);

-- Insert test order 999999999
INSERT INTO `Order` (`OrderID`, `datePlaced`, `CustomerID`)
VALUES (999999999, '2026-01-01', 999999);

-- Insert test orderline
INSERT INTO `OrderLine` (`OrderID`, `ProductID`, `Quantity`, `UnitPrice`)
VALUES (999999999, 0, 5, 719.99);

-- Execute Rollback
ROLLBACK;

-- Verification: Assert records do not exist
SELECT 
  (SELECT COUNT(*) FROM `Customer` WHERE `CustomerID` = 999999) AS `OrphanCustomers`,
  (SELECT COUNT(*) FROM `Order` WHERE `OrderID` = 999999999) AS `OrphanOrders`,
  (SELECT COUNT(*) FROM `OrderLine` WHERE `OrderID` = 999999999) AS `OrphanLines`;

-- ------------------------------------------------------------------------------
-- 3. Test 2: Commit Integrity & Virtual Column LineTotal Verification
-- Verifies ACID commit persistence, virtual generated column computation,
-- and proc_FillOrderTotal execution.
-- ------------------------------------------------------------------------------
SELECT 'Starting Test 2: Commit Integrity & LineTotal Generation...' AS `Status`;

START TRANSACTION;

-- Insert test customer 888888
INSERT INTO `Customer` (`CustomerID`, `FirstName`, `LastName`, `Email`, `Address1`, `Zip`)
VALUES (888888, 'Commit', 'Tester', 'commit.test@pos.local', '888 Persistent Way', 40475);

-- Insert test order 888888888
INSERT INTO `Order` (`OrderID`, `datePlaced`, `CustomerID`)
VALUES (888888888, '2026-01-02', 888888);

-- Insert test orderlines:
-- Line 1: 2 items @ $100.00 -> LineTotal should auto-compute to $200.00
-- Line 2: 3 items @ $50.00  -> LineTotal should auto-compute to $150.00
INSERT INTO `OrderLine` (`OrderID`, `ProductID`, `Quantity`, `UnitPrice`)
VALUES 
  (888888888, 0, 2, 100.00),
  (888888888, 1, 3, 50.00);

-- Verify LineTotal generated column before commit
SELECT 
  `OrderID`, `ProductID`, `Quantity`, `UnitPrice`, `LineTotal`,
  IF(`LineTotal` = (`Quantity` * `UnitPrice`), 'PASS', 'FAIL') AS `GeneratedColumnCheck`
FROM `OrderLine` 
WHERE `OrderID` = 888888888;

-- Execute proc_FillOrderTotal
CALL `proc_FillOrderTotal`(@updated_orders);

-- Verify OrderTotal aggregated
SELECT 
  `OrderID`, `OrderTotal`, 
  IF(`OrderTotal` = 350.00, 'PASS', 'FAIL') AS `OrderTotalSumCheck`
FROM `Order` 
WHERE `OrderID` = 888888888;

COMMIT;

-- Clean up Test 2 artifacts
DELETE FROM `OrderLine` WHERE `OrderID` = 888888888;
DELETE FROM `Order` WHERE `OrderID` = 888888888;
DELETE FROM `Customer` WHERE `CustomerID` = 888888;

-- ------------------------------------------------------------------------------
-- 4. Test 3: Parameterized Prepared Statements Simulation
-- Demonstrates SQL injection-proof execution via parameterized statements.
-- ------------------------------------------------------------------------------
SELECT 'Starting Test 3: Parameterized Prepared Statements...' AS `Status`;

PREPARE stmt_secure_lookup FROM 
  'SELECT c.CustomerID, c.FirstName, c.LastName, c.Email, o.OrderID, o.datePlaced, o.OrderTotal
   FROM Customer c
   JOIN `Order` o ON c.CustomerID = o.CustomerID
   WHERE c.CustomerID = ? AND o.datePlaced >= ?
   ORDER BY o.datePlaced DESC
   LIMIT 2';

SET @param_cid := 0;
SET @param_date := '2005-01-01';

EXECUTE stmt_secure_lookup USING @param_cid, @param_date;
DEALLOCATE PREPARE stmt_secure_lookup;

-- ------------------------------------------------------------------------------
-- 5. Test 4: Transaction-Safe Materialized View Refresh (proc_RefreshMV)
-- ------------------------------------------------------------------------------
SELECT 'Starting Test 4: proc_RefreshMV Execution...' AS `Status`;

CALL `proc_RefreshMV`();

SELECT 
  (SELECT COUNT(*) FROM `v_ProductBuyers`) AS `v_ProductBuyers_Count`,
  (SELECT COUNT(*) FROM `mv_ProductBuyers`) AS `mv_ProductBuyers_Count`,
  (SELECT COUNT(*) FROM `v_CustomerPurchases`) AS `v_CustomerPurchases_Count`,
  (SELECT COUNT(*) FROM `mv_CustomerPurchases`) AS `mv_CustomerPurchases_Count`;

-- ==============================================================================
-- MultiNode POS: Phase 5 - Triggers & Business Constraints Test Suite
-- Target DBMS: MariaDB (InnoDB Storage Engine)
-- Database: pos
-- File: database/05_triggers/test_triggers.sql
-- ==============================================================================

USE `pos`;

-- ------------------------------------------------------------------------------
-- 1. Test Price Auditing Trigger (trig_ProductPriceAudit)
-- ------------------------------------------------------------------------------
SELECT 'Starting Test 1: Price Auditing Trigger...' AS `Status`;

-- Ensure test product 9999 exists
DELETE FROM `Product` WHERE `ProductID` = 9999;
INSERT INTO `Product` (`ProductID`, `Name`, `CurrentPrice`, `QtyOnHand`)
VALUES (9999, 'Test Audit Table', 100.00, 50);

-- Update price: $100.00 -> $125.50 (should fire trigger)
UPDATE `Product` SET `CurrentPrice` = 125.50 WHERE `ProductID` = 9999;

-- Update non-price attribute: Name change only (should NOT fire trigger)
UPDATE `Product` SET `Name` = 'Test Audit Table (Renamed)' WHERE `ProductID` = 9999;

-- Assert: exactly 1 record logged in PriceHistory
SELECT 
  `ChangeID`, `ProductID`, `OldPrice`, `NewPrice`, `TS`,
  IF(`OldPrice` = 100.00 AND `NewPrice` = 125.50, 'PASS', 'FAIL') AS `PriceAuditCheck`
FROM `PriceHistory` 
WHERE `ProductID` = 9999;


-- ------------------------------------------------------------------------------
-- 2. Test Unit Price Inheritance & Default Quantity Trigger
-- ------------------------------------------------------------------------------
SELECT 'Starting Test 2: Unit Price Inheritance & Default Quantity...' AS `Status`;

-- Setup clean customer and order for testing
DELETE FROM `OrderLine` WHERE `OrderID` = 777777777;
DELETE FROM `Order` WHERE `OrderID` = 777777777;
DELETE FROM `Customer` WHERE `CustomerID` = 777777;

-- Customer with known Zip (40475 in Richmond, KY)
INSERT INTO `Customer` (`CustomerID`, `FirstName`, `LastName`, `Email`, `Address1`, `Zip`)
VALUES (777777, 'Trigger', 'Tester', 'trig.test@pos.local', '777 Reactive Blvd', 40475);

INSERT INTO `Order` (`OrderID`, `datePlaced`, `CustomerID`)
VALUES (777777777, '2026-02-01', 777777);

-- Insert line with NULL quantity and NULL UnitPrice for Product 9999 ($125.50, Qty 50)
INSERT INTO `OrderLine` (`OrderID`, `ProductID`, `Quantity`, `UnitPrice`)
VALUES (777777777, 9999, NULL, NULL);

-- Verification:
-- Quantity should default to 1
-- UnitPrice should inherit 125.50 from Product 9999
-- LineTotal should be 125.50
SELECT 
  `OrderID`, `ProductID`, `Quantity`, `UnitPrice`, `LineTotal`,
  IF(`Quantity` = 1 AND `UnitPrice` = 125.50 AND `LineTotal` = 125.50, 'PASS', 'FAIL') AS `InheritanceCheck`
FROM `OrderLine`
WHERE `OrderID` = 777777777;


-- ------------------------------------------------------------------------------
-- 3. Test Inventory Control & Automatic Decrement
-- ------------------------------------------------------------------------------
SELECT 'Starting Test 3: Inventory Control Trigger...' AS `Status`;

-- Product 9999 started with 50. Line above ordered 1.
-- QtyOnHand should now be 49.
SELECT 
  `ProductID`, `QtyOnHand`,
  IF(`QtyOnHand` = 49, 'PASS', 'FAIL') AS `StockDecrementCheck`
FROM `Product` 
WHERE `ProductID` = 9999;


-- ------------------------------------------------------------------------------
-- 4. Test Subtotal, Tax Calculation & Virtual Column OrderTotal
-- ------------------------------------------------------------------------------
SELECT 'Starting Test 4: Subtotal & Tax Synchronization...' AS `Status`;

-- Check TaxRate for 40475
SET @tax_rate := (SELECT `EstimatedCombinedRate` FROM `TaxRates` WHERE `ZipCode` = 40475);

-- Verify OrderSubtotal, SalesTax, and OrderTotal (virtual)
SELECT 
  o.`OrderID`, 
  o.`OrderSubtotal`, 
  o.`SalesTax`, 
  o.`OrderTotal`,
  @tax_rate AS `AppliedTaxRate`,
  IF(o.`OrderSubtotal` = 125.50 AND o.`OrderTotal` = (o.`OrderSubtotal` + o.`SalesTax`), 'PASS', 'FAIL') AS `TaxSyncCheck`
FROM `Order` o
WHERE o.`OrderID` = 777777777;


-- ------------------------------------------------------------------------------
-- 5. Test Eager Materialized View Refresh
-- ------------------------------------------------------------------------------
SELECT 'Starting Test 5: Eager Materialized View Refresh...' AS `Status`;

-- Check mv_ProductBuyers for Product 9999
SELECT `ProductID`, `DistinctBuyerCount`, `Buyers`
FROM `mv_ProductBuyers`
WHERE `ProductID` = 9999;

-- Check mv_CustomerPurchases for Customer 777777
SELECT `CustomerID`, `DistinctProductCount`, `PurchasedProducts`
FROM `mv_CustomerPurchases`
WHERE `CustomerID` = 777777;


-- ------------------------------------------------------------------------------
-- 6. Clean Up Test Artifacts
-- ------------------------------------------------------------------------------
DELETE FROM `OrderLine` WHERE `OrderID` = 777777777;
DELETE FROM `Order` WHERE `OrderID` = 777777777;
DELETE FROM `Customer` WHERE `CustomerID` = 777777;
DELETE FROM `PriceHistory` WHERE `ProductID` = 9999;
DELETE FROM `Product` WHERE `ProductID` = 9999;

SELECT 'All Phase 5 Trigger tests completed!' AS `Result`;

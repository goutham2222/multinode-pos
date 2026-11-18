-- ==============================================================================
-- MultiNode POS: Phase 5 - Automated Business Triggers & Constraints
-- Target DBMS: MariaDB (InnoDB Storage Engine)
-- Database: pos
-- File: database/05_triggers/trig.sql
-- ==============================================================================

USE `pos`;

-- ------------------------------------------------------------------------------
-- 1. Sales Tax System Integration
-- ------------------------------------------------------------------------------

-- Create TaxRates lookup table
DROP TABLE IF EXISTS `TaxRates`;
CREATE TABLE `TaxRates` (
  `ZipCode` DECIMAL(5) ZEROFILL NOT NULL,
  `State` VARCHAR(4) NOT NULL,
  `TaxRegionName` VARCHAR(128) DEFAULT NULL,
  `EstimatedCombinedRate` DECIMAL(7,6) NOT NULL DEFAULT 0.000000,
  `RiskLevel` INT DEFAULT 0,
  PRIMARY KEY (`ZipCode`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Staging table for TAXRATES.csv
DROP TABLE IF EXISTS `taxrates_tmp`;
CREATE TABLE `taxrates_tmp` (
  `State` VARCHAR(32),
  `ZipCode` VARCHAR(32),
  `TaxRegionName` VARCHAR(128),
  `EstimatedCombinedRate` VARCHAR(32),
  `StateRate` VARCHAR(32),
  `EstimatedCountyRate` VARCHAR(32),
  `EstimatedCityRate` VARCHAR(32),
  `EstimatedSpecialRate` VARCHAR(32),
  `RiskLevel` VARCHAR(32)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- Load TAXRATES.csv
LOAD DATA LOCAL INFILE 'data/raw/TAXRATES.csv'
INTO TABLE `taxrates_tmp`
FIELDS TERMINATED BY ','
OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES;

-- Ingest into TaxRates, stripping repeated headers & deduplicating ZipCodes
INSERT INTO `TaxRates` (`ZipCode`, `State`, `TaxRegionName`, `EstimatedCombinedRate`, `RiskLevel`)
SELECT
  CAST(TRIM(`ZipCode`) AS UNSIGNED) AS `ZipCode`,
  MAX(TRIM(`State`)),
  MAX(TRIM(`TaxRegionName`)),
  MAX(CAST(TRIM(`EstimatedCombinedRate`) AS DECIMAL(7,6))),
  MAX(CAST(TRIM(`RiskLevel`) AS SIGNED))
FROM `taxrates_tmp`
WHERE `ZipCode` REGEXP '^[0-9]+$'
GROUP BY CAST(TRIM(`ZipCode`) AS UNSIGNED);

DROP TABLE IF EXISTS `taxrates_tmp`;


-- ------------------------------------------------------------------------------
-- 2. Schema Migrations: PriceHistory & Order
-- ------------------------------------------------------------------------------

-- A. PriceHistory: Make ChangeID AUTO_INCREMENT
ALTER TABLE `PriceHistory` 
  MODIFY COLUMN `ChangeID` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT;

-- B. Order: Migrate OrderTotal -> OrderSubtotal, Add SalesTax, Add OrderTotal virtual column
SET @has_order_subtotal := (
  SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = 'pos' AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'OrderSubtotal'
);

-- If OrderTotal is still the physical column, rename it to OrderSubtotal
SET @sql := IF(@has_order_subtotal = 0,
  'ALTER TABLE `Order` CHANGE COLUMN `OrderTotal` `OrderSubtotal` DECIMAL(8,2) DEFAULT 0.00',
  'SELECT "Column OrderSubtotal already renamed" AS Notice');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add SalesTax column if not exists
SET @has_salestax := (
  SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = 'pos' AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'SalesTax'
);
SET @sql := IF(@has_salestax = 0,
  'ALTER TABLE `Order` ADD COLUMN `SalesTax` DECIMAL(7,2) NOT NULL DEFAULT 0.00 AFTER `OrderSubtotal`',
  'SELECT "Column SalesTax already exists in Order" AS Notice');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add virtual generated column OrderTotal (OrderSubtotal + SalesTax)
SET @has_ordertotal_virtual := (
  SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = 'pos' AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'OrderTotal'
);
SET @sql := IF(@has_ordertotal_virtual = 0,
  'ALTER TABLE `Order` ADD COLUMN `OrderTotal` DECIMAL(8,2) AS (`OrderSubtotal` + `SalesTax`) VIRTUAL AFTER `SalesTax`',
  'SELECT "Column OrderTotal virtual column already exists in Order" AS Notice');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Synchronize initial SalesTax for existing historical orders based on customer ZipCode
UPDATE `Order` o
JOIN `Customer` c ON o.`CustomerID` = c.`CustomerID`
LEFT JOIN `TaxRates` tr ON c.`Zip` = tr.`ZipCode`
SET o.`SalesTax` = ROUND(COALESCE(o.`OrderSubtotal`, 0.00) * COALESCE(tr.`EstimatedCombinedRate`, 0.00), 2)
WHERE o.`SalesTax` = 0.00 AND o.`OrderSubtotal` > 0;


-- ------------------------------------------------------------------------------
-- 3. Trigger 1: Product Price Auditing
-- Automatically record modifications to PriceHistory strictly when price changes.
-- ------------------------------------------------------------------------------
DELIMITER $$

DROP TRIGGER IF EXISTS `trig_ProductPriceAudit`$$
CREATE TRIGGER `trig_ProductPriceAudit`
AFTER UPDATE ON `Product`
FOR EACH ROW
BEGIN
  IF OLD.`CurrentPrice` <> NEW.`CurrentPrice` THEN
    INSERT INTO `PriceHistory` (`OldPrice`, `NewPrice`, `ProductID`, `TS`)
    VALUES (OLD.`CurrentPrice`, NEW.`CurrentPrice`, NEW.`ProductID`, CURRENT_TIMESTAMP);
  END IF;
END$$


-- ------------------------------------------------------------------------------
-- 4. Trigger 2: OrderLine Unit Price Inheritance & Default Quantity
-- Before insert, default UnitPrice to Product.CurrentPrice and NULL Quantity to 1.
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trig_OrderLineBeforeInsert`$$
CREATE TRIGGER `trig_OrderLineBeforeInsert`
BEFORE INSERT ON `OrderLine`
FOR EACH ROW
BEGIN
  -- Default NULL or non-positive Quantity to 1
  IF NEW.`Quantity` IS NULL OR NEW.`Quantity` <= 0 THEN
    SET NEW.`Quantity` = 1;
  END IF;

  -- Default UnitPrice to Product.CurrentPrice if not provided
  IF NEW.`UnitPrice` IS NULL OR NEW.`UnitPrice` <= 0 THEN
    SELECT `CurrentPrice` INTO @prod_price
    FROM `Product`
    WHERE `ProductID` = NEW.`ProductID`;

    SET NEW.`UnitPrice` = @prod_price;
  END IF;
END$$


-- ------------------------------------------------------------------------------
-- 5. Trigger 3: Inventory Control & Error Constraints
-- Enforce stock availability and adjust Product.QtyOnHand atomically.
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trig_OrderLineInventoryInsert`$$
CREATE TRIGGER `trig_OrderLineInventoryInsert`
AFTER INSERT ON `OrderLine`
FOR EACH ROW
BEGIN
  DECLARE v_available_qty INT;

  -- Check available stock
  SELECT `QtyOnHand` INTO v_available_qty
  FROM `Product`
  WHERE `ProductID` = NEW.`ProductID`
  FOR UPDATE;

  IF v_available_qty < NEW.`Quantity` THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Transaction Aborted: Requested quantity exceeds Product.QtyOnHand';
  END IF;

  -- Decrement inventory
  UPDATE `Product`
  SET `QtyOnHand` = `QtyOnHand` - NEW.`Quantity`
  WHERE `ProductID` = NEW.`ProductID`;
END$$

DROP TRIGGER IF EXISTS `trig_OrderLineInventoryUpdate`$$
CREATE TRIGGER `trig_OrderLineInventoryUpdate`
AFTER UPDATE ON `OrderLine`
FOR EACH ROW
BEGIN
  DECLARE v_qty_diff INT;
  DECLARE v_available_qty INT;

  SET v_qty_diff = NEW.`Quantity` - OLD.`Quantity`;

  IF v_qty_diff > 0 THEN
    SELECT `QtyOnHand` INTO v_available_qty
    FROM `Product`
    WHERE `ProductID` = NEW.`ProductID`
    FOR UPDATE;

    IF v_available_qty < v_qty_diff THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Transaction Aborted: Quantity adjustment exceeds Product.QtyOnHand';
    END IF;
  END IF;

  -- Adjust stock (handles both increases and decreases)
  IF v_qty_diff <> 0 THEN
    UPDATE `Product`
    SET `QtyOnHand` = `QtyOnHand` - v_qty_diff
    WHERE `ProductID` = NEW.`ProductID`;
  END IF;
END$$

DROP TRIGGER IF EXISTS `trig_OrderLineInventoryDelete`$$
CREATE TRIGGER `trig_OrderLineInventoryDelete`
AFTER DELETE ON `OrderLine`
FOR EACH ROW
BEGIN
  -- Restore inventory upon line cancellation
  UPDATE `Product`
  SET `QtyOnHand` = `QtyOnHand` + OLD.`Quantity`
  WHERE `ProductID` = OLD.`ProductID`;
END$$


-- ------------------------------------------------------------------------------
-- 6. Trigger 4: Subtotal & Tax Synchronization
-- Automatically recomputes OrderSubtotal & SalesTax using Customer ZIP lookup.
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trig_OrderLineSyncTotalsInsert`$$
CREATE TRIGGER `trig_OrderLineSyncTotalsInsert`
AFTER INSERT ON `OrderLine`
FOR EACH ROW
BEGIN
  DECLARE v_new_subtotal DECIMAL(8,2);
  DECLARE v_tax_rate DECIMAL(7,6);
  DECLARE v_new_tax DECIMAL(7,2);

  -- Recompute subtotal
  SELECT COALESCE(SUM(`LineTotal`), 0.00) INTO v_new_subtotal
  FROM `OrderLine`
  WHERE `OrderID` = NEW.`OrderID`;

  -- Fetch customer tax rate
  SELECT COALESCE(tr.`EstimatedCombinedRate`, 0.000000) INTO v_tax_rate
  FROM `Order` o
  JOIN `Customer` c ON o.`CustomerID` = c.`CustomerID`
  LEFT JOIN `TaxRates` tr ON c.`Zip` = tr.`ZipCode`
  WHERE o.`OrderID` = NEW.`OrderID`;

  -- Half-penny rounding (ROUND)
  SET v_new_tax = ROUND(v_new_subtotal * v_tax_rate, 2);

  -- Update Order header
  UPDATE `Order`
  SET `OrderSubtotal` = v_new_subtotal,
      `SalesTax` = v_new_tax
  WHERE `OrderID` = NEW.`OrderID`;
END$$

DROP TRIGGER IF EXISTS `trig_OrderLineSyncTotalsUpdate`$$
CREATE TRIGGER `trig_OrderLineSyncTotalsUpdate`
AFTER UPDATE ON `OrderLine`
FOR EACH ROW
BEGIN
  DECLARE v_new_subtotal DECIMAL(8,2);
  DECLARE v_tax_rate DECIMAL(7,6);
  DECLARE v_new_tax DECIMAL(7,2);

  SELECT COALESCE(SUM(`LineTotal`), 0.00) INTO v_new_subtotal
  FROM `OrderLine`
  WHERE `OrderID` = NEW.`OrderID`;

  SELECT COALESCE(tr.`EstimatedCombinedRate`, 0.000000) INTO v_tax_rate
  FROM `Order` o
  JOIN `Customer` c ON o.`CustomerID` = c.`CustomerID`
  LEFT JOIN `TaxRates` tr ON c.`Zip` = tr.`ZipCode`
  WHERE o.`OrderID` = NEW.`OrderID`;

  SET v_new_tax = ROUND(v_new_subtotal * v_tax_rate, 2);

  UPDATE `Order`
  SET `OrderSubtotal` = v_new_subtotal,
      `SalesTax` = v_new_tax
  WHERE `OrderID` = NEW.`OrderID`;
END$$

DROP TRIGGER IF EXISTS `trig_OrderLineSyncTotalsDelete`$$
CREATE TRIGGER `trig_OrderLineSyncTotalsDelete`
AFTER DELETE ON `OrderLine`
FOR EACH ROW
BEGIN
  DECLARE v_new_subtotal DECIMAL(8,2);
  DECLARE v_tax_rate DECIMAL(7,6);
  DECLARE v_new_tax DECIMAL(7,2);

  SELECT COALESCE(SUM(`LineTotal`), 0.00) INTO v_new_subtotal
  FROM `OrderLine`
  WHERE `OrderID` = OLD.`OrderID`;

  SELECT COALESCE(tr.`EstimatedCombinedRate`, 0.000000) INTO v_tax_rate
  FROM `Order` o
  JOIN `Customer` c ON o.`CustomerID` = c.`CustomerID`
  LEFT JOIN `TaxRates` tr ON c.`Zip` = tr.`ZipCode`
  WHERE o.`OrderID` = OLD.`OrderID`;

  SET v_new_tax = ROUND(v_new_subtotal * v_tax_rate, 2);

  UPDATE `Order`
  SET `OrderSubtotal` = v_new_subtotal,
      `SalesTax` = v_new_tax
  WHERE `OrderID` = OLD.`OrderID`;
END$$


-- ------------------------------------------------------------------------------
-- 7. Trigger 5: Eager Materialized View Refresh
-- Selectively refreshes affected rows in mv_ProductBuyers & mv_CustomerPurchases
-- without running full table scans.
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trig_EagerMVRefreshInsert`$$
CREATE TRIGGER `trig_EagerMVRefreshInsert`
AFTER INSERT ON `OrderLine`
FOR EACH ROW
BEGIN
  DECLARE v_cust_id INT;

  SELECT `CustomerID` INTO v_cust_id
  FROM `Order`
  WHERE `OrderID` = NEW.`OrderID`;

  -- Refresh affected Product in mv_ProductBuyers
  REPLACE INTO `mv_ProductBuyers` (
    `ProductID`, `ProductName`, `CurrentPrice`, `QtyOnHand`, `DistinctBuyerCount`, `Buyers`
  )
  SELECT
    `ProductID`, `ProductName`, `CurrentPrice`, `QtyOnHand`, `DistinctBuyerCount`, `Buyers`
  FROM `v_ProductBuyers`
  WHERE `ProductID` = NEW.`ProductID`;

  -- Refresh affected Customer in mv_CustomerPurchases
  IF v_cust_id IS NOT NULL THEN
    REPLACE INTO `mv_CustomerPurchases` (
      `CustomerID`, `FirstName`, `LastName`, `DistinctProductCount`, `PurchasedProducts`
    )
    SELECT
      `CustomerID`, `FirstName`, `LastName`, `DistinctProductCount`, `PurchasedProducts`
    FROM `v_CustomerPurchases`
    WHERE `CustomerID` = v_cust_id;
  END IF;
END$$

DELIMITER ;

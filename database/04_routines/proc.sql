-- ==============================================================================
-- MultiNode POS: Phase 4 - Stored Procedures & Table Alterations
-- Target DBMS: MariaDB (InnoDB Storage Engine)
-- Database: pos
-- File: database/04_routines/proc.sql
-- ==============================================================================

USE `pos`;

-- ------------------------------------------------------------------------------
-- 1. Table Alterations
-- ------------------------------------------------------------------------------

-- Alter OrderLine: Add UnitPrice and virtual generated column LineTotal
-- Use procedures/conditional checks or alter directly
SET @col_unitprice_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = 'pos' AND TABLE_NAME = 'OrderLine' AND COLUMN_NAME = 'UnitPrice'
);
SET @sql := IF(@col_unitprice_exists = 0, 
  'ALTER TABLE `OrderLine` ADD COLUMN `UnitPrice` DECIMAL(6,2) DEFAULT NULL AFTER `Quantity`', 
  'SELECT "Column UnitPrice already exists in OrderLine" AS Notice');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_linetotal_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = 'pos' AND TABLE_NAME = 'OrderLine' AND COLUMN_NAME = 'LineTotal'
);
SET @sql := IF(@col_linetotal_exists = 0, 
  'ALTER TABLE `OrderLine` ADD COLUMN `LineTotal` DECIMAL(8,2) AS (`Quantity` * `UnitPrice`) VIRTUAL AFTER `UnitPrice`', 
  'SELECT "Column LineTotal already exists in OrderLine" AS Notice');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Alter Order: Add OrderTotal
SET @col_ordertotal_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = 'pos' AND TABLE_NAME = 'Order' AND COLUMN_NAME = 'OrderTotal'
);
SET @sql := IF(@col_ordertotal_exists = 0, 
  'ALTER TABLE `Order` ADD COLUMN `OrderTotal` DECIMAL(8,2) DEFAULT NULL AFTER `CustomerID`', 
  'SELECT "Column OrderTotal already exists in Order" AS Notice');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Alter Customer: Drop Phone column if present
SET @col_phone_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = 'pos' AND TABLE_NAME = 'Customer' AND COLUMN_NAME = 'Phone'
);
SET @sql := IF(@col_phone_exists > 0, 
  'ALTER TABLE `Customer` DROP COLUMN `Phone`', 
  'SELECT "Column Phone already dropped from Customer" AS Notice');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- ------------------------------------------------------------------------------
-- 2. Stored Procedure: proc_FillUnitPrice
-- Populates NULL UnitPrice values in OrderLine from Product.CurrentPrice
-- without modifying existing records.
-- ------------------------------------------------------------------------------
DELIMITER $$

DROP PROCEDURE IF EXISTS `proc_FillUnitPrice`$$
CREATE PROCEDURE `proc_FillUnitPrice`(OUT `p_UpdatedRows` INT)
BEGIN
  -- Perform atomic update joining Product to backfill NULL UnitPrices
  UPDATE `OrderLine` ol
  JOIN `Product` p ON ol.`ProductID` = p.`ProductID`
  SET ol.`UnitPrice` = p.`CurrentPrice`
  WHERE ol.`UnitPrice` IS NULL;

  SET `p_UpdatedRows` = ROW_COUNT();
END$$

-- ------------------------------------------------------------------------------
-- 3. Stored Procedure: proc_FillOrderTotal
-- Aggregates the sum of LineTotal from OrderLine into Order.OrderTotal where NULL.
-- ------------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `proc_FillOrderTotal`$$
CREATE PROCEDURE `proc_FillOrderTotal`(OUT `p_UpdatedOrders` INT)
BEGIN
  -- Aggregate sum of generated LineTotal and update Order records where NULL
  UPDATE `Order` o
  JOIN (
    SELECT 
      `OrderID`, 
      ROUND(SUM(`LineTotal`), 2) AS `CalculatedTotal`
    FROM `OrderLine`
    GROUP BY `OrderID`
  ) ot ON o.`OrderID` = ot.`OrderID`
  SET o.`OrderTotal` = ot.`CalculatedTotal`
  WHERE o.`OrderTotal` IS NULL;

  SET `p_UpdatedOrders` = ROW_COUNT();
END$$

-- ------------------------------------------------------------------------------
-- 4. Stored Procedure: proc_RefreshMV
-- Transaction-safe refresh routine for mv_ProductBuyers and mv_CustomerPurchases.
-- Avoids TRUNCATE / DROP which cause implicit commits in MariaDB/MySQL.
-- Uses transactional DELETE + INSERT with error rollback.
-- ------------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `proc_RefreshMV`$$
CREATE PROCEDURE `proc_RefreshMV`()
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    -- Rollback on any failure to preserve existing materialized view snapshots
    ROLLBACK;
    RESIGNAL;
  END;

  -- Ensure adequate buffer for GROUP_CONCAT during snapshot refresh
  SET SESSION group_concat_max_len = 1048576;

  START TRANSACTION;

  -- Refresh mv_ProductBuyers
  DELETE FROM `mv_ProductBuyers`;
  INSERT INTO `mv_ProductBuyers` (
    `ProductID`,
    `ProductName`,
    `CurrentPrice`,
    `QtyOnHand`,
    `DistinctBuyerCount`,
    `Buyers`
  )
  SELECT
    `ProductID`,
    `ProductName`,
    `CurrentPrice`,
    `QtyOnHand`,
    `DistinctBuyerCount`,
    `Buyers`
  FROM `v_ProductBuyers`;

  -- Refresh mv_CustomerPurchases
  DELETE FROM `mv_CustomerPurchases`;
  INSERT INTO `mv_CustomerPurchases` (
    `CustomerID`,
    `FirstName`,
    `LastName`,
    `DistinctProductCount`,
    `PurchasedProducts`
  )
  SELECT
    `CustomerID`,
    `FirstName`,
    `LastName`,
    `DistinctProductCount`,
    `PurchasedProducts`
  FROM `v_CustomerPurchases`;

  COMMIT;
END$$

DELIMITER ;

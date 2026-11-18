-- ==============================================================================
-- MultiNode POS: Phase 3 - Views, Materialized Views & Indexes
-- Target DBMS: MariaDB (InnoDB Storage Engine)
-- Database: pos
-- File: database/03_views/views.sql
-- ==============================================================================

USE `pos`;

-- 1. Increase GROUP_CONCAT limit for snapshot population
SET SESSION group_concat_max_len = 1048576; -- 1MB buffer

-- ------------------------------------------------------------------------------
-- 2. Standard View: v_CustomerNames
-- Customer list ordered by LastName, then FirstName.
-- ------------------------------------------------------------------------------
DROP VIEW IF EXISTS `v_CustomerNames`;
CREATE VIEW `v_CustomerNames` AS
SELECT
  `CustomerID`,
  `FirstName`,
  `LastName`,
  CONCAT(`LastName`, ', ', `FirstName`) AS `FullName`
FROM `Customer`
ORDER BY `LastName` ASC, `FirstName` ASC;

-- ------------------------------------------------------------------------------
-- 3. Standard View: v_Customers
-- Full normalized address representation joined with City table and cleanly aliased.
-- ------------------------------------------------------------------------------
DROP VIEW IF EXISTS `v_Customers`;
CREATE VIEW `v_Customers` AS
SELECT
  c.`CustomerID` AS `customer_number`,
  c.`FirstName`  AS `first_name`,
  c.`LastName`   AS `last_name`,
  c.`Email`      AS `email`,
  c.`Address1`   AS `street1`,
  c.`Address2`   AS `street2`,
  ci.`City`      AS `City`,
  ci.`State`     AS `ST`,
  c.`Zip`        AS `zip_code`
FROM `Customer` c
JOIN `City` ci ON c.`Zip` = ci.`Zip`;

-- ------------------------------------------------------------------------------
-- 4. Standard View: v_ProductBuyers
-- All products mapped with a comma-separated list of distinct customer names
-- and IDs who purchased them (handles products with zero buyers gracefully).
-- ------------------------------------------------------------------------------
DROP VIEW IF EXISTS `v_ProductBuyers`;
CREATE VIEW `v_ProductBuyers` AS
SELECT
  p.`ProductID`,
  p.`Name` AS `ProductName`,
  p.`CurrentPrice`,
  p.`QtyOnHand`,
  COUNT(DISTINCT c.`CustomerID`) AS `DistinctBuyerCount`,
  COALESCE(
    GROUP_CONCAT(
      DISTINCT CONCAT(c.`FirstName`, ' ', c.`LastName`, ' (ID: ', c.`CustomerID`, ')')
      ORDER BY c.`LastName` ASC, c.`FirstName` ASC
      SEPARATOR ', '
    ),
    'None'
  ) AS `Buyers`
FROM `Product` p
LEFT JOIN `OrderLine` ol ON p.`ProductID` = ol.`ProductID`
LEFT JOIN `Order` o      ON ol.`OrderID` = o.`OrderID`
LEFT JOIN `Customer` c   ON o.`CustomerID` = c.`CustomerID`
GROUP BY
  p.`ProductID`,
  p.`Name`,
  p.`CurrentPrice`,
  p.`QtyOnHand`;

-- ------------------------------------------------------------------------------
-- 5. Standard View: v_CustomerPurchases
-- All customers mapped with a pipe-separated (|) list of distinct product
-- names and IDs purchased.
-- ------------------------------------------------------------------------------
DROP VIEW IF EXISTS `v_CustomerPurchases`;
CREATE VIEW `v_CustomerPurchases` AS
SELECT
  c.`CustomerID`,
  c.`FirstName`,
  c.`LastName`,
  COUNT(DISTINCT p.`ProductID`) AS `DistinctProductCount`,
  COALESCE(
    GROUP_CONCAT(
      DISTINCT CONCAT(p.`Name`, ' [ID: ', p.`ProductID`, ']')
      ORDER BY p.`Name` ASC
      SEPARATOR ' | '
    ),
    'None'
  ) AS `PurchasedProducts`
FROM `Customer` c
LEFT JOIN `Order` o      ON c.`CustomerID` = o.`CustomerID`
LEFT JOIN `OrderLine` ol ON o.`OrderID` = ol.`OrderID`
LEFT JOIN `Product` p    ON ol.`ProductID` = p.`ProductID`
GROUP BY
  c.`CustomerID`,
  c.`FirstName`,
  c.`LastName`;

-- ------------------------------------------------------------------------------
-- 6. Materialized Views: mv_ProductBuyers & mv_CustomerPurchases
-- Instantiated as dedicated InnoDB tables for instant O(1) PK snapshot reads.
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `mv_ProductBuyers`;
CREATE TABLE `mv_ProductBuyers` (
  `ProductID` INT NOT NULL,
  `ProductName` VARCHAR(128) NOT NULL,
  `CurrentPrice` DECIMAL(6,2) NOT NULL,
  `QtyOnHand` INT NOT NULL,
  `DistinctBuyerCount` INT NOT NULL DEFAULT 0,
  `Buyers` MEDIUMTEXT NOT NULL,
  `LastRefreshed` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`ProductID`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

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

DROP TABLE IF EXISTS `mv_CustomerPurchases`;
CREATE TABLE `mv_CustomerPurchases` (
  `CustomerID` INT NOT NULL,
  `FirstName` VARCHAR(32) NOT NULL,
  `LastName` VARCHAR(32) NOT NULL,
  `DistinctProductCount` INT NOT NULL DEFAULT 0,
  `PurchasedProducts` MEDIUMTEXT NOT NULL,
  `LastRefreshed` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`CustomerID`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

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

-- ------------------------------------------------------------------------------
-- 7. Secondary Indexes
-- Non-unique indexes for fast lookup on Customer Email and Product Name
-- ------------------------------------------------------------------------------
-- Ensure idempotent creation
DROP INDEX IF EXISTS `idx_CustomerEmail` ON `Customer`;
CREATE INDEX `idx_CustomerEmail` ON `Customer` (`Email`);

DROP INDEX IF EXISTS `idx_ProductName` ON `Product`;
CREATE INDEX `idx_ProductName` ON `Product` (`Name`);

-- ------------------------------------------------------------------------------
-- 8. Phase 3 Verification Queries
-- ------------------------------------------------------------------------------
SELECT 'v_CustomerNames' AS `View/Table`, COUNT(*) AS `RowCount` FROM `v_CustomerNames`
UNION ALL
SELECT 'v_Customers', COUNT(*) FROM `v_Customers`
UNION ALL
SELECT 'v_ProductBuyers', COUNT(*) FROM `v_ProductBuyers`
UNION ALL
SELECT 'v_CustomerPurchases', COUNT(*) FROM `v_CustomerPurchases`
UNION ALL
SELECT 'mv_ProductBuyers', COUNT(*) FROM `mv_ProductBuyers`
UNION ALL
SELECT 'mv_CustomerPurchases', COUNT(*) FROM `mv_CustomerPurchases`;

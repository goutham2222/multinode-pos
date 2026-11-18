-- ==============================================================================
-- MultiNode POS: Phase 2 - Staging & Cleansing ETL
-- Target DBMS: MariaDB (InnoDB Storage Engine)
-- Database: pos
-- File: database/02_etl/etl.sql
-- ==============================================================================

USE `pos`;

-- 1. Create Raw Staging Tables
DROP TABLE IF EXISTS `customers_tmp`;
CREATE TABLE `customers_tmp` (
  `ID` VARCHAR(64),
  `FN` VARCHAR(64),
  `LN` VARCHAR(64),
  `CT` VARCHAR(64),
  `ST` VARCHAR(64),
  `ZP` VARCHAR(64),
  `S1` VARCHAR(256),
  `S2` VARCHAR(256),
  `EM` VARCHAR(256),
  `BD` VARCHAR(64)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

DROP TABLE IF EXISTS `products_tmp`;
CREATE TABLE `products_tmp` (
  `ID` VARCHAR(64),
  `Name` VARCHAR(256),
  `Price` VARCHAR(64),
  `QtyOnHand` VARCHAR(64)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

DROP TABLE IF EXISTS `orders_tmp`;
CREATE TABLE `orders_tmp` (
  `OID` VARCHAR(64),
  `CID` VARCHAR(64),
  `Ordered` VARCHAR(64),
  `Shipped` VARCHAR(64)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

DROP TABLE IF EXISTS `orderlines_tmp`;
CREATE TABLE `orderlines_tmp` (
  `OID` VARCHAR(64),
  `PID` VARCHAR(64)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 2. Ingest CSV Files via LOAD DATA LOCAL INFILE
-- File paths are relative to client execution directory (e.g. repo root or ~/data/raw/)
LOAD DATA LOCAL INFILE 'data/raw/customers.csv'
INTO TABLE `customers_tmp`
FIELDS TERMINATED BY ','
OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES;

LOAD DATA LOCAL INFILE 'data/raw/products.csv'
INTO TABLE `products_tmp`
FIELDS TERMINATED BY ','
OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES;

LOAD DATA LOCAL INFILE 'data/raw/orders.csv'
INTO TABLE `orders_tmp`
FIELDS TERMINATED BY ','
OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES;

LOAD DATA LOCAL INFILE 'data/raw/orderlines.csv'
INTO TABLE `orderlines_tmp`
FIELDS TERMINATED BY ','
OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES;

-- 3. Step 1: Cleansing & Coercion for City
-- Extract distinct normalized Zip, City, State pairings
INSERT INTO `City` (`Zip`, `City`, `State`)
SELECT DISTINCT
  CAST(TRIM(`ZP`) AS UNSIGNED),
  TRIM(`CT`),
  TRIM(`ST`)
FROM `customers_tmp`
WHERE TRIM(`ZP`) != '' AND `ZP` IS NOT NULL;

-- 4. Step 2: Cleansing & Coercion for Customer
-- Strip whitespaces, format date (STR_TO_DATE), zero-pad zip codes, convert blank strings to NULL
INSERT INTO `Customer` (
  `CustomerID`,
  `FirstName`,
  `LastName`,
  `Email`,
  `Address1`,
  `Address2`,
  `Phone`,
  `Birthdate`,
  `Zip`
)
SELECT
  CAST(TRIM(`ID`) AS SIGNED),
  TRIM(`FN`),
  TRIM(`LN`),
  NULLIF(TRIM(`EM`), ''),
  NULLIF(TRIM(`S1`), ''),
  NULLIF(TRIM(`S2`), ''),
  NULL, -- Phone column initialized to NULL
  CASE
    WHEN TRIM(`BD`) = '' OR `BD` IS NULL THEN NULL
    ELSE STR_TO_DATE(TRIM(`BD`), '%c/%e/%Y')
  END,
  CAST(TRIM(`ZP`) AS UNSIGNED)
FROM `customers_tmp`;

-- 5. Step 3: Cleansing & Coercion for Product
-- Strip currency symbols ($) and commas from price, coerce types
INSERT INTO `Product` (
  `ProductID`,
  `Name`,
  `CurrentPrice`,
  `QtyOnHand`
)
SELECT
  CAST(TRIM(`ID`) AS SIGNED),
  TRIM(`Name`),
  CAST(REPLACE(REPLACE(TRIM(`Price`), '$', ''), ',', '') AS DECIMAL(6,2)),
  CAST(TRIM(`QtyOnHand`) AS SIGNED)
FROM `products_tmp`;

-- 6. Step 4: Cleansing & Coercion for Order
-- Extract date portions, convert 'Cancelled' shipments to NULL
INSERT INTO `Order` (
  `OrderID`,
  `datePlaced`,
  `dateShipped`,
  `CustomerID`
)
SELECT
  CAST(TRIM(`OID`) AS UNSIGNED),
  DATE(TRIM(`Ordered`)),
  CASE
    WHEN LOWER(TRIM(`Shipped`)) = 'cancelled' OR TRIM(`Shipped`) = '' OR `Shipped` IS NULL THEN NULL
    ELSE DATE(TRIM(`Shipped`))
  END,
  CAST(TRIM(`CID`) AS SIGNED)
FROM `orders_tmp`;

-- 7. Step 5: Cleansing & Aggregation for OrderLine
-- Aggregate repeated (OID, PID) pairs into single row with Quantity count
INSERT INTO `OrderLine` (
  `OrderID`,
  `ProductID`,
  `Quantity`
)
SELECT
  CAST(TRIM(`OID`) AS UNSIGNED),
  CAST(TRIM(`PID`) AS SIGNED),
  COUNT(*) AS `Quantity`
FROM `orderlines_tmp`
GROUP BY
  CAST(TRIM(`OID`) AS UNSIGNED),
  CAST(TRIM(`PID`) AS SIGNED);

-- 8. Clean up temporary staging tables
DROP TABLE IF EXISTS `customers_tmp`;
DROP TABLE IF EXISTS `products_tmp`;
DROP TABLE IF EXISTS `orders_tmp`;
DROP TABLE IF EXISTS `orderlines_tmp`;

-- 9. Post-ETL Record Count Verification
SELECT 'City' AS `Table`, COUNT(*) AS `LoadedRows` FROM `City`
UNION ALL
SELECT 'Customer', COUNT(*) FROM `Customer`
UNION ALL
SELECT 'Product', COUNT(*) FROM `Product`
UNION ALL
SELECT 'Order', COUNT(*) FROM `Order`
UNION ALL
SELECT 'OrderLine', COUNT(*) FROM `OrderLine`
UNION ALL
SELECT 'PriceHistory', COUNT(*) FROM `PriceHistory`;

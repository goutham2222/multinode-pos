-- ==============================================================================
-- MultiNode POS: Phase 2 - Base Relational Schema
-- Target DBMS: MariaDB (InnoDB Storage Engine)
-- Database: pos
-- File: database/01_schema/structure.sql
-- ==============================================================================

-- 1. Database Initialization
CREATE DATABASE IF NOT EXISTS `pos`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `pos`;

-- 2. Drop existing tables in reverse dependency order
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `OrderLine`;
DROP TABLE IF EXISTS `PriceHistory`;
DROP TABLE IF EXISTS `Order`;
DROP TABLE IF EXISTS `Customer`;
DROP TABLE IF EXISTS `Product`;
DROP TABLE IF EXISTS `City`;
SET FOREIGN_KEY_CHECKS = 1;

-- 3. City Table
-- Normalized location lookup referenced by Customer.
CREATE TABLE `City` (
  `Zip` DECIMAL(5) ZEROFILL NOT NULL,
  `City` VARCHAR(32) NOT NULL,
  `State` VARCHAR(4) NOT NULL,
  PRIMARY KEY (`Zip`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- 4. Customer Table
-- Customer master entity with 5-digit zero-filled postal code.
CREATE TABLE `Customer` (
  `CustomerID` INT NOT NULL,
  `FirstName` VARCHAR(32) NOT NULL,
  `LastName` VARCHAR(32) NOT NULL,
  `Email` VARCHAR(128) DEFAULT NULL,
  `Address1` VARCHAR(128) DEFAULT NULL,
  `Address2` VARCHAR(128) DEFAULT NULL,
  `Phone` VARCHAR(32) DEFAULT NULL,
  `Birthdate` DATE DEFAULT NULL,
  `Zip` DECIMAL(5) ZEROFILL NOT NULL,
  PRIMARY KEY (`CustomerID`),
  CONSTRAINT `fk_customer_city`
    FOREIGN KEY (`Zip`) REFERENCES `City` (`Zip`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- 5. Product Table
-- Catalog inventory tracking quantity on hand and current retail price.
CREATE TABLE `Product` (
  `ProductID` INT NOT NULL,
  `Name` VARCHAR(128) NOT NULL,
  `CurrentPrice` DECIMAL(6,2) NOT NULL,
  `QtyOnHand` INT NOT NULL,
  PRIMARY KEY (`ProductID`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- 6. Order Table
-- Transaction header capturing placement and fulfillment timestamps.
CREATE TABLE `Order` (
  `OrderID` BIGINT UNSIGNED NOT NULL,
  `datePlaced` DATE NOT NULL,
  `dateShipped` DATE DEFAULT NULL,
  `CustomerID` INT NOT NULL,
  PRIMARY KEY (`OrderID`),
  CONSTRAINT `fk_order_customer`
    FOREIGN KEY (`CustomerID`) REFERENCES `Customer` (`CustomerID`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- 7. OrderLine Table
-- Composite associative entity mapping orders to line items with quantities.
CREATE TABLE `OrderLine` (
  `OrderID` BIGINT UNSIGNED NOT NULL,
  `ProductID` INT NOT NULL,
  `Quantity` INT NOT NULL,
  PRIMARY KEY (`OrderID`, `ProductID`),
  CONSTRAINT `fk_orderline_order`
    FOREIGN KEY (`OrderID`) REFERENCES `Order` (`OrderID`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_orderline_product`
    FOREIGN KEY (`ProductID`) REFERENCES `Product` (`ProductID`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- 8. PriceHistory Table
-- Audit ledger capturing historical price adjustments per product.
CREATE TABLE `PriceHistory` (
  `ChangeID` BIGINT UNSIGNED NOT NULL,
  `OldPrice` DECIMAL(6,2) DEFAULT NULL,
  `NewPrice` DECIMAL(6,2) DEFAULT NULL,
  `TS` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ProductID` INT NOT NULL,
  PRIMARY KEY (`ChangeID`),
  CONSTRAINT `fk_pricehistory_product`
    FOREIGN KEY (`ProductID`) REFERENCES `Product` (`ProductID`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- ==============================================================================
-- MultiNode POS: Phase 8 - NoSQL Denormalization & Document Transformation
-- Target DBMS: MariaDB (Relational) -> MongoDB (Document Analytics)
-- Database: pos
-- File: database/07_nosql/json.sql
-- ==============================================================================

USE `pos`;

-- ------------------------------------------------------------------------------
-- 1. View: v_Document_Orders
-- Denormalizes orders into self-contained hierarchical JSON documents.
-- Embeds customer demographics and nested array of order line items.
-- ------------------------------------------------------------------------------
DROP VIEW IF EXISTS `v_Document_Orders`;
CREATE VIEW `v_Document_Orders` AS
SELECT 
  o.OrderID AS order_id,
  JSON_OBJECT(
    "order_id", o.OrderID,
    "date_placed", DATE_FORMAT(o.datePlaced, "%Y-%m-%d"),
    "date_shipped", DATE_FORMAT(o.dateShipped, "%Y-%m-%d"),
    "status", IF(o.dateShipped IS NULL, "Processing", "Shipped"),
    "subtotal", CAST(COALESCE(o.OrderSubtotal, 0.00) AS DOUBLE),
    "sales_tax", CAST(COALESCE(o.SalesTax, 0.00) AS DOUBLE),
    "total", CAST(COALESCE(o.OrderTotal, 0.00) AS DOUBLE),
    "customer", JSON_OBJECT(
      "customer_id", c.CustomerID,
      "name", CONCAT(c.FirstName, " ", c.LastName),
      "first_name", c.FirstName,
      "last_name", c.LastName,
      "email", c.Email,
      "address", c.Address1,
      "zip", c.Zip,
      "city", ct.City,
      "state", ct.State
    ),
    "items", COALESCE(
      (
        SELECT JSON_ARRAYAGG(
          JSON_OBJECT(
            "product_id", ol.ProductID,
            "product_name", p.Name,
            "quantity", ol.Quantity,
            "unit_price", CAST(ol.UnitPrice AS DOUBLE),
            "line_total", CAST(ol.LineTotal AS DOUBLE)
          )
        )
        FROM OrderLine ol
        JOIN Product p ON ol.ProductID = p.ProductID
        WHERE ol.OrderID = o.OrderID
      ),
      JSON_ARRAY()
    ),
    "item_count", (
      SELECT COALESCE(SUM(ol.Quantity), 0)
      FROM OrderLine ol
      WHERE ol.OrderID = o.OrderID
    )
  ) AS document_json
FROM `Order` o
JOIN Customer c ON o.CustomerID = c.CustomerID
LEFT JOIN City ct ON c.Zip = ct.Zip;


-- ------------------------------------------------------------------------------
-- 2. View: v_Document_Customers
-- Denormalizes customers into analytical profile documents.
-- Embeds address details and precomputed customer lifetime metrics.
-- ------------------------------------------------------------------------------
DROP VIEW IF EXISTS `v_Document_Customers`;
CREATE VIEW `v_Document_Customers` AS
SELECT 
  c.CustomerID AS customer_id,
  JSON_OBJECT(
    "customer_id", c.CustomerID,
    "name", CONCAT(c.FirstName, " ", c.LastName),
    "first_name", c.FirstName,
    "last_name", c.LastName,
    "email", c.Email,
    "address", c.Address1,
    "zip", c.Zip,
    "city", ct.City,
    "state", ct.State,
    "metrics", JSON_OBJECT(
      "lifetime_orders", COUNT(o.OrderID),
      "lifetime_spend", CAST(COALESCE(SUM(o.OrderTotal), 0.00) AS DOUBLE),
      "average_order_value", CAST(IF(COUNT(o.OrderID) > 0, ROUND(SUM(o.OrderTotal) / COUNT(o.OrderID), 2), 0.00) AS DOUBLE),
      "first_order_date", DATE_FORMAT(MIN(o.datePlaced), "%Y-%m-%d"),
      "latest_order_date", DATE_FORMAT(MAX(o.datePlaced), "%Y-%m-%d")
    )
  ) AS document_json
FROM Customer c
LEFT JOIN City ct ON c.Zip = ct.Zip
LEFT JOIN `Order` o ON c.CustomerID = o.CustomerID
GROUP BY c.CustomerID, c.FirstName, c.LastName, c.Email, c.Address1, c.Zip, ct.City, ct.State;


-- ------------------------------------------------------------------------------
-- 3. View: v_Document_Products
-- Denormalizes products into catalog documents with price audit histories.
-- ------------------------------------------------------------------------------
DROP VIEW IF EXISTS `v_Document_Products`;
CREATE VIEW `v_Document_Products` AS
SELECT 
  p.ProductID AS product_id,
  JSON_OBJECT(
    "product_id", p.ProductID,
    "name", p.Name,
    "current_price", CAST(p.CurrentPrice AS DOUBLE),
    "qty_on_hand", p.QtyOnHand,
    "price_audit_history", COALESCE(
      (
        SELECT JSON_ARRAYAGG(
          JSON_OBJECT(
            "change_id", ph.ChangeID,
            "old_price", CAST(ph.OldPrice AS DOUBLE),
            "new_price", CAST(ph.NewPrice AS DOUBLE),
            "timestamp", DATE_FORMAT(ph.TS, "%Y-%m-%d %H:%i:%s")
          )
        )
        FROM PriceHistory ph
        WHERE ph.ProductID = p.ProductID
      ),
      JSON_ARRAY()
    )
  ) AS document_json
FROM Product p;


-- ------------------------------------------------------------------------------
-- 4. Sample Extraction Queries for CLI Export
-- Run via:
-- mariadb -u pos_app -p -e "SELECT document_json FROM pos.v_Document_Orders" -N -B > orders.jsonl
-- mariadb -u pos_app -p -e "SELECT document_json FROM pos.v_Document_Customers" -N -B > customers.jsonl
-- ------------------------------------------------------------------------------
SELECT "NoSQL Views v_Document_Orders, v_Document_Customers, v_Document_Products created successfully." AS Status;

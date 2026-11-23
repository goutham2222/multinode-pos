-- ==============================================================================
-- MultiNode POS: Distributed Transactional & Analytical Engine
-- Relational to Denormalized NoSQL Document Extraction Pipeline
-- Author: Goutham
-- System: MariaDB 10.11+ / MongoDB JSON Lines Pipeline
-- Purpose: Denormalized document extraction for analytical processing
-- ==============================================================================

source trig.sql;

USE `pos`;

-- ------------------------------------------------------------------------------
-- Extraction Pipeline Overview & Execution Notes:
-- This script transforms normalized relational data from the MultiNode POS
-- schema into four denormalized JSON document streams formatted as JSON Lines
-- (one valid JSON object per row, without separating commas between root objects)
-- ready for direct bulk ingestion into MongoDB via mongoimport.
--
-- File Output Options:
-- 1. MariaDB Server-Side INTO OUTFILE:
--    By default, MariaDB writes files to the database directory (/var/lib/mysql/pos/).
--    The SELECT statements below include INTO OUTFILE clauses.
--
-- 2. Client-Side Streaming CLI (if @@secure_file_priv restricts server writes):
--    mariadb -h 20.169.214.104 -u pos_app -p pos -N -B -e "..." > cust1.json
--
-- 3. Automated Exporter:
--    python3 database/07_nosql/export_to_mongo.py
-- ------------------------------------------------------------------------------


-- ==============================================================================
-- Aggregate 1: cust1.json
-- Focuses on Customers.
-- Includes full address information formatted with \n between lines.
-- Omits Address2 if it is NULL or empty.
-- Combines FirstName and LastName into "Customer Name".
-- ==============================================================================

SELECT JSON_OBJECT(
  'CustomerID', c.CustomerID,
  'Customer Name', CONCAT(c.FirstName, ' ', c.LastName),
  'Address', CONCAT_WS('\n', c.Address1, NULLIF(c.Address2, ''), ct.City, ct.State, c.Zip)
)
FROM Customer c
JOIN City ct ON c.Zip = ct.Zip
INTO OUTFILE 'cust1.json';


-- ==============================================================================
-- Aggregate 2: prod.json
-- Focuses on Products and the customers who purchased them.
-- Includes ProductID, current price, and product name.
-- Includes an array of customer objects { CustomerID, "Customer Name" }.
-- ==============================================================================

SELECT JSON_OBJECT(
  'ProductID', p.ProductID,
  'CurrentPrice', CAST(p.CurrentPrice AS DOUBLE),
  'Name', p.Name,
  'Customers', IF(sub.CustomerID IS NULL, JSON_ARRAY(), JSON_ARRAYAGG(
    JSON_OBJECT(
      'CustomerID', sub.CustomerID,
      'Customer Name', CONCAT(sub.FirstName, ' ', sub.LastName)
    )
  ))
)
FROM Product p
LEFT JOIN (
  SELECT DISTINCT ol.ProductID, c.CustomerID, c.FirstName, c.LastName
  FROM OrderLine ol
  JOIN `Order` o ON ol.OrderID = o.OrderID
  JOIN Customer c ON o.CustomerID = c.CustomerID
) sub ON p.ProductID = sub.ProductID
GROUP BY p.ProductID, p.Name, p.CurrentPrice
INTO OUTFILE 'prod.json';


-- ==============================================================================
-- Aggregate 3: ord.json
-- Focuses on Orders.
-- Each order represented with embedded buyer object and product object.
-- Includes quantity.
-- ==============================================================================

SELECT JSON_OBJECT(
  'OrderID', o.OrderID,
  'Order Date', DATE_FORMAT(o.datePlaced, '%Y-%m-%d'),
  'Order Total', CAST(COALESCE(o.OrderTotal, 0.00) AS DOUBLE),
  'buyer', JSON_OBJECT(
    'CustomerID', c.CustomerID,
    'Customer Name', CONCAT(c.FirstName, ' ', c.LastName)
  ),
  'product', JSON_OBJECT(
    'ProductID', p.ProductID,
    'Product Name', p.Name,
    'UnitPrice', CAST(ol.UnitPrice AS DOUBLE)
  ),
  'quantity', ol.Quantity
)
FROM `Order` o
JOIN Customer c ON o.CustomerID = c.CustomerID
JOIN OrderLine ol ON o.OrderID = ol.OrderID
JOIN Product p ON ol.ProductID = p.ProductID
INTO OUTFILE 'ord.json';


-- ==============================================================================
-- Aggregate 4: cust2.json
-- Focuses on Customers and their complete order history.
-- Includes all demographic and address information from cust1.json.
-- Adds an array of each order placed by the customer, including:
--   - Order Total
--   - Order Date
--   - Shipping Date
--   - Items in the order:
--       - Product ID
--       - Quantity
--       - Product Name
-- ==============================================================================

SELECT JSON_OBJECT(
  'CustomerID', c.CustomerID,
  'Customer Name', CONCAT(c.FirstName, ' ', c.LastName),
  'Address', CONCAT_WS('\n', c.Address1, NULLIF(c.Address2, ''), ct.City, ct.State, c.Zip),
  'orders', COALESCE(
    (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
          'Order Total', CAST(COALESCE(o.OrderTotal, 0.00) AS DOUBLE),
          'Order Date', DATE_FORMAT(o.datePlaced, '%Y-%m-%d'),
          'Shipping Date', DATE_FORMAT(o.dateShipped, '%Y-%m-%d'),
          'items', COALESCE(
            (
              SELECT JSON_ARRAYAGG(
                JSON_OBJECT(
                  'Product ID', ol.ProductID,
                  'Quantity', ol.Quantity,
                  'Product Name', p.Name
                )
              )
              FROM OrderLine ol
              JOIN Product p ON ol.ProductID = p.ProductID
              WHERE ol.OrderID = o.OrderID
            ),
            JSON_ARRAY()
          )
        )
      )
      FROM `Order` o
      WHERE o.CustomerID = c.CustomerID
    ),
    JSON_ARRAY()
  )
)
FROM Customer c
JOIN City ct ON c.Zip = ct.Zip
INTO OUTFILE 'cust2.json';

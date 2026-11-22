#!/usr/bin/env python3
"""
MultiNode POS: Phase 8 - Automated MariaDB to MongoDB Exporter
File: database/07_nosql/export_to_mongo.py

Extracts the four standardized JSON document aggregates required by the
JSON Milestone and MongoDB Milestone:
  1. cust1.json  -> MongoDB collection: Customers
  2. prod.json   -> MongoDB collection: Products
  3. ord.json    -> MongoDB collection: Orders
  4. cust2.json  -> MongoDB collection: CustomerOrders

Outputs to: data/nosql_export/ (JSON Lines format)
"""

import os
import sys
import json
import argparse
import time
import pymysql

EXPORT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../data/nosql_export"))

SQL_QUERIES = {
    "cust1.json": """
        SELECT JSON_OBJECT(
          'CustomerID', c.CustomerID,
          'Customer Name', CONCAT(c.FirstName, ' ', c.LastName),
          'Address', CONCAT_WS('\n', c.Address1, NULLIF(c.Address2, ''), ct.City, ct.State, c.Zip)
        )
        FROM Customer c
        JOIN City ct ON c.Zip = ct.Zip
    """,
    "prod.json": """
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
    """,
    "ord.json": """
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
    """,
    "cust2.json": """
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
    """
}

def get_mariadb_connection(host="20.169.214.104", user="pos_app", password="ChangeMeSecure123!", database="pos"):
    return pymysql.connect(
        host=host,
        user=user,
        password=password,
        database=database,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.SSCursor  # Streaming server-side cursor to handle large datasets
    )

def export_file(conn, filename, query, limit=None):
    os.makedirs(EXPORT_DIR, exist_ok=True)
    out_path = os.path.join(EXPORT_DIR, filename)
    print(f"\n[*] Exporting -> {out_path} ...")
    start_t = time.time()

    sql = query.strip()
    if limit:
        sql += f" LIMIT {limit}"

    count = 0
    with conn.cursor() as cur:
        cur.execute(sql)
        with open(out_path, "w", encoding="utf-8") as f:
            while True:
                row = cur.fetchone()
                if not row:
                    break
                doc_str = row[0]
                if isinstance(doc_str, (bytes, bytearray)):
                    doc_str = doc_str.decode("utf-8")
                f.write(doc_str.strip() + "\n")
                count += 1
                if count % 10000 == 0:
                    print(f"    Exported {count} documents...")

    elapsed = time.time() - start_t
    file_size_mb = os.path.getsize(out_path) / (1024 * 1024)
    print(f"[✓] Completed {filename}: {count:,} documents in {elapsed:.2f}s ({file_size_mb:.2f} MB)")
    return count

def run_export(host="20.169.214.104", limit=None):
    print("=" * 70)
    print("MultiNode POS: NoSQL Milestone Document Exporter")
    print(f"MariaDB Host:     {host}")
    print(f"Output Directory: {EXPORT_DIR}")
    print(f"Sample Limit:     {limit if limit else 'None (Full Export)'}")
    print("=" * 70)

    conn = get_mariadb_connection(host=host)
    try:
        total_docs = 0
        for filename, query in SQL_QUERIES.items():
            total_docs += export_file(conn, filename, query, limit=limit)

        print("\n" + "=" * 70)
        print(f"SUCCESS: Exported {total_docs:,} total documents across 4 aggregates.")
        print("\nImport into MongoDB using mongoimport:")
        print(f"  mongoimport --db pos --collection Customers      --file {os.path.join(EXPORT_DIR, 'cust1.json')}")
        print(f"  mongoimport --db pos --collection Products       --file {os.path.join(EXPORT_DIR, 'prod.json')}")
        print(f"  mongoimport --db pos --collection Orders         --file {os.path.join(EXPORT_DIR, 'ord.json')}")
        print(f"  mongoimport --db pos --collection CustomerOrders --file {os.path.join(EXPORT_DIR, 'cust2.json')}")
        print("=" * 70)
    finally:
        conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export MariaDB relational tables to JSON Milestone files")
    parser.add_argument("--host", default="20.169.214.104", help="MariaDB host IP")
    parser.add_argument("--limit", type=int, default=None, help="Optional record limit for testing")
    args = parser.parse_args()

    run_export(host=args.host, limit=args.limit)

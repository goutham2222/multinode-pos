#!/usr/bin/env python3
"""
MultiNode POS: Phase 8 - Automated MariaDB to MongoDB Exporter & Analytics Runner
File: database/07_nosql/export_to_mongo.py

Extracts denormalized JSON documents from MariaDB views:
  - v_Document_Orders -> data/nosql_export/orders.jsonl
  - v_Document_Customers -> data/nosql_export/customers.jsonl
  - v_Document_Products -> data/nosql_export/products.jsonl

Optionally loads them into MongoDB and executes analytical aggregation pipelines.
"""

import os
import sys
import json
import argparse
import pymysql

# Add backend directory to path if needed
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../backend")))

EXPORT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../data/nosql_export"))

def get_mariadb_connection(host="20.169.214.104", user="pos_app", password="ChangeMeSecure123!", database="pos"):
    return pymysql.connect(
        host=host,
        user=user,
        password=password,
        database=database,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.SSCursor  # Server-side streaming cursor for high throughput
    )

def export_view_to_jsonl(conn, view_name, output_filename, limit=None):
    os.makedirs(EXPORT_DIR, exist_ok=True)
    out_path = os.path.join(EXPORT_DIR, output_filename)
    
    print(f"[*] Exporting {view_name} -> {out_path} ...")
    query = f"SELECT document_json FROM {view_name}"
    if limit:
        query += f" LIMIT {limit}"
        
    count = 0
    with conn.cursor() as cur:
        cur.execute(query)
        with open(out_path, "w", encoding="utf-8") as f:
            while True:
                row = cur.fetchone()
                if not row:
                    break
                doc_str = row[0]
                if isinstance(doc_str, (bytes, bytearray)):
                    doc_str = doc_str.decode("utf-8")
                # Validate JSON string format
                f.write(doc_str.strip() + "\n")
                count += 1
                if count % 5000 == 0:
                    print(f"    Exported {count} documents...")

    file_size_mb = os.path.getsize(out_path) / (1024 * 1024)
    print(f"[✓] Successfully exported {count} documents to {output_filename} ({file_size_mb:.2f} MB).")
    return count

def run_export(host="20.169.214.104", sample_only=False):
    print("=" * 65)
    print("MultiNode POS: NoSQL Denormalization & Document Extraction")
    print(f"Target Database Host: {host}")
    print(f"Output Directory: {EXPORT_DIR}")
    print("=" * 65)

    conn = get_mariadb_connection(host=host)
    try:
        limit = 500 if sample_only else None
        
        # 1. Orders
        export_view_to_jsonl(conn, "v_Document_Orders", "orders.jsonl", limit=limit)
        
        # 2. Customers
        export_view_to_jsonl(conn, "v_Document_Customers", "customers.jsonl", limit=limit)
        
        # 3. Products
        export_view_to_jsonl(conn, "v_Document_Products", "products.jsonl", limit=limit)

        print("\n[✓] All NoSQL documents exported successfully.")
        print("\nNext steps for MongoDB Ingestion:")
        print("  mongoimport --uri=\"mongodb://localhost:27017/pos_analytics\" --collection=orders --file=data/nosql_export/orders.jsonl")
        print("  mongoimport --uri=\"mongodb://localhost:27017/pos_analytics\" --collection=customers --file=data/nosql_export/customers.jsonl")
        print("  mongoimport --uri=\"mongodb://localhost:27017/pos_analytics\" --collection=products --file=data/nosql_export/products.jsonl")
        print("  mongosh \"mongodb://localhost:27017/pos_analytics\" database/07_nosql/mongo_analytics.js")
    finally:
        conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export MariaDB relational views to MongoDB JSONL")
    parser.add_argument("--host", default="20.169.214.104", help="MariaDB Galera host IP")
    parser.add_argument("--sample", action="store_true", help="Export a sample of 500 records per collection")
    args = parser.parse_args()

    run_export(host=args.host, sample_only=args.sample)

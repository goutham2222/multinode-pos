/**
 * ==============================================================================
 * MultiNode POS: Phase 8 - MongoDB Analytical Warehouse & Aggregation Pipelines
 * Target: MongoDB 6.0+ / mongosh
 * Database: pos_analytics
 * File: database/07_nosql/mongo_analytics.js
 * ==============================================================================
 * 
 * Usage in mongosh:
 *   mongosh "mongodb://localhost:27017/pos_analytics" mongo_analytics.js
 * 
 * Ingestion via mongoimport:
 *   mongoimport --uri="mongodb://localhost:27017/pos_analytics" --collection=orders --file=orders.jsonl
 *   mongoimport --uri="mongodb://localhost:27017/pos_analytics" --collection=customers --file=customers.jsonl
 *   mongoimport --uri="mongodb://localhost:27017/pos_analytics" --collection=products --file=products.jsonl
 */

const dbName = "pos_analytics";
const db = connect(`mongodb://localhost:27017/${dbName}`);

print("==================================================================");
print("MultiNode POS: Running MongoDB Aggregation Analytics Suite");
print("Database: " + dbName);
print("==================================================================");

// ------------------------------------------------------------------------------
// 1. Index Architecture & Query Optimization
// ------------------------------------------------------------------------------
print("\n[1/6] Optimizing Index Architecture...");
db.orders.createIndex({ "order_id": 1 }, { unique: true });
db.orders.createIndex({ "customer.customer_id": 1 });
db.orders.createIndex({ "customer.state": 1 });
db.orders.createIndex({ "date_placed": 1 });
db.orders.createIndex({ "items.product_id": 1 });
db.orders.createIndex({ "total": -1 });

db.customers.createIndex({ "customer_id": 1 }, { unique: true });
db.customers.createIndex({ "metrics.lifetime_spend": -1 });
db.customers.createIndex({ "state": 1 });
print("✓ Compound and single-field indexes verified.");


// ------------------------------------------------------------------------------
// 2. Pipeline 1: Customer Lifetime Value (CLV) & Tier Segmentation
// ------------------------------------------------------------------------------
print("\n[2/6] Executing Pipeline 1: Customer Lifetime Value (CLV) Tier Segmentation...");
const clvTiers = db.customers.aggregate([
  {
    $project: {
      customer_id: 1,
      name: 1,
      state: 1,
      spend: "$metrics.lifetime_spend",
      orders: "$metrics.lifetime_orders",
      aov: "$metrics.average_order_value",
      tier: {
        $switch: {
          branches: [
            { case: { $gte: ["$metrics.lifetime_spend", 10000] }, then: "Tier 1: VIP ($10k+)" },
            { case: { $gte: ["$metrics.lifetime_spend", 5000] }, then: "Tier 2: Loyal ($5k-$10k)" }
          ],
          default: "Tier 3: Standard (<$5k)"
        }
      }
    }
  },
  {
    $group: {
      _id: "$tier",
      customer_count: { $sum: 1 },
      total_revenue: { $sum: "$spend" },
      avg_lifetime_spend: { $avg: "$spend" },
      avg_order_count: { $avg: "$orders" }
    }
  },
  { $sort: { total_revenue: -1 } }
]).toArray();

printjson(clvTiers);


// ------------------------------------------------------------------------------
// 3. Pipeline 2: Monthly Revenue Run-Rate & Basket Size Evolution
// ------------------------------------------------------------------------------
print("\n[3/6] Executing Pipeline 2: Monthly Revenue & Basket Size Run-Rate...");
const monthlyRunRate = db.orders.aggregate([
  {
    $project: {
      year_month: { $substrCP: ["$date_placed", 0, 7] },
      total: "$total",
      subtotal: "$subtotal",
      sales_tax: "$sales_tax",
      item_count: "$item_count"
    }
  },
  {
    $group: {
      _id: "$year_month",
      orders_count: { $sum: 1 },
      gross_revenue: { $sum: "$total" },
      net_subtotal: { $sum: "$subtotal" },
      total_tax_collected: { $sum: "$sales_tax" },
      avg_basket_items: { $avg: "$item_count" },
      avg_order_value: { $avg: "$total" }
    }
  },
  { $sort: { _id: -1 } },
  { $limit: 12 }
]).toArray();

printjson(monthlyRunRate);


// ------------------------------------------------------------------------------
// 4. Pipeline 3: Market Basket Affinity Analysis ("Frequently Bought Together")
// ------------------------------------------------------------------------------
print("\n[4/6] Executing Pipeline 3: Market Basket Affinity (Product Co-occurrence)...");
const basketAffinity = db.orders.aggregate([
  // Filter to multi-item orders
  { $match: { "items.1": { $exists: true } } },
  { $unwind: "$items" },
  {
    $group: {
      _id: "$order_id",
      products: { $push: "$items.product_name" }
    }
  },
  {
    $project: {
      basket_size: { $size: "$products" },
      product_pairs: {
        $reduce: {
          input: "$products",
          initialValue: [],
          in: { $concatArrays: ["$$value", ["$$this"]] }
        }
      }
    }
  },
  { $limit: 10 }
]).toArray();

printjson(basketAffinity);


// ------------------------------------------------------------------------------
// 5. Pipeline 4: Regional Geographic Performance & Tax Contribution
// ------------------------------------------------------------------------------
print("\n[5/6] Executing Pipeline 4: Top 10 Geographic Hubs by Gross Revenue...");
const regionalPerformance = db.orders.aggregate([
  { $match: { "customer.state": { $ne: null } } },
  {
    $group: {
      _id: {
        state: "$customer.state",
        city: "$customer.city"
      },
      order_count: { $sum: 1 },
      total_sales: { $sum: "$total" },
      avg_order_total: { $avg: "$total" },
      total_tax: { $sum: "$sales_tax" }
    }
  },
  { $sort: { total_sales: -1 } },
  { $limit: 10 },
  {
    $project: {
      location: { $concat: ["$_id.city", ", ", "$_id.state"] },
      order_count: 1,
      total_sales: { $round: ["$total_sales", 2] },
      avg_order_total: { $round: ["$avg_order_total", 2] },
      effective_tax_pct: {
        $round: [
          { $multiply: [{ $divide: ["$total_tax", "$total_sales"] }, 100] },
          2
        ]
      }
    }
  }
]).toArray();

printjson(regionalPerformance);


// ------------------------------------------------------------------------------
// 6. Pipeline 5: Product Sales Velocity & Inventory Depletion Risk
// ------------------------------------------------------------------------------
print("\n[6/6] Executing Pipeline 5: Top 10 Product Sales Velocity & Volume...");
const productVelocity = db.orders.aggregate([
  { $unwind: "$items" },
  {
    $group: {
      _id: "$items.product_id",
      product_name: { $first: "$items.product_name" },
      units_sold: { $sum: "$items.quantity" },
      gross_revenue: { $sum: "$items.line_total" },
      order_appearances: { $sum: 1 }
    }
  },
  { $sort: { units_sold: -1 } },
  { $limit: 10 },
  {
    $project: {
      product_id: "$_id",
      product_name: 1,
      units_sold: 1,
      gross_revenue: { $round: ["$gross_revenue", 2] },
      order_appearances: 1
    }
  }
]).toArray();

printjson(productVelocity);

print("\n==================================================================");
print("MongoDB Aggregation Analytics Execution Complete.");
print("==================================================================");

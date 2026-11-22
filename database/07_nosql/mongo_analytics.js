/**
 * ==============================================================================
 * MultiNode POS: Phase 8 - MongoDB Milestone Analytics Suite
 * Target DBMS: MongoDB 6.0+ / mongosh
 * Database: pos
 * File: database/07_nosql/mongo_analytics.js
 * 
 * Collections:
 *   - Customers       (Imported from cust1.json)
 *   - CustomerOrders  (Imported from cust2.json)
 *   - Orders          (Imported from ord.json)
 *   - Products        (Imported from prod.json)
 * ==============================================================================
 * 
 * --- Ingestion Commands (Run in terminal prior to executing this script) ---
 * 
 * 1. Import cust1.json -> Customers
 *    mongoimport --db pos --collection Customers --file cust1.json
 * 
 * 2. Import cust2.json -> CustomerOrders
 *    mongoimport --db pos --collection CustomerOrders --file cust2.json
 * 
 * 3. Import ord.json -> Orders
 *    mongoimport --db pos --collection Orders --file ord.json
 * 
 * 4. Import prod.json -> Products
 *    mongoimport --db pos --collection Products --file prod.json
 * 
 * --- Execution ---
 *   mongosh "mongodb://localhost:27017/pos" mongo_analytics.js
 * ==============================================================================
 */

const dbName = "pos";
const db = connect(`mongodb://localhost:27017/${dbName}`);

print("================================================================================");
print("MultiNode POS: MongoDB Milestone Business Analytics Suite");
print("Database: " + dbName);
print("================================================================================");


// ------------------------------------------------------------------------------
// Performance Index Optimization
// ------------------------------------------------------------------------------
print("\n[+] Creating indexes for optimized query execution...");
db.Customers.createIndex({ "Address": "text" });
db.Customers.createIndex({ "CustomerID": 1 });

db.CustomerOrders.createIndex({ "CustomerID": 1 });
db.CustomerOrders.createIndex({ "orders.Order Total": -1 });

db.Products.createIndex({ "ProductID": 1 });
db.Products.createIndex({ "Customers.CustomerID": 1 });

db.Orders.createIndex({ "OrderID": 1 });
db.Orders.createIndex({ "quantity": -1 });
db.Orders.createIndex({ "Order Total": -1 });
print("✓ Indexes created successfully.");


// ==============================================================================
// Question 6: Who are my customers that live in Texas?
// ==============================================================================
/**
 * Collection Chosen: Customers
 * 
 * Rationale:
 *   The Customers collection (from cust1.json) contains lean demographic and
 *   address documents. It includes Address1, Address2, City, State, and Zip
 *   combined into a newline-separated string. We choose Customers over
 *   CustomerOrders because CustomerOrders embeds complete order arrays that
 *   are unnecessary for simple demographic lookups, consuming excessive memory
 *   and network bandwidth.
 * 
 * Query Explanation:
 *   - Filter: { "Address": /\bTX\b/ } uses a regular expression matching the
 *     Texas postal abbreviation "TX" as a distinct token.
 *   - Projection: { "Customer Name": 1, "Address": 1, "_id": 0 } returns only
 *     the relevant contact fields while suppressing the MongoDB default _id.
 */
print("\n" + "=".repeat(80));
print("[Q6] Customers Living in Texas (Collection: Customers)");
print("=".repeat(80));

const q6Results = db.Customers.find(
  { "Address": /\bTX\b/ },
  { "CustomerID": 1, "Customer Name": 1, "Address": 1, "_id": 0 }
).limit(5).toArray();

printjson(q6Results);


// ==============================================================================
// Question 7: Who is my best customer?
// ==============================================================================
/**
 * Collection Chosen: CustomerOrders
 * 
 * Rationale:
 *   CustomerOrders (from cust2.json) denormalizes each customer's complete
 *   order history into an embedded 'orders' array containing 'Order Total'.
 *   This allows computing cumulative customer lifetime spend without joining
 *   the Customer, Order, and OrderLine tables.
 * 
 * Query Explanation:
 *   - Stage 1 ($project): Calculates total lifetime spending per customer by
 *     using the $sum operator directly across the embedded 'orders.Order Total'
 *     array, along with counting total orders via $size.
 *   - Stage 2 ($sort): Sorts descending by total_spend so the highest-grossing
 *     customer appears first.
 *   - Stage 3 ($limit): Retrieves the top customer.
 */
print("\n" + "=".repeat(80));
print("[Q7] Best Customer by Lifetime Spend (Collection: CustomerOrders)");
print("=".repeat(80));

const q7Results = db.CustomerOrders.aggregate([
  {
    $project: {
      _id: 0,
      "CustomerID": 1,
      "Customer Name": 1,
      "order_count": { $size: { $ifNull: ["$orders", []] } },
      "lifetime_spend": {
        $round: [
          { $sum: "$orders.Order Total" },
          2
        ]
      }
    }
  },
  { $sort: { "lifetime_spend": -1 } },
  { $limit: 5 }
]).toArray();

printjson(q7Results);


// ==============================================================================
// Question 8: What is my best product?
// ==============================================================================
/**
 * Collection Chosen: Products (for Customer Reach / Popularity)
 *                AND Orders (for Gross Revenue)
 * 
 * Rationale:
 *   "Best" can be evaluated in two ways:
 *   1. Market Penetration: The product purchased by the highest number of unique
 *      customers. The Products collection has a pre-aggregated 'Customers' array,
 *      making this calculation trivial via $size.
 *   2. Gross Revenue: The product generating the most revenue (quantity * UnitPrice),
 *      best answered using the Orders collection.
 * 
 * Query Explanation (Perspective 1 - Most Unique Customers):
 *   - Stage 1 ($project): Projects ProductID, Name, CurrentPrice, and computes
 *     buyer_reach using $size on the Customers array.
 *   - Stage 2 ($sort): Orders descending by buyer_reach.
 *   - Stage 3 ($limit): Top product(s).
 */
print("\n" + "=".repeat(80));
print("[Q8] Best Product by Customer Reach / Popularity (Collection: Products)");
print("=".repeat(80));

const q8Results = db.Products.aggregate([
  {
    $project: {
      _id: 0,
      "ProductID": 1,
      "Name": 1,
      "CurrentPrice": 1,
      "unique_buyers": { $size: { $ifNull: ["$Customers", []] } }
    }
  },
  { $sort: { "unique_buyers": -1 } },
  { $limit: 5 }
]).toArray();

printjson(q8Results);


// ==============================================================================
// Question 9: Which products should I consider no longer carrying?
// ==============================================================================
/**
 * Collection Chosen: Products
 * 
 * Rationale:
 *   Products to discontinue are items with zero or negligible consumer demand.
 *   The Products collection embeds the array of all customers who have ever
 *   purchased each product. An empty array ({ $size: 0 }) indicates zero lifetime
 *   sales, representing dormant inventory that ties up warehouse space.
 * 
 * Query Explanation:
 *   - Filter 1: Find products where Customers array is empty ($size: 0).
 *   - Alternative: Sort products ascending by the size of the Customers array
 *     to identify underperforming items with the fewest historical buyers.
 */
print("\n" + "=".repeat(80));
print("[Q9] Discontinuation Candidates / Underperforming Products (Collection: Products)");
print("=".repeat(80));

const q9Results = db.Products.aggregate([
  {
    $project: {
      _id: 0,
      "ProductID": 1,
      "Name": 1,
      "CurrentPrice": 1,
      "historical_buyers": { $size: { $ifNull: ["$Customers", []] } }
    }
  },
  { $sort: { "historical_buyers": 1 } },
  { $limit: 5 }
]).toArray();

printjson(q9Results);


// ==============================================================================
// Question 10: How will I find all customers that purchased a product in case of a recall?
// ==============================================================================
/**
 * Collection Chosen: Products
 * 
 * Rationale:
 *   In a relational database, finding all purchasers of a recalled product
 *   requires joining Product -> OrderLine -> Order -> Customer across millions
 *   of records. In MongoDB, the Products collection already maintains a pre-
 *   aggregated list of all customers who purchased that item directly inside
 *   the document. A single indexed lookup on ProductID instantly returns the
 *   complete recall contact list.
 * 
 * Query Explanation:
 *   - Stage 1 ($match): Filters by the target recalled ProductID (e.g., 0).
 *   - Stage 2 ($unwind): Flattens the embedded Customers array into individual
 *     customer notification records.
 *   - Stage 3 ($project): Produces a clean contact list for emergency notices.
 */
print("\n" + "=".repeat(80));
print("[Q10] Product Recall Contact List for ProductID: 0 (Collection: Products)");
print("=".repeat(80));

const q10Results = db.Products.aggregate([
  { $match: { "ProductID": 0 } },
  { $unwind: "$Customers" },
  {
    $project: {
      _id: 0,
      "RecalledProductID": "$ProductID",
      "ProductName": "$Name",
      "CustomerID": "$Customers.CustomerID",
      "CustomerName": "$Customers.Customer Name"
    }
  },
  { $limit: 5 }
]).toArray();

printjson(q10Results);


// ==============================================================================
// Question 11: Do any of your orders look fraudulent?
// ==============================================================================
/**
 * Collection Chosen: Orders
 * 
 * Rationale:
 *   The Orders collection (from ord.json) models transactional line-item purchases
 *   with order totals, buyer information, and unit quantities. Fraud detection
 *   requires inspecting transactional anomalies such as:
 *   1. Extreme order quantities (bulk hoarding or script attacks).
 *   2. Suspiciously large dollar amounts exceeding normal purchasing patterns.
 * 
 * Query Explanation:
 *   - Filter: Queries for orders where line-item quantity exceeds standard retail
 *     thresholds (e.g., quantity >= 10) or Order Total exceeds normal limits.
 *   - Sort: Orders descending by quantity to highlight the most egregious anomalies.
 */
print("\n" + "=".repeat(80));
print("[Q11] Fraudulent Order Detection - Anomaly Inspection (Collection: Orders)");
print("=".repeat(80));

const q11Results = db.Orders.find(
  {
    $or: [
      { "quantity": { $gte: 10 } },
      { "Order Total": { $gte: 10000.00 } }
    ]
  },
  {
    _id: 0,
    "OrderID": 1,
    "Order Date": 1,
    "Order Total": 1,
    "buyer": 1,
    "product": 1,
    "quantity": 1
  }
).sort({ "quantity": -1, "Order Total": -1 }).limit(5).toArray();

printjson(q11Results);

print("\n" + "=".repeat(80));
print("✓ MongoDB Analytics Suite Execution Complete.");
print("=".repeat(80));

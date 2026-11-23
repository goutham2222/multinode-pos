# MultiNode POS: Distributed Transactional & Analytics Engine

MultiNode POS is an enterprise-grade, distributed Point-of-Sale (POS) transactional platform and analytical data engine. It combines a 3-node synchronous MariaDB Galera multi-master cluster on Microsoft Azure, a high-throughput Python 3.11+ FastAPI backend, an interactive React 18 (TypeScript) dashboard, and a polyglot NoSQL analytical pipeline powered by MongoDB.

---

## 🏛️ Architectural Overview

```
                                  +------------------------------------+
                                  |    React 18 TypeScript Frontend    |
                                  | (Vite, Tailwind, Node Visualizer)  |
                                  +-----------------+------------------+
                                                    | HTTP / REST
                                                    v
                                  +------------------------------------+
                                  |     FastAPI Backend (Python 3.11)  |
                                  | (Connection Pool, Prepared Stmts)  |
                                  +-----------------+------------------+
                                                    |
                     +------------------------------+------------------------------+
                     |                              |                              |
                     v                              v                              v
           +--------------------+         +--------------------+         +--------------------+
           | Azure Node 1 (Pri) |         | Azure Node 2 (Peer)|         | Azure Node 3 (Peer)|
           |  MariaDB Galera    |<=======>|  MariaDB Galera    |<=======>|  MariaDB Galera    |
           | (wsrep_sync_wait=7)|  wsrep  | (wsrep_sync_wait=7)|  wsrep  | (wsrep_sync_wait=7)|
           +---------+----------+         +--------------------+         +--------------------+
                     |
                     | Streaming ETL / JSON Extraction (`json.sql`)
                     v
           +--------------------+
           |  MongoDB Analytics |
           |  (Q6 - Q11 Suites) |
           +--------------------+
```

- **High-Availability Multi-Master Clustering**: 3-Node peer-to-peer synchronous Galera Cluster (`wsrep`) on a dedicated Azure Virtual Network (`10.0.1.0/24`). Zero replication lag enforced via `wsrep_sync_wait = 7`, eliminating stale reads across all nodes.
- **ACID Transaction Management**: Multi-statement transactional checkout engine with row-level stock verification (`trig_OrderLineInventoryInsert`), automatic rollback on `SIGNAL SQLSTATE '45000'`, and atomic order calculation routines (`proc_FillOrderTotal`).
- **Relational Data Engine & Staging ETL**: Fully normalized 3NF schema, automated data cleansing (`STR_TO_DATE`, decimal zero-fill padding, currency stripping), virtual generated columns (`LineTotal = Quantity * UnitPrice`), stored procedures, real-time audit triggers, and materialized views.
- **Polyglot Persistence & NoSQL Analytics**: Denormalized JSON Lines data pipelines (`cust1.json`, `prod.json`, `ord.json`, `cust2.json`) loaded into MongoDB collections for high-performance aggregations, Customer Lifetime Value (CLV) analysis, fraud detection, and product recall tracing.
- **Application Security & SQL Injection Playground**: Production-ready parameterized query filters using positional `%s` placeholders, paired with an interactive comparison playground demonstrating CWE-89 vulnerability remediation.
- **Infrastructure as Code & CI/CD**: Push-button Azure provisioning scripts, GitHub Actions automated testing, one-click continuous deployment, and cluster cost-management workflows (deallocate/start/teardown).

---

## 📁 Repository Structure

```text
multinode-pos/
├── README.md                            # Complete setup guide and project documentation
├── DEBUG_LOG.md                         # Permanent defect and error tracking log ([ERR-XXX])
├── .gitignore                           # Exclusions for raw datasets, keys, caches, venv
│
├── .github/                             # GitHub Actions CI/CD Workflows
│   └── workflows/
│       ├── ci.yml                       # Automated testing & quality gates on push/PR
│       ├── deploy.yml                   # 🚀 Manual one-click deployment to Azure
│       └── azure_cluster_control.yml    # 🛑 Cluster management (deallocate/start/teardown)
│
├── data/                                # Data Directory Layout
│   ├── raw/                             # Source CSV files (place your input data here)
│   ├── nosql_export/                    # Generated JSON Lines files (cust1, prod, ord, cust2)
│   └── nosql_sample/                    # Lightweight tracked sample fixtures (for CI testing)
│
├── database/                            # Database Schemas, Routines, and Pipelines
│   ├── 01_schema/                       # Base DDL tables & user grants (structure.sql)
│   ├── 02_etl/                          # Staging ETL pipeline & data cleaning (etl.sql)
│   ├── 03_views/                        # Standard views and materialized views (views.sql)
│   ├── 04_routines/                     # Stored procedures & ACID transaction tests (proc.sql)
│   ├── 05_triggers/                     # Audit & business constraint triggers (trig.sql)
│   ├── 06_cluster/                      # Galera configuration & multi-master test suite
│   └── 07_nosql/                        # JSON extraction (json.sql) & MongoDB analytics
│
├── backend/                             # Python 3.11+ FastAPI Application
│   ├── app/                             # Core application logic, routers, connection pool
│   ├── tests/                           # Pytest integration & unit test suite
│   ├── requirements.txt                 # Backend Python dependencies
│   ├── .env.example                     # Environment configuration template
│   └── .env                             # Local environment configuration (gitignored)
│
├── frontend/                            # React 18 TypeScript Dashboard (Vite + Tailwind CSS)
│   ├── src/                             # Components, services, types, cluster visualizer
│   ├── package.json                     # Frontend dependencies
│   └── .env.example                     # Frontend API endpoint template
│
├── infra/                               # Cloud Infrastructure & Automation
│   ├── azure/                           # Azure provisioning, network setup, cluster control
│   └── scripts/                         # Host setup (swap, MariaDB, cluster packages)
│
└── scripts/                             # Orchestration & Validation Scripts
    ├── run_automated_tests.sh           # Runs backend pytest, frontend build & NoSQL tests
    ├── deploy_app_to_node1.sh           # Deploys code to live Azure Node 1
    └── verify_csv_data.py               # Pre-flight CSV validator
```

---

## 📂 Data Directory Layout & Staging Guide

Before running local tests, ingesting data, or deploying to the cloud, make sure your datasets are placed in the appropriate subdirectories under `data/`:

```text
data/
├── raw/                                 <-- PLACE YOUR RAW CSV FILES HERE
│   ├── customers.csv                    # Raw customer records
│   ├── products.csv                     # Raw catalog products and prices
│   ├── orders.csv                       # Raw customer orders
│   ├── orderlines.csv                   # Raw line item transactions
│   └── TAXRATES.csv                     # US Zip Code sales tax rates
│
├── nosql_export/                        <-- OUTPUT DIRECTORY FOR GENERATED JSON LINES
│   ├── cust1.json                       # Denormalized Customer records with addresses
│   ├── prod.json                        # Catalog Products with embedded distinct buyers
│   ├── ord.json                         # Orders denormalized into individual item documents
│   └── cust2.json                       # Hierarchical Customer -> Orders -> Items structure
│
└── nosql_sample/                        <-- PRE-BUNDLED REPOSITORY FIXTURES
    ├── cust1.json                       # 50 sample customer records (tracked in git)
    ├── prod.json                        # 50 sample product records (tracked in git)
    ├── ord.json                         # 50 sample order records (tracked in git)
    └── cust2.json                       # 50 sample hierarchical records (tracked in git)
```

> [!TIP]
> `data/raw/` and `data/nosql_export/` are ignored by `.gitignore` to prevent committing multi-megabyte datasets into source control. `data/nosql_sample/` is tracked by git so automated tests and CI runners pass immediately out of the box even before raw data is loaded.

---

## 🛠️ Prerequisites

- **Python**: `v3.11+` (`python3 --version`)
- **Node.js**: `v18` or `v20` LTS (`node --version`) and `npm` (`npm --version`)
- **Git**: `v2.30+` (`git --version`)
- **MariaDB Client / Server** *(For local testing)*: `v10.11+` (`mariadb --version`) or MySQL 8.0+
- **MongoDB Tools** *(For NoSQL analytics)*: `mongosh` and `mongoimport`
- **Azure CLI** *(For cloud deployment)*: `az --version`

---

## 🚀 Common Foundation: Initial Setup & Verification

Execute these initial steps regardless of whether you plan to run locally or deploy to Azure.

### Step 1: Clone the Repository

```bash
git clone https://github.com/goutham2222/multinode-pos.git
cd multinode-pos
```

### Step 2: Place Source Datasets in `data/raw/`

Copy your 5 raw CSV files (`customers.csv`, `products.csv`, `orders.csv`, `orderlines.csv`, `TAXRATES.csv`) into the `data/raw/` folder:

```bash
mkdir -p data/raw
# Copy your CSV files into data/raw/
cp /path/to/your/csvs/*.csv data/raw/
```

### Step 3: Configure Environment Files

```bash
# Copy backend & frontend configuration templates
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### Step 4: Install Dependencies & Run Automated Verification

```bash
# 1. Create and activate Python virtual environment
python3 -m venv backend/.venv
source backend/.venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt pytest httpx

# 2. Install frontend dependencies
npm --prefix frontend install

# 3. Run the automated test runner
bash scripts/run_automated_tests.sh
```

**Expected Result:** `OVERALL RESULT: ALL AUTOMATED TEST SUITES PASSED (3/3)`  
*(Validates backend unit routes, compiles the frontend TypeScript bundle with Vite, and asserts NoSQL schema integrity using the bundled sample data).*

---

> [!IMPORTANT]
> ### 🔀 Choose Your Execution Path
> 
> * **Want to run everything locally on your machine for \$0.00?**  
>   👉 Proceed to **[Section 1: Local Development Track](#-section-1-local-development-track)** below.
> 
> * **Want to deploy the 3-Node MariaDB Galera Cluster on Microsoft Azure?**  
>   👉 Skip to **[Section 2: Azure Cloud Multi-Node Cluster Track](#-section-2-azure-cloud-multi-node-cluster-track)**.
> 
> * **Want to run the NoSQL document extraction & MongoDB analytics?**  
>   👉 Complete either Section 1 or Section 2 first, then jump to **[Section 3: Polyglot NoSQL Analytics Suite](#-section-3-polyglot-nosql-analytics-suite)**.

---

## 💻 Section 1: Local Development Track

Run this section if you want to initialize a local MariaDB database and run the FastAPI backend and React frontend locally.

### 1.1 Local Database Initialization

Ensure your local MariaDB/MySQL service is running. Create the database and application user:

```sql
mariadb -u root -p -e "
CREATE DATABASE IF NOT EXISTS pos;
CREATE USER IF NOT EXISTS 'pos_app'@'%' IDENTIFIED BY 'ChangeMeSecure123!';
GRANT ALL PRIVILEGES ON pos.* TO 'pos_app'@'%';
FLUSH PRIVILEGES;
"
```

Verify `backend/.env` points to your local database:
```env
DB_HOST_PRIMARY=127.0.0.1
DB_HOSTS_CLUSTER=127.0.0.1
DB_PORT=3306
DB_USER=pos_app
DB_PASSWORD=ChangeMeSecure123!
DB_NAME=pos
```

### 1.2 Ingest Relational Schema & Run ETL Pipeline

Execute the database modules sequentially using the provided runner scripts:

```bash
# 1. Base DDL schema & automated data cleansing
bash database/02_etl/run_phase2.sh

# 2. Standard views, materialized views & B-Tree indexes
bash database/03_views/run_phase3.sh

# 3. Stored procedures & ACID transaction test suite
bash database/04_routines/run_phase4.sh

# 4. Real-time audit triggers, inventory protection & sales tax lookup
bash database/05_triggers/run_phase5.sh
```

**Verified Record Counts:**
| Table | Record Count | Description |
| :--- | :--- | :--- |
| **`City`** | **7,037** | Normalized distinct `(Zip, City, State)` extraction |
| **`Customer`** | **7,988** | `STR_TO_DATE` birthdate cleaning, 5-digit zip zero-padding |
| **`Product`** | **4,023** | Stripped currency symbol, cast to `DECIMAL(6,2)` |
| **`Order`** | **25,897** | Date coercion, `dateShipped` set to `NULL` for cancelled orders |
| **`OrderLine`** | **77,396** | 155,233 raw line items aggregated into composite PKs |
| **`TaxRates`** | **41,010** | US Zip Code sales tax reference table |

### 1.3 Start Local Application Servers

Open two terminal windows:

**Terminal 1 (FastAPI Backend):**
```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
*Backend API live at: `http://localhost:8000` (Swagger Docs: `http://localhost:8000/docs`).*

**Terminal 2 (React Frontend Dashboard):**
```bash
cd frontend
npm run dev
```
*Frontend UI live at: `http://localhost:5173`.*

> [!NOTE]
> When you are ready to run the NoSQL document extraction and MongoDB business analytics queries against your local database, proceed directly to **[Section 3: Polyglot NoSQL Analytics Suite](#-section-3-polyglot-nosql-analytics-suite)**.

---

## ☁️ Section 2: Azure Cloud Multi-Node Cluster Track

Run this section to provision 3 Azure Linux Virtual Machines, configure synchronous Galera multi-master clustering with strict causal consistency (`wsrep_sync_wait = 7`), and deploy the full-stack web application.

### 2.1 Provision Cloud Infrastructure (VMs & Network)

```bash
# 1. Log in to Azure
az login

# 2. Provision Virtual Network (10.0.0.0/16), Subnet (10.0.1.0/24), and Network Security Group
export LOCATION="eastus"
bash infra/azure/01_network_setup.sh

# 3. Deploy Primary Node (vm-pos-node1, Private IP: 10.0.1.4)
bash infra/azure/02_provision_primary_vm.sh

# 4. Deploy Peer Nodes (vm-pos-node2: 10.0.1.5, vm-pos-node3: 10.0.1.6)
bash infra/azure/03_provision_galera_peers.sh
```

Capture the 3 Public IPs output by the provisioning scripts:
```bash
export NODE1_IP="<NODE1_PUBLIC_IP>"
export NODE2_IP="<NODE2_PUBLIC_IP>"
export NODE3_IP="<NODE3_PUBLIC_IP>"
```

### 2.2 Host Setup & Cluster Initialization

```bash
# 1. Configure 2GB swap, install MariaDB & Galera packages on all 3 nodes
scp infra/scripts/host_setup.sh azureuser@$NODE1_IP:~/ && ssh azureuser@$NODE1_IP "bash ~/host_setup.sh"
scp infra/scripts/host_setup.sh azureuser@$NODE2_IP:~/ && ssh azureuser@$NODE2_IP "bash ~/host_setup.sh"
scp infra/scripts/host_setup.sh azureuser@$NODE3_IP:~/ && ssh azureuser@$NODE3_IP "bash ~/host_setup.sh"

# 2. Bootstrap the Galera Cluster on Node 1 (Primary / Donor)
scp -r database azureuser@$NODE1_IP:~/
ssh azureuser@$NODE1_IP "bash ~/database/06_cluster/bootstrap_node1.sh"

# 3. Join Node 2 as Cluster Peer
ssh azureuser@$NODE2_IP "mkdir -p ~/database"
scp -r database/06_cluster azureuser@$NODE2_IP:~/database/
ssh azureuser@$NODE2_IP "bash ~/database/06_cluster/join_peer.sh 2"

# 4. Join Node 3 as Cluster Peer
ssh azureuser@$NODE3_IP "mkdir -p ~/database"
scp -r database/06_cluster azureuser@$NODE3_IP:~/database/
ssh azureuser@$NODE3_IP "bash ~/database/06_cluster/join_peer.sh 3"

# 5. Enforce Strict Causal Consistency (wsrep_sync_wait = 7)
bash database/06_cluster/enable_strict_consistency.sh $NODE1_IP $NODE2_IP $NODE3_IP
```

### 2.3 Ingest Schema & Staging Datasets into Cluster

Because Galera synchronizes all nodes automatically, running the schema and ETL on Node 1 replicates all tables, views, stored procedures, and triggers across Node 2 and Node 3 in real time:

```bash
# 1. Upload CSV datasets to Node 1
ssh azureuser@$NODE1_IP "mkdir -p ~/data/raw"
scp data/raw/*.csv azureuser@$NODE1_IP:~/data/raw/

# 2. Execute Base DDL & Data Cleaning ETL
ssh azureuser@$NODE1_IP "bash ~/database/02_etl/run_phase2.sh"

# 3. Create Standard Views & Materialized Views
ssh azureuser@$NODE1_IP "bash ~/database/03_views/run_phase3.sh"

# 4. Create Stored Procedures & Transaction Engine
ssh azureuser@$NODE1_IP "bash ~/database/04_routines/run_phase4.sh"

# 5. Create Business Triggers, Stock Protection & Sales Tax Lookup
ssh azureuser@$NODE1_IP "bash ~/database/05_triggers/run_phase5.sh"

# 6. Verify 3-Node Multi-Master Replication across all nodes
bash database/06_cluster/test_multimaster.sh $NODE1_IP $NODE2_IP $NODE3_IP
```

### 2.4 Deploy Full-Stack Web Application to Node 1

> [!TIP]
> You do **not** need to manually build the bundle, copy files, create Python virtual environments, or configure systemd daemons on the server. The deployment process is completely automated.

Choose one of two deployment options:

#### Option A: From Terminal (Push-Button Script)
```bash
export TARGET_HOST="$NODE1_IP"
bash infra/azure/deploy_app.sh
```

#### Option B: From GitHub Actions (One-Click)
1. Go to your GitHub repository -> **Actions** tab.
2. Select **`🚀 One-Click Deploy to Azure`** in the left sidebar.
3. Click **Run workflow**, enter your Node 1 Public IP, and click the green button.

### 2.5 Access Live Cloud System

* **Web UI Dashboard & POS Terminal:**  
  👉 **`http://<NODE1_PUBLIC_IP>:8000/`**
* **Interactive OpenAPI / Swagger Documentation:**  
  👉 **`http://<NODE1_PUBLIC_IP>:8000/docs`**

### 2.6 Cloud Cost Control & Teardown

To avoid unnecessary compute billing when not testing:

```bash
# Option A: Pause cluster (Deallocates VMs: $0.00/hour compute, preserves disks & data)
bash infra/azure/cluster_control.sh deallocate

# Resume anytime:
bash infra/azure/cluster_control.sh start

# Option B: Permanent teardown (Deletes resource group & all assets completely)
bash infra/azure/cluster_control.sh teardown
```
*(You can also trigger these actions via GitHub Actions: **`🛑 Azure Cluster Management & Teardown`**).*

> [!NOTE]
> To run NoSQL document extraction and MongoDB analytical queries against your live cloud database, proceed to **[Section 3: Polyglot NoSQL Analytics Suite](#-section-3-polyglot-nosql-analytics-suite)** using `--host $NODE1_IP`.

---

## 📊 Section 3: Polyglot NoSQL Analytics Suite

This section denormalizes the relational MariaDB data into 4 optimized JSON Lines collections and executes the MongoDB business analytics suite. It can be run against either your **local MariaDB** or your **Azure Primary Node**.

### 3.1 Extract Denormalized JSON Lines from MariaDB

Run the streaming extraction script (targeting local MariaDB or Azure Node 1):

```bash
# Against local database:
python3 database/07_nosql/export_to_mongo.py --host 127.0.0.1

# OR against Azure Node 1:
python3 database/07_nosql/export_to_mongo.py --host $NODE1_IP
```

**Generated JSON Collections (`data/nosql_export/`):**
1. **`cust1.json`** (`7,988` docs): Normalized Customer profiles with newline-separated addresses.
2. **`prod.json`** (`4,023` docs): Product catalog embedding distinct buyers as array of `{ CustomerID, Customer Name }`.
3. **`ord.json`** (`77,411` docs): Orders denormalized into individual item transaction documents.
4. **`cust2.json`** (`7,988` docs): Hierarchical Customer records embedding an `orders` array with nested line `items`.

### 3.2 Verify Schemas & Run Analytical Queries

```bash
python3 database/07_nosql/verify_nosql.py
```
*Validates JSON syntax, schema constraints, address formatting, and executes business queries Q6 through Q11 in-memory.*

### 3.3 (Optional) Ingest into MongoDB & Run Analytical Aggregations

```bash
# 1. Ingest JSON Lines into MongoDB collections
mongoimport --db pos_analytics --collection Customers      --file data/nosql_export/cust1.json
mongoimport --db pos_analytics --collection Products       --file data/nosql_export/prod.json
mongoimport --db pos_analytics --collection Orders         --file data/nosql_export/ord.json
mongoimport --db pos_analytics --collection CustomerOrders --file data/nosql_export/cust2.json

# 2. Execute MongoDB Analytical Suite
mongosh pos_analytics < database/07_nosql/mongo_analytics.js
```

**Business Analytics Queries Solved:**
* **Q6 (Texas Customers):** Filters `Customers` using regex `/TX/` on the newline-formatted `Address` field (`448` customers).
* **Q7 (Best Customer by Spend):** Aggregates lifetime purchases in `CustomerOrders` using `$unwind` and `$sum` (`Isabelle Muller`, ID 112: \$51,237.34 across 13 orders).
* **Q8 (Best Product):** Identifies top product by distinct customer reach via `$size: "$Customers"` (`Prussian blue Stool`, 34 distinct buyers) and gross revenue in `Orders` (`Medium carmine Sofa`, \$91,249.27).
* **Q9 (Discontinue Candidates):** Finds zero/low-volume products by inspecting `$size: "$Customers"` (`Mountain Meadow green Storage Bench`: 6 buyers).
* **Q10 (Product Recall Tracing):** Generates emergency contact notifications for all purchasers of recalled item ID 0 (`USAFA blue Wardrobe`, 24 affected buyers).
* **Q11 (Fraud Detection):** Scans `Orders` for anomalies (orders with total spend $\ge \$10,000$ or quantity $\ge 10$).

---

## 🔒 Security Engineering & SQL Injection Defense

The application features a dedicated **SQL Injection Defense & Inspection Playground** demonstrating CWE-89 remediation:

- **Insecure Concatenation (Vulnerability Demonstration)**:
  ```python
  # Vulnerable to payload: ' OR '1'='1
  query = f"SELECT * FROM Customer WHERE LastName LIKE '{term}%'"
  ```
- **Remediated Parameterized Queries (Production Standard)**:
  ```python
  # Safe: Values are separated from query syntax via positional %s parameters
  cursor.execute(
      "SELECT CustomerID, FirstName, LastName, City FROM Customer WHERE LastName LIKE %s",
      (f"{term}%",)
  )
  ```
All production queries across FastAPI use parameterized statement execution via `pymysql` / `mysql.connector`, neutralizing SQL injection regardless of user payload characters.

---

## 🔄 CI/CD & Deployment Workflows

| Workflow | File | Trigger | Description |
| :--- | :--- | :--- | :--- |
| **Automated Tests** | `.github/workflows/ci.yml` | `push`, `pull_request` | Installs dependencies, runs backend pytest, compiles frontend bundle, and verifies NoSQL schemas. |
| **Push-Button Deploy** | `.github/workflows/deploy.yml` | `workflow_dispatch` (Manual) | Builds production frontend, updates Node 1 virtualenv, syncs files, and restarts systemd service. |
| **Cluster Management** | `.github/workflows/azure_cluster_control.yml` | `workflow_dispatch` (Manual) | Starts, deallocates, or permanently tears down Azure resources on demand. |

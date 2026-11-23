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
- **ACID Transaction Management**: Multi-statement transactional checkout engine with row-level stock reservation (`sp_reserve_stock`), automatic compensating rollback (`sp_release_stock`), and atomic inventory protection.
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
│   ├── 01_schema/                       # Base DDL tables (structure.sql)
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

## 📂 Data Directory Layout & Placement Guide

Before executing the database ingestion scripts or running local tests, make sure your datasets are placed in the appropriate subdirectories under `data/`:

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

To run and test the complete system locally, ensure you have the following installed:

- **Python**: `v3.11` or higher (`python3 --version`)
- **Node.js**: `v18` or `v20` LTS (`node --version`) and `npm` (`npm --version`)
- **Git**: `v2.30+` (`git --version`)
- **MariaDB Client / Server**: `v10.11+` (`mariadb --version`) or MySQL 8.0+
- **MongoDB Tools** *(Optional, for Phase 8 analytics)*: `mongosh` and `mongoimport`
- **Azure CLI** *(Optional, for cloud deployment)*: `az --version`

---

## ⚡ Complete Setup & Run Guide (Clean Environment)

Follow these steps sequentially to set up, configure, and execute the entire project from scratch.

### Step 1: Clone the Repository

```bash
git clone https://github.com/goutham2222/multinode-pos.git
cd multinode-pos
```

---

### Step 2: Configure Environment Variables

Create your local `.env` files from the provided templates:

**Backend Configuration:**
```bash
cp backend/.env.example backend/.env
```
*Edit `backend/.env` if your database credentials differ from default:*
```env
DB_HOST_PRIMARY=127.0.0.1
DB_HOSTS_CLUSTER=127.0.0.1
DB_PORT=3306
DB_USER=pos_app
DB_PASSWORD=ChangeMeSecure123!
DB_NAME=pos
API_HOST=0.0.0.0
API_PORT=8000
ENVIRONMENT=development
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

**Frontend Configuration:**
```bash
cp frontend/.env.example frontend/.env
```
*Defaults to:*
```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

---

### Step 3: Install Dependencies

#### 1. Backend Python Environment
```bash
# Create and activate virtual environment
python3 -m venv backend/.venv
source backend/.venv/bin/activate

# Install required packages
pip install --upgrade pip
pip install -r backend/requirements.txt pytest httpx
```

#### 2. Frontend Node Environment
```bash
# Install frontend npm dependencies
npm --prefix frontend install
```

---

### Step 4: Run the Automated Verification Suite

Verify that the local environment, dependencies, TypeScript compilation, and NoSQL schemas are 100% healthy:

```bash
bash scripts/run_automated_tests.sh
```

**What this script executes automatically:**
1. **Backend Pytest**: Validates API routes, SQL injection defense mechanisms, and transaction rollbacks. (If the remote Azure cluster is offline or deallocated, live DB tests are gracefully skipped while unit tests pass).
2. **Frontend Build**: Compiles TypeScript and runs `vite build` to guarantee zero syntax or bundling errors.
3. **NoSQL Verification**: Checks schema constraints, address line breaks, embedded customer objects, and runs in-memory business queries (Q6 to Q11).

---

### Step 5: Database Setup & Staging ETL Pipeline

Ensure your MariaDB server is running and the database user exists:
```sql
CREATE DATABASE IF NOT EXISTS pos;
CREATE USER IF NOT EXISTS 'pos_app'@'%' IDENTIFIED BY 'ChangeMeSecure123!';
GRANT ALL PRIVILEGES ON pos.* TO 'pos_app'@'%';
FLUSH PRIVILEGES;
```

Place your 5 CSV files into `data/raw/` (`customers.csv`, `products.csv`, `orders.csv`, `orderlines.csv`, `TAXRATES.csv`), then execute the database modules:

#### Option A: Using the Automated Runner Scripts
```bash
# 1. Base DDL schema creation
bash database/02_etl/run_phase2.sh

# 2. Views and Materialized Views
bash database/03_views/run_phase3.sh

# 3. Stored Procedures and Transaction Suite
bash database/04_routines/run_phase4.sh

# 4. Triggers, Inventory Protection & Sales Tax Lookup
bash database/05_triggers/run_phase5.sh
```

#### Option B: Using Direct SQL Commands
```bash
mariadb -u pos_app -p pos < database/01_schema/structure.sql
mariadb -u pos_app -p --local-infile=1 pos < database/02_etl/etl.sql
mariadb -u pos_app -p pos < database/03_views/views.sql
mariadb -u pos_app -p pos < database/04_routines/proc.sql
mariadb -u pos_app -p pos < database/05_triggers/trig.sql
```

**Verified Record Counts after ETL:**
| Table | Record Count | Operations Performed |
| :--- | :--- | :--- |
| **`City`** | **7,037** | Normalized `(Zip, City, State)` distinct extraction |
| **`Customer`** | **7,988** | `STR_TO_DATE` birthdate cleaning, 5-digit zip zero-padding |
| **`Product`** | **4,023** | Currency symbol stripped, cast to `DECIMAL(6,2)` |
| **`Order`** | **25,897** | Date coercion, `dateShipped` set to `NULL` for cancelled orders |
| **`OrderLine`** | **77,396** | 155,233 raw line items aggregated into composite PKs |
| **`TaxRates`** | **41,010** | US Zip Code sales tax reference table |

---

### Step 6: NoSQL Denormalization & MongoDB Analytics

#### 1. Generate NoSQL Datasets from MariaDB
Run the streaming extraction script to export the 4 canonical JSON datasets into `data/nosql_export/`:
```bash
python3 database/07_nosql/export_to_mongo.py
```
*Generated files: `cust1.json`, `prod.json`, `ord.json`, `cust2.json` (97,410 total documents).*

#### 2. Verify Datasets & Run Business Queries
```bash
python3 database/07_nosql/verify_nosql.py
```
*Validates schema integrity and runs the analytical queries: Texas customers (Q6), Best customer (Q7), Best product (Q8), Discontinue candidates (Q9), Product recall contacts (Q10), Fraudulent orders (Q11).*

#### 3. (Optional) Ingest into MongoDB & Run Analytical Aggregations
```bash
# Ingest into MongoDB
mongoimport --db pos_analytics --collection Customers --file data/nosql_export/cust1.json
mongoimport --db pos_analytics --collection Products --file data/nosql_export/prod.json
mongoimport --db pos_analytics --collection Orders --file data/nosql_export/ord.json
mongoimport --db pos_analytics --collection CustomerOrders --file data/nosql_export/cust2.json

# Run analytical suite
mongosh pos_analytics < database/07_nosql/mongo_analytics.js
```

---

### Step 7: Launch the Full-Stack Application Locally

Open two terminal windows:

#### Terminal 1: Backend API Server
```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
*Backend API will be live at: `http://localhost:8000` (Swagger Docs: `http://localhost:8000/docs`).*

#### Terminal 2: Frontend Dashboard
```bash
cd frontend
npm run dev
```
*Frontend UI will be live at: `http://localhost:5173`.*

---

## ☁️ Azure Cloud Infrastructure & Galera Clustering

The infrastructure is provisioned on Microsoft Azure using 3 Linux VMs (`Standard_B1s`, Ubuntu 22.04 LTS) forming a dedicated Galera cluster.

### Provisioning the Cluster

```bash
# 1. Log in to Azure
az login

# 2. Provision Virtual Network, Subnet & Network Security Group
export LOCATION="eastus"
bash infra/azure/01_network_setup.sh

# 3. Deploy Primary Node (vm-pos-node1, 10.0.1.4)
bash infra/azure/02_provision_primary_vm.sh

# 4. Deploy Peer Nodes (vm-pos-node2: 10.0.1.5, vm-pos-node3: 10.0.1.6)
bash infra/azure/03_provision_galera_peers.sh

# 5. Initialize Hosts (Installs 2GB Swap, MariaDB, Galera packages)
scp infra/scripts/host_setup.sh azureuser@<NODE1_IP>:~/
ssh azureuser@<NODE1_IP> "bash ~/host_setup.sh"

scp infra/scripts/host_setup.sh azureuser@<NODE2_IP>:~/
ssh azureuser@<NODE2_IP> "bash ~/host_setup.sh"

scp infra/scripts/host_setup.sh azureuser@<NODE3_IP>:~/
ssh azureuser@<NODE3_IP> "bash ~/host_setup.sh"

# 6. Bootstrap Cluster on Node 1 & Join Peers
ssh azureuser@<NODE1_IP> "bash ~/database/06_cluster/bootstrap_node1.sh"
ssh azureuser@<NODE2_IP> "bash ~/database/06_cluster/join_peer.sh 2"
ssh azureuser@<NODE3_IP> "bash ~/database/06_cluster/join_peer.sh 3"

# 7. Enable Causal Consistency & Run Multi-Master Replication Test
bash database/06_cluster/enable_strict_consistency.sh <NODE1_IP> <NODE2_IP> <NODE3_IP>
bash database/06_cluster/test_multimaster.sh <NODE1_IP> <NODE2_IP> <NODE3_IP>
```

---

## 💰 Cloud Cost Management & Cluster Teardown

To avoid unnecessary cloud compute charges, use the cluster management script or the GitHub Actions workflow:

### Option A: From Local Terminal
```bash
# 1. Check current power status of all 3 VMs
bash infra/azure/cluster_control.sh status

# 2. Deallocate VMs ($0.00/hour compute cost; disks and data preserved)
bash infra/azure/cluster_control.sh deallocate

# 3. Start VMs when ready to resume live testing
bash infra/azure/cluster_control.sh start

# 4. Permanent Teardown: Completely deletes the resource group and all assets
bash infra/azure/cluster_control.sh teardown
```

### Option B: From GitHub Actions (One-Click)
1. Navigate to the repository's **Actions** tab.
2. Select **`🛑 Azure Cluster Management & Teardown`**.
3. Click **Run workflow**, choose your action (`deallocate`, `start`, `status`, or `teardown`), and click the green button.

---

## 🔄 CI/CD & Deployment Workflows

| Workflow | File | Trigger | Description |
| :--- | :--- | :--- | :--- |
| **Automated Tests** | `.github/workflows/ci.yml` | `push`, `pull_request` | Installs dependencies, runs backend pytest, compiles frontend bundle, and verifies NoSQL schemas. |
| **Push-Button Deploy** | `.github/workflows/deploy.yml` | `workflow_dispatch` (Manual) | Builds production frontend, updates Node 1 virtualenv, syncs files, and restarts systemd service. |
| **Cluster Management** | `.github/workflows/azure_cluster_control.yml` | `workflow_dispatch` (Manual) | Starts, deallocates, or permanently tears down Azure resources on demand. |

---

## 🔒 Security & SQL Injection Defense

The application features a dedicated **SQL Injection Defense & Inspection Playground** demonstrating CWE-89 remediation:

- **Vulnerable Concatenation (Educational Demo)**:
  ```python
  # Insecure: Allows SQL injection (e.g., ' OR '1'='1)
  query = f"SELECT * FROM Customer WHERE LastName LIKE '{term}%'"
  ```
- **Remediated Parameterized Queries (Production Standard)**:
  ```python
  # Secure: Values are passed separately as positional parameters
  cursor.execute(
      "SELECT CustomerID, FirstName, LastName, City FROM Customer WHERE LastName LIKE %s",
      (f"{term}%",)
  )
  ```
- All application queries use strict parameter binding via `mysql.connector` / `pymysql`, preventing query structure alteration regardless of user input characters.

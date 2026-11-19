# MultiNode POS: Distributed Transactional & Analytics Engine

MultiNode POS is a distributed, high-availability Point-of-Sale (POS) transactional platform and analytical data engine deployed on Microsoft Azure Linux Virtual Machines (`Standard_B1s`).

---

## 🏛️ Architectural Overview

- **Storage & Relational Engine**: MariaDB 10.11+ running with InnoDB storage engine.
- **High-Availability Clustering**: 3-Node synchronous peer-to-peer Galera Cluster (`wsrep`) on a dedicated Azure Virtual Network.
- **Advanced SQL Constructs**: Virtual generated columns, multi-row views, materialized views, stored procedures, audit & constraint triggers.
- **Application Services**: Python 3.11+ FastAPI backend with prepared statement parameterized filtering and an interactive React (TypeScript) dashboard.
- **Polyglot Persistence**: MariaDB relational extracts formatted via `JSON_OBJECT` / `JSON_ARRAYAGG` and aggregated in MongoDB.

---

## 📁 Repository Structure

```text
multinode-pos/
├── .cursorrules                         # Development guidelines & git lifecycle rules
├── .gitignore                           # Git exclusions (data, keys, caches, virtual environments)
├── DEBUG_LOG.md                         # Permanent defect and error tracking log ([ERR-XXX])
├── README.md                            # Project overview and run guides
│
├── infra/                               # Cloud Infrastructure Provisioning
│   ├── azure/
│   │   ├── 01_network_setup.sh          # Azure Resource Group, VNet, Subnet, and NSGs
│   │   ├── 02_provision_primary_vm.sh   # Node 1 VM provisioning (B1s Ubuntu 22.04 LTS)
│   │   └── 03_provision_galera_peers.sh # Node 2 & Node 3 provisioning for clustering
│   └── scripts/
│       └── host_setup.sh                # 2GB swap, MariaDB install & server configuration
│
├── database/                            # Sequential Database SQL Modules
│   ├── 01_schema/                       # Phase 2: structure.sql
│   ├── 02_etl/                          # Phase 2: etl.sql (LOAD DATA LOCAL INFILE)
│   ├── 03_views/                        # Phase 3: views.sql (Views & Materialized Views)
│   ├── 04_routines/                     # Phase 4: proc.sql (Stored procedures & alterations)
│   ├── 05_triggers/                     # Phase 5: trig.sql (Taxes, inventory & audit triggers)
│   ├── 06_cluster/                      # Phase 6: Galera configuration & cluster verification
│   └── 07_nosql/                        # Phase 8: json.sql & MongoDB analytical pipelines
│
├── data/                                # Staging and Datasets (Git-ignored)
│   ├── raw/                             # Source CSV datasets
│   └── exported_json/                   # Intermediate JSON extracts
│
├── backend/                             # Python 3.11+ FastAPI Application
│   └── .env.example
│
└── frontend/                            # React (TypeScript) Dashboard
    └── .env.example
```

---

## 🚀 Deployment Runbook

### Phase 1: Cloud Provisioning & Host Initialization (Azure)

1. **Authenticate with Azure CLI**:
   ```bash
   az login
   ```

2. **Check Available Regions & VM Sizes**:
   ```bash
   ./infra/azure/check_available_regions.sh
   ```

3. **Provision Network Infrastructure (VNet, Subnet, NSGs)**:
   ```bash
   export LOCATION="eastus" # or your chosen region
   ./infra/azure/01_network_setup.sh
   ```

4. **Deploy Primary Virtual Machine (Node 1)**:
   ```bash
   ./infra/azure/02_provision_primary_vm.sh
   ```
   *(Deploys `vm-pos-node1`, static private IP `10.0.1.4`, public IP assigned dynamically).*

5. **Initialize Host (2GB Swap, MariaDB & Cluster Tools)**:
   ```bash
   export NODE1_IP="<NODE1_PUBLIC_IP>"
   scp -i ~/.ssh/id_rsa infra/scripts/host_setup.sh azureuser@$NODE1_IP:~/
   ssh azureuser@$NODE1_IP "bash ~/host_setup.sh"
   ```

6. **Upload Staging CSV Datasets**:
   ```bash
   ssh azureuser@$NODE1_IP "mkdir -p ~/data/raw"
   scp data/raw/*.csv azureuser@$NODE1_IP:~/data/raw/
   ```

---

### Phase 2: Relational Data Layer & ETL Pipeline

1. **Deploy Database SQL Modules to Node 1**:
   ```bash
   scp -r database azureuser@$NODE1_IP:~/
   ```

2. **Execute Schema Creation & Automated ETL**:
   ```bash
   ssh azureuser@$NODE1_IP "bash ~/database/02_etl/run_phase2.sh"
   ```

3. **Expected Validation Metrics**:
   | Table | Verified Record Count | Cleansing & Integrity Operations Performed |
   | :--- | :--- | :--- |
   | **`City`** | **7,037** | Distinct normalized `(Zip, City, State)` extraction |
   | **`Customer`** | **7,988** | `STR_TO_DATE` on birthdates, `DECIMAL(5) ZEROFILL` padding, blank strings to `NULL` |
   | **`Product`** | **4,023** | Stripped currency (`$`) and commas, cast to `DECIMAL(6,2)` |
   | **`Order`** | **25,897** | Date coercion, `dateShipped` set to `NULL` for 1,747 cancelled orders |
   | **`OrderLine`** | **77,396** | 155,233 raw line items aggregated into composite PKs with `Quantity = COUNT(*)` |
   | **`PriceHistory`** | **0** | Baseline schema instantiated for Phase 5 price auditing triggers |

---

### Phase 3: Views, Materialized Views & Indexes

1. **Deploy Phase 3 Views & Indexes Module to Node 1**:
   ```bash
   scp -r database/03_views azureuser@$NODE1_IP:~/database/
   ```

2. **Execute Phase 3 Runner**:
   ```bash
   ssh azureuser@$NODE1_IP "bash ~/database/03_views/run_phase3.sh"
   ```

3. **Objects Created**:
   - `v_CustomerNames`: Alphabetically sorted by `LastName`, then `FirstName`.
   - `v_Customers`: Full normalized address joined with `City` (`customer_number`, `street1`, `street2`, `City`, `ST`, `zip_code`).
   - `v_ProductBuyers`: Aggregate comma-separated list of distinct customer names and IDs per product (handles products with 0 buyers).
   - `v_CustomerPurchases`: Aggregate pipe-separated (`|`) list of distinct products purchased per customer.
   - `mv_ProductBuyers` & `mv_CustomerPurchases`: Dedicated snapshot tables with Primary Keys for instant reads.
   - `idx_CustomerEmail` & `idx_ProductName`: B-Tree indexes on `Customer(Email)` and `Product(Name)`.

---

### Phase 4: Stored Procedures & Transaction Management

1. **Deploy Phase 4 Routines Module to Node 1**:
   ```bash
   scp -r database/04_routines azureuser@$NODE1_IP:~/database/
   ```

2. **Execute Phase 4 Runner**:
   ```bash
   ssh azureuser@$NODE1_IP "bash ~/database/04_routines/run_phase4.sh"
   ```

3. **Operations & Deliverables**:
   - Schema alterations: `OrderLine.UnitPrice`, `OrderLine.LineTotal` (virtual generated column: `Quantity * UnitPrice`), `Order.OrderTotal`, dropped `Customer.Phone`.
   - Stored procedure `proc_FillUnitPrice`: Populates `NULL` `UnitPrice` from `Product.CurrentPrice` without modifying existing values.
   - Stored procedure `proc_FillOrderTotal`: Aggregates `SUM(LineTotal)` from `OrderLine` into `Order.OrderTotal`.
   - Stored procedure `proc_RefreshMV`: Transaction-safe materialized view refresh routine utilizing transactional `DELETE/INSERT` to avoid implicit DDL commits.
   - Comprehensive ACID transaction test suite: Rollback integrity verification, commit persistence, and parameterized prepared statements.

---

### Phase 5: Automated Business Triggers & Constraints

1. **Deploy Phase 5 Triggers Module to Node 1**:
   ```bash
   scp -r database/05_triggers azureuser@$NODE1_IP:~/database/
   ```

2. **Execute Phase 5 Runner**:
   ```bash
   ssh azureuser@$NODE1_IP "bash ~/database/05_triggers/run_phase5.sh"
   ```

3. **Operations & Deliverables**:
   - `TaxRates` table ingested from `TAXRATES.csv` (41,010 clean US zip tax rates, `DECIMAL(7,6)` precision).
   - Schema evolution: `PriceHistory.ChangeID` (`AUTO_INCREMENT`), `Order.OrderSubtotal`, `Order.SalesTax`, `Order.OrderTotal` (virtual: `OrderSubtotal + SalesTax`).
   - Trigger `trig_ProductPriceAudit`: Logs historical price adjustments strictly when `OLD.CurrentPrice <> NEW.CurrentPrice`.
   - Trigger `trig_OrderLineBeforeInsert`: Defaults `UnitPrice` to `Product.CurrentPrice` and `Quantity` to 1.
   - Triggers `trig_OrderLineInventory*`: Decrements/increments `Product.QtyOnHand` atomically; signals error 45000 if requested quantity exceeds stock.
   - Triggers `trig_OrderLineSyncTotals*`: Dynamically recalculates `OrderSubtotal` and `SalesTax` via Customer Zip tax lookup with half-penny rounding.
   - Trigger `trig_EagerMVRefreshInsert`: Selectively refreshes affected rows in `mv_ProductBuyers` and `mv_CustomerPurchases` in real-time.

---

### Phase 6: Galera Peer-to-Peer Multi-Master Replication

1. **Deploy Peer Virtual Machines (Node 2 & Node 3)**:
   ```bash
   ./infra/azure/03_provision_galera_peers.sh
   ```
   *(Note down the public IP addresses for Node 2 and Node 3 from the terminal output).*

2. **Initialize Host on Node 2 & Node 3**:
   ```bash
   export NODE2_IP="<NODE2_PUBLIC_IP>"
   export NODE3_IP="<NODE3_PUBLIC_IP>"

   scp infra/scripts/host_setup.sh azureuser@$NODE2_IP:~/
   ssh azureuser@$NODE2_IP "bash ~/host_setup.sh"

   scp infra/scripts/host_setup.sh azureuser@$NODE3_IP:~/
   ssh azureuser@$NODE3_IP "bash ~/host_setup.sh"
   ```

3. **Bootstrap Cluster on Node 1 (10.0.1.4)**:
   ```bash
   scp -r database/06_cluster azureuser@$NODE1_IP:~/database/
   ssh azureuser@$NODE1_IP "bash ~/database/06_cluster/bootstrap_node1.sh"
   ```

4. **Join Node 2 (10.0.1.5) & Node 3 (10.0.1.6)**:
   ```bash
   # Sync cluster scripts to Node 2 and join
   scp -r database/06_cluster azureuser@$NODE2_IP:~/database/
   ssh azureuser@$NODE2_IP "bash ~/database/06_cluster/join_peer.sh 2"

   # Sync cluster scripts to Node 3 and join
   scp -r database/06_cluster azureuser@$NODE3_IP:~/database/
   ssh azureuser@$NODE3_IP "bash ~/database/06_cluster/join_peer.sh 3"
   ```

5. **Enable Strict Causal Consistency (wsrep_sync_wait = 7)**:
   ```bash
   ./database/06_cluster/enable_strict_consistency.sh $NODE1_IP $NODE2_IP $NODE3_IP
   ```

6. **Run Multi-Master Replication Test Suite**:
   ```bash
   ./database/06_cluster/test_multimaster.sh $NODE1_IP $NODE2_IP $NODE3_IP
   ```

---

## 🚦 Phased Sequential Milestones

| Milestone | Phase | Description | Deliverables |
| :--- | :--- | :--- | :--- |
| **0** | **Setup** | Architecture, repo setup, infrastructure scripts & data staging | `infra/*`, `.gitignore`, `DEBUG_LOG.md` |
| **1** | **Phase 2** | Relational Data Layer & Baseline Modeling | `database/01_schema/structure.sql`, `database/02_etl/etl.sql` |
| **2** | **Phase 3** | Views, Materialized Views & Indexes | `database/03_views/views.sql` |
| **3** | **Phase 4** | Stored Procedures & Transaction Management | `database/04_routines/proc.sql` |
| **4** | **Phase 5** | Automated Business Triggers & Constraints | `database/05_triggers/trig.sql` |
| **5** | **Phase 6** | Galera Multi-Master Replication (Nodes A, B, C) | `infra/azure/03_provision_galera_peers.sh`, `database/06_cluster/*` |
| **6** | **Phase 7** | Full-Stack Application (FastAPI & React) | `backend/`, `frontend/` |
| **7** | **Phase 8** | Polyglot Persistence & NoSQL Analytics | `database/07_nosql/json.sql`, MongoDB scripts |


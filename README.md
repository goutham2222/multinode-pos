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


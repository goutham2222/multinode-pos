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

## 🚀 Getting Started (Milestone 0)

### 1. Place Source CSV Datasets
Copy your 5 raw CSV files directly into `data/raw/`:
- `data/raw/customers.csv`
- `data/raw/orders.csv`
- `data/raw/products.csv`
- `data/raw/orderlines.csv`
- `data/raw/TAXRATES.csv`

### 2. Configure Environment Files
Clone the template files:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 3. Azure Cloud Provisioning (Azure for Students)
Authenticate with Azure CLI:
```bash
az login
```

Provision the network infrastructure and primary node:
```bash
# 1. Provision VNet, Subnet, and NSGs
./infra/azure/01_network_setup.sh

# 2. Deploy Node 1 VM (Standard_B1s, Static Private IP 10.0.1.4)
./infra/azure/02_provision_primary_vm.sh
```

Initialize the host (Swap & MariaDB setup):
```bash
# Copy and run host initialization on Node 1:
scp infra/scripts/host_setup.sh azureuser@<NODE1_PUBLIC_IP>:~/
ssh azureuser@<NODE1_PUBLIC_IP> "bash ~/host_setup.sh"
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


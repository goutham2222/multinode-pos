# MultiNode POS: Defect & Error Resolution Log

This document serves as the permanent record of all bugs, syntax issues, compile errors, runtime anomalies, and UI/UX defects identified and resolved during the development of MultiNode POS, adhering strictly to the repository error logging protocol.

---

## Log Entries

### [ERR-001] Azure VM Provisioning Capacity Restriction (SkuNotAvailable) in eastus
- **Timestamp:** 2026-10-30 / Phase 1 (Azure Provisioning)
- **Component:** `infra/azure/01_network_setup.sh`, `infra/azure/02_provision_primary_vm.sh`, `infra/azure/03_provision_galera_peers.sh`
- **Technical Issue:** `az vm create` failed with `(SkuNotAvailable) The requested VM size for resource 'Following SKUs have failed for Capacity Restrictions: Standard_B1s' is currently not available in location 'eastus'`. Azure's East US data center experienced compute capacity exhaustion for the student/free-tier burstable `Standard_B1s` VM SKU.
- **Resolution:** Created `infra/azure/check_available_regions.sh` to dynamically query unrestricted regions for `Standard_B1s` in the user's active subscription. Updated Azure provisioning scripts to support parameterized `LOCATION` (e.g. `eastus2`, `centralus`, `southcentralus`) and provided cleanup/re-deployment guidance.
- **In Plain English:** Azure ran out of B1s machines in the `eastus` region. We added a script to check which Azure regions currently have B1s machines available and updated the setup scripts so you can deploy to an available region (such as East US 2 or Central US) without losing your free tier benefits.

### [ERR-002] Invalid JMESPath Query Syntax in check_available_regions.sh
- **Timestamp:** 2026-11-17 / Phase 1 (Azure Provisioning)
- **Component:** `infra/azure/check_available_regions.sh`
- **Technical Issue:** `az vm list-skus` failed with `ERROR: argument --query: invalid jmespath_type value: "[?resourceType=='virtualMachines' && (restrictions == null || length(restrictions) == 0)].locationInfo[0].location"`. Azure CLI's JMESPath parser requires backtick literals for numeric comparisons and rejected the compound null/length expression.
- **Resolution:** Replaced the fragile CLI JMESPath expression with an embedded Python script that directly loads and evaluates `az vm list-skus --size Standard_B1s --output json`, categorizing unrestricted vs. restricted regions with clear status output.
- **In Plain English:** Azure CLI's query syntax choked on the complex JMESPath filter. We replaced it with a Python parser that inspects the JSON output reliably across all platforms.

### [ERR-003] Incorrect SKU Restriction Mapping in check_available_regions.sh
- **Timestamp:** 2026-11-17 / Phase 1 (Azure Provisioning)
- **Component:** `infra/azure/check_available_regions.sh`
- **Technical Issue:** `check_available_regions.sh` checked whether `restrictions` was present on the SKU object without correlating `r['restrictionInfo']['locations']` or `r['values']` to the specific location being evaluated. Consequently, a restriction in `eastus` caused all standard physical regions in that SKU block to be falsely marked as restricted, leaving only test/staging regions.
- **Resolution:** Updated `check_available_regions.sh` to correlate restrictions strictly against the specific target location, filtered out non-physical staging regions using `az account list-locations`, and grouped standard public regions clearly.
- **In Plain English:** The region check script mistakenly flagged all major regions as restricted because of a single location's restriction. We fixed the script to map restrictions to specific regions accurately and filter out Microsoft internal test regions, displaying true available regions like East US 2, Central US, or West US.

### [ERR-004] MariaDB System Variable Syntax (transaction_isolation vs tx_isolation)
- **Timestamp:** 2026-11-17 / Phase 4 (Stored Procedures & Transactions)
- **Component:** `database/04_routines/test_transactions.sql`
- **Technical Issue:** `test_transactions.sql` failed with `ERROR 1193 (HY000) at line 13: Unknown system variable 'transaction_isolation'`. MariaDB 10.6 uses the standard system variable `@@tx_isolation` rather than the MySQL 8.0 `@@transaction_isolation` naming convention.
- **Resolution:** Updated `test_transactions.sql` to use `@@tx_isolation` (or fallback expression) to ensure full compatibility with MariaDB 10.6+.
- **In Plain English:** MySQL 8 and MariaDB 10 use slightly different variable names to check the transaction isolation level. We updated the SQL script to MariaDB's variable name (`@@tx_isolation`) so the transaction tests execute cleanly.

### [ERR-005] TaxRegionName Column Overflow in TaxRates Table
- **Timestamp:** 2026-11-17 / Phase 5 (Triggers & Business Constraints)
- **Component:** `database/05_triggers/trig.sql`
- **Technical Issue:** `trig.sql` failed during `TaxRates` ingestion with `ERROR 1406 (22001) at line 48: Data too long for column 'TaxRegionName' at row 24123`. `TaxRegionName` was typed as `VARCHAR(64)`, whereas complex municipal improvement district names in `TAXRATES.csv` reach up to 83 characters.
- **Resolution:** Modified `TaxRates.TaxRegionName` column definition from `VARCHAR(64)` to `VARCHAR(128)` to accommodate long municipal district descriptions.
- **In Plain English:** Certain city and county tax district names in the CSV exceeded 64 characters (up to 83 characters). We expanded the table column to 128 characters so all records load smoothly.

### [ERR-006] macOS Bash 3.2 Incompatibility with Associative Arrays (declare -A)
- **Timestamp:** 2026-11-18 / Phase 6 (Galera Clustering)
- **Component:** `infra/azure/03_provision_galera_peers.sh`
- **Technical Issue:** Running `03_provision_galera_peers.sh` failed with `./infra/azure/03_provision_galera_peers.sh: line 19: declare: -A: invalid option`. macOS defaults to GNU Bash 3.2, which lacks support for associative arrays (`declare -A`, introduced in Bash 4.0).
- **Resolution:** Replaced the associative array with a POSIX-compliant string list and standard parameter expansion (`${item%%:*}` and `${item##*:}`) compatible with Bash 3.2+, Zsh, and modern Linux shells.
- **In Plain English:** macOS uses an older version of Bash that doesn't support dictionary arrays. We rewritten the loop syntax so the peer provisioning script works reliably on macOS without needing to upgrade system Bash.

### [ERR-007] Azure for Students Regional Core Quota Exceeded for standardDASv4Family
- **Timestamp:** 2026-11-18 / Phase 6 (Galera Clustering)
- **Component:** `infra/azure/03_provision_galera_peers.sh`
- **Technical Issue:** Provisioning `vm-pos-node3` failed with `(QuotaExceeded) Operation could not be completed as it results in exceeding approved standardDASv4Family Cores quota. Location: eastus, Current Limit: 4, Current Usage: 4, Additional Required: 2`. Azure for Students limits subscriptions to 4 vCPUs per specific VM family in a single region. Because Node 1 and Node 2 each use 2 vCPUs of `standardDASv4Family` (`Standard_D2as_v4`), deploying Node 3 with the same size requested 6 cores, breaching the limit.
- **Resolution:** Updated `03_provision_galera_peers.sh` to allow per-node VM sizing. Set Node 3 to `Standard_D2s_v4` (Intel Xeon, 2 vCPU, 8 GB RAM, `standardDSv4Family`), which has 0/4 cores currently used in `eastus`. Made the script idempotent so it automatically skips already-running peer nodes (`vm-pos-node2`).
- **In Plain English:** Azure for Students limits each VM family to 4 cores. Node 1 and Node 2 used all 4 cores of the AMD family (`D2as_v4`). We assigned Node 3 to the identical Intel family (`D2s_v4`), which has a separate 4-core allowance, letting all 3 nodes run with 2 vCPUs and 8 GB RAM.

### [ERR-008] Unescaped Dollar Sign in test_multimaster.sh String
- **Timestamp:** 2026-11-18 / Phase 6 (Galera Clustering)
- **Component:** `database/06_cluster/test_multimaster.sh`
- **Technical Issue:** Running `test_multimaster.sh` failed with `./database/06_cluster/test_multimaster.sh: line 63: $9: unbound variable`. Because `set -u` is enabled, bash evaluated `$99.95` as the 9th shell argument (`$9`), which was unset.
- **Resolution:** Escaped literal dollar signs (`\$99.95` and `\$149.95`) in informational `echo` statements.
- **In Plain English:** The test script tried to read `$99.95` as a shell variable instead of text. We escaped the dollar signs so bash prints the currency values properly.

### [ERR-009] Pydantic email-validator Dependency Requirement
- **Timestamp:** 2026-11-19 / Phase 7 (Full-Stack Application Layer)
- **Component:** `backend/app/models/schemas.py`, `backend/requirements.txt`
- **Technical Issue:** Importing `CustomerBase` utilizing `EmailStr` raised `ImportError: email-validator is not installed, run pip install 'pydantic[email]'`.
- **Resolution:** Added `email-validator>=2.2.0` to `backend/requirements.txt` and installed it in the virtual environment.
- **In Plain English:** Pydantic requires an external email validator package when validating email fields. We installed the package and added it to the project requirements.

### [ERR-010] City Table Column Name Mismatch (CityName vs City)
- **Timestamp:** 2026-11-19 / Phase 7 (Full-Stack Application Layer)
- **Component:** `backend/app/api/routes_customers.py`, `backend/app/services/query_service.py`
- **Technical Issue:** Customer lookup queries referenced `ct.CityName`, failing with `pymysql.err.OperationalError: (1054, "Unknown column 'ct.CityName' in 'SELECT'")`. The base relational schema defines the column as `City`.
- **Resolution:** Updated queries to alias `ct.City AS CityName` ensuring alignment with Pydantic response models and the database schema.
- **In Plain English:** The code expected the city column to be named `CityName`, but the database table has it named `City`. We aliased it in the SQL query so the customer information loads without errors.

### [ERR-011] DECIMAL(8,2) Overflow in Test Suite Stock Rollback Simulation
- **Timestamp:** 2026-11-19 / Phase 7 (Full-Stack Application Layer)
- **Component:** `backend/tests/test_transactions.py`
- **Technical Issue:** Simulating an over-stock order with `Quantity = 9999999` caused the virtual generated column `LineTotal DECIMAL(8,2)` (`Quantity * UnitPrice`) to exceed the column capacity ($999,999.99), raising MariaDB error `1264 ("Out of range value for column 'LineTotal'")` prior to the inventory trigger evaluation.
- **Resolution:** Adjusted the test quantity to `500` (which exceeds the available stock of ~225 while keeping the line total within the decimal range), successfully verifying `trig_OrderLineInventoryInsert` and the resulting rollback.
- **In Plain English:** Testing an out-of-stock order with 9 million items caused the total price calculation to overflow the database decimal column. We adjusted the test quantity to 500, which exceeds warehouse stock while staying within normal price limits, successfully triggering the stock warning and rollback.




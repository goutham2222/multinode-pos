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



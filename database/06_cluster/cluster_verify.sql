-- ==============================================================================
-- MultiNode POS: Phase 6 - Galera Cluster Health & Verification Suite
-- File: database/06_cluster/cluster_verify.sql
-- ==============================================================================

SELECT '==================================================' AS ``;
SELECT 'Galera Cluster Node & Replication Status' AS `ClusterTelemetry`;
SELECT '==================================================' AS ``;

SHOW STATUS LIKE 'wsrep_cluster_size';
SHOW STATUS LIKE 'wsrep_cluster_status';
SHOW STATUS LIKE 'wsrep_ready';
SHOW STATUS LIKE 'wsrep_connected';
SHOW STATUS LIKE 'wsrep_local_state_comment';
SHOW STATUS LIKE 'wsrep_incoming_addresses';
SHOW STATUS LIKE 'wsrep_node_name';

-- Verify pos database tables are available on this node
USE `pos`;
SELECT 'pos Database Record Verification' AS `Status`;
SELECT 'City' AS `Table`, COUNT(*) AS `TotalRows` FROM City
UNION ALL
SELECT 'Customer', COUNT(*) FROM Customer
UNION ALL
SELECT 'Product', COUNT(*) FROM Product
UNION ALL
SELECT 'Order', COUNT(*) FROM `Order`
UNION ALL
SELECT 'OrderLine', COUNT(*) FROM OrderLine
UNION ALL
SELECT 'TaxRates', COUNT(*) FROM TaxRates;

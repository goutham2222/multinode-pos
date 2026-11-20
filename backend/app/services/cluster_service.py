import time
from typing import List, Dict, Any
from app.config import settings
from app.db.pool import db_pool
from app.models.schemas import NodeStatus, ClusterStatusResponse


class ClusterService:
    @staticmethod
    def get_cluster_status() -> ClusterStatusResponse:
        statuses: List[NodeStatus] = []
        quorum_ok = True

        for node in settings.cluster_nodes:
            node_id = node["id"]
            node_name = node["name"]
            host = node["host"]

            start_t = time.perf_counter()
            try:
                conn = db_pool.create_connection(host, connect_timeout=2)
                elapsed_ms = round((time.perf_counter() - start_t) * 1000, 2)
                with conn.cursor() as cur:
                    cur.execute("SHOW STATUS LIKE 'wsrep_cluster_size'")
                    row_size = cur.fetchone()
                    cluster_size = int(row_size["Value"]) if row_size else None

                    cur.execute("SHOW STATUS LIKE 'wsrep_cluster_status'")
                    row_status = cur.fetchone()
                    cluster_status = row_status["Value"] if row_status else None

                    cur.execute("SHOW STATUS LIKE 'wsrep_local_state_comment'")
                    row_state = cur.fetchone()
                    local_state = row_state["Value"] if row_state else None

                    cur.execute("SHOW VARIABLES LIKE 'wsrep_sync_wait'")
                    row_sync = cur.fetchone()
                    sync_wait = int(row_sync["Value"]) if row_sync else None

                conn.close()

                is_primary = (cluster_status == "Primary")
                if not is_primary or cluster_size < 2:
                    quorum_ok = False

                statuses.append(NodeStatus(
                    id=node_id,
                    name=node_name,
                    host=host,
                    online=True,
                    cluster_size=cluster_size,
                    cluster_status=cluster_status,
                    local_state=local_state,
                    sync_wait=sync_wait,
                    ping_ms=elapsed_ms
                ))
            except Exception as e:
                elapsed_ms = round((time.perf_counter() - start_t) * 1000, 2)
                quorum_ok = False
                statuses.append(NodeStatus(
                    id=node_id,
                    name=node_name,
                    host=host,
                    online=False,
                    ping_ms=elapsed_ms,
                    error=str(e)
                ))

        return ClusterStatusResponse(
            nodes=statuses,
            quorum_healthy=quorum_ok
        )


cluster_service = ClusterService()

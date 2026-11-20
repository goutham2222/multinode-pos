import time
from contextlib import contextmanager
from typing import Generator, Optional, Dict, Any, Tuple
import pymysql
import pymysql.cursors
from app.config import settings


class NodeConnectionError(Exception):
    """Raised when a specific Galera node cannot be reached."""
    pass


class ClusterPool:
    def __init__(self):
        self._nodes = settings.cluster_nodes
        self._primary_host = settings.DB_HOST_PRIMARY

    def get_host_for_target(self, target: Optional[Any] = None) -> Tuple[str, str]:
        """
        Resolves target parameter to (host, node_name).
        target can be 1, 2, 3, '1', '2', '3', 'Node 1', 'auto', or an IP address.
        """
        if target is None or str(target).lower() in ("auto", "0", ""):
            return self._primary_host, "Auto (Primary)"

        target_str = str(target).strip()

        # Check by node index (1, 2, 3)
        for node in self._nodes:
            if str(node["id"]) == target_str or node["name"].lower() == target_str.lower() or node["host"] == target_str:
                return node["host"], node["name"]

        # Default fallback to primary
        return self._primary_host, "Fallback (Primary)"

    def create_connection(self, host: str, connect_timeout: int = 4) -> pymysql.connections.Connection:
        """Create a new database connection to a specific host."""
        return pymysql.connect(
            host=host,
            user=settings.DB_USER,
            password=settings.DB_PASSWORD,
            database=settings.DB_NAME,
            port=settings.DB_PORT,
            cursorclass=pymysql.cursors.DictCursor,
            connect_timeout=connect_timeout,
            autocommit=False,
            charset="utf8mb4"
        )

    @contextmanager
    def connection(self, target_node: Optional[Any] = None) -> Generator[Tuple[pymysql.connections.Connection, Dict[str, Any]], None, None]:
        """
        Yields (conn, node_metadata).
        If target is specified, connects to that node directly.
        If target is auto/None and primary fails, fails over to other healthy cluster nodes.
        """
        target_str = str(target_node).strip().lower() if target_node is not None else "auto"
        is_auto = target_str in ("auto", "0", "none", "")

        conn = None
        selected_node = None

        if not is_auto:
            host, node_name = self.get_host_for_target(target_node)
            selected_node = {"name": node_name, "host": host}
            try:
                conn = self.create_connection(host)
            except Exception as e:
                raise NodeConnectionError(f"Failed to connect to target node {node_name} ({host}): {str(e)}")
        else:
            # Auto failover mode: try primary first, then others
            hosts_to_try = [self._primary_host] + [n["host"] for n in self._nodes if n["host"] != self._primary_host]
            last_err = None

            for host in hosts_to_try:
                node_match = next((n for n in self._nodes if n["host"] == host), {"name": "Node", "host": host})
                try:
                    conn = self.create_connection(host, connect_timeout=3)
                    selected_node = node_match
                    break
                except Exception as e:
                    last_err = e
                    continue

            if conn is None:
                raise NodeConnectionError(f"All Galera cluster nodes are unreachable. Last error: {last_err}")

        try:
            yield conn, selected_node
        finally:
            if conn:
                try:
                    conn.close()
                except Exception:
                    pass


db_pool = ClusterPool()

import socket
import pytest

def is_cluster_online(host="20.169.214.104", port=3306, timeout=1.5):
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(timeout)
        s.connect((host, port))
        s.close()
        return True
    except Exception:
        return False

CLUSTER_ONLINE = is_cluster_online()

@pytest.fixture(autouse=True)
def require_live_cluster(request):
    """
    Automatically skips live database integration tests when Azure cluster
    nodes are deallocated or stopped to prevent CI/CD failures during downtime.
    """
    if request.node.name != "test_health" and not CLUSTER_ONLINE:
        pytest.skip("Azure Galera cluster nodes are deallocated / offline (compute stopped to save cloud costs)")

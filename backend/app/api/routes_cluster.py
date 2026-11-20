from fastapi import APIRouter
from app.services.cluster_service import cluster_service
from app.models.schemas import ClusterStatusResponse

router = APIRouter(prefix="/cluster", tags=["Cluster & CAP Status"])


@router.get("/status", response_model=ClusterStatusResponse)
def get_cluster_status():
    """
    Returns real-time health, latency, replication state, and CAP theorem consistency guarantees
    across all 3 MariaDB Galera nodes.
    """
    return cluster_service.get_cluster_status()

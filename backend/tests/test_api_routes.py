from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"


def test_cluster_status_route():
    res = client.get("/api/v1/cluster/status")
    assert res.status_code == 200
    data = res.json()
    assert "nodes" in data
    assert len(data["nodes"]) == 3
    assert data["quorum_healthy"] is True


def test_products_route():
    res = client.get("/api/v1/products?limit=5")
    assert res.status_code == 200
    data = res.json()
    assert "rows" in data
    assert len(data["rows"]) == 5


def test_customers_route():
    res = client.get("/api/v1/customers?limit=5")
    assert res.status_code == 200
    data = res.json()
    assert "rows" in data
    assert len(data["rows"]) == 5


def test_sql_demo_route():
    res = client.post("/api/v1/sql-demo/execute", json={
        "search_term": "Wardrobe",
        "use_prepared_statement": True
    })
    assert res.status_code == 200
    data = res.json()
    assert data["safe_mode"] is True
    assert data["row_count"] >= 1

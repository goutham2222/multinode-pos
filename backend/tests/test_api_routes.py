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


def test_nosql_analytics_routes():
    res_orders = client.get("/api/v1/analytics/documents/orders?limit=3")
    assert res_orders.status_code == 200
    data_orders = res_orders.json()
    assert "documents" in data_orders
    assert len(data_orders["documents"]) == 3
    sample_order = data_orders["documents"][0]
    assert "order_id" in sample_order
    assert "customer" in sample_order
    assert "items" in sample_order

    res_clv = client.get("/api/v1/analytics/clv-tiers")
    assert res_clv.status_code == 200
    data_clv = res_clv.json()
    assert "tiers" in data_clv
    assert len(data_clv["tiers"]) > 0

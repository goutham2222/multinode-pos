import pytest
from app.services.query_service import query_service


def test_prepared_statement_neutralizes_sql_injection():
    """
    Tests that injection payloads are safely sanitized when using prepared statements.
    """
    payload = "' OR '1'='1"
    resp = query_service.demonstrate_injection_defense(search_term=payload, use_prepared_statement=True)

    assert resp.safe_mode is True
    assert "SAFE" in resp.defense_summary
    assert len(resp.bound_parameters) == 1
    assert resp.bound_parameters[0] == f"%{payload}%"
    # In a database where no product actually has "' OR '1'='1" in its name, row_count must be 0!
    assert resp.row_count == 0


def test_parameterized_order_filter_with_special_characters():
    """
    Tests that order filters safely handle single quotes and special characters without syntax errors.
    """
    result = query_service.filter_orders(
        customer_name="O'Connor",
        status="Shipped",
        limit=10,
        offset=0
    )

    assert "rows" in result
    assert "total" in result
    assert isinstance(result["rows"], list)

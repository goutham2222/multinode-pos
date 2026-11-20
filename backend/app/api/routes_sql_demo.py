from fastapi import APIRouter
from app.services.query_service import query_service
from app.models.schemas import SqlDemoRequest, SqlDemoResponse

router = APIRouter(prefix="/sql-demo", tags=["SQL Injection Defense Demo"])


@router.post("/execute", response_model=SqlDemoResponse)
def execute_sql_demo(payload: SqlDemoRequest):
    """
    Demonstrates defense against SQL injection using prepared statements.
    Compares parameterized execution against vulnerable dynamic string concatenation.
    """
    return query_service.demonstrate_injection_defense(
        search_term=payload.search_term,
        use_prepared_statement=payload.use_prepared_statement,
        target_node=payload.target_node
    )

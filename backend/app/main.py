import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.config import settings
from app.api.routes_cluster import router as cluster_router
from app.api.routes_products import router as products_router
from app.api.routes_customers import router as customers_router
from app.api.routes_orders import router as orders_router
from app.api.routes_checkout import router as checkout_router
from app.api.routes_sql_demo import router as sql_demo_router

app = FastAPI(
    title="MultiNode POS API",
    description="Synchronous Multi-Master Transactional & Analytics Point-of-Sale Engine",
    version="1.0.0"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Open to facilitate local dev, Azure IP, and Vite UI
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API v1 Routers
API_V1_PREFIX = "/api/v1"
app.include_router(cluster_router, prefix=API_V1_PREFIX)
app.include_router(products_router, prefix=API_V1_PREFIX)
app.include_router(customers_router, prefix=API_V1_PREFIX)
app.include_router(orders_router, prefix=API_V1_PREFIX)
app.include_router(checkout_router, prefix=API_V1_PREFIX)
app.include_router(sql_demo_router, prefix=API_V1_PREFIX)


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "MultiNode POS Backend",
        "environment": settings.ENVIRONMENT,
        "nodes_configured": len(settings.cluster_nodes)
    }


# Mount Static Frontend if built
FRONTEND_DIST = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend/dist")

if os.path.isdir(FRONTEND_DIST):
    # Mount assets directory
    assets_dir = os.path.join(FRONTEND_DIST, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Allow API calls to pass through
        if full_path.startswith("api/") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
            return None
        file_path = os.path.join(FRONTEND_DIST, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
else:
    @app.get("/")
    def root():
        return {
            "message": "Welcome to MultiNode POS API",
            "docs_url": "/docs",
            "api_v1": "/api/v1"
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.API_HOST, port=settings.API_PORT, reload=True)


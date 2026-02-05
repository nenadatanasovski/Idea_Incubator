"""
Vibe Memory Graph API

FastAPI application for memory graph operations using Neo4j.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import get_settings
from .core.database import close_driver, verify_connection
from .routers import memory


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    settings = get_settings()
    print(f"🚀 Starting {settings.api_title} v{settings.api_version}")
    
    # Verify Neo4j connection
    if await verify_connection():
        print("✅ Neo4j connection verified")
    else:
        print("⚠️  Neo4j connection failed - some features may not work")
    
    yield
    
    # Shutdown
    print("🛑 Shutting down...")
    await close_driver()


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    settings = get_settings()
    
    app = FastAPI(
        title=settings.api_title,
        version=settings.api_version,
        description="Memory Graph API for the Vibe platform",
        lifespan=lifespan,
        docs_url=f"{settings.api_prefix}/docs",
        redoc_url=f"{settings.api_prefix}/redoc",
        openapi_url=f"{settings.api_prefix}/openapi.json",
    )
    
    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Routers
    app.include_router(memory.router, prefix=settings.api_prefix)
    
    # Health check
    @app.get("/health")
    async def health_check():
        """Health check endpoint."""
        neo4j_ok = await verify_connection()
        return {
            "status": "healthy" if neo4j_ok else "degraded",
            "neo4j": "connected" if neo4j_ok else "disconnected",
        }
    
    return app


# Create app instance
app = create_app()


if __name__ == "__main__":
    import uvicorn
    settings = get_settings()
    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
    )

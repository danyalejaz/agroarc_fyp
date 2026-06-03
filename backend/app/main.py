"""
AgroArc FastAPI Backend Application
Main entry point for the API server
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import os

# Import all route modules
from .routes import crop, fertilizer, weather, chat

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette import status

# Configure logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def _parse_allowed_origins() -> list[str]:
    """
    CORS allowlist driven by the ALLOWED_ORIGINS env var.

    - Unset or "*" -> wide-open (suitable for local development only).
    - Comma-separated list -> exact origin allowlist (production).
      Example: "https://agroarc-web.herokuapp.com,https://agroarc.com"
    """
    raw = os.getenv("ALLOWED_ORIGINS", "*").strip()
    if not raw or raw == "*":
        return ["*"]
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


ALLOWED_ORIGINS = _parse_allowed_origins()
logger.info("CORS allowlist: %s", ALLOWED_ORIGINS)

# Create FastAPI application instance
app = FastAPI(
    title="AgroArc API",
    description="Smart Agriculture Recommendation System - ML-powered crop and fertilizer predictions with weather advisories",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# CORS middleware – defaults to wide-open for local dev, restricted in prod.
# Set ALLOWED_ORIGINS as a comma-separated list of full origins to lock down.
# allow_credentials must be False when allow_origins is "*" (browser rule).
_uses_wildcard = ALLOWED_ORIGINS == ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=not _uses_wildcard,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include API routers
# Each router handles a specific domain of the application
app.include_router(crop.router)  # Crop recommendation endpoints
app.include_router(fertilizer.router)  # Fertilizer recommendation endpoints
app.include_router(weather.router)  # Weather advisory endpoints
app.include_router(chat.router)  # General chat endpoint


# Exception handler for validation errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    """Log detailed validation errors for debugging"""
    logger.error(f"Validation error on {request.url.path}: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": exc.errors(),
            "body": exc.body if hasattr(exc, 'body') else None
        }
    )

# Root health check endpoint
@app.get("/", tags=["Health"])
async def root() -> dict:
    """
    Root endpoint - Health check and API information
    
    Endpoint: GET /
    
    Returns:
    - status: Service status
    - message: Welcome message
    - version: API version
    - documentation: Link to interactive API docs
    - endpoints: Available API endpoint groups
    """
    return {
        "status": "healthy",
        "message": "Welcome to AgroArc API - Smart Agriculture Recommendation System",
        "version": "1.0.0",
        "documentation": "/docs",
        "endpoints": {
            "crop_recommendation": "/api/v1/crop",
            "fertilizer_recommendation": "/api/v1/fertilizer",
            "weather_advisory": "/api/v1/weather",
            "general_chat": "/chat"
        }
    }

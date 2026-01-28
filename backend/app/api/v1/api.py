from fastapi import APIRouter
from app.api.v1.endpoints import generation, files, auth

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(generation.router, prefix="/generation", tags=["generation"])
api_router.include_router(files.router, prefix="/files", tags=["files"])

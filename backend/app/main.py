from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.api.v1.endpoints import generation, files, auth, admin, demo_storage
from app.core.database import create_db_and_tables, engine
from sqlmodel import Session, select
from app.models.models import User
from app.core.auth import get_password_hash
from contextlib import asynccontextmanager
import os

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时：创建表和初始化管理员
    create_db_and_tables()
    with Session(engine) as session:
        admin_user = session.exec(select(User).where(User.username == "admin")).first()
        if not admin_user:
            admin = User(
                username="admin",
                hashed_password=get_password_hash("admin123"),
                is_admin=True
            )
            session.add(admin)
            session.commit()
            print("--- 初始化管理员账号成功: admin / admin123 ---")
    yield

app = FastAPI(
    title="AI 军工管理系统",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(generation.router, prefix="/api/v1/generation", tags=["Generation"])
app.include_router(files.router, prefix="/api/v1/files", tags=["Files"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])
app.include_router(demo_storage.router, prefix="/api/v1/demo", tags=["Demo Storage"])

# 挂载前端静态文件（生产环境下使用）
# 假设前端 build 后的文件放在 backend/static 目录下
static_path = os.path.join(os.path.dirname(__file__), "..", "static")
if os.path.exists(static_path):
    app.mount("/", StaticFiles(directory=static_path, html=True), name="static")

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

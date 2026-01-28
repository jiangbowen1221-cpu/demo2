from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from app.core.database import get_session
from app.core.auth import get_current_admin
from app.models.models import License, User
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
import uuid

router = APIRouter()

class LicenseCreate(BaseModel):
    username: str
    max_calls: int = 100
    valid_days: int = 30

class LicenseRead(BaseModel):
    id: int
    license_key: str
    username: str
    max_calls: int
    used_calls: int
    expires_at: datetime
    is_active: bool
    created_at: datetime

@router.post("/generate", response_model=LicenseRead)
def generate_license(
    data: LicenseCreate,
    session: Session = Depends(get_session),
    admin: User = Depends(get_current_admin)
):
    """管理员：为指定用户生成授权码"""
    # 查找用户
    user = session.exec(select(User).where(User.username == data.username)).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    # 禁用该用户之前的旧 License
    old_licenses = session.exec(select(License).where(License.user_id == user.id, License.is_active == True)).all()
    for old in old_licenses:
        old.is_active = False
        session.add(old)
    
    # 生成新 License
    new_license = License(
        license_key=str(uuid.uuid4()).upper().replace("-", "")[:16],
        user_id=user.id,
        max_calls=data.max_calls,
        expires_at=datetime.now() + timedelta(days=data.valid_days)
    )
    session.add(new_license)
    session.commit()
    session.refresh(new_license)
    
    return {
        **new_license.dict(),
        "username": user.username
    }

@router.get("/list", response_model=List[LicenseRead])
def list_licenses(
    session: Session = Depends(get_session),
    admin: User = Depends(get_current_admin)
):
    """管理员：查看所有授权码及使用情况"""
    results = session.exec(select(License, User).join(User).order_by(License.created_at.desc())).all()
    return [
        {**lic.dict(), "username": user.username}
        for lic, user in results
    ]

@router.get("/check-me")
def check_my_license(
    current_user: User = Depends(get_current_admin), # Actually just need current_user, but we can check if they are admin too
    session: Session = Depends(get_session)
):
    """用户：检查自己的授权状态"""
    lic = session.exec(select(License).where(License.user_id == current_user.id, License.is_active == True)).first()
    if not lic:
        return {"status": "none", "message": "未激活授权"}
    
    is_expired = lic.expires_at < datetime.now()
    is_exhausted = lic.used_calls >= lic.max_calls
    
    return {
        "status": "valid" if not (is_expired or is_exhausted) else "invalid",
        "license_key": lic.license_key,
        "max_calls": lic.max_calls,
        "used_calls": lic.used_calls,
        "expires_at": lic.expires_at,
        "is_expired": is_expired,
        "is_exhausted": is_exhausted
    }

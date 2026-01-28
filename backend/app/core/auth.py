from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session, select
from app.models.models import User, License
from app.core.database import get_session

# 安全配置（实际生产环境应使用环境变量）
SECRET_KEY = "your-secret-key-for-military-demo"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 令牌有效期 24 小时

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")

def verify_password(plain_password, hashed_password):
    """验证明文密码和哈希值是否匹配"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    """生成密码哈希值"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """创建 JWT 访问令牌"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), session: Session = Depends(get_session)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = session.exec(select(User).where(User.username == username)).first()
    if user is None:
        raise credentials_exception
    return user

async def get_current_admin(current_user: User = Depends(get_current_user)):
    """检查当前用户是否为管理员"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有管理员有权执行此操作"
        )
    return current_user

async def verify_license(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """校验用户的 License 是否有效，并增加使用计数"""
    # 管理员豁免校验
    if current_user.is_admin:
        return True
        
    lic = session.exec(select(License).where(
        License.user_id == current_user.id, 
        License.is_active == True
    )).first()
    
    if not lic:
        raise HTTPException(status_code=402, detail="未检测到有效授权，请联系管理员")
        
    if lic.expires_at < datetime.now():
        raise HTTPException(status_code=402, detail="授权已过期，请续费")
        
    if lic.used_calls >= lic.max_calls:
        raise HTTPException(status_code=402, detail="授权额度已耗尽")
        
    # 增加使用次数
    lic.used_calls += 1
    session.add(lic)
    session.commit()
    return True

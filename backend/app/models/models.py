from typing import Optional
from sqlmodel import Field, SQLModel
from datetime import datetime

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    hashed_password: str
    is_active: bool = Field(default=True)
    is_admin: bool = Field(default=False)  # 是否为管理员
    created_at: datetime = Field(default_factory=datetime.now)

class License(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    license_key: str = Field(unique=True, index=True) # 授权码
    user_id: int = Field(foreign_key="user.id") # 绑定用户
    max_calls: int = Field(default=100) # 最大调用次数
    used_calls: int = Field(default=0)  # 已使用次数
    expires_at: datetime # 到期时间
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.now)

class Project(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    description: Optional[str] = None
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    
    # Document Content
    raw_requirement: Optional[str] = None
    requirements_doc: Optional[str] = None
    product_doc: Optional[str] = None
    tech_doc: Optional[str] = None
    demo_code: Optional[str] = None
    report_content: Optional[str] = None
    share_token: Optional[str] = Field(default=None, index=True) # 发布分享用的 Token
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class DemoData(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    data_key: str = Field(index=True) # 业务数据的 Key，如 "users", "records"
    data_content: str = Field(default="[]") # JSON 字符串存储
    updated_at: datetime = Field(default_factory=datetime.now)

class FileUpload(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    filename: str
    file_path: str
    file_type: str
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    project_id: Optional[int] = Field(default=None, foreign_key="project.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ProjectCreate(SQLModel):
    name: str
    description: Optional[str] = None

class ProjectUpdate(SQLModel):
    name: Optional[str] = None
    raw_requirement: Optional[str] = None
    requirements_doc: Optional[str] = None
    product_doc: Optional[str] = None
    tech_doc: Optional[str] = None
    demo_code: Optional[str] = None
    report_content: Optional[str] = None

class ProjectRead(Project):
    pass

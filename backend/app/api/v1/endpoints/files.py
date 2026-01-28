import os
import shutil
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import FileResponse
from sqlmodel import Session, select
from app.models.models import User, FileUpload
from app.core.database import get_session
from app.core.auth import get_current_user
from datetime import datetime

router = APIRouter()

UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    project_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    真正的文件上传接口：
    1. 接收前端上传的文件
    2. 保存到本地 uploads 文件夹
    3. 将文件元数据与用户绑定
    """
    try:
        # 生成唯一的文件名，防止冲突
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        safe_filename = f"{timestamp}_{file.filename}"
        file_path = os.path.join(UPLOAD_DIR, safe_filename)
        
        # 保存文件到磁盘
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # 存入数据库，绑定当前用户
        db_file = FileUpload(
            filename=file.filename,
            file_path=file_path,
            file_type=file.content_type,
            user_id=current_user.id,
            project_id=project_id
        )
        session.add(db_file)
        session.commit()
        session.refresh(db_file)
        
        return {
            "id": db_file.id,
            "filename": db_file.filename,
            "url": f"/api/v1/files/download/{db_file.id}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件上传失败: {str(e)}")

@router.get("/list/{project_id}", response_model=List[FileUpload])
def list_project_files(project_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    """获取指定项目的所有附件（仅限本人）"""
    files = session.exec(select(FileUpload).where(
        FileUpload.project_id == project_id,
        FileUpload.user_id == current_user.id
    )).all()
    return files

@router.get("/download/{file_id}")
def download_file(file_id: int, session: Session = Depends(get_session)):
    """下载/查看文件接口"""
    db_file = session.get(FileUpload, file_id)
    if not db_file:
        raise HTTPException(status_code=404, detail="文件不存在")
    
    if not os.path.exists(db_file.file_path):
        raise HTTPException(status_code=404, detail="物理文件已丢失")
        
    return FileResponse(db_file.file_path, media_type=db_file.file_type)

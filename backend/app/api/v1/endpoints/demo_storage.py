from fastapi import APIRouter, Depends, HTTPException, Body
from sqlmodel import Session, select
from app.core.database import get_session
from app.models.models import DemoData, Project
from typing import List, Any
import json

router = APIRouter()

@router.get("/{project_id}/data/{key}")
def get_demo_data(project_id: str, key: str, session: Session = Depends(get_session)):
    """获取 Demo 的模拟数据"""
    # 尝试将 project_id 转换为整数，如果失败则尝试查找默认项目或返回空数据
    try:
        p_id = int(project_id)
    except ValueError:
        # 如果是字符串 ID，尝试找到第一个项目作为兜底，或者直接返回空
        # 很多生成的 Demo 会使用 "default" 或 "1" 作为占位符
        first_project = session.exec(select(Project)).first()
        if first_project:
            p_id = first_project.id
        else:
            return []

    data = session.exec(select(DemoData).where(
        DemoData.project_id == p_id,
        DemoData.data_key == key
    )).first()
    
    if not data:
        return []
    return json.loads(data.data_content)

@router.post("/{project_id}/data/{key}")
def save_demo_data(project_id: str, key: str, payload: Any = Body(...), session: Session = Depends(get_session)):
    """保存/更新 Demo 的模拟数据"""
    try:
        p_id = int(project_id)
    except ValueError:
        first_project = session.exec(select(Project)).first()
        if first_project:
            p_id = first_project.id
        else:
            raise HTTPException(status_code=400, detail="Invalid project ID and no projects exist")

    data = session.exec(select(DemoData).where(
        DemoData.project_id == p_id,
        DemoData.data_key == key
    )).first()
    
    if not data:
        data = DemoData(project_id=p_id, data_key=key)
    
    data.data_content = json.dumps(payload)
    session.add(data)
    session.commit()
    return {"status": "success"}

@router.delete("/{project_id}/data/{key}")
def clear_demo_data(project_id: str, key: str, session: Session = Depends(get_session)):
    """清除数据"""
    try:
        p_id = int(project_id)
    except ValueError:
        return {"status": "skipped", "reason": "invalid project id"}

    data = session.exec(select(DemoData).where(
        DemoData.project_id == p_id,
        DemoData.data_key == key
    )).first()
    if data:
        session.delete(data)
        session.commit()
    return {"status": "cleared"}

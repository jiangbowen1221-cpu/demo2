from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select
from app.services.llm_service import llm_service
from app.models.schemas import (
    RequirementRequest, ProductDocRequest, TechDocRequest, DemoRequest, GenerationResponse, IterateRequest, PartialEditRequest, ReportRequest
)
from app.models.models import Project, ProjectCreate, ProjectUpdate, ProjectRead, User
from app.core.database import get_session
from app.core.auth import get_current_user, verify_license
from app.core.prompts import (
    REQUIREMENTS_PROMPT, PRODUCT_DOC_PROMPT, TECHNICAL_DOC_PROMPT, DEMO_PROMPT,
    REFINE_REQUIREMENTS_PROMPT, REFINE_PRODUCT_DOC_PROMPT, REFINE_TECHNICAL_DOC_PROMPT, ITERATION_PROMPT, PARTIAL_EDIT_PROMPT,
    REPORT_PROMPT
)
from typing import List

router = APIRouter()

# --- Project Management Endpoints ---
# (Keep existing project endpoints unchanged)

@router.post("/projects/", response_model=ProjectRead)
def create_project(project: ProjectCreate, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    db_project = Project.from_orm(project)
    db_project.user_id = current_user.id
    session.add(db_project)
    session.commit()
    session.refresh(db_project)
    return db_project

@router.get("/projects/", response_model=List[ProjectRead])
def read_projects(offset: int = 0, limit: int = 100, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    projects = session.exec(select(Project).where(Project.user_id == current_user.id).offset(offset).limit(limit).order_by(Project.updated_at.desc())).all()
    return projects

@router.get("/projects/{project_id}", response_model=ProjectRead)
def read_project(project_id: int, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    project = session.get(Project, project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.patch("/projects/{project_id}", response_model=ProjectRead)
def update_project(project_id: int, project_update: ProjectUpdate, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    db_project = session.get(Project, project_id)
    if not db_project or db_project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project_data = project_update.dict(exclude_unset=True)
    for key, value in project_data.items():
        setattr(db_project, key, value)
    
    session.add(db_project)
    session.commit()
    session.refresh(db_project)
    return db_project

@router.delete("/projects/{project_id}")
def delete_project(project_id: int, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    """删除项目"""
    db_project = session.get(Project, project_id)
    if not db_project or db_project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    session.delete(db_project)
    session.commit()
    return {"status": "success", "message": "项目已删除"}

import uuid

@router.post("/projects/{project_id}/publish")
def publish_project(project_id: int, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    """一键发布项目，生成分享 Token"""
    project = session.get(Project, project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    if not project.share_token:
        project.share_token = str(uuid.uuid4()).replace("-", "")
        session.add(project)
        session.commit()
        session.refresh(project)
    
    return {"share_token": project.share_token, "url": f"/preview/{project.share_token}"}

@router.get("/public/preview/{share_token}")
def get_public_project(share_token: str, session: Session = Depends(get_session)):
    """公网免登录预览接口"""
    project = session.exec(select(Project).where(Project.share_token == share_token)).first()
    if not project:
        raise HTTPException(status_code=404, detail="分享链接已失效")
    
    return {
        "name": project.name,
        "demo_code": project.demo_code,
        "project_id": project.id
    }

@router.post("/stream/partial_edit")
async def stream_partial_edit(
    request: PartialEditRequest,
    current_user: User = Depends(get_current_user),
    licensed: bool = Depends(verify_license)
):
    try:
        print(f"DEBUG: Partial edit request for user {current_user.username}")
        print(f"DEBUG: Selected elements count: {len(request.selected_elements)}")
        
        selected_info = []
        for el in request.selected_elements:
            info = []
            if el.traceId:
                info.append(f"Trace ID: {el.traceId}")
            if el.selector:
                info.append(f"Selector: {el.selector}")
            info.append(f"Current HTML Snippet: {el.html}")
            selected_info.append("\n".join(info))
        
        selected_info_str = "\n---\n".join(selected_info)
        
        prompt = PARTIAL_EDIT_PROMPT.replace("{selected_elements_info}", selected_info_str)\
                                   .replace("{user_feedback}", request.user_feedback)\
                                   .replace("{current_code}", request.current_code)
        
        messages = [
            {"role": "system", "content": "你是一个精准的代码修改助手。"},
            {"role": "user", "content": prompt}
        ]
        
        return StreamingResponse(
            llm_service.chat_completion_stream(messages, model=request.model),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            }
        )
    except Exception as e:
        print(f"ERROR in stream_partial_edit: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stream/requirements")
async def stream_requirements(
    request: RequirementRequest, 
    current_user: User = Depends(get_current_user),
    licensed: bool = Depends(verify_license)
):
    # Usage tracking could go here
    if request.current_content:
        # Refinement Mode
        content = REFINE_REQUIREMENTS_PROMPT.replace("{current_content}", request.current_content)\
                                           .replace("{feedback}", request.raw_requirement)
        messages = [
            {"role": "system", "content": content}
        ]
    else:
        # Generation Mode
        messages = [
            {"role": "system", "content": REQUIREMENTS_PROMPT},
            {"role": "user", "content": request.raw_requirement}
        ]
        
    return StreamingResponse(
        llm_service.chat_completion_stream(messages, model=request.model),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )

@router.post("/stream/product")
async def stream_product_doc(
    request: ProductDocRequest, 
    current_user: User = Depends(get_current_user),
    licensed: bool = Depends(verify_license)
):
    if request.current_content:
        # Refinement Mode
        content = REFINE_PRODUCT_DOC_PROMPT.replace("{current_content}", request.current_content)\
                                          .replace("{feedback}", request.feedback or "Please improve based on requirements.")
        messages = [
            {"role": "system", "content": content}
        ]
    else:
        # Generation Mode
        messages = [
            {"role": "system", "content": PRODUCT_DOC_PROMPT},
            {"role": "user", "content": f"基于以下需求文档生成PRD：\n\n{request.requirements_doc}"}
        ]
    return StreamingResponse(
        llm_service.chat_completion_stream(messages, model=request.model),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )

@router.post("/stream/technical")
async def stream_tech_doc(
    request: TechDocRequest, 
    current_user: User = Depends(get_current_user),
    licensed: bool = Depends(verify_license)
):
    if request.current_content:
        # Refinement Mode
        content = REFINE_TECHNICAL_DOC_PROMPT.replace("{current_content}", request.current_content)\
                                            .replace("{feedback}", request.feedback or "Please improve based on PRD.")
        messages = [
            {"role": "system", "content": content}
        ]
    else:
        # Generation Mode
        messages = [
            {"role": "system", "content": TECHNICAL_DOC_PROMPT},
            {"role": "user", "content": f"基于以下PRD生成技术方案：\n\n{request.product_doc}"}
        ]
    return StreamingResponse(
        llm_service.chat_completion_stream(messages, model=request.model),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )

@router.post("/stream/demo")
async def stream_demo(
    request: DemoRequest, 
    current_user: User = Depends(get_current_user),
    licensed: bool = Depends(verify_license)
):
    if request.current_content:
        # Refinement Mode
        content = ITERATION_PROMPT.replace("{current_code}", request.current_content)\
                                 .replace("{user_feedback}", request.feedback or "优化现有代码")
        messages = [
            {"role": "system", "content": content}
        ]
    else:
        # Construct a comprehensive prompt based on all available documents
        context_parts = []
        if request.requirements_doc:
            context_parts.append(f"【需求文档 (PRD 背景)】：\n{request.requirements_doc}")
        if request.product_doc:
            context_parts.append(f"【UI/交互设计文档】：\n{request.product_doc}")
        context_parts.append(f"【核心开发/技术文档】：\n{request.tech_doc}")
        
        full_context = "\n\n---\n\n".join(context_parts)
        
        messages = [
            {"role": "system", "content": DEMO_PROMPT},
            {"role": "user", "content": f"请结合以下全套设计文档，生成最终的高保真原型代码：\n\n{full_context}"}
        ]
        
    return StreamingResponse(
        llm_service.chat_completion_stream(messages, model=request.model),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )

@router.post("/stream/report")
async def stream_report(
    request: ReportRequest,
    current_user: User = Depends(get_current_user),
    licensed: bool = Depends(verify_license)
):
    """生成项目汇报报告"""
    req_doc = request.requirements_doc or "暂无需求文档"
    prod_doc = request.product_doc or "暂无设计文档"
    t_doc = request.tech_doc or "暂无技术文档"
    d_code = request.demo_code or "暂无原型代码"
    
    prompt = REPORT_PROMPT.replace("{requirements_doc}", req_doc)\
                         .replace("{product_doc}", prod_doc)\
                         .replace("{tech_doc}", t_doc)\
                         .replace("{demo_code}", d_code[:4000] + "..." if len(d_code) > 4000 else d_code)
    
    if request.feedback:
        prompt += f"\n\n用户的补充修改意见：{request.feedback}"
        
    messages = [
        {"role": "system", "content": "你是一个顶级的战略咨询顾问和项目汇报专家。"},
        {"role": "user", "content": prompt}
    ]
    
    return StreamingResponse(
        llm_service.chat_completion_stream(messages, model=request.model),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )

@router.post("/stream/iterate")
async def stream_iterate(
    request: IterateRequest, 
    current_user: User = Depends(get_current_user),
    licensed: bool = Depends(verify_license)
):
    messages = [
        {"role": "system", "content": ITERATION_PROMPT},
        {"role": "user", "content": f"当前代码：\n```html\n{request.current_code}\n```\n\n修改意见：{request.user_feedback}"}
    ]
    return StreamingResponse(
        llm_service.chat_completion_stream(messages, model=request.model),
        media_type="text/event-stream"
    )

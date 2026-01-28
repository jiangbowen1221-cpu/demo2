from pydantic import BaseModel
from typing import Optional

class BaseRequest(BaseModel):
    model: Optional[str] = None
    # If provided, this is a refinement request based on existing content
    current_content: Optional[str] = None 

class RequirementRequest(BaseRequest):
    raw_requirement: str # User input or feedback

class ProductDocRequest(BaseRequest):
    requirements_doc: str # Previous stage output
    feedback: Optional[str] = None # User feedback for refinement

class TechDocRequest(BaseRequest):
    product_doc: str # Previous stage output
    feedback: Optional[str] = None # User feedback for refinement

class DemoRequest(BaseRequest):
    tech_doc: str # Previous stage output
    requirements_doc: Optional[str] = None
    product_doc: Optional[str] = None
    feedback: Optional[str] = None # User feedback for refinement

class ReportRequest(BaseRequest):
    requirements_doc: Optional[str] = ""
    product_doc: Optional[str] = ""
    tech_doc: Optional[str] = ""
    demo_code: Optional[str] = ""
    feedback: Optional[str] = None

class IterateRequest(BaseModel):
    current_code: str
    user_feedback: str
    model: Optional[str] = None

class SelectedElement(BaseModel):
    selector: str
    html: str
    traceId: Optional[str] = None

class PartialEditRequest(BaseModel):
    current_code: str
    user_feedback: str
    selected_elements: list[SelectedElement]
    model: Optional[str] = None

class GenerationResponse(BaseModel):
    content: str
    status: str = "success"

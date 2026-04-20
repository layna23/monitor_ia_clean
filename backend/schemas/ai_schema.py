from pydantic import BaseModel
from typing import List, Optional


class MetricInput(BaseModel):
    code: str
    value: str | int | float
    severity: Optional[str] = "UNKNOWN"
    unit: Optional[str] = None


class AIAnalyzeRequest(BaseModel):
    db_name: str
    db_type: Optional[str] = "ORACLE"
    metrics: List[MetricInput]


class AIAnalyzeResponse(BaseModel):
    success: bool
    analysis: str
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class MetricRunBase(BaseModel):
    metric_id: int
    db_id: int
    status: str = Field(..., max_length=20)  # SUCCESS / FAILED
    duration_ms: Optional[int] = None
    error_message: Optional[str] = Field(default=None, max_length=4000)
    value_id: Optional[int] = None


class MetricRunCreate(MetricRunBase):
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None


class MetricRunUpdate(BaseModel):
    status: Optional[str] = Field(default=None, max_length=20)
    ended_at: Optional[datetime] = None
    duration_ms: Optional[int] = None
    error_message: Optional[str] = Field(default=None, max_length=4000)
    value_id: Optional[int] = None


class MetricRunOut(MetricRunBase):
    run_id: int
    started_at: datetime
    ended_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class MetricDefBase(BaseModel):
    metric_code: str = Field(..., max_length=50)
    db_type_id: int
    unit: Optional[str] = Field(default=None, max_length=30)

    frequency_sec: int = 300
    warn_threshold: Optional[float] = None
    crit_threshold: Optional[float] = None

    is_active: int = 1
    sql_query: str


class MetricDefCreate(MetricDefBase):
    pass


class MetricDefUpdate(BaseModel):
    metric_code: Optional[str] = Field(default=None, max_length=50)
    db_type_id: Optional[int] = None
    unit: Optional[str] = Field(default=None, max_length=30)

    frequency_sec: Optional[int] = None
    warn_threshold: Optional[float] = None
    crit_threshold: Optional[float] = None

    is_active: Optional[int] = None
    sql_query: Optional[str] = None


class MetricDefOut(MetricDefBase):
    metric_id: int
    created_at: datetime

    model_config = {"from_attributes": True}
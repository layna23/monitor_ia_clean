from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class AlertBase(BaseModel):
    db_id: int
    metric_id: int

    severity: str = Field(..., max_length=20)  # WARNING / CRITICAL
    status: str = Field(..., max_length=20)    # OPEN / ACK / RESOLVED

    title: str = Field(..., max_length=300)
    details: Optional[str] = Field(default=None, max_length=2000)
    last_value: Optional[str] = Field(default=None, max_length=200)


class AlertCreate(AlertBase):
    # facultatif, sinon DB met CURRENT_TIMESTAMP
    created_at: Optional[datetime] = None


class AlertUpdate(BaseModel):
    severity: Optional[str] = Field(default=None, max_length=20)
    status: Optional[str] = Field(default=None, max_length=20)
    title: Optional[str] = Field(default=None, max_length=300)
    details: Optional[str] = Field(default=None, max_length=2000)
    last_value: Optional[str] = Field(default=None, max_length=200)

    updated_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None


class AlertOut(AlertBase):
    alert_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
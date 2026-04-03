from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class AuditLogBase(BaseModel):
    user_id: Optional[int] = None
    user_email: Optional[str] = Field(default=None, max_length=255)

    action_type: str = Field(..., max_length=100)

    entity_type: Optional[str] = Field(default=None, max_length=100)
    entity_id: Optional[int] = None

    description: Optional[str] = Field(default=None, max_length=2000)
    ip_address: Optional[str] = Field(default=None, max_length=100)


class AuditLogCreate(AuditLogBase):
    event_time: Optional[datetime] = None


class AuditLogUpdate(BaseModel):
    user_id: Optional[int] = None
    user_email: Optional[str] = Field(default=None, max_length=255)

    action_type: Optional[str] = Field(default=None, max_length=100)

    entity_type: Optional[str] = Field(default=None, max_length=100)
    entity_id: Optional[int] = None

    description: Optional[str] = Field(default=None, max_length=2000)
    ip_address: Optional[str] = Field(default=None, max_length=100)


class AuditLogOut(AuditLogBase):
    audit_id: int
    event_time: datetime

    model_config = {"from_attributes": True}
from typing import Optional
from pydantic import BaseModel, field_validator


class DbTypeCreate(BaseModel):
    code: str
    name: str
    version: Optional[str] = None
    driver: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = "ACTIVE"

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: str) -> str:
        v = v.strip().upper()
        if not v:
            raise ValueError("code is required")
        return v

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name is required")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> str:
        status = (v or "ACTIVE").strip().upper()
        if status not in {"ACTIVE", "INACTIVE", "BETA"}:
            raise ValueError("invalid status")
        return status


class DbTypeUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    version: Optional[str] = None
    driver: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return v.strip().upper()

    @field_validator("name")
    @classmethod
    def normalize_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return v.strip()

    @field_validator("status")
    @classmethod
    def normalize_status(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        status = v.strip().upper()
        if status not in {"ACTIVE", "INACTIVE", "BETA"}:
            raise ValueError("invalid status")
        return status


class DbTypeOut(BaseModel):
    db_type_id: int
    code: str
    name: str
    version: Optional[str] = None
    driver: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None

    class Config:
        from_attributes = True
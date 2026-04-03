from pydantic import BaseModel
from typing import Optional


class DbTypeCreate(BaseModel):
    code: str
    name: str
    version: Optional[str] = None
    driver: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


class DbTypeUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    version: Optional[str] = None
    driver: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


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
from pydantic import BaseModel
from typing import Optional

class RoleBase(BaseModel):
    role_code: str
    role_name: str


class RoleCreate(RoleBase):
    pass


class RoleUpdate(BaseModel):
    role_code: Optional[str] = None
    role_name: Optional[str] = None


class RoleOut(RoleBase):
    role_id: int

    class Config:
        from_attributes = True
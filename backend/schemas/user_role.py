from pydantic import BaseModel


class UserRoleCreate(BaseModel):
    user_id: int
    role_id: int


class UserRoleOut(BaseModel):
    user_id: int
    role_id: int

    class Config:
        from_attributes = True
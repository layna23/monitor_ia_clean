from pydantic import BaseModel, EmailStr


class LoginPayload(BaseModel):
    email: EmailStr
    password: str


class RoleOut(BaseModel):
    role_id: int
    role_code: str
    role_name: str


class UserOut(BaseModel):
    user_id: int
    email: EmailStr
    full_name: str | None = None
    is_active: int


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
    roles: list[RoleOut]
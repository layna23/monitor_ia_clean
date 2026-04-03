from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional


class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None   # ✅ optionnel
    is_active: int = 1                # ✅ défaut = 1


class UserCreate(UserBase):
    password: str                     # ✅ obligatoire pour create


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    is_active: Optional[int] = None
    password: Optional[str] = None    # ✅ si tu veux modifier mdp


class UserOut(BaseModel):
    user_id: int
    email: EmailStr
    full_name: Optional[str] = None   # ✅ optionnel
    is_active: int
    created_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None

    class Config:
        from_attributes = True
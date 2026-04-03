from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from jose import jwt
from passlib.context import CryptContext

from backend.database.session import get_db
from backend.models.users import User
from backend.models.role import Role
from backend.models.user_role import UserRole

router = APIRouter(prefix="/auth", tags=["Auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

JWT_SECRET = "CHANGE_ME_SECRET"
JWT_ALG = "HS256"
JWT_EXPIRE_MIN = 60 * 24  # 24h


class LoginPayload(BaseModel):
    email: EmailStr
    password: str


def create_access_token(data: dict):
    expire = datetime.utcnow() + timedelta(minutes=JWT_EXPIRE_MIN)
    to_encode = {**data, "exp": expire}
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALG)


@router.post("/login")
def login(payload: LoginPayload, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")

    if int(user.is_active) != 1:
        raise HTTPException(status_code=403, detail="Compte désactivé")

    password_hash = user.password_hash

    # Si tu avais déjà des anciens users avec password en clair => ça provoque UnknownHashError
    # Donc ici on protège pour renvoyer une erreur claire :
    try:
        ok = pwd_context.verify(payload.password, password_hash)
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Le mot de passe en base n'est pas un hash bcrypt valide. Recrée l'utilisateur avec /users.",
        )

    if not ok:
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")

    roles = (
        db.query(Role.role_id, Role.role_code, Role.role_name)
        .join(UserRole, UserRole.role_id == Role.role_id)
        .filter(UserRole.user_id == user.user_id)
        .all()
    )

    roles_out = [
        {"role_id": int(r.role_id), "role_code": r.role_code, "role_name": r.role_name}
        for r in roles
    ]

    token = create_access_token({"sub": str(int(user.user_id)), "email": user.email})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "user_id": int(user.user_id),
            "email": user.email,
            "full_name": user.full_name,
            "is_active": int(user.is_active),
        },
        "roles": roles_out,
    }
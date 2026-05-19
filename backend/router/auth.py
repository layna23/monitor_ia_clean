from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from passlib.context import CryptContext

from backend.database.session import get_db
from backend.models.users import User
from backend.models.role import Role
from backend.models.user_role import UserRole

router = APIRouter(prefix="/auth", tags=["Auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

JWT_SECRET = "CHANGE_ME_SECRET"
JWT_ALG = "HS256"
JWT_EXPIRE_MIN = 60 * 24

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


class LoginPayload(BaseModel):
    email: EmailStr
    password: str


def create_access_token(data: dict):
    expire = datetime.utcnow() + timedelta(minutes=JWT_EXPIRE_MIN)
    to_encode = {**data, "exp": expire}
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALG)


def get_user_role(db: Session, user_id: int):
    role = (
        db.query(Role.role_id, Role.role_code, Role.role_name)
        .join(UserRole, UserRole.role_id == Role.role_id)
        .filter(UserRole.user_id == user_id)
        .first()
    )

    if not role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Aucun rôle affecté à cet utilisateur",
        )

    return {
        "role_id": int(role.role_id),
        "role_code": role.role_code,
        "role_name": role.role_name,
    }


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        user_id = payload.get("sub")

        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token invalide",
            )

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide ou expiré",
        )

    user = db.query(User).filter(User.user_id == int(user_id)).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Utilisateur introuvable",
        )

    if int(user.is_active) != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte désactivé",
        )

    role = get_user_role(db, int(user.user_id))

    return {
        "user_id": int(user.user_id),
        "email": user.email,
        "full_name": user.full_name,
        "is_active": int(user.is_active),
        "role": role,
    }


def require_roles(allowed_roles: list[str]):
    def checker(current_user: dict = Depends(get_current_user)):
        user_role_code = current_user["role"]["role_code"]

        if user_role_code not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Accès refusé",
            )

        return current_user

    return checker


@router.post("/login")
def login(payload: LoginPayload, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
        )

    if int(user.is_active) != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte désactivé",
        )

    try:
        ok = pwd_context.verify(payload.password, user.password_hash)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Le mot de passe en base n'est pas un hash bcrypt valide. Recrée l'utilisateur avec /users.",
        )

    if not ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
        )

    role = get_user_role(db, int(user.user_id))

    token = create_access_token(
        {
            "sub": str(int(user.user_id)),
            "email": user.email,
            "role": role["role_code"],
        }
    )

    user.last_login_at = datetime.utcnow()
    db.commit()

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "user_id": int(user.user_id),
            "email": user.email,
            "full_name": user.full_name,
            "is_active": int(user.is_active),
            "role": role,
        },
    }


@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    return current_user
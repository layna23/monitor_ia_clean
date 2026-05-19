from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from passlib.context import CryptContext

from backend.database.session import get_db
from backend.models.users import User
from backend.models.role import Role
from backend.models.user_role import UserRole
from backend.schemas.users import UserCreate, UserUpdate, UserOut
from backend.router.auth import require_roles

router = APIRouter(prefix="/users", tags=["Users"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _hash_password(raw_pwd: str) -> str:
    raw_pwd = (raw_pwd or "").strip()

    if len(raw_pwd.encode("utf-8")) > 72:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le mot de passe ne doit pas dépasser 72 caractères (bcrypt).",
        )

    return pwd_context.hash(raw_pwd)


def _check_role_exists(role_id: int, db: Session):
    role = db.query(Role).filter(Role.role_id == role_id).first()

    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rôle introuvable",
        )

    return role


@router.get("/", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["SUPER_ADMIN", "ADMIN"])),
):
    return db.query(User).order_by(User.user_id.asc()).all()


@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["SUPER_ADMIN", "ADMIN"])),
):
    exists = db.query(User).filter(User.email == payload.email).first()

    if exists:
        raise HTTPException(status_code=400, detail="email already exists")

    role = _check_role_exists(payload.role_id, db)

    current_role = current_user["role"]["role_code"]
    new_user_role = role.role_code

    if current_role == "ADMIN" and new_user_role == "SUPER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Un ADMIN ne peut pas créer un SUPER_ADMIN",
        )

    hashed_password = _hash_password(payload.password)

    user = User(
        email=payload.email,
        full_name=payload.full_name,
        is_active=payload.is_active,
        created_at=datetime.utcnow(),
        last_login_at=None,
        password_hash=hashed_password,
    )

    try:
        db.add(user)
        db.flush()

        user_role = UserRole(
            user_id=user.user_id,
            role_id=payload.role_id,
        )

        db.add(user_role)
        db.commit()
        db.refresh(user)

        return user

    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"DB integrity error: {str(e.orig)}",
        )


@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["SUPER_ADMIN", "ADMIN"])),
):
    user = db.query(User).filter(User.user_id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="user not found")

    return user


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["SUPER_ADMIN", "ADMIN"])),
):
    user = db.query(User).filter(User.user_id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="user not found")

    if payload.email and payload.email != user.email:
        exists = db.query(User).filter(User.email == payload.email).first()

        if exists:
            raise HTTPException(status_code=400, detail="email already exists")

        user.email = payload.email

    if payload.full_name is not None:
        user.full_name = payload.full_name

    if payload.is_active is not None:
        user.is_active = payload.is_active

    if payload.password:
        user.password_hash = _hash_password(payload.password)

    if payload.role_id is not None:
        role = _check_role_exists(payload.role_id, db)

        current_role = current_user["role"]["role_code"]
        new_role = role.role_code

        if current_role == "ADMIN" and new_role == "SUPER_ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Un ADMIN ne peut pas affecter le rôle SUPER_ADMIN",
            )

        current_user_role = (
            db.query(UserRole)
            .filter(UserRole.user_id == user.user_id)
            .first()
        )

        if current_user_role:
            current_user_role.role_id = payload.role_id
        else:
            db.add(
                UserRole(
                    user_id=user.user_id,
                    role_id=payload.role_id,
                )
            )

    try:
        db.commit()

    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"DB integrity error: {str(e.orig)}",
        )

    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["SUPER_ADMIN"])),
):
    user = db.query(User).filter(User.user_id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="user not found")

    if int(current_user["user_id"]) == int(user.user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous ne pouvez pas supprimer votre propre compte",
        )

    try:
        db.query(UserRole).filter(UserRole.user_id == user.user_id).delete()

        db.delete(user)
        db.commit()

    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=f"Impossible de supprimer: utilisateur lié à d'autres tables. {str(e.orig)}",
        )

    return None
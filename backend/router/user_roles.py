from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from backend.database.session import get_db
from backend.models.user_role import UserRole
from backend.schemas.user_role import UserRoleCreate, UserRoleOut
from backend.router.auth import require_roles

router = APIRouter(prefix="/user-roles", tags=["User Roles"])


@router.get("/", response_model=list[UserRoleOut])
def list_user_roles(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["SUPER_ADMIN", "ADMIN"])),
):
    return db.query(UserRole).all()


@router.post("/", response_model=UserRoleOut, status_code=status.HTTP_201_CREATED)
def assign_role(
    payload: UserRoleCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["SUPER_ADMIN", "ADMIN"])),
):
    from backend.models.users import User
    from backend.models.role import Role

    user = db.query(User).filter(User.user_id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    role = db.query(Role).filter(Role.role_id == payload.role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Rôle introuvable")

    current_role = current_user["role"]["role_code"]

    if current_role == "ADMIN" and role.role_code == "SUPER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Un ADMIN ne peut pas affecter le rôle SUPER_ADMIN",
        )

    existing_role = (
        db.query(UserRole)
        .filter(UserRole.user_id == payload.user_id)
        .first()
    )

    if existing_role:
        raise HTTPException(
            status_code=409,
            detail="Cet utilisateur possède déjà un rôle",
        )

    obj = UserRole(
        user_id=payload.user_id,
        role_id=payload.role_id,
    )

    db.add(obj)

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"Erreur d'intégrité: {str(e.orig)}",
        )

    db.refresh(obj)
    return obj


@router.put("/", response_model=UserRoleOut)
def update_user_role(
    user_id: int,
    role_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["SUPER_ADMIN", "ADMIN"])),
):
    from backend.models.users import User
    from backend.models.role import Role

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    role = db.query(Role).filter(Role.role_id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Rôle introuvable")

    current_role = current_user["role"]["role_code"]

    if current_role == "ADMIN" and role.role_code == "SUPER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Un ADMIN ne peut pas affecter le rôle SUPER_ADMIN",
        )

    obj = db.query(UserRole).filter(UserRole.user_id == user_id).first()

    if not obj:
        obj = UserRole(
            user_id=user_id,
            role_id=role_id,
        )
        db.add(obj)
    else:
        obj.role_id = role_id

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"Erreur d'intégrité: {str(e.orig)}",
        )

    db.refresh(obj)
    return obj


@router.delete("/", status_code=status.HTTP_204_NO_CONTENT)
def unassign_role(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["SUPER_ADMIN"])),
):
    obj = db.query(UserRole).filter(UserRole.user_id == user_id).first()

    if not obj:
        raise HTTPException(status_code=404, detail="Affectation introuvable")

    if int(current_user["user_id"]) == int(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous ne pouvez pas retirer votre propre rôle",
        )

    db.delete(obj)
    db.commit()

    return None


@router.get("/by-user/{user_id}")
def roles_by_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["SUPER_ADMIN", "ADMIN"])),
):
    from backend.models.role import Role

    rows = (
        db.query(Role.role_id, Role.role_code, Role.role_name)
        .join(UserRole, UserRole.role_id == Role.role_id)
        .filter(UserRole.user_id == user_id)
        .order_by(Role.role_id)
        .all()
    )

    return [
        {
            "role_id": int(r.role_id),
            "role_code": r.role_code,
            "role_name": r.role_name,
        }
        for r in rows
    ]
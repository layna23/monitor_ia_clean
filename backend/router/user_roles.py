from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from backend.database.session import get_db
from backend.models.user_role import UserRole
from backend.schemas.user_role import UserRoleCreate, UserRoleOut

router = APIRouter(prefix="/user-roles", tags=["User Roles"])


@router.get("/", response_model=list[UserRoleOut])
def list_user_roles(db: Session = Depends(get_db)):
    return db.query(UserRole).all()


@router.post("/", response_model=UserRoleOut, status_code=status.HTTP_201_CREATED)
def assign_role(payload: UserRoleCreate, db: Session = Depends(get_db)):
    # ✅ Imports ici (lazy import) pour éviter circular import
    from backend.models.users import User
    from backend.models.role import Role

    # vérifier existence user/role
    u = db.query(User).filter(User.user_id == payload.user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    r = db.query(Role).filter(Role.role_id == payload.role_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Rôle introuvable")

    # empêcher doublon
    exists = (
        db.query(UserRole)
        .filter(UserRole.user_id == payload.user_id, UserRole.role_id == payload.role_id)
        .first()
    )
    if exists:
        raise HTTPException(status_code=409, detail="Affectation déjà existante")

    obj = UserRole(user_id=payload.user_id, role_id=payload.role_id)
    db.add(obj)

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Erreur d'intégrité: {str(e.orig)}")

    db.refresh(obj)
    return obj


@router.delete("/", status_code=status.HTTP_204_NO_CONTENT)
def unassign_role(user_id: int, role_id: int, db: Session = Depends(get_db)):
    obj = (
        db.query(UserRole)
        .filter(UserRole.user_id == user_id, UserRole.role_id == role_id)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Affectation introuvable")

    db.delete(obj)
    db.commit()
    return


@router.get("/by-user/{user_id}")
def roles_by_user(user_id: int, db: Session = Depends(get_db)):
    # ✅ Imports ici (lazy import) pour éviter circular import
    from backend.models.role import Role

    rows = (
        db.query(Role.role_id, Role.role_code, Role.role_name)
        .join(UserRole, UserRole.role_id == Role.role_id)
        .filter(UserRole.user_id == user_id)
        .order_by(Role.role_id)
        .all()
    )

    return [
        {"role_id": int(r.role_id), "role_code": r.role_code, "role_name": r.role_name}
        for r in rows
    ]
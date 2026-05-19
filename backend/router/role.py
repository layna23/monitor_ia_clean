from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.models.role import Role
from backend.schemas.role import RoleCreate, RoleUpdate, RoleOut
from backend.router.auth import require_roles

router = APIRouter(prefix="/roles", tags=["Roles"])


@router.get("/", response_model=list[RoleOut])
def list_roles(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["SUPER_ADMIN"])),
):
    return db.query(Role).order_by(Role.role_id.asc()).all()


@router.get("/{role_id}", response_model=RoleOut)
def get_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["SUPER_ADMIN"])),
):
    role = db.query(Role).filter(Role.role_id == role_id).first()

    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    return role


@router.post("/", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
def create_role(
    payload: RoleCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["SUPER_ADMIN"])),
):
    exists = db.query(Role).filter(Role.role_code == payload.role_code).first()

    if exists:
        raise HTTPException(status_code=400, detail="role_code already exists")

    role = Role(
        role_code=payload.role_code,
        role_name=payload.role_name,
    )

    db.add(role)
    db.commit()
    db.refresh(role)

    return role


@router.put("/{role_id}", response_model=RoleOut)
def update_role(
    role_id: int,
    payload: RoleUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["SUPER_ADMIN"])),
):
    role = db.query(Role).filter(Role.role_id == role_id).first()

    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    if payload.role_code is not None and payload.role_code != role.role_code:
        exists = db.query(Role).filter(Role.role_code == payload.role_code).first()

        if exists:
            raise HTTPException(status_code=400, detail="role_code already exists")

        role.role_code = payload.role_code

    if payload.role_name is not None:
        role.role_name = payload.role_name

    db.commit()
    db.refresh(role)

    return role


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles(["SUPER_ADMIN"])),
):
    role = db.query(Role).filter(Role.role_id == role_id).first()

    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    protected_roles = [
        "SUPER_ADMIN",
        "ADMIN",
        "CONSULTANT",
        "SIMPLE_USER",
    ]

    if role.role_code in protected_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Impossible de supprimer un rôle système",
        )

    db.delete(role)
    db.commit()

    return None
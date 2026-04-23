from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.models.db_type import DbType
from backend.schemas.db_type import DbTypeCreate, DbTypeOut, DbTypeUpdate

router = APIRouter(prefix="/db-types", tags=["DB Types"])


@router.get("/", response_model=list[DbTypeOut])
def list_db_types(db: Session = Depends(get_db)):
    return db.query(DbType).order_by(DbType.db_type_id).all()


@router.post("/", response_model=DbTypeOut)
def create_db_type(payload: DbTypeCreate, db: Session = Depends(get_db)):
    code = payload.code.strip().upper()
    name = payload.name.strip()

    if not code:
        raise HTTPException(status_code=400, detail="CODE is required")

    if not name:
        raise HTTPException(status_code=400, detail="NAME is required")

    exists = db.query(DbType).filter(DbType.code == code).first()
    if exists:
        raise HTTPException(status_code=400, detail="CODE already exists")

    status = (payload.status or "ACTIVE").strip().upper()
    if status not in {"ACTIVE", "INACTIVE", "BETA"}:
        raise HTTPException(status_code=400, detail="Invalid status")

    obj = DbType(
        code=code,
        name=name,
        version=payload.version.strip() if payload.version else None,
        driver=payload.driver.strip() if payload.driver else None,
        description=payload.description.strip() if payload.description else None,
        status=status,
    )

    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{db_type_id}", response_model=DbTypeOut)
def update_db_type(db_type_id: int, payload: DbTypeUpdate, db: Session = Depends(get_db)):
    obj = db.query(DbType).filter(DbType.db_type_id == db_type_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="DB Type not found")

    if payload.code is not None:
        new_code = payload.code.strip().upper()
        if not new_code:
            raise HTTPException(status_code=400, detail="CODE cannot be empty")

        if new_code != obj.code:
            exists = db.query(DbType).filter(DbType.code == new_code).first()
            if exists:
                raise HTTPException(status_code=400, detail="CODE already exists")
        obj.code = new_code

    if payload.name is not None:
        new_name = payload.name.strip()
        if not new_name:
            raise HTTPException(status_code=400, detail="NAME cannot be empty")
        obj.name = new_name

    if payload.version is not None:
        obj.version = payload.version.strip() if payload.version else None

    if payload.driver is not None:
        obj.driver = payload.driver.strip() if payload.driver else None

    if payload.description is not None:
        obj.description = payload.description.strip() if payload.description else None

    if payload.status is not None:
        new_status = payload.status.strip().upper() if payload.status else "ACTIVE"
        if new_status not in {"ACTIVE", "INACTIVE", "BETA"}:
            raise HTTPException(status_code=400, detail="Invalid status")
        obj.status = new_status

    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{db_type_id}")
def delete_db_type(
    db_type_id: int,
    soft: bool = Query(False, description="Soft delete: status=INACTIVE"),
    db: Session = Depends(get_db),
):
    obj = db.query(DbType).filter(DbType.db_type_id == db_type_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="DB Type not found")

    if soft:
        obj.status = "INACTIVE"
        db.commit()
        db.refresh(obj)
        return {"success": True, "message": "DB Type deactivated (status=INACTIVE)"}

    db.delete(obj)
    db.commit()
    return {"success": True, "message": "DB Type deleted"}
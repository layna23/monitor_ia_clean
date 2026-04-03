from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.models.db_type import DbType
from backend.schemas.db_type import DbTypeCreate, DbTypeOut, DbTypeUpdate

router = APIRouter(prefix="/db-types", tags=["DB Types"])


@router.get("/", response_model=list[DbTypeOut])
def list_db_types(db: Session = Depends(get_db)):
    return db.query(DbType).all()


@router.post("/", response_model=DbTypeOut)
def create_db_type(payload: DbTypeCreate, db: Session = Depends(get_db)):
    # check unique code
    exists = db.query(DbType).filter(DbType.code == payload.code).first()
    if exists:
        raise HTTPException(status_code=400, detail="CODE already exists")

    obj = DbType(
        code=payload.code,
        name=payload.name,
        version=payload.version,
        driver=payload.driver,
        description=payload.description,
        status=payload.status if payload.status else None,  # si None => default DB
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

    # si on modifie le code, vérifier unicité
    if payload.code and payload.code != obj.code:
        exists = db.query(DbType).filter(DbType.code == payload.code).first()
        if exists:
            raise HTTPException(status_code=400, detail="CODE already exists")

    # update champs (uniquement si fourni)
    if payload.code is not None:
        obj.code = payload.code
    if payload.name is not None:
        obj.name = payload.name
    if payload.version is not None:
        obj.version = payload.version
    if payload.driver is not None:
        obj.driver = payload.driver
    if payload.description is not None:
        obj.description = payload.description
    if payload.status is not None:
        obj.status = payload.status

    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{db_type_id}")
def delete_db_type(
    db_type_id: int,
    soft: bool = Query(True, description="Soft delete: status=INACTIVE (recommended)"),
    db: Session = Depends(get_db)
):
    obj = db.query(DbType).filter(DbType.db_type_id == db_type_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="DB Type not found")

    if soft:
        # suppression logique
        obj.status = "INACTIVE"
        db.commit()
        return {"success": True, "message": "DB Type deactivated (status=INACTIVE)"}

    # suppression physique
    db.delete(obj)
    db.commit()
    return {"success": True, "message": "DB Type deleted"}
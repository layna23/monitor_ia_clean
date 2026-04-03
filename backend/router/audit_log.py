from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text

from backend.database.session import get_db
from backend.models.audit_log import AuditLog
from backend.schemas.audit_log import AuditLogCreate, AuditLogOut, AuditLogUpdate

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])

AUDIT_SEQ = "DBMON.AUDIT_LOG_SEQ"  # à créer dans Oracle


@router.get("/", response_model=list[AuditLogOut])
def list_audit_logs(db: Session = Depends(get_db)):
    return db.query(AuditLog).order_by(AuditLog.audit_id.desc()).all()


@router.get("/{audit_id}", response_model=AuditLogOut)
def get_audit_log(audit_id: int, db: Session = Depends(get_db)):
    obj = db.query(AuditLog).filter(AuditLog.audit_id == audit_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="AuditLog not found")
    return obj


@router.post("/", response_model=AuditLogOut, status_code=status.HTTP_201_CREATED)
def create_audit_log(payload: AuditLogCreate, db: Session = Depends(get_db)):
    # ✅ ID via SEQUENCE
    try:
        next_id = db.execute(text(f"SELECT {AUDIT_SEQ}.NEXTVAL FROM DUAL")).scalar()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Cannot get NEXTVAL from {AUDIT_SEQ}. Create it first. Error: {str(e)}",
        )

    obj = AuditLog(
        audit_id=next_id,
        event_time=payload.event_time or datetime.now(),
        user_id=payload.user_id,
        user_email=payload.user_email,
        action_type=payload.action_type,
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        description=payload.description,
        ip_address=payload.ip_address,
    )

    db.add(obj)
    try:
        db.commit()
        db.refresh(obj)
        return obj
    except IntegrityError as e:
        db.rollback()
        msg = str(e.orig)

        if "ORA-02291" in msg:
            raise HTTPException(status_code=409, detail=f"Invalid FK USER_ID (not in USERS). {msg}")
        if "ORA-01400" in msg:
            raise HTTPException(status_code=409, detail=f"Missing required field (NOT NULL). {msg}")
        if "ORA-00001" in msg:
            raise HTTPException(status_code=409, detail=f"Duplicate key (PK/UNIQUE). {msg}")

        raise HTTPException(status_code=500, detail=f"Integrity error: {msg}")


@router.put("/{audit_id}", response_model=AuditLogOut)
def update_audit_log(audit_id: int, payload: AuditLogUpdate, db: Session = Depends(get_db)):
    obj = db.query(AuditLog).filter(AuditLog.audit_id == audit_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="AuditLog not found")

    data = payload.model_dump(exclude_unset=True)

    for k, v in data.items():
        setattr(obj, k, v)

    try:
        db.commit()
        db.refresh(obj)
        return obj
    except IntegrityError as e:
        db.rollback()
        msg = str(e.orig)

        if "ORA-02291" in msg:
            raise HTTPException(status_code=409, detail=f"Invalid FK USER_ID. {msg}")

        raise HTTPException(status_code=500, detail=f"Integrity error: {msg}")


@router.delete("/{audit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_audit_log(audit_id: int, db: Session = Depends(get_db)):
    obj = db.query(AuditLog).filter(AuditLog.audit_id == audit_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="AuditLog not found")

    try:
        db.delete(obj)
        db.commit()
        return
    except IntegrityError as e:
        db.rollback()
        msg = str(e.orig)
        raise HTTPException(status_code=500, detail=f"Integrity error: {msg}")
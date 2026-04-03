from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text

from backend.database.session import get_db
from backend.models.alerts import Alert
from backend.schemas.alerts import AlertCreate, AlertOut, AlertUpdate

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.get("/", response_model=list[AlertOut])
def list_alerts(db: Session = Depends(get_db)):
    return db.query(Alert).order_by(Alert.alert_id.desc()).all()


@router.get("/{alert_id}", response_model=AlertOut)
def get_alert(alert_id: int, db: Session = Depends(get_db)):
    obj = db.query(Alert).filter(Alert.alert_id == alert_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Alert not found")
    return obj


@router.post("/", response_model=AlertOut, status_code=status.HTTP_201_CREATED)
def create_alert(payload: AlertCreate, db: Session = Depends(get_db)):
    # ✅ ID via sequence DBMON
    try:
        next_id = db.execute(text("SELECT DBMON.ALERTS_SEQ.NEXTVAL FROM DUAL")).scalar()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Cannot get NEXTVAL from DBMON.ALERTS_SEQ. Error: {str(e)}",
        )

    obj = Alert(
        alert_id=next_id,
        db_id=payload.db_id,
        metric_id=payload.metric_id,
        severity=payload.severity,
        status=payload.status,
        title=payload.title,
        details=payload.details,
        last_value=payload.last_value,
        created_at=payload.created_at or datetime.now(),
    )

    db.add(obj)
    try:
        db.commit()
        db.refresh(obj)
        return obj

    except IntegrityError as e:
        db.rollback()
        msg = str(e.orig)

        if "ORA-00001" in msg:
            raise HTTPException(status_code=409, detail=f"Duplicate key (PK/UNIQUE). {msg}")
        if "ORA-02291" in msg:
            raise HTTPException(status_code=409, detail=f"Invalid FK (db_id/metric_id). {msg}")
        if "ORA-01400" in msg:
            raise HTTPException(status_code=409, detail=f"Missing required field (NOT NULL). {msg}")

        raise HTTPException(status_code=500, detail=f"Integrity error: {msg}")


@router.put("/{alert_id}", response_model=AlertOut)
def update_alert(alert_id: int, payload: AlertUpdate, db: Session = Depends(get_db)):
    obj = db.query(Alert).filter(Alert.alert_id == alert_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Alert not found")

    data = payload.model_dump(exclude_unset=True)

    # ✅ auto updated_at si pas fourni
    if "updated_at" not in data:
        data["updated_at"] = datetime.now()

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
            raise HTTPException(status_code=409, detail=f"Invalid FK. {msg}")

        raise HTTPException(status_code=500, detail=f"Integrity error: {msg}")


@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_alert(alert_id: int, db: Session = Depends(get_db)):
    obj = db.query(Alert).filter(Alert.alert_id == alert_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Alert not found")

    try:
        db.delete(obj)
        db.commit()
        return
    except IntegrityError as e:
        db.rollback()
        msg = str(e.orig)
        raise HTTPException(status_code=500, detail=f"Integrity error: {msg}")
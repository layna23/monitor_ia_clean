from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.schemas.ai_schema import AIAnalyzeRequest, AIAnalyzeResponse
from backend.services.ai_service import analyze_metrics
from backend.services.ai_db_service import analyze_database_from_db

router = APIRouter(prefix="/ai", tags=["AI"])


@router.post("/analyze", response_model=AIAnalyzeResponse)
def analyze_database(data: AIAnalyzeRequest):
    try:
        metrics_payload = [m.model_dump() for m in data.metrics]

        result = analyze_metrics(
            db_name=data.db_name,
            db_type=data.db_type or "ORACLE",
            metrics=metrics_payload,
        )

        return AIAnalyzeResponse(
            success=True,
            analysis=result,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analyze-db/{db_id}", response_model=AIAnalyzeResponse)
def analyze_database_from_collection(db_id: int, db: Session = Depends(get_db)):
    try:
        result = analyze_database_from_db(db, db_id)

        return AIAnalyzeResponse(
            success=True,
            analysis=result,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.services.collector_service import collect_one_metric

router = APIRouter(prefix="/execute", tags=["Execute Metrics"])


@router.post(
    "/{db_id}/{metric_id}",
    status_code=status.HTTP_201_CREATED,
)
def execute_metric(db_id: int, metric_id: int, db: Session = Depends(get_db)):
    """
    Exécute une métrique via le collector principal.
    La collecte réelle se fait sur la base cible (ex: Oracle),
    puis les résultats sont stockés dans la base applicative.
    """
    try:
        result = collect_one_metric(db, db_id, metric_id)

        if not result.get("success", False):
            raise HTTPException(
                status_code=500,
                detail=result.get("error", "Execution failed"),
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Execution failed: {str(e)}")
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class MetricValueBase(BaseModel):
    db_id: int
    metric_id: int

    value_number: Optional[float] = None
    value_text: Optional[str] = Field(default=None, max_length=4000)

    severity: str = Field(..., max_length=20)


class MetricValueCreate(MetricValueBase):
    # collected_at optionnel: si tu veux le donner, sinon DB met current_timestamp()
    collected_at: Optional[datetime] = None


class MetricValueUpdate(BaseModel):
    # en général on n’update pas une valeur historique, mais on le met quand même
    value_number: Optional[float] = None
    value_text: Optional[str] = Field(default=None, max_length=4000)
    severity: Optional[str] = Field(default=None, max_length=20)


class MetricValueOut(MetricValueBase):
    value_id: int
    collected_at: datetime

    model_config = {"from_attributes": True}


class MetricHistoryPoint(BaseModel):
    value_id: int
    value_number: Optional[float] = None
    value_text: Optional[str] = None
    severity: Optional[str] = None
    collected_at: datetime


class MetricDetailOut(BaseModel):
    metric_id: int
    metric_code: str
    metric_name: Optional[str] = None

    db_id: int
    db_name: str

    current_value_number: Optional[float] = None
    current_value_text: Optional[str] = None
    severity: Optional[str] = None
    collected_at: datetime

    warn_threshold: Optional[float] = None
    crit_threshold: Optional[float] = None
    frequency_sec: Optional[int] = None
    sql_query: Optional[str] = None

    history: List[MetricHistoryPoint] = []

    model_config = {"from_attributes": True}
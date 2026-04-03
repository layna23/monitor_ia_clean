from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ===== Base (champs communs) =====
class TargetDBBase(BaseModel):
    db_name: str = Field(..., max_length=255)
    db_type_id: int
    host: str = Field(..., max_length=255)
    port: int

    service_name: Optional[str] = Field(default=None, max_length=255)
    sid: Optional[str] = Field(default=None, max_length=255)

    username: str = Field(..., max_length=255)
    password_enc: Optional[str] = None

    collect_interval_sec: int = 300
    is_active: int = 1


# ===== Create =====
class TargetDBCreate(TargetDBBase):
    pass


# ===== Update =====
class TargetDBUpdate(BaseModel):
    db_name: Optional[str] = Field(default=None, max_length=255)
    db_type_id: Optional[int] = None
    host: Optional[str] = Field(default=None, max_length=255)
    port: Optional[int] = None

    service_name: Optional[str] = Field(default=None, max_length=255)
    sid: Optional[str] = Field(default=None, max_length=255)

    username: Optional[str] = Field(default=None, max_length=255)
    password_enc: Optional[str] = None

    collect_interval_sec: Optional[int] = None
    is_active: Optional[int] = None
    last_collect_at: Optional[datetime] = None


# ===== Out =====
class TargetDBOut(TargetDBBase):
    db_id: int
    last_collect_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ===== OVERVIEW =====
class TargetDBLatestMetricOut(BaseModel):
    metric_id: int
    metric_code: str
    value_number: Optional[float] = None
    value_text: Optional[str] = None
    severity: Optional[str] = None
    collected_at: Optional[datetime] = None

    # ✅ nouveaux champs utiles pour la vue globale
    sql_query: Optional[str] = None
    warn_threshold: Optional[float] = None
    crit_threshold: Optional[float] = None
    frequency_sec: Optional[int] = None
    unit: Optional[str] = None


class TargetDBOverviewOut(BaseModel):
    db_id: int
    db_name: str
    db_type_id: int
    host: str
    port: int
    service_name: Optional[str] = None
    sid: Optional[str] = None
    is_active: int
    last_collect_at: Optional[datetime] = None

    total_metric_values: int
    total_runs: int
    success_runs: int
    failed_runs: int
    success_rate: float

    latest_metrics: List[TargetDBLatestMetricOut]
from sqlalchemy import Column, String, Numeric, TIMESTAMP, ForeignKey, CLOB, func
from backend.database.session import Base


class MetricDef(Base):
    __tablename__ = "METRIC_DEFS"

    metric_id = Column("METRIC_ID", Numeric(22, 0), primary_key=True, index=True)

    metric_code = Column("METRIC_CODE", String(50), nullable=False, unique=True, index=True)

    db_type_id = Column(
        "DB_TYPE_ID",
        Numeric(22, 0),
        ForeignKey("DB_TYPES.DB_TYPE_ID"),
        nullable=False,
    )

    unit = Column("UNIT", String(30), nullable=True)
    frequency_sec = Column("FREQUENCY_SEC", Numeric(22, 0), nullable=False)

    warn_threshold = Column("WARN_THRESHOLD", Numeric(22, 0), nullable=True)
    crit_threshold = Column("CRIT_THRESHOLD", Numeric(22, 0), nullable=True)

    is_active = Column("IS_ACTIVE", Numeric(1, 0), nullable=False, default=1)

    sql_query = Column("SQL_QUERY", CLOB, nullable=False)

    # ✅ NOUVEAU CHAMP (IMPORTANT)
    category = Column("CATEGORY", String(50), nullable=True)

    created_at = Column(
        "CREATED_AT",
        TIMESTAMP,
        nullable=False,
        server_default=func.current_timestamp(),
    )
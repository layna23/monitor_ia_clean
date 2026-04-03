from sqlalchemy import Column, String, Numeric, TIMESTAMP, ForeignKey, func
from backend.database.session import Base


class MetricRun(Base):
    __tablename__ = "METRIC_RUNS"

    run_id = Column("RUN_ID", Numeric(22, 0), primary_key=True, index=True)

    metric_id = Column(
        "METRIC_ID",
        Numeric(22, 0),
        ForeignKey("METRIC_DEFS.METRIC_ID"),
        nullable=False,
        index=True,
    )

    db_id = Column(
        "DB_ID",
        Numeric(22, 0),
        ForeignKey("TARGET_DBS.DB_ID"),
        nullable=False,
        index=True,
    )

    started_at = Column(
        "STARTED_AT",
        TIMESTAMP,
        nullable=False,
        server_default=func.current_timestamp(),
    )

    ended_at = Column("ENDED_AT", TIMESTAMP, nullable=True)

    status = Column("STATUS", String(20), nullable=False)  # SUCCESS / FAILED
    duration_ms = Column("DURATION_MS", Numeric(22, 0), nullable=True)

    error_message = Column("ERROR_MESSAGE", String(4000), nullable=True)

    value_id = Column(
        "VALUE_ID",
        Numeric(22, 0),
        ForeignKey("METRIC_VALUES.VALUE_ID"),
        nullable=True,
    )
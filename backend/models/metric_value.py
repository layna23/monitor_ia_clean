from sqlalchemy import Column, String, Numeric, TIMESTAMP, ForeignKey, CLOB, func
from backend.database.session import Base


class MetricValue(Base):
    __tablename__ = "METRIC_VALUES"

    value_id = Column("VALUE_ID", Numeric(22, 0), primary_key=True, index=True)

    collected_at = Column(
        "COLLECTED_AT",
        TIMESTAMP,
        nullable=False,
        server_default=func.current_timestamp(),
    )

    db_id = Column(
        "DB_ID",
        Numeric(22, 0),
        ForeignKey("TARGET_DBS.DB_ID"),
        nullable=False,
        index=True,
    )

    metric_id = Column(
        "METRIC_ID",
        Numeric(22, 0),
        ForeignKey("METRIC_DEFS.METRIC_ID"),
        nullable=False,
        index=True,
    )

    value_number = Column("VALUE_NUMBER", Numeric(22, 0), nullable=True)
    value_text = Column("VALUE_TEXT", String(4000), nullable=True)

    severity = Column("SEVERITY", String(20), nullable=False)
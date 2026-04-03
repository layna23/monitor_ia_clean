from sqlalchemy import Column, String, Numeric, TIMESTAMP, ForeignKey, func
from backend.database.session import Base


class Alert(Base):
    __tablename__ = "ALERTS"

    alert_id = Column("ALERT_ID", Numeric(22, 0), primary_key=True, index=True)

    created_at = Column(
        "CREATED_AT",
        TIMESTAMP,
        nullable=False,
        server_default=func.current_timestamp(),
    )
    updated_at = Column("UPDATED_AT", TIMESTAMP, nullable=True)
    closed_at = Column("CLOSED_AT", TIMESTAMP, nullable=True)

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

    severity = Column("SEVERITY", String(20), nullable=False)
    status = Column("STATUS", String(20), nullable=False)

    title = Column("TITLE", String(300), nullable=False)
    details = Column("DETAILS", String(2000), nullable=True)
    last_value = Column("LAST_VALUE", String(200), nullable=True)
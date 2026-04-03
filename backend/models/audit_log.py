from sqlalchemy import Column, String, Numeric, TIMESTAMP, ForeignKey, func
from backend.database.session import Base


class AuditLog(Base):
    __tablename__ = "AUDIT_LOG"

    audit_id = Column("AUDIT_ID", Numeric(22, 0), primary_key=True, index=True)

    event_time = Column(
        "EVENT_TIME",
        TIMESTAMP,
        nullable=False,
        server_default=func.current_timestamp(),
    )

    user_id = Column(
        "USER_ID",
        Numeric(22, 0),
        ForeignKey("USERS.USER_ID"),
        nullable=True,
    )

    user_email = Column("USER_EMAIL", String(255), nullable=True)

    action_type = Column("ACTION_TYPE", String(100), nullable=False)

    entity_type = Column("ENTITY_TYPE", String(100), nullable=True)

    entity_id = Column("ENTITY_ID", Numeric(22, 0), nullable=True)

    description = Column("DESCRIPTION", String(2000), nullable=True)

    ip_address = Column("IP_ADDRESS", String(100), nullable=True)
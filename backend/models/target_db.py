from sqlalchemy import Column, String, Numeric, TIMESTAMP, ForeignKey, CLOB
from sqlalchemy.orm import relationship

from backend.database.session import Base
from backend.models.db_type import DbType


class TargetDB(Base):
    __tablename__ = "TARGET_DBS"

    db_id = Column(
        "DB_ID",
        Numeric(22, 0),
        primary_key=True,
        index=True
    )

    db_name = Column(
        "DB_NAME",
        String(255),
        nullable=False
    )

    db_type_id = Column(
        "DB_TYPE_ID",
        Numeric(22, 0),
        ForeignKey("DB_TYPES.DB_TYPE_ID"),
        nullable=False
    )

    host = Column(
        "HOST",
        String(255),
        nullable=False
    )

    port = Column(
        "PORT",
        Numeric(10, 0),
        nullable=False
    )

    service_name = Column(
        "SERVICE_NAME",
        String(255),
        nullable=True
    )

    sid = Column(
        "SID",
        String(255),
        nullable=True
    )

    username = Column(
        "USERNAME",
        String(255),
        nullable=False
    )

    password_enc = Column(
        "PASSWORD_ENC",
        CLOB,
        nullable=True
    )

    collect_interval_sec = Column(
        "COLLECT_INTERVAL_SEC",
        Numeric(10, 0),
        nullable=False,
        default=300
    )

    is_active = Column(
        "IS_ACTIVE",
        Numeric(1, 0),
        nullable=False,
        default=1
    )

    last_collect_at = Column(
        "LAST_COLLECT_AT",
        TIMESTAMP,
        nullable=True
    )

    db_type = relationship(DbType)

    # Champ logique non stocké en base pour l'instant
    archive_mode = None
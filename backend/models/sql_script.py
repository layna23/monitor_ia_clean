# backend/models/sql_script.py
from sqlalchemy import Column, String, Text, Numeric, TIMESTAMP, func
from backend.database.session import Base


class SqlScript(Base):
    __tablename__ = "SQL_SCRIPTS"
    __table_args__ = {"schema": "DBMON"}

    script_id   = Column("SCRIPT_ID",   Numeric(10, 0), primary_key=True)
    script_name = Column("SCRIPT_NAME", String(200),    nullable=False)
    description = Column("DESCRIPTION", String(1000),   nullable=True)
    category    = Column("CATEGORY",    String(50),     nullable=True)
    db_type     = Column("DB_TYPE",     String(20),     default="ORACLE")
    sql_content = Column("SQL_CONTENT", Text,           nullable=False)
    is_active   = Column("IS_ACTIVE",   Numeric(1, 0),  default=1)
    created_at  = Column("CREATED_AT",  TIMESTAMP,      server_default=func.current_timestamp())
    created_by  = Column("CREATED_BY",  String(100),    default="ADMIN")
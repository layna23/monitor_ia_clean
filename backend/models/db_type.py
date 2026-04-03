from sqlalchemy import Column, String, Numeric
from backend.database.session import Base

class DbType(Base):
    __tablename__ = "DB_TYPES"

    db_type_id = Column("DB_TYPE_ID", Numeric(22, 0), primary_key=True, index=True)
    code = Column("CODE", String(50), nullable=False, unique=True, index=True)
    name = Column("NAME", String(100), nullable=False)

    version = Column("VERSION", String(50), nullable=True)
    driver = Column("DRIVER", String(50), nullable=True)
    description = Column("DESCRIPTION", String(400), nullable=True)

    status = Column("STATUS", String(20), nullable=False)  # Oracle default = 'ACTIVE'
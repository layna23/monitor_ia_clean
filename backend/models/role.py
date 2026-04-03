from sqlalchemy import Column, String, Numeric
from backend.database.session import Base

class Role(Base):
    __tablename__ = "ROLES"   # ✅ IMPORTANT

    role_id = Column("ROLE_ID", Numeric(22, 0), primary_key=True, index=True)
    role_code = Column("ROLE_CODE", String(50), nullable=False, unique=True, index=True)
    role_name = Column("ROLE_NAME", String(100), nullable=False)
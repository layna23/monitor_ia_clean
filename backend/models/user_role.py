from sqlalchemy import Column, Numeric, ForeignKey
from backend.database.session import Base

class UserRole(Base):
    __tablename__ = "USER_ROLES"

    user_id = Column("USER_ID", Numeric(22, 0), ForeignKey("USERS.USER_ID"), primary_key=True)
    role_id = Column("ROLE_ID", Numeric(22, 0), ForeignKey("ROLES.ROLE_ID"), primary_key=True)
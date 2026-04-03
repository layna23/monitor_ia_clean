from sqlalchemy import Column, String, Numeric, TIMESTAMP, text
from backend.database.session import Base


class User(Base):
    __tablename__ = "USERS"

    user_id = Column("USER_ID", Numeric(22, 0), primary_key=True, index=True)
    email = Column("EMAIL", String(255), nullable=False, unique=True, index=True)
    full_name = Column("FULL_NAME", String(200), nullable=True)
    password_hash = Column("PASSWORD_HASH", String(255), nullable=False)

    # default = 1 (actif)
    is_active = Column("IS_ACTIVE", Numeric(1, 0), nullable=False, server_default=text("1"))

    # Oracle default timestamp
    created_at = Column("CREATED_AT", TIMESTAMP, nullable=False, server_default=text("SYSTIMESTAMP"))
    last_login_at = Column("LAST_LOGIN_AT", TIMESTAMP, nullable=True)
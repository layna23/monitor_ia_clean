import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base


# ─────────────────────────────────────────────
# CONFIG ORACLE (via variables d’environnement)
# ─────────────────────────────────────────────

ORACLE_USER = os.getenv("ORACLE_USER", "DBMON")
ORACLE_PASSWORD = os.getenv("ORACLE_PASSWORD", "dbmon123")

# IMPORTANT :
# - localhost → si backend sur Windows
# - IP Windows → si appel depuis VM
ORACLE_HOST = os.getenv("ORACLE_HOST", "localhost")

ORACLE_PORT = os.getenv("ORACLE_PORT", "1521")

# Vérifie ton service Oracle :
# souvent "XEPDB1" ou "ORCL"
ORACLE_SERVICE = os.getenv("ORACLE_SERVICE", "orcl")


# ─────────────────────────────────────────────
# URL DE CONNEXION
# ─────────────────────────────────────────────

DATABASE_URL = (
    f"oracle+oracledb://{ORACLE_USER}:{ORACLE_PASSWORD}"
    f"@{ORACLE_HOST}:{ORACLE_PORT}/?service_name={ORACLE_SERVICE}"
)


# ─────────────────────────────────────────────
# ENGINE SQLALCHEMY
# ─────────────────────────────────────────────

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,              # 🔥 important (évite erreurs connexions mortes)
    pool_size=5,
    max_overflow=10,
    connect_args={"tcp_connect_timeout": 10},
)


# ─────────────────────────────────────────────
# SESSION
# ─────────────────────────────────────────────

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


# ─────────────────────────────────────────────
# DEPENDENCY FASTAPI
# ─────────────────────────────────────────────

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
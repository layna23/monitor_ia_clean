import time
from fastapi import APIRouter

router = APIRouter(prefix="/db-test", tags=["DB Test"])


@router.post("/")
def test_connection(data: dict):
    def s(v):
        return str(v).strip() if v is not None else None

    db_id = data.get("db_id")
    db_name = s(data.get("db_name"))
    db_type = s(data.get("db_type") or "").upper()
    host = s(data.get("host"))
    port = data.get("port")
    service = s(data.get("service"))
    username = s(data.get("username"))
    password = s(data.get("password"))

    start = time.perf_counter()

    print("\n========== /db-test DEBUG ==========")
    print("RAW DATA =", data)
    print("DB_ID    =", db_id)
    print("DB_NAME  =", db_name)
    print("DB_TYPE  =", db_type)
    print("HOST     =", host)
    print("PORT     =", port)
    print("SERVICE  =", service)
    print("USERNAME =", username)
    print("PASSWORD =", password)
    print("====================================\n")

    try:
        if db_type == "ORACLE":
            import oracledb

            if not host:
                raise ValueError("Host Oracle manquant")
            if not port:
                raise ValueError("Port Oracle manquant")
            if not service:
                raise ValueError("Service Oracle manquant")
            if not username:
                raise ValueError("Username Oracle manquant")

            if not password:
                from backend.database.session import SessionLocal
                from backend.models.target_db import TargetDB

                db = SessionLocal()
                try:
                    target = None

                    if db_id not in (None, "", "null"):
                        try:
                            target = (
                                db.query(TargetDB)
                                .filter(TargetDB.db_id == int(db_id))
                                .first()
                            )
                            print("Recherche par db_id =", db_id, "->", bool(target))
                        except Exception:
                            pass

                    if target is None and db_name:
                        target = (
                            db.query(TargetDB)
                            .filter(TargetDB.db_name == db_name)
                            .first()
                        )
                        print("Recherche par db_name =", db_name, "->", bool(target))

                    if target is None:
                        target = (
                            db.query(TargetDB)
                            .filter(
                                TargetDB.host == host,
                                TargetDB.port == int(port),
                                TargetDB.username == username,
                            )
                            .first()
                        )
                        print("Recherche par host/port/username ->", bool(target))

                    if target is None:
                        raise ValueError("Target DB introuvable en base")

                    stored_password = getattr(target, "password_enc", None)
                    if stored_password is None or str(stored_password).strip() == "":
                        raise ValueError("Password Oracle introuvable en base")

                    password = str(stored_password).strip()
                    print("Password récupéré depuis DB pour :", target.db_name)
                    print("PASSWORD FINAL =", password)

                finally:
                    db.close()

            dsn = oracledb.makedsn(host, int(port), service_name=service)

            conn = oracledb.connect(
                user=username,
                password=password,
                dsn=dsn,
            )
            cur = conn.cursor()

            cur.execute("SELECT banner FROM v$version WHERE banner LIKE 'Oracle%'")
            version = cur.fetchone()[0]

            cur.execute("SELECT open_mode FROM v$database")
            open_mode = cur.fetchone()[0]

            cur.execute("SELECT log_mode FROM v$database")
            log_mode = cur.fetchone()[0]

            cur.close()
            conn.close()

            latency_ms = round((time.perf_counter() - start) * 1000)
            return {
                "success": True,
                "message": "Connexion réussie",
                "db_type": db_type,
                "version": version,
                "open_mode": open_mode,
                "log_mode": log_mode,
                "latency_ms": latency_ms,
            }

        elif db_type == "MYSQL":
            import mysql.connector

            if not password:
                raise ValueError("Password MySQL manquant ou vide")

            conn = mysql.connector.connect(
                host=host,
                port=int(port),
                user=username,
                password=password,
                database=service,
                connection_timeout=10,
            )
            cur = conn.cursor()

            cur.execute("SELECT @@version")
            version = "MySQL " + cur.fetchone()[0]

            cur.execute("SELECT @@read_only")
            open_mode = "READ ONLY" if cur.fetchone()[0] else "READ WRITE"

            cur.execute("SELECT @@log_bin")
            log_mode = "binary_log=ON" if cur.fetchone()[0] else "binary_log=OFF"

            cur.close()
            conn.close()

            latency_ms = round((time.perf_counter() - start) * 1000)
            return {
                "success": True,
                "message": "Connexion réussie",
                "db_type": db_type,
                "version": version,
                "open_mode": open_mode,
                "log_mode": log_mode,
                "latency_ms": latency_ms,
            }

        elif db_type == "SQLSERVER":
            import pyodbc

            if not password:
                raise ValueError("Password SQL Server manquant ou vide")

            conn_str = (
                f"DRIVER={{ODBC Driver 17 for SQL Server}};"
                f"SERVER={host},{port};"
                f"DATABASE={service};"
                f"UID={username};PWD={password};"
                "TrustServerCertificate=yes;"
            )

            conn = pyodbc.connect(conn_str)
            cur = conn.cursor()

            cur.execute("SELECT @@VERSION")
            version = cur.fetchone()[0].splitlines()[0]

            cur.execute("SELECT DATABASEPROPERTYEX(DB_NAME(), 'Updateability')")
            open_mode = cur.fetchone()[0]

            cur.execute(
                "SELECT recovery_model_desc FROM sys.databases WHERE name = DB_NAME()"
            )
            log_mode = "recovery_model=" + cur.fetchone()[0]

            cur.close()
            conn.close()

            latency_ms = round((time.perf_counter() - start) * 1000)
            return {
                "success": True,
                "message": "Connexion réussie",
                "db_type": db_type,
                "version": version,
                "open_mode": open_mode,
                "log_mode": log_mode,
                "latency_ms": latency_ms,
            }

        else:
            return {
                "success": False,
                "message": f"Type BD '{db_type}' non supporté",
            }

    except Exception as e:
        latency_ms = round((time.perf_counter() - start) * 1000)
        print("ERREUR /db-test =", repr(e))
        return {
            "success": False,
            "message": str(e),
            "db_type": db_type,
            "latency_ms": latency_ms,
        }
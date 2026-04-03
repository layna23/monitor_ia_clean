import time
from fastapi import APIRouter

router = APIRouter(prefix="/db-test", tags=["DB Test"])


@router.post("/")
def test_connection(data: dict):
    db_type = (data.get("db_type") or "").upper()
    host = data.get("host")
    port = data.get("port")
    service = data.get("service")
    username = data.get("username")
    password = data.get("password")

    start = time.perf_counter()

    try:
        if db_type == "ORACLE":
            import oracledb

            dsn = oracledb.makedsn(host, port, service_name=service)
            conn = oracledb.connect(user=username, password=password, dsn=dsn)
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

            conn = mysql.connector.connect(
                host=host,
                port=port,
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

            conn_str = (
                f"DRIVER={{ODBC Driver 17 for SQL Server}};"
                f"SERVER={host},{port};"
                f"DATABASE={service};"
                f"UID={username};PWD={password};"
                f"Connection Timeout=10;"
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
                "message": f"Type BD '{db_type}' non supporté. Valeurs : ORACLE, MYSQL, SQLSERVER",
            }

    except Exception as e:
        latency_ms = round((time.perf_counter() - start) * 1000)
        return {
            "success": False,
            "message": str(e),
            "db_type": db_type,
            "version": None,
            "open_mode": None,
            "log_mode": None,
            "latency_ms": latency_ms,
        }
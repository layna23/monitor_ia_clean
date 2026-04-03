from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from backend.database.session import engine

router = APIRouter(prefix="/oracle-sessions", tags=["oracle-sessions"])


def normalize_password_value(value):
    if value is None:
        return None
    if hasattr(value, "read"):
        value = value.read()
    return str(value)


def get_target_db_by_id(db_id: int):
    query = text("""
        SELECT
            db_id,
            db_name,
            host,
            port,
            service_name,
            sid,
            username,
            password_enc
        FROM target_dbs
        WHERE db_id = :db_id
    """)

    with engine.connect() as conn:
        row = conn.execute(query, {"db_id": db_id}).fetchone()

    if not row:
        return None

    return {
        "db_id": row[0],
        "db_name": row[1],
        "host": row[2],
        "port": row[3],
        "service_name": row[4],
        "sid": row[5],
        "username": row[6],
        "password": normalize_password_value(row[7]),
    }


@router.get("/{db_id}")
def get_oracle_sessions(db_id: int):
    import oracledb

    target = get_target_db_by_id(db_id)

    if not target:
        raise HTTPException(status_code=404, detail="Base cible introuvable")

    conn = None
    cur = None

    try:
        password = target["password"]
        if not password:
            raise HTTPException(
                status_code=400,
                detail="Mot de passe vide pour cette base cible"
            )

        if target["service_name"]:
            dsn = oracledb.makedsn(
                target["host"],
                int(target["port"]),
                service_name=target["service_name"]
            )
        elif target["sid"]:
            dsn = oracledb.makedsn(
                target["host"],
                int(target["port"]),
                sid=target["sid"]
            )
        else:
            raise HTTPException(
                status_code=400,
                detail="SERVICE_NAME et SID sont vides pour cette base cible"
            )

        conn = oracledb.connect(
            user=target["username"],
            password=password,
            dsn=dsn
        )

        cur = conn.cursor()

        cur.execute("""
            SELECT
                s.sid,
                s.serial#,
                s.username,
                s.osuser,
                s.machine,
                s.program,
                s.status,
                s.event,
                s.sql_id,
                s.logon_time
            FROM v$session s
            WHERE s.type = 'USER'
            ORDER BY s.status DESC, s.logon_time DESC
        """)

        rows = cur.fetchall()
        columns = [desc[0].lower() for desc in cur.description]

        sessions = []
        for row in rows:
            item = {}
            for i, col in enumerate(columns):
                value = row[i]
                if hasattr(value, "isoformat"):
                    value = value.isoformat()
                item[col] = value
            sessions.append(item)

        active_count = len(
            [s for s in sessions if str(s.get("status", "")).upper() == "ACTIVE"]
        )
        inactive_count = len(
            [s for s in sessions if str(s.get("status", "")).upper() == "INACTIVE"]
        )

        return {
            "db_id": target["db_id"],
            "db_name": target["db_name"],
            "count": len(sessions),
            "active_count": active_count,
            "inactive_count": inactive_count,
            "sessions": sessions,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()
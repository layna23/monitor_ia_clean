def get_target_connection(target_db):
    """
    Ouvre une connexion vers la base cible surveillée.
    Les drivers sont importés en lazy (à l'intérieur des fonctions)
    pour éviter tout blocage au démarrage de l'application.
    """
    db_type_code = (target_db.db_type.code or "").upper()

    # ── ORACLE ────────────────────────────────────────────────────────────────
    if db_type_code == "ORACLE":
        import oracledb  # lazy import — n'est chargé que si on connecte Oracle

        service_name = getattr(target_db, "service_name", None)
        sid = getattr(target_db, "sid", None)

        if service_name:
            dsn = oracledb.makedsn(
                target_db.host,
                int(target_db.port),
                service_name=service_name,
            )
        elif sid:
            dsn = oracledb.makedsn(
                target_db.host,
                int(target_db.port),
                sid=sid,
            )
        else:
            raise ValueError("Oracle: service_name ou sid est obligatoire")

        return oracledb.connect(
            user=target_db.username,
            password=target_db.password_enc,
            dsn=dsn,
        )

    # ── MYSQL ─────────────────────────────────────────────────────────────────
    if db_type_code == "MYSQL":
        import mysql.connector  # lazy import

        database_name = (
            getattr(target_db, "service_name", None)
            or getattr(target_db, "db_name", None)
        )

        return mysql.connector.connect(
            host=target_db.host,
            port=int(target_db.port),
            user=target_db.username,
            password=target_db.password_enc,
            database=database_name,
            connection_timeout=10,
        )

    # ── SQL SERVER ────────────────────────────────────────────────────────────
    if db_type_code in ("SQLSERVER", "MSSQL"):
        try:
            import pyodbc  # lazy import
        except ImportError:
            raise ValueError("pyodbc n'est pas installé pour SQL Server.")

        database_name = (
            getattr(target_db, "service_name", None)
            or getattr(target_db, "db_name", None)
        )

        conn_str = (
            "DRIVER={ODBC Driver 17 for SQL Server};"
            f"SERVER={target_db.host},{target_db.port};"
            f"DATABASE={database_name};"
            f"UID={target_db.username};"
            f"PWD={target_db.password_enc};"
            "TrustServerCertificate=yes;"
        )
        return pyodbc.connect(conn_str)

    raise ValueError(f"SGBD non supporté : {db_type_code}")
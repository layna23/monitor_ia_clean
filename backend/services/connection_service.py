def get_target_connection(target_db):
    """
    Ouvre une connexion vers la base cible surveillée.
    """

    def _safe_str(value):
        return str(value).strip() if value is not None else None

    def _get_password():
        """
        Priorité :
        1) target_db.password
        2) target_db.password_enc
        """
        raw_password = getattr(target_db, "password", None)

        if raw_password is None or str(raw_password).strip() == "":
            raw_password = getattr(target_db, "password_enc", None)

        if raw_password is None or str(raw_password).strip() == "":
            raise ValueError("Mot de passe introuvable pour la base cible")

        return str(raw_password).strip()

    db_type_code = _safe_str(target_db.db_type.code or "").upper()

    # ── ORACLE ────────────────────────────────────────────────────────────────
    if db_type_code == "ORACLE":
        import oracledb

        host = _safe_str(target_db.host)
        port = int(target_db.port)
        username = _safe_str(target_db.username)
        password = _get_password()
        service_name = _safe_str(getattr(target_db, "service_name", None))
        sid = _safe_str(getattr(target_db, "sid", None))

        if not host:
            raise ValueError("Oracle: host est obligatoire")
        if not username:
            raise ValueError("Oracle: username est obligatoire")

        if service_name:
            dsn = oracledb.makedsn(
                host,
                port,
                service_name=service_name,
            )
        elif sid:
            dsn = oracledb.makedsn(
                host,
                port,
                sid=sid,
            )
        else:
            raise ValueError("Oracle: service_name ou sid est obligatoire")

        # 🔥 DEBUG IMPORTANT
        print("\n==== DEBUG CONNEXION ORACLE ====")
        print("USER =", username)
        print("PASSWORD UTILISÉ =", password)
        print("HOST =", host)
        print("PORT =", port)
        print("SERVICE =", service_name)
        print("================================\n")

        return oracledb.connect(
            user=username,
            password=password,
            dsn=dsn,
        )

    # ── MYSQL ─────────────────────────────────────────────────────────────────
    if db_type_code == "MYSQL":
        import mysql.connector

        host = _safe_str(target_db.host)
        port = int(target_db.port)
        username = _safe_str(target_db.username)
        password = _get_password()

        database_name = (
            _safe_str(getattr(target_db, "service_name", None))
            or _safe_str(getattr(target_db, "db_name", None))
        )

        return mysql.connector.connect(
            host=host,
            port=port,
            user=username,
            password=password,
            database=database_name,
            connection_timeout=10,
        )

    # ── SQL SERVER ────────────────────────────────────────────────────────────
    if db_type_code in ("SQLSERVER", "MSSQL"):
        try:
            import pyodbc
        except ImportError:
            raise ValueError("pyodbc n'est pas installé pour SQL Server.")

        host = _safe_str(target_db.host)
        port = int(target_db.port)
        username = _safe_str(target_db.username)
        password = _get_password()

        database_name = (
            _safe_str(getattr(target_db, "service_name", None))
            or _safe_str(getattr(target_db, "db_name", None))
        )

        conn_str = (
            "DRIVER={ODBC Driver 17 for SQL Server};"
            f"SERVER={host},{port};"
            f"DATABASE={database_name};"
            f"UID={username};"
            f"PWD={password};"
            "TrustServerCertificate=yes;"
        )

        return pyodbc.connect(conn_str)

    raise ValueError(f"SGBD non supporté : {db_type_code}")
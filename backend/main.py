from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from backend.router.role import router as role_router
from backend.router.users import router as user_router
from backend.router.db_types import router as db_types_router
from backend.router.target_dbs import router as target_dbs_router
from backend.router.metric_defs import router as metric_defs_router
from backend.router.metric_values import router as metric_values_router
from backend.router.metric_runs import router as metric_runs_router
from backend.router.alerts import router as alerts_router
from backend.router.execute_metrics import router as execute_metrics_router
from backend.router.audit_log import router as audit_logs_router
from backend.router import user_roles
from backend.router.auth import router as auth_router
from backend.router import db_test
from backend.router import collector
from backend.router.sql_analyzer import router as sql_analyzer_router
from backend.router.oracle_sessions import router as oracle_sessions_router

app = FastAPI(title="DB Monitor IA Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(role_router)
app.include_router(user_router)
app.include_router(db_types_router)
app.include_router(target_dbs_router)
app.include_router(metric_defs_router)
app.include_router(metric_values_router)
app.include_router(metric_runs_router)
app.include_router(alerts_router)
app.include_router(execute_metrics_router)
app.include_router(audit_logs_router)
app.include_router(user_roles.router)
app.include_router(auth_router)
app.include_router(db_test.router)
app.include_router(collector.router)
app.include_router(sql_analyzer_router)
app.include_router(oracle_sessions_router)

Instrumentator().instrument(app).expose(app)


@app.get("/")
def root():
    return {"message": "API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}
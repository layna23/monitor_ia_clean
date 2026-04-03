from apscheduler.schedulers.blocking import BlockingScheduler
from backend.services.collector_service import run_due_collections

scheduler = BlockingScheduler()


def start_scheduler():
    scheduler.add_job(
        run_due_collections,
        "interval",
        minutes=1,
        id="auto_collect_metrics",
        replace_existing=True,
    )
    print("Scheduler autonome démarré...", flush=True)
    scheduler.start()
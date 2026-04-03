from apscheduler.schedulers.blocking import BlockingScheduler
from backend.services.collector_service import run_due_collections

scheduler = BlockingScheduler()


def scheduled_collect():
    print("=== JOB SCHEDULER : DEMARRAGE ===", flush=True)
    run_due_collections()
    print("=== JOB SCHEDULER : FIN ===", flush=True)


if __name__ == "__main__":
    print("Scheduler autonome démarré...", flush=True)

    scheduler.add_job(
        scheduled_collect,
        trigger="interval",
        minutes=1,
        id="auto_collect_metrics",
        replace_existing=True,
    )

    try:
        scheduler.start()
    except KeyboardInterrupt:
        print("\nArrêt manuel du scheduler...", flush=True)
        scheduler.shutdown(wait=False)
        print("Scheduler arrêté proprement.", flush=True)
import logging
import time
import backend.models

from backend.services.collector_service import run_due_collections

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)

logger = logging.getLogger("collector_worker")

if __name__ == "__main__":
    logger.info("Worker de collecte démarré")

    while True:
        try:
            run_due_collections()
        except Exception:
            logger.exception("Erreur dans la collecte")

        time.sleep(30)
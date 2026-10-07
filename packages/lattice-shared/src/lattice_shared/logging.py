"""One logging format for every service."""

import logging
import sys


def configure_logging(service_name: str, level: str = "INFO") -> logging.Logger:
    root = logging.getLogger()
    if not root.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(
            logging.Formatter(
                fmt="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
                datefmt="%Y-%m-%dT%H:%M:%S",
            )
        )
        root.addHandler(handler)
        root.setLevel(level)
    return logging.getLogger(service_name)

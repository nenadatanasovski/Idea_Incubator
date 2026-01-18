"""
Scheduled jobs for observability system.

Jobs:
    log_archival: Archive old observability data

Usage:
    python3 coding-loops/jobs/log_archival.py --mode daily
    python3 coding-loops/jobs/log_archival.py --mode weekly
    python3 coding-loops/jobs/log_archival.py --mode monthly
"""

from pathlib import Path

JOBS_DIR = Path(__file__).parent

__all__ = ["JOBS_DIR"]

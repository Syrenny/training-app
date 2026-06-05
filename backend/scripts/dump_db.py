from __future__ import annotations

import argparse
import os
import sqlite3
import sys
from datetime import datetime
from pathlib import Path
from typing import Sequence

import django
from django.conf import settings

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parent
DEFAULT_BACKUP_DIR = REPO_ROOT / "backups"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Create a SQLite database dump using the configured Django database."
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help="Full path to the dump file. Overrides --output-dir.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_BACKUP_DIR,
        help=f"Directory for timestamped dumps. Default: {DEFAULT_BACKUP_DIR}",
    )
    return parser


def configure_django() -> None:
    if str(BACKEND_DIR) not in sys.path:
        sys.path.insert(0, str(BACKEND_DIR))
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")
    django.setup()


def resolve_destination(output: Path | None, output_dir: Path) -> Path:
    if output is not None:
        return output.expanduser().resolve()

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return output_dir.expanduser().resolve() / f"db-{timestamp}.sqlite3"


def get_database_path() -> Path:
    db_config = settings.DATABASES["default"]
    engine = str(db_config["ENGINE"])
    if engine != "django.db.backends.sqlite3":
        raise RuntimeError(f"Unsupported database engine for dump script: {engine}")

    return Path(db_config["NAME"]).expanduser().resolve()


def dump_database(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(source) as source_connection:
        with sqlite3.connect(destination) as destination_connection:
            source_connection.backup(destination_connection)


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    configure_django()
    source = get_database_path()
    if not source.exists():
        raise FileNotFoundError(f"Database file not found: {source}")

    destination = resolve_destination(args.output, args.output_dir)
    dump_database(source, destination)
    print(destination)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

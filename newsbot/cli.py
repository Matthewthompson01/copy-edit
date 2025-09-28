from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

import typer

from .core.models import Article
from .core.store import db_init as initialize_db
from .core.store import get_conn, upsert_article
from .ingestion.extract import extract_main_text
from .ingestion.rss import parse_feed

app = typer.Typer(help="Newsletter research CLI")
LOGGER = logging.getLogger("newsbot")
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

_CONFIG_PATH = Path(__file__).resolve().parent / "config" / "sources.json"
_DB_PATH = Path("database/agentclaude.db")


def _load_sources() -> list[dict[str, str]]:
    if not _CONFIG_PATH.exists():
        raise FileNotFoundError(f"Missing config file: {_CONFIG_PATH}")
    with _CONFIG_PATH.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    feeds = data.get("feeds")
    if not isinstance(feeds, list):
        raise ValueError("config/sources.json must contain a 'feeds' list")
    return [feed for feed in feeds if feed.get("url")]


@app.command("db-init")
def db_init(db_path: Path = typer.Option(_DB_PATH, help="SQLite database path")) -> None:
    """Create database tables."""
    initialize_db(db_path)
    typer.echo(f"Database initialized at {db_path}")


@app.command()
def research(
    limit: Optional[int] = typer.Option(None, help="Maximum articles to process"),
    db_path: Path = typer.Option(_DB_PATH, help="SQLite database path"),
) -> None:
    """Fetch feeds, extract article text, and store results."""
    try:
        feeds = _load_sources()
    except Exception as exc:
        raise typer.Exit(code=1) from exc

    conn = get_conn(db_path)
    processed = inserted = updated = 0

    try:
        for feed in feeds:
            if limit is not None and processed >= limit:
                break
            feed_name = feed.get("name") or feed.get("url")
            try:
                entries = parse_feed(feed["url"])
            except Exception as exc:  # pragma: no cover
                LOGGER.warning("Failed to parse feed %s: %s", feed_name, exc)
                continue

            for entry in entries:
                if limit is not None and processed >= limit:
                    break
                url = entry.get("url")
                if not url:
                    continue
                try:
                    raw_text = extract_main_text(url)
                except Exception as exc:  # pragma: no cover
                    LOGGER.warning("Extraction error for %s: %s", url, exc)
                    continue

                article = Article(
                    url=url,
                    title=entry.get("title", "(untitled)"),
                    source=feed_name,
                    published_at=entry.get("published"),
                    summary=entry.get("summary"),
                    raw_text=raw_text,
                )
                inserted_flag = upsert_article(conn, article)
                if inserted_flag:
                    inserted += 1
                else:
                    updated += 1
                processed += 1
    finally:
        conn.close()

    typer.echo(
        f"Processed {processed} articles (inserted={inserted}, updated={updated})"
    )


@app.command()
def newsletter() -> None:
    """Generate newsletter draft (stub)."""
    typer.echo("Not implemented (coming next)")


@app.command("db-status")
def db_status() -> None:
    """Report database status (stub)."""
    typer.echo("Not implemented (coming next)")

from __future__ import annotations

import sqlite3
from dataclasses import asdict
from datetime import datetime
from pathlib import Path

from .models import Article

_DB_PATH = Path("database/agentclaude.db")
_SCHEMA_PATH = Path(__file__).resolve().parent.parent / "database" / "schema.sql"


def get_conn(db_path: str | Path = _DB_PATH) -> sqlite3.Connection:
    db_file = Path(db_path)
    db_file.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_file)
    conn.row_factory = sqlite3.Row
    return conn


def db_init(db_path: str | Path = _DB_PATH) -> None:
    conn = get_conn(db_path)
    try:
        with _SCHEMA_PATH.open("r", encoding="utf-8") as fh:
            conn.executescript(fh.read())
        conn.commit()
    finally:
        conn.close()


def upsert_article(conn: sqlite3.Connection, article: Article) -> bool:
    existing = conn.execute(
        "SELECT 1 FROM articles WHERE url = ?", (article.url,)
    ).fetchone()
    data = asdict(article)
    columns = [
        "url",
        "title",
        "source",
        "published_at",
        "summary",
        "raw_text",
        "category",
        "importance",
        "used_in_newsletter",
    ]
    if data.get("created_at"):
        columns.append("created_at")
    placeholders = ", ".join([f":{col}" for col in columns])
    sql = (
        "INSERT INTO articles (" + ", ".join(columns) + ")"
        " VALUES (" + placeholders + ") "
        "ON CONFLICT(url) DO UPDATE SET "
        "title=excluded.title, source=excluded.source, published_at=excluded.published_at, "
        "summary=excluded.summary, raw_text=excluded.raw_text, category=excluded.category, "
        "importance=excluded.importance, used_in_newsletter=excluded.used_in_newsletter"
    )
    conn.execute(sql, {col: data[col] for col in columns})

    inserted = existing is None
    conn.execute(
        "INSERT INTO source_performance (source, articles_discovered, articles_stored, last_updated) "
        "VALUES (:source, 1, :stored, :updated) "
        "ON CONFLICT(source) DO UPDATE SET "
        "articles_discovered = source_performance.articles_discovered + 1, "
        "articles_stored = source_performance.articles_stored + :stored, "
        "last_updated = :updated",
        {
            "source": article.source,
            "stored": 1 if inserted else 0,
            "updated": datetime.utcnow().isoformat(timespec="seconds"),
        },
    )
    conn.commit()
    return inserted

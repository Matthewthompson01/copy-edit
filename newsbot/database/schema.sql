PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY,
    url TEXT UNIQUE,
    title TEXT,
    source TEXT,
    published_at TEXT,
    summary TEXT,
    raw_text TEXT,
    category TEXT,
    importance REAL DEFAULT 0.0,
    used_in_newsletter INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS source_performance (
    id INTEGER PRIMARY KEY,
    source TEXT UNIQUE,
    articles_discovered INTEGER DEFAULT 0,
    articles_stored INTEGER DEFAULT 0,
    success_rate REAL DEFAULT 0.0,
    avg_importance_score REAL DEFAULT 0.0,
    last_updated TEXT,
    total_funding_captured INTEGER DEFAULT 0
);

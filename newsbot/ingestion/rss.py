from __future__ import annotations

from datetime import datetime
from typing import Any

import feedparser


def parse_feed(url: str) -> list[dict[str, Any]]:
    feed = feedparser.parse(url)
    items: list[dict[str, Any]] = []
    feed_source = feed.feed.get("title", url) if feed else url
    for entry in feed.entries:
        published = entry.get("published") or entry.get("updated")
        if published and hasattr(entry, "published_parsed") and entry.published_parsed:
            published = datetime(*entry.published_parsed[:6]).isoformat()
        items.append(
            {
                "title": entry.get("title", "(untitled)"),
                "url": entry.get("link", ""),
                "published": published,
                "source": feed_source,
                "summary": entry.get("summary", ""),
            }
        )
    return items

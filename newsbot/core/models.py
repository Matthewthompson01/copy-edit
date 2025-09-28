from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass(slots=True)
class Article:
    url: str
    title: str
    source: str
    published_at: Optional[str] = None
    summary: Optional[str] = None
    raw_text: Optional[str] = None
    category: Optional[str] = None
    importance: float = 0.0
    used_in_newsletter: int = 0
    created_at: Optional[str] = None

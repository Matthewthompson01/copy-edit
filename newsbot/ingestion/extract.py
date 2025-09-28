from __future__ import annotations

import logging

import requests
import trafilatura
from bs4 import BeautifulSoup

LOGGER = logging.getLogger(__name__)


def extract_main_text(url: str) -> str:
    try:
        response = requests.get(url, timeout=20)
        response.raise_for_status()
    except Exception as exc:  # pragma: no cover
        LOGGER.warning("Failed to fetch %s: %s", url, exc)
        return ""

    html = response.text
    text = trafilatura.extract(html)
    if text:
        return text.strip()

    soup = BeautifulSoup(html, "lxml")
    fallback = soup.get_text(separator="\n", strip=True)
    return fallback[:20000]

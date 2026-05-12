"""
course_fetcher.py — Fetches real course recommendations via Serper Google Search API.

Searches across Udemy, Coursera, edX, LinkedIn Learning, Pluralsight, and YouTube
for courses matching the target role. Returns structured course objects with
thumbnail, title, price, platform, rating, and URL.
"""
import os
import re
import json
import httpx
from typing import Optional
from dotenv import load_dotenv
from utils.logger import setup_logger

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../.env"))

logger = setup_logger(__name__)

SERPER_API_KEY = os.getenv("SERPER_API_KEY")
SERPER_URL = "https://google.serper.dev/search"
SERPER_IMAGES_URL = "https://google.serper.dev/images"

# Platforms to search — prioritised
PLATFORMS = [
    ("Udemy", "site:udemy.com"),
    ("Coursera", "site:coursera.org"),
    ("edX", "site:edx.org"),
    ("LinkedIn Learning", "site:linkedin.com/learning"),
    ("Pluralsight", "site:pluralsight.com"),
    ("FreeCodeCamp", "site:freecodecamp.org"),
    ("YouTube", "site:youtube.com"),
]

# Fallback thumbnail per platform when none found in snippet
PLATFORM_THUMBS = {
    "Udemy":            "https://www.udemy.com/staticx/udemy/images/v7/logo-udemy.svg",
    "Coursera":         "https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Coursera-Logo_600x600.svg/600px-Coursera-Logo_600x600.svg.png",
    "edX":              "https://upload.wikimedia.org/wikipedia/commons/8/8f/EdX.svg",
    "LinkedIn Learning":"https://upload.wikimedia.org/wikipedia/commons/c/ca/LinkedIn_logo_initials.png",
    "Pluralsight":      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Pluralsight-logo.svg/600px-Pluralsight-logo.svg.png",
    "FreeCodeCamp":     "https://design.freecodecamp.org/img/fcc_secondary_small.svg",
    "YouTube":          "https://upload.wikimedia.org/wikipedia/commons/b/b8/YouTube_Logo_2017.svg",
}

PLATFORM_COLORS = {
    "Udemy":            "#a435f0",
    "Coursera":         "#0056d3",
    "edX":              "#02262b",
    "LinkedIn Learning":"#0a66c2",
    "Pluralsight":      "#ef4b2e",
    "FreeCodeCamp":     "#0a0a23",
    "YouTube":          "#ff0000",
}


def _extract_price(snippet: str, platform: str) -> str:
    """Pull price info from snippet text."""
    free_keywords = ["free", "free course", "no cost", "open access"]
    snippet_l = snippet.lower()
    for kw in free_keywords:
        if kw in snippet_l:
            return "Free"

    # Match patterns like $12.99, $199.99, ₹499 etc.
    m = re.search(r"[\$₹£€]\s?\d+[\.,]?\d*", snippet)
    if m:
        return m.group(0)

    if platform in ("FreeCodeCamp", "edX"):
        return "Free / Audit"
    if platform == "YouTube":
        return "Free"
    return "Check site"


def _extract_rating(snippet: str) -> Optional[str]:
    """Extract rating like 4.5 or 4.7 from snippet."""
    m = re.search(r"\b([45]\.\d)\b", snippet)
    return m.group(1) if m else None


def _extract_students(snippet: str) -> Optional[str]:
    """Extract student count like '12,345 students'."""
    m = re.search(r"([\d,]+)\s+(?:students?|learners?|enrollments?)", snippet, re.I)
    return m.group(0) if m else None


def _fetch_thumbnail(title: str, platform: str) -> str:
    """Fetch a landscape thumbnail for the course."""
    if not SERPER_API_KEY or not title:
        return ""
    
    query = f"{title} {platform} course"
    body = {
        "q": query,
        "num": 5
    }
    headers = {
        "X-API-KEY": SERPER_API_KEY or "",
    }
    
    try:
        with httpx.Client(timeout=10) as http_client:
            resp = http_client.post(SERPER_IMAGES_URL, json=body, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            
            for img in data.get("images", []):
                url = img.get("imageUrl", "")
                width = img.get("imageWidth", 0)
                height = img.get("imageHeight", 0)
                
                # Need landscape that isn't tiny
                if url.lower().endswith((".jpg", ".jpeg", ".png")):
                    if width > height and width >= 300:
                        return url
                        
            # fallback: first image
            images = data.get("images", [])
            if images:
                return images[0].get("imageUrl", "")
    except Exception as e:
        logger.warning(f"Thumbnail fetch failed for '{title}': {e}")
        
    return ""


def _search_platform(role: str, platform_name: str, site_filter: str) -> list[dict]:
    """Run a single Serper search for one platform."""
    query = f"{role} course {site_filter}"
    body = {
        "q": query,
        "num": 4,
        "gl": "us",
        "hl": "en",
    }
    headers = {
        "X-API-KEY": SERPER_API_KEY or "",
    }

    try:
        with httpx.Client(timeout=10) as http_client:
            resp = http_client.post(SERPER_URL, json=body, headers=headers)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.warning(f"Serper request failed for {platform_name}: {e}")
        return []

    courses = []
    for item in data.get("organic", []):
        title = item.get("title", "").strip()
        url   = item.get("link", "")
        snippet = item.get("snippet", "")

        # Skip non-course pages (blog posts, category pages, etc.)
        skip_patterns = ["blog", "category", "articles", "help.", "support."]
        if any(p in url.lower() for p in skip_patterns):
            continue
        if not title:
            continue

        # Fetch real thumbnail from images endpoint
        real_thumbnail = _fetch_thumbnail(title, platform_name)
        
        thumbnail = (
            real_thumbnail
            or item.get("imageUrl")
            or item.get("thumbnailUrl")
            or PLATFORM_THUMBS.get(platform_name, "")
        )

        courses.append({
            "id":          f"{platform_name.lower().replace(' ', '_')}_{hash(url) % 99999}",
            "title":       title,
            "url":         url,
            "platform":    platform_name,
            "thumbnail":   thumbnail,
            "price":       _extract_price(snippet, platform_name),
            "rating":      _extract_rating(snippet),
            "students":    _extract_students(snippet),
            "description": snippet[:200] if snippet else "",
            "color":       PLATFORM_COLORS.get(platform_name, "#f97316"),
        })

    return courses[:2]  # max 2 per platform


def fetch_courses(target_role: str, max_courses: int = 12) -> list[dict]:
    """
    Fetch real course recommendations from multiple platforms for a given role.

    Args:
        target_role: Job role string (e.g. "React Developer")
        max_courses: Maximum number of courses to return (default 12)

    Returns:
        List of course dicts with thumbnail, title, platform, price, url etc.
    """
    if not SERPER_API_KEY:
        logger.error("SERPER_API_KEY not set — returning empty courses")
        return []

    logger.info(f"Fetching courses for: {target_role}")
    all_courses: list[dict] = []

    import concurrent.futures
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(PLATFORMS)) as executor:
        futures = [executor.submit(_search_platform, target_role, p_name, s_filter) for p_name, s_filter in PLATFORMS]
        for future in futures:  # Preserves the priority order of platforms
            try:
                results = future.result()
                all_courses.extend(results)
                # We can stop collecting if we have enough, but futures already started
            except Exception as e:
                logger.error(f"Error fetching platform courses: {e}")

    # De-duplicate by URL
    seen_urls: set[str] = set()
    unique: list[dict] = []
    for c in all_courses:
        if c["url"] not in seen_urls:
            seen_urls.add(c["url"])
            unique.append(c)

    logger.info(f"Fetched {len(unique)} unique courses for {target_role}")
    return unique[:max_courses]

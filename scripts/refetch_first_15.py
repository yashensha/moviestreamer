#!/usr/bin/env python3
"""
Refetch First 15 Movies & Compare Differences
=============================================
Re-fetches TMDB IDs: 2, 3, 5, 6, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21
Compares against existing movie_themes.json and updates if anything new was found.
"""

import datetime
import json
import os
import re
import sys
import time
from playwright.sync_api import sync_playwright

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DATA_DIR = os.path.join(ROOT_DIR, 'src', 'data')
OUTPUT_FILE = os.path.join(DATA_DIR, 'movie_themes.json')
BROWSER_PROFILE_DIR = os.path.join(os.path.dirname(__file__), '.browser_profile')

clean = lambda lst: list(dict.fromkeys([
    x.strip() for x in lst 
    if x.strip() and x.strip() not in ['Themes', 'Nanogenres', 'Genres', 'Similar films for', 'Sign in', 'Create account']
]))

FIRST_15_IDS = ['2', '3', '5', '6', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21']


def is_letterboxd_not_found(page):
    try:
        title = page.title()
        content = page.content()
        return (
            "Film not found" in content
            or "We could not find a film" in content
            or "TMDB Import Result" in title
            or "Not Found" in title
            or "Page not found" in content
            or page.locator(".error-404, .film-not-found").count() > 0
        )
    except Exception:
        return False


def wait_until_real_letterboxd_page(page, context_name="page", max_wait_sec=120):
    start_time = time.time()
    alerted = False

    while time.time() - start_time < max_wait_sec:
        if is_letterboxd_not_found(page):
            return True

        title = page.title()
        content = page.content()
        is_cf = (
            "Just a moment" in title
            or "Cloudflare" in title
            or "Attention Required" in title
            or "Performing security verification" in content
            or "cf-turnstile" in content
            or "Verify you are human" in content
        )

        has_real_content = (
            page.locator("#tab-genres, .text-sluglist, #film-page-wrapper, .film-header-group, h1.headline-1, .sidebar, #content-nav, .subnav, .similar-films").count() > 0
            or "Similar films" in page.title()
        )

        if has_real_content and not is_cf:
            return True

        if is_cf and not alerted:
            print(f"\n[!] CAPTCHA on {context_name}. Please solve in browser window...")
            alerted = True

        time.sleep(1)

    return False


def extract_movie_metadata(page, tmdb_id):
    tmdb_url = f"https://letterboxd.com/tmdb/{tmdb_id}/"
    try:
        page.goto(tmdb_url, wait_until="domcontentloaded", timeout=30000)
    except Exception as e:
        print(f" [!] Navigation error: {e}")
        return None

    if not wait_until_real_letterboxd_page(page, context_name=f"TMDB #{tmdb_id}"):
        return None

    if is_letterboxd_not_found(page) or "tmdb/" in page.url:
        return {
            "slug": None,
            "genres": [],
            "themes": [],
            "nanogenres": [],
            "not_found": True,
            "fetched_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }

    film_url = page.url
    match = re.search(r'/film/([^/]+)/', film_url)
    slug = match.group(1) if match else None
    if not slug:
        return None

    base_film_url = f"https://letterboxd.com/film/{slug}"

    # 1. Genres
    genres = []
    try:
        page.goto(f"{base_film_url}/genres/", wait_until="domcontentloaded", timeout=25000)
        if wait_until_real_letterboxd_page(page, context_name=f"{slug} /genres/"):
            time.sleep(0.4)
            genres = clean(page.locator('a[href*="/films/genre/"]').all_inner_texts())
    except Exception as e:
        pass

    # 2. Themes (includes /films/theme/ and /films/mini-theme/)
    themes = []
    try:
        page.goto(f"{base_film_url}/themes/", wait_until="domcontentloaded", timeout=25000)
        if wait_until_real_letterboxd_page(page, context_name=f"{slug} /themes/"):
            time.sleep(0.4)
            themes = clean(page.locator('a[href*="/films/theme/"], a[href*="/films/mini-theme/"]').all_inner_texts())
    except Exception as e:
        pass

    # 3. Nanogenres (/films/nanogenre/)
    nanogenres = []
    try:
        page.goto(f"{base_film_url}/nanogenres/", wait_until="domcontentloaded", timeout=25000)
        if wait_until_real_letterboxd_page(page, context_name=f"{slug} /nanogenres/"):
            time.sleep(0.4)
            nanogenres = clean(page.locator('a[href*="/films/nanogenre/"]').all_inner_texts())
    except Exception as e:
        pass

    return {
        "slug": slug,
        "genres": genres,
        "themes": themes,
        "nanogenres": nanogenres,
        "fetched_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }


def main():
    print("=" * 70)
    print("🎬 RE-FETCHING FIRST 15 MOVIES TO COMPARE AND UPDATE")
    print(f"Target IDs: {FIRST_15_IDS}")
    print("=" * 70)

    with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
        existing_data = json.load(f)

    changes = []

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=BROWSER_PROFILE_DIR,
            headless=False,
            viewport={"width": 1280, "height": 850},
            args=["--disable-blink-features=AutomationControlled"]
        )
        page = context.pages[0] if context.pages else context.new_page()

        for idx, mid in enumerate(FIRST_15_IDS, 1):
            old_item = existing_data.get(mid, {})
            old_themes = set(old_item.get("themes", []))
            old_nanos = set(old_item.get("nanogenres", []))
            old_genres = set(old_item.get("genres", []))

            print(f"\n[{idx}/15] Checking TMDB #{mid} ({old_item.get('slug', 'unknown')})...")
            new_item = extract_movie_metadata(page, mid)

            if not new_item:
                print("  [x] Could not retrieve data.")
                continue

            new_themes = set(new_item.get("themes", []))
            new_nanos = set(new_item.get("nanogenres", []))
            new_genres = set(new_item.get("genres", []))

            added_themes = new_themes - old_themes
            added_nanos = new_nanos - old_nanos
            added_genres = new_genres - old_genres

            slug = new_item.get("slug") or old_item.get("slug")

            print(f"  Result for {slug}:")
            print(f"    - Themes:     {len(new_themes)} (was {len(old_themes)})")
            print(f"    - Nanogenres: {len(new_nanos)} (was {len(old_nanos)})")
            print(f"    - Genres:     {len(new_genres)} (was {len(old_genres)})")

            if added_themes or added_nanos or added_genres:
                print(f"    ✨ NEW DATA FOUND!")
                if added_themes:
                    print(f"       + New Themes: {list(added_themes)}")
                if added_nanos:
                    print(f"       + New Nanogenres: {list(added_nanos)}")
                if added_genres:
                    print(f"       + New Genres: {list(added_genres)}")

                changes.append({
                    "id": mid,
                    "slug": slug,
                    "added_themes": list(added_themes),
                    "added_nanos": list(added_nanos),
                    "added_genres": list(added_genres),
                    "total_themes": len(new_themes),
                    "total_nanos": len(new_nanos)
                })

                # Update in memory
                existing_data[mid] = new_item
            else:
                print("    (No new tags compared to existing file)")

            # Atomic save
            with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
                json.dump(existing_data, f, indent=2, ensure_ascii=False)

            time.sleep(1.2)

        context.close()

    print("\n" + "=" * 70)
    print(f"SUMMARY OF UPDATES ({len(changes)} movies updated with new data):")
    print("=" * 70)
    for c in changes:
        print(f"• TMDB #{c['id']} ({c['slug']}): {c['total_themes']} themes (+{len(c['added_themes'])} new), {c['total_nanos']} nanogenres (+{len(c['added_nanos'])} new)")

    if not changes:
        print("All 15 movies were already at their maximum metadata!")


if __name__ == "__main__":
    main()

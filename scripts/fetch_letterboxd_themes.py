#!/usr/bin/env python3
"""
Letterboxd Full Themes, Nanogenres & Genres Scraper
===================================================
Extracts ALL themes, nanogenres, and genres from Letterboxd:
  - Genres:     /film/{slug}/genres/      (all a[href*="/films/genre/"])
  - Themes:     /film/{slug}/themes/      (all a[href*="/films/theme/"] & a[href*="/films/mini-theme/"])
  - Nanogenres: /film/{slug}/nanogenres/  (all a[href*="/films/nanogenre/"])

Never repeats already processed movies. Progress is saved after every movie.
Automatically handles missing/deleted TMDB IDs without freezing.

Usage:
    python scripts/fetch_letterboxd_themes.py --clear          # Reset and start fresh
    python scripts/fetch_letterboxd_themes.py --limit=20       # Test 20 movies
    python scripts/fetch_letterboxd_themes.py --limit=2500     # Run top 2500
    python scripts/fetch_letterboxd_themes.py                  # Run all remaining
"""

import argparse
import datetime
import json
import os
import random
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
SUBGENRES_FILE = os.path.join(DATA_DIR, 'movie_subgenres.json')
OUTPUT_FILE = os.path.join(DATA_DIR, 'movie_themes.json')
BROWSER_PROFILE_DIR = os.path.join(os.path.dirname(__file__), '.browser_profile')

clean = lambda lst: list(dict.fromkeys([
    x.strip() for x in lst 
    if x.strip() and x.strip() not in ['Themes', 'Nanogenres', 'Genres', 'Similar films for', 'Sign in', 'Create account']
]))


def is_letterboxd_not_found(page):
    """
    Checks if Letterboxd reports a movie as missing or not found on TMDB.
    """
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


def is_cloudflare_challenge(page):
    """
    Specifically checks if a real Cloudflare challenge / Turnstile captcha is active.
    """
    try:
        title = page.title()
        content = page.content()
        return (
            "Just a moment" in title
            or "Cloudflare" in title
            or "Attention Required" in title
            or "Performing security verification" in content
            or "cf-turnstile" in content
            or "Verify you are human" in content
            or "security service to protect against malicious bots" in content
        )
    except Exception:
        return False


def wait_until_real_letterboxd_page(page, context_name="page", max_wait_sec=300):
    """
    Blocks until real Letterboxd content is loaded.
    If movie is not found, returns True immediately.
    If Cloudflare captcha is present, pauses and alerts user.
    """
    start_time = time.time()
    alerted = False

    while time.time() - start_time < max_wait_sec:
        # Check if the page is a known 'Not Found' page
        if is_letterboxd_not_found(page):
            return True

        is_cf = is_cloudflare_challenge(page)

        # Check if actual film content is loaded
        has_real_content = (
            page.locator("#tab-genres, .text-sluglist, #film-page-wrapper, .film-header-group, h1.headline-1, .sidebar, #content-nav, .subnav, .similar-films").count() > 0
            or "Similar films" in page.title()
        )

        if has_real_content and not is_cf:
            if alerted:
                print(f"\n[✓] Verification completed for {context_name}! Resuming extraction...")
                time.sleep(1)
            return True

        if is_cf:
            if not alerted:
                print("\n" + "!" * 70)
                print(f"[!] CLOUDFLARE CAPTCHA DETECTED on {context_name}!")
                print("    Please switch to the Chrome browser window and solve it.")
                print("    The script is paused and WILL NOT move to the next movie.")
                print("!" * 70 + "\n")
                alerted = True
            time.sleep(1.5)
        else:
            time.sleep(0.5)

    print(f"\n[x] Timed out waiting for {context_name}.")
    return False


def extract_movie_metadata(page, tmdb_id):
    """
    Navigates to TMDB redirect to get slug, then scrapes:
      1. /film/{slug}/genres/
      2. /film/{slug}/themes/
      3. /film/{slug}/nanogenres/
    """
    tmdb_url = f"https://letterboxd.com/tmdb/{tmdb_id}/"

    try:
        page.goto(tmdb_url, wait_until="domcontentloaded", timeout=40000)
    except Exception as e:
        print(f" [!] Navigation error to {tmdb_url}: {e}")
        return None

    if not wait_until_real_letterboxd_page(page, context_name=f"TMDB #{tmdb_id}"):
        return None

    # Check if movie was not found on Letterboxd/TMDB
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
        page.goto(f"{base_film_url}/genres/", wait_until="domcontentloaded", timeout=30000)
        if wait_until_real_letterboxd_page(page, context_name=f"{slug} /genres/"):
            time.sleep(0.4)
            genres = clean(page.locator('a[href*="/films/genre/"]').all_inner_texts())
    except Exception as e:
        print(f" [!] Error fetching genres: {e}")

    # 2. Themes (Captures both /films/theme/ and /films/mini-theme/)
    themes = []
    try:
        page.goto(f"{base_film_url}/themes/", wait_until="domcontentloaded", timeout=30000)
        if wait_until_real_letterboxd_page(page, context_name=f"{slug} /themes/"):
            time.sleep(0.4)
            themes = clean(page.locator('a[href*="/films/theme/"], a[href*="/films/mini-theme/"]').all_inner_texts())
    except Exception as e:
        print(f" [!] Error fetching themes: {e}")

    # 3. Nanogenres (Captures all /films/nanogenre/)
    nanogenres = []
    try:
        page.goto(f"{base_film_url}/nanogenres/", wait_until="domcontentloaded", timeout=30000)
        if wait_until_real_letterboxd_page(page, context_name=f"{slug} /nanogenres/"):
            time.sleep(0.4)
            nanogenres = clean(page.locator('a[href*="/films/nanogenre/"]').all_inner_texts())
    except Exception as e:
        print(f" [!] Error fetching nanogenres: {e}")

    return {
        "slug": slug,
        "genres": genres,
        "themes": themes,
        "nanogenres": nanogenres,
        "fetched_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }


def main():
    parser = argparse.ArgumentParser(description="Letterboxd Full Themes & Nanogenres Scraper")
    parser.add_argument("--limit", type=int, default=None, help="Maximum number of movies to process")
    parser.add_argument("--delay", type=float, default=1.5, help="Base delay between movies in seconds")
    parser.add_argument("--sort", choices=["popularity", "id"], default="popularity", help="Order to prioritize movies (popularity or numeric id)")
    parser.add_argument("--headless", action="store_true", help="Run browser in headless mode")
    parser.add_argument("--clear", action="store_true", help="Clear current movie_themes.json and start fresh")
    args = parser.parse_args()

    POPULARITY_FILE = os.path.join(DATA_DIR, 'movie_popularity.json')

    print("=" * 70)
    print("🎬 MOVIEWATCHER: LETTERBOXD THEMES & NANOGENRES EXTRACTOR")
    print(f"Subgenres source: {SUBGENRES_FILE}")
    print(f"Output destination: {OUTPUT_FILE}")
    print(f"Browser profile:   {BROWSER_PROFILE_DIR}")
    print(f"Priority order:    {args.sort.upper()}")
    print(f"Delay:             {args.delay}s (±0.3s jitter)")
    print(f"Headless mode:     {args.headless}")
    print("=" * 70)

    if args.clear:
        if os.path.exists(OUTPUT_FILE):
            backup_file = OUTPUT_FILE + ".bak"
            os.replace(OUTPUT_FILE, backup_file)
            print(f"[!] Cleared existing themes! Backup created at {backup_file}")
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump({}, f, indent=2)
        print("[+] Fresh empty movie_themes.json initialized.")

    if not os.path.exists(SUBGENRES_FILE):
        print(f"[x] Could not find {SUBGENRES_FILE}")
        sys.exit(1)

    with open(SUBGENRES_FILE, 'r', encoding='utf-8') as f:
        known_movies = json.load(f)

    all_ids = list(known_movies.keys())

    # Load already processed movies (so we NEVER repeat)
    themes_data = {}
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                themes_data = json.load(f)
        except Exception:
            themes_data = {}

    already_done_ids = set(themes_data.keys())
    pending_ids = [mid for mid in all_ids if mid not in already_done_ids]

    # Prioritize by popularity
    if args.sort == "popularity" and os.path.exists(POPULARITY_FILE):
        try:
            with open(POPULARITY_FILE, 'r', encoding='utf-8') as pf:
                pop_map = json.load(pf)
            pending_ids.sort(key=lambda mid: pop_map.get(mid, {}).get('pop', 0.0), reverse=True)
            print(f"[*] Sorted {len(pending_ids):,} pending movies by TMDB popularity (highest first).")
        except Exception as e:
            print(f"[!] Warning: Could not sort by popularity: {e}")

    print(f"[*] Total in catalog:     {len(all_ids):,}")
    print(f"[*] Already processed:    {len(already_done_ids):,}")
    print(f"[*] Remaining to process: {len(pending_ids):,}")

    if args.limit:
        pending_ids = pending_ids[:args.limit]
        print(f"[*] Batch limit for this run: {len(pending_ids):,}")

    if not pending_ids:
        print("[+] All movies in catalog are already processed! Nothing to do.")
        return

    os.makedirs(BROWSER_PROFILE_DIR, exist_ok=True)

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=BROWSER_PROFILE_DIR,
            headless=args.headless,
            viewport={"width": 1280, "height": 850},
            args=[
                "--disable-blink-features=AutomationControlled",
                "--start-maximized"
            ]
        )
        page = context.pages[0] if context.pages else context.new_page()

        print("\n[*] Initializing Letterboxd connection...")
        page.goto("https://letterboxd.com/", wait_until="domcontentloaded", timeout=40000)
        wait_until_real_letterboxd_page(page, context_name="Letterboxd Homepage")

        saved_count = 0
        total = len(pending_ids)

        try:
            for idx, tmdb_id in enumerate(pending_ids, 1):
                pct = ((len(themes_data) + 1) / len(all_ids)) * 100
                print(f"[{idx}/{total} | Total {len(themes_data)+1}/{len(all_ids)} ({pct:.1f}%)] Fetching TMDB #{tmdb_id}...", end="", flush=True)

                meta = extract_movie_metadata(page, tmdb_id)
                if meta:
                    themes_data[str(tmdb_id)] = meta
                    saved_count += 1
                    
                    if meta.get("not_found"):
                        print(" ✗ (Not found on Letterboxd - recorded & skipped)")
                    else:
                        t = meta.get("themes", [])
                        n = meta.get("nanogenres", [])
                        g = meta.get("genres", [])
                        slug = meta.get("slug", "unknown")
                        print(f" ✓ ({slug}) -> {len(t)} themes, {len(n)} nanogenres, {len(g)} genres")
                        if t:
                            print(f"     └─ Themes ({len(t)}): {t[:3]}...")
                        if n:
                            print(f"     └─ Nanogenres ({len(n)}): {n[:3]}...")
                else:
                    print(" ✗ Skipped/Failed")

                # Save atomically after every single item
                with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
                    json.dump(themes_data, f, indent=2, ensure_ascii=False)

                jitter = random.uniform(-0.25, 0.25)
                sleep_time = max(0.5, args.delay + jitter)
                time.sleep(sleep_time)

        except KeyboardInterrupt:
            print("\n[!] Process paused by user. All progress is saved!")
        except Exception as e:
            if "Target closed" in str(e) or "TargetClosedError" in str(type(e).__name__):
                print("\n[!] Browser window closed by user. Progress saved!")
            else:
                print(f"\n[!] Unexpected error: {e}")
        finally:
            with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
                json.dump(themes_data, f, indent=2, ensure_ascii=False)
            print(f"\n[+] Total processed movies saved in {OUTPUT_FILE}: {len(themes_data):,}")
            
            # Automatically synchronize normalized database and compact lookup tables
            try:
                import subprocess
                build_script = os.path.join(os.path.dirname(__file__), 'build_themes_nanogenres_db.py')
                if os.path.exists(build_script):
                    print("\n[*] Synchronizing normalized database & lookups...")
                    subprocess.run([sys.executable, build_script], check=False)
            except Exception as sync_err:
                print(f"[!] Warning: Could not auto-sync normalized DB: {sync_err}")

            try:
                context.close()
            except Exception:
                pass


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Build Normalized Database & Mappings for Letterboxd Themes and Nanogenres
========================================================================
1. Reads existing src/data/movie_themes.json (3,122+ movies)
2. Normalizes:
   - themes table (ID -> name)
   - nanogenres table (ID -> name)
   - movie_themes junction table (movie_id, theme_id)
   - movie_nanogenres junction table (movie_id, nanogenre_id)
3. Outputs:
   - src/data/movie_taxonomy.db (Local SQLite database ready for instant queries)
   - migrations/0002_themes_nanogenres.sql (Cloudflare D1 migration script)
   - src/data/themes_lookup.json (ID <-> Name dictionary)
   - src/data/nanogenres_lookup.json (ID <-> Name dictionary)
   - src/data/movie_theme_ids.json (Compact TMDB ID -> [theme_ids], [nanogenre_ids])
"""

import json
import os
import sqlite3
import sys

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DATA_DIR = os.path.join(ROOT_DIR, 'src', 'data')
MIGRATIONS_DIR = os.path.join(ROOT_DIR, 'migrations')
os.makedirs(MIGRATIONS_DIR, exist_ok=True)

INPUT_JSON = os.path.join(DATA_DIR, 'movie_themes.json')
SQLITE_DB = os.path.join(DATA_DIR, 'movie_taxonomy.db')
MIGRATION_SQL = os.path.join(MIGRATIONS_DIR, '0002_themes_nanogenres.sql')
THEMES_LOOKUP_FILE = os.path.join(DATA_DIR, 'themes_lookup.json')
NANOS_LOOKUP_FILE = os.path.join(DATA_DIR, 'nanogenres_lookup.json')
MOVIE_THEME_IDS_FILE = os.path.join(DATA_DIR, 'movie_theme_ids.json')


def main():
    print("=" * 70)
    print("🔨 NORMALIZING THEMES & NANOGENRES FOR MOVIEWATCHER")
    print("=" * 70)

    if not os.path.exists(INPUT_JSON):
        print(f"[!] Error: {INPUT_JSON} not found!")
        return

    with open(INPUT_JSON, 'r', encoding='utf-8') as f:
        movies_data = json.load(f)

    print(f"[*] Loaded {len(movies_data)} movies from {os.path.basename(INPUT_JSON)}")

    # 1. Load existing lookups if present to ensure STABLE, IMMUTABLE IDs
    theme_to_id = {}
    id_to_theme = {}
    if os.path.exists(THEMES_LOOKUP_FILE):
        try:
            with open(THEMES_LOOKUP_FILE, 'r', encoding='utf-8') as f:
                prev_themes = json.load(f)
                theme_to_id = {k: int(v) for k, v in prev_themes.get("byName", {}).items()}
                id_to_theme = {int(k): v for k, v in prev_themes.get("byId", {}).items()}
        except Exception:
            pass

    nano_to_id = {}
    id_to_nano = {}
    if os.path.exists(NANOS_LOOKUP_FILE):
        try:
            with open(NANOS_LOOKUP_FILE, 'r', encoding='utf-8') as f:
                prev_nanos = json.load(f)
                nano_to_id = {k: int(v) for k, v in prev_nanos.get("byName", {}).items()}
                id_to_nano = {int(k): v for k, v in prev_nanos.get("byId", {}).items()}
        except Exception:
            pass

    # Collect all themes and nanogenres in movies_data
    new_themes_count = 0
    new_nanos_count = 0

    for info in movies_data.values():
        if info.get('not_found'):
            continue
        for t in info.get('themes', []):
            t_clean = t.strip()
            if t_clean and t_clean not in theme_to_id:
                new_id = len(theme_to_id) + 1
                theme_to_id[t_clean] = new_id
                id_to_theme[new_id] = t_clean
                new_themes_count += 1

        for n in info.get('nanogenres', []):
            n_clean = n.strip()
            if n_clean and n_clean not in nano_to_id:
                new_id = len(nano_to_id) + 1
                nano_to_id[n_clean] = new_id
                id_to_nano[new_id] = n_clean
                new_nanos_count += 1

    print(f"[*] Total themes: {len(theme_to_id)} (+{new_themes_count} newly added)")
    print(f"[*] Total nanogenres: {len(nano_to_id)} (+{new_nanos_count} newly added)")

    # 2. Build junction rows
    movie_themes_rows = []
    movie_nanos_rows = []
    compact_movie_ids = {}

    for mid_str, info in movies_data.items():
        if info.get('not_found'):
            continue
        try:
            mid = int(mid_str)
        except ValueError:
            continue

        m_themes = [theme_to_id[t.strip()] for t in info.get('themes', []) if t.strip() in theme_to_id]
        m_nanos = [nano_to_id[n.strip()] for n in info.get('nanogenres', []) if n.strip() in nano_to_id]

        for tid in m_themes:
            movie_themes_rows.append((mid, tid))
        for nid in m_nanos:
            movie_nanos_rows.append((mid, nid))

        if m_themes or m_nanos:
            compact_movie_ids[mid_str] = {
                "t": m_themes,
                "n": m_nanos
            }

    print(f"[*] Generated {len(movie_themes_rows)} movie-theme links.")
    print(f"[*] Generated {len(movie_nanos_rows)} movie-nanogenre links.")

    # 3. Create & Populate local SQLite database
    print(f"[*] Creating local SQLite database: {SQLITE_DB}")
    if os.path.exists(SQLITE_DB):
        os.remove(SQLITE_DB)

    conn = sqlite3.connect(SQLITE_DB)
    cur = conn.cursor()

    cur.executescript("""
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS themes (
      id INTEGER PRIMARY KEY,
      name TEXT UNIQUE NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_themes_name ON themes(name);

    CREATE TABLE IF NOT EXISTS nanogenres (
      id INTEGER PRIMARY KEY,
      name TEXT UNIQUE NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_nanogenres_name ON nanogenres(name);

    CREATE TABLE IF NOT EXISTS movie_themes (
      movie_id INTEGER NOT NULL,
      theme_id INTEGER NOT NULL,
      PRIMARY KEY (movie_id, theme_id),
      FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_movie_themes_theme ON movie_themes(theme_id);
    CREATE INDEX IF NOT EXISTS idx_movie_themes_movie ON movie_themes(movie_id);

    CREATE TABLE IF NOT EXISTS movie_nanogenres (
      movie_id INTEGER NOT NULL,
      nanogenre_id INTEGER NOT NULL,
      PRIMARY KEY (movie_id, nanogenre_id),
      FOREIGN KEY (nanogenre_id) REFERENCES nanogenres(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_movie_nanogenres_nano ON movie_nanogenres(nanogenre_id);
    CREATE INDEX IF NOT EXISTS idx_movie_nanogenres_movie ON movie_nanogenres(movie_id);
    """)

    cur.executemany("INSERT INTO themes (id, name) VALUES (?, ?);", sorted(id_to_theme.items()))
    cur.executemany("INSERT INTO nanogenres (id, name) VALUES (?, ?);", sorted(id_to_nano.items()))
    cur.executemany("INSERT OR IGNORE INTO movie_themes (movie_id, theme_id) VALUES (?, ?);", movie_themes_rows)
    cur.executemany("INSERT OR IGNORE INTO movie_nanogenres (movie_id, nanogenre_id) VALUES (?, ?);", movie_nanos_rows)

    conn.commit()
    conn.close()
    print("  ✓ SQLite database successfully written and indexed.")

    # 4. Generate Cloudflare D1 Migration SQL file
    print(f"[*] Writing D1 SQL migration file: {MIGRATION_SQL}")
    with open(MIGRATION_SQL, 'w', encoding='utf-8') as sql_f:
        sql_f.write("-- ==============================================================================\n")
        sql_f.write("-- Migration 0002: Normalized Themes and Nanogenres for Cloudflare D1\n")
        sql_f.write("-- ==============================================================================\n\n")

        sql_f.write("CREATE TABLE IF NOT EXISTS themes (\n")
        sql_f.write("  id INTEGER PRIMARY KEY,\n")
        sql_f.write("  name TEXT UNIQUE NOT NULL\n")
        sql_f.write(");\n")
        sql_f.write("CREATE INDEX IF NOT EXISTS idx_themes_name ON themes(name);\n\n")

        sql_f.write("CREATE TABLE IF NOT EXISTS nanogenres (\n")
        sql_f.write("  id INTEGER PRIMARY KEY,\n")
        sql_f.write("  name TEXT UNIQUE NOT NULL\n")
        sql_f.write(");\n")
        sql_f.write("CREATE INDEX IF NOT EXISTS idx_nanogenres_name ON nanogenres(name);\n\n")

        sql_f.write("CREATE TABLE IF NOT EXISTS movie_themes (\n")
        sql_f.write("  movie_id INTEGER NOT NULL,\n")
        sql_f.write("  theme_id INTEGER NOT NULL,\n")
        sql_f.write("  PRIMARY KEY (movie_id, theme_id)\n")
        sql_f.write(");\n")
        sql_f.write("CREATE INDEX IF NOT EXISTS idx_movie_themes_theme ON movie_themes(theme_id);\n")
        sql_f.write("CREATE INDEX IF NOT EXISTS idx_movie_themes_movie ON movie_themes(movie_id);\n\n")

        sql_f.write("CREATE TABLE IF NOT EXISTS movie_nanogenres (\n")
        sql_f.write("  movie_id INTEGER NOT NULL,\n")
        sql_f.write("  nanogenre_id INTEGER NOT NULL,\n")
        sql_f.write("  PRIMARY KEY (movie_id, nanogenre_id)\n")
        sql_f.write(");\n")
        sql_f.write("CREATE INDEX IF NOT EXISTS idx_movie_nanogenres_nano ON movie_nanogenres(nanogenre_id);\n")
        sql_f.write("CREATE INDEX IF NOT EXISTS idx_movie_nanogenres_movie ON movie_nanogenres(movie_id);\n\n")

        # Themes
        sql_f.write("-- --- Themes Data ---\n")
        for idx, name in sorted(id_to_theme.items()):
            safe_name = name.replace("'", "''")
            sql_f.write(f"INSERT OR IGNORE INTO themes (id, name) VALUES ({idx}, '{safe_name}');\n")

        # Nanogenres
        sql_f.write("\n-- --- Nanogenres Data ---\n")
        for idx, name in sorted(id_to_nano.items()):
            safe_name = name.replace("'", "''")
            sql_f.write(f"INSERT OR IGNORE INTO nanogenres (id, name) VALUES ({idx}, '{safe_name}');\n")

        # Movie Themes
        sql_f.write("\n-- --- Movie Themes Data ---\n")
        for mid, tid in movie_themes_rows:
            sql_f.write(f"INSERT OR IGNORE INTO movie_themes (movie_id, theme_id) VALUES ({mid}, {tid});\n")

        # Movie Nanogenres
        sql_f.write("\n-- --- Movie Nanogenres Data ---\n")
        for mid, nid in movie_nanos_rows:
            sql_f.write(f"INSERT OR IGNORE INTO movie_nanogenres (movie_id, nanogenre_id) VALUES ({mid}, {nid});\n")

    print(f"  ✓ SQL migration written ({os.path.getsize(MIGRATION_SQL):,} bytes).")

    # 5. Export lightweight JSON lookups for web app / edge functions
    print(f"[*] Exporting JSON lookup files...")
    with open(THEMES_LOOKUP_FILE, 'w', encoding='utf-8') as f:
        json.dump({"byId": id_to_theme, "byName": theme_to_id}, f, indent=2, ensure_ascii=False)

    with open(NANOS_LOOKUP_FILE, 'w', encoding='utf-8') as f:
        json.dump({"byId": id_to_nano, "byName": nano_to_id}, f, indent=2, ensure_ascii=False)

    with open(MOVIE_THEME_IDS_FILE, 'w', encoding='utf-8') as f:
        json.dump(compact_movie_ids, f, separators=(',', ':'), ensure_ascii=False)

    print(f"  ✓ {THEMES_LOOKUP_FILE} created.")
    print(f"  ✓ {NANOS_LOOKUP_FILE} created.")
    print(f"  ✓ {MOVIE_THEME_IDS_FILE} created ({os.path.getsize(MOVIE_THEME_IDS_FILE):,} bytes vs original {os.path.getsize(INPUT_JSON):,} bytes).")

    print("\n" + "=" * 70)
    print("🎉 ALL DATA NORMALIZED AND LINKED SUCCESSFULLY!")
    print("=" * 70)


if __name__ == "__main__":
    main()

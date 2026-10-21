#!/usr/bin/env python3
"""
AI Bulk Theme & Nanogenre Predictor for TV Shows & Series
=========================================================
Applies the trained multi-label NLP engine to all 4,867 TV shows
in src/data/tv_subgenres.json:
  1. Predicts top Letterboxd Themes (from 109 taxonomy)
  2. Predicts top Nanogenres (from 6,307 micro-genres)
  3. Outputs:
     - src/data/tv_themes.json
     - src/data/tv_theme_ids.json (compact ID mapping)
     - migrations/0003_tv_themes_nanogenres.sql (Cloudflare D1 migration)
     - Updates src/data/movie_taxonomy.db with tv_themes and tv_nanogenres
"""

import argparse
import datetime
import json
import os
import re
import sqlite3
import sys
import time
import numpy as np

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.multiclass import OneVsRestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import MultiLabelBinarizer

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DATA_DIR = os.path.join(ROOT_DIR, 'src', 'data')
MIGRATIONS_DIR = os.path.join(ROOT_DIR, 'migrations')

MOVIE_THEMES_FILE = os.path.join(DATA_DIR, 'movie_themes.json')
MOVIE_SUBS_FILE = os.path.join(DATA_DIR, 'movie_subgenres.json')
TV_SUBS_FILE = os.path.join(DATA_DIR, 'tv_subgenres.json')
TV_OUTPUT_FILE = os.path.join(DATA_DIR, 'tv_themes.json')
TV_THEME_IDS_FILE = os.path.join(DATA_DIR, 'tv_theme_ids.json')
THEMES_LOOKUP_FILE = os.path.join(DATA_DIR, 'themes_lookup.json')
NANOS_LOOKUP_FILE = os.path.join(DATA_DIR, 'nanogenres_lookup.json')
SQLITE_DB = os.path.join(DATA_DIR, 'movie_taxonomy.db')
MIGRATION_SQL = os.path.join(MIGRATIONS_DIR, '0003_tv_themes_nanogenres.sql')


def build_semantic_theme_keywords(themes_list):
    stopwords = {'and', 'the', 'of', 'in', 'with', 'a', 'to', 'for', 'or', 'stories', 'dramas', 'drama', 'classics'}
    theme_keywords = {}
    for theme in themes_list:
        words = set(re.findall(r'[a-zA-Z]+', theme.lower())) - stopwords
        theme_keywords[theme] = words
    return theme_keywords


def main():
    parser = argparse.ArgumentParser(description="AI TV Theme & Nanogenre Predictor")
    parser.add_argument("--dry-run", action="store_true", help="Print sample predictions without saving")
    args = parser.parse_args()

    print("=" * 70)
    print("📺 AI BULK THEME & NANOGENRE PREDICTOR FOR TV SHOWS")
    print("=" * 70)

    # 1. Load TV Shows
    with open(TV_SUBS_FILE, 'r', encoding='utf-8') as f:
        tv_catalog = json.load(f)

    # 2. Load Movie Ground Truth for training
    with open(MOVIE_SUBS_FILE, 'r', encoding='utf-8') as f:
        movie_subs = json.load(f)

    with open(MOVIE_THEMES_FILE, 'r', encoding='utf-8') as f:
        movie_themes = json.load(f)

    # Ground truth movies from Letterboxd
    ground_truth = {
        mid: info for mid, info in movie_themes.items()
        if not info.get('not_found') and info.get('source') != 'ai' and (info.get('themes') or info.get('nanogenres'))
    }

    print(f"[*] Total TV shows to tag:     {len(tv_catalog):,}")
    print(f"[*] Training ground truth:     {len(ground_truth):,} verified titles")

    # 3. Train Classifier
    print("\n[*] Training AI Multi-Label Classifier...")
    t0 = time.time()

    train_texts = []
    train_themes = []
    train_nanos = []

    for mid, info in ground_truth.items():
        kw = movie_subs.get(mid, [])
        if not kw:
            continue
        themes = info.get('themes', [])
        nanos = info.get('nanogenres', [])
        if not themes:
            continue

        train_texts.append(" ".join(kw))
        train_themes.append(themes)
        train_nanos.append(nanos)

    vectorizer = TfidfVectorizer(ngram_range=(1, 2), min_df=1, max_features=12000, sublinear_tf=True)
    X_train_vec = vectorizer.fit_transform(train_texts)

    mlb_themes = MultiLabelBinarizer()
    y_train_themes = mlb_themes.fit_transform(train_themes)

    nano_counts = {}
    for n_list in train_nanos:
        for n in n_list:
            nano_counts[n] = nano_counts.get(n, 0) + 1

    common_nanos = {n for n, c in nano_counts.items() if c >= 2}
    filtered_train_nanos = [[n for n in n_list if n in common_nanos] for n_list in train_nanos]

    mlb_nanos = MultiLabelBinarizer()
    y_train_nanos = mlb_nanos.fit_transform(filtered_train_nanos)

    clf_themes = OneVsRestClassifier(LogisticRegression(max_iter=400, C=3.0, solver='liblinear'))
    clf_themes.fit(X_train_vec, y_train_themes)

    clf_nanos = OneVsRestClassifier(LogisticRegression(max_iter=400, C=2.5, solver='liblinear'))
    clf_nanos.fit(X_train_vec, y_train_nanos)

    print(f"  ✓ Model trained in {time.time() - t0:.2f} seconds.")

    # 4. Predict on TV Shows
    print(f"\n[*] Predicting themes and nanogenres for {len(tv_catalog):,} TV shows...")
    t1 = time.time()

    tv_items = list(tv_catalog.values())
    tv_texts = []

    for item in tv_items:
        title = item.get('title', '')
        kw = item.get('keywords', [])
        clusters = item.get('clusters', [])
        subgenres = item.get('subgenres', [])
        text_repr = f"{title} {' '.join(kw)} {' '.join(clusters)} {' '.join(subgenres)}"
        tv_texts.append(text_repr)

    X_tv_vec = vectorizer.transform(tv_texts)

    theme_probs = clf_themes.predict_proba(X_tv_vec)
    nano_probs = clf_nanos.predict_proba(X_tv_vec)

    theme_classes = mlb_themes.classes_
    nano_classes = mlb_nanos.classes_
    theme_keywords = build_semantic_theme_keywords(theme_classes)

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    tv_results = {}

    for idx, item in enumerate(tv_items):
        tid_str = str(item['id'])
        kw_set = set(tv_texts[idx].lower().split())

        probs = theme_probs[idx].copy()
        for c_idx, t_name in enumerate(theme_classes):
            overlap = len(theme_keywords[t_name] & kw_set)
            if overlap > 0:
                probs[c_idx] += (overlap * 0.15)

        sorted_theme_indices = np.argsort(probs)[::-1]
        top_themes = [theme_classes[i] for i in sorted_theme_indices if probs[i] >= 0.25][:7]
        if len(top_themes) < 3:
            top_themes = [theme_classes[i] for i in sorted_theme_indices[:4]]

        sorted_nano_indices = np.argsort(nano_probs[idx])[::-1]
        top_nanos = [nano_classes[i] for i in sorted_nano_indices if nano_probs[idx][i] >= 0.15][:8]
        if len(top_nanos) < 4:
            top_nanos = [nano_classes[i] for i in sorted_nano_indices[:5]]

        tv_results[tid_str] = {
            "title": item.get('title', ''),
            "year": item.get('year'),
            "popularity": item.get('popularity'),
            "vote_average": item.get('vote_average'),
            "themes": top_themes,
            "nanogenres": top_nanos,
            "source": "ai",
            "fetched_at": now_iso
        }

    print(f"  ✓ TV predictions completed in {time.time() - t1:.2f} seconds!")

    # 5. Preview Samples
    print("\n" + "=" * 70)
    print("📋 SAMPLE TV SHOW PREDICTIONS:")
    print("=" * 70)

    sample_check_ids = ['1396', '1399', '2316', '66732', '456', '2734']
    for sid in sample_check_ids:
        if sid in tv_results:
            show = tv_results[sid]
            print(f"\n{show['title']} (TV #{sid}):")
            print(f"  Themes:  {show['themes']}")
            print(f"  Nanos:   {show['nanogenres'][:4]}")

    if args.dry_run:
        print("\n[!] Dry run mode: No changes written.")
        return

    # 6. Save tv_themes.json
    print(f"\n[*] Writing {TV_OUTPUT_FILE}...")
    with open(TV_OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(tv_results, f, indent=2, ensure_ascii=False)
    print(f"  ✓ Saved {len(tv_results):,} TV shows.")

    # 7. Map to IDs & Save tv_theme_ids.json
    print(f"[*] Mapping TV shows to numeric IDs...")
    with open(THEMES_LOOKUP_FILE, 'r', encoding='utf-8') as f:
        themes_lookup = json.load(f).get('byName', {})
    with open(NANOS_LOOKUP_FILE, 'r', encoding='utf-8') as f:
        nanos_lookup = json.load(f).get('byName', {})

    tv_compact_ids = {}
    tv_theme_links = []
    tv_nano_links = []

    for sid_str, info in tv_results.items():
        sid = int(sid_str)
        t_ids = [themes_lookup[t] for t in info['themes'] if t in themes_lookup]
        n_ids = [nanos_lookup[n] for n in info['nanogenres'] if n in nanos_lookup]

        for tid in t_ids:
            tv_theme_links.append((sid, tid))
        for nid in n_ids:
            tv_nano_links.append((sid, nid))

        if t_ids or n_ids:
            tv_compact_ids[sid_str] = {
                "t": t_ids,
                "n": n_ids
            }

    with open(TV_THEME_IDS_FILE, 'w', encoding='utf-8') as f:
        json.dump(tv_compact_ids, f, separators=(',', ':'), ensure_ascii=False)
    print(f"  ✓ {TV_THEME_IDS_FILE} saved ({os.path.getsize(TV_THEME_IDS_FILE):,} bytes).")
    print(f"  ✓ Generated {len(tv_theme_links):,} tv-theme links.")
    print(f"  ✓ Generated {len(tv_nano_links):,} tv-nanogenre links.")

    # 8. Update SQLite Database with tv_themes and tv_nanogenres
    print(f"[*] Updating SQLite database {SQLITE_DB}...")
    conn = sqlite3.connect(SQLITE_DB)
    cur = conn.cursor()

    cur.executescript("""
    CREATE TABLE IF NOT EXISTS tv_themes (
      tv_id INTEGER NOT NULL,
      theme_id INTEGER NOT NULL,
      PRIMARY KEY (tv_id, theme_id),
      FOREIGN KEY (theme_id) REFERENCES themes(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_tv_themes_theme ON tv_themes(theme_id);
    CREATE INDEX IF NOT EXISTS idx_tv_themes_tv ON tv_themes(tv_id);

    CREATE TABLE IF NOT EXISTS tv_nanogenres (
      tv_id INTEGER NOT NULL,
      nanogenre_id INTEGER NOT NULL,
      PRIMARY KEY (tv_id, nanogenre_id),
      FOREIGN KEY (nanogenre_id) REFERENCES nanogenres(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_tv_nanogenres_nano ON tv_nanogenres(nanogenre_id);
    CREATE INDEX IF NOT EXISTS idx_tv_nanogenres_tv ON tv_nanogenres(tv_id);
    """)

    cur.execute("DELETE FROM tv_themes;")
    cur.execute("DELETE FROM tv_nanogenres;")
    cur.executemany("INSERT OR IGNORE INTO tv_themes (tv_id, theme_id) VALUES (?, ?);", tv_theme_links)
    cur.executemany("INSERT OR IGNORE INTO tv_nanogenres (tv_id, nanogenre_id) VALUES (?, ?);", tv_nano_links)
    conn.commit()
    conn.close()
    print("  ✓ SQLite tv_themes and tv_nanogenres populated.")

    # 9. Write Cloudflare D1 Migration SQL
    print(f"[*] Generating Cloudflare D1 migration: {MIGRATION_SQL}...")
    with open(MIGRATION_SQL, 'w', encoding='utf-8') as sql_f:
        sql_f.write("-- ==============================================================================\n")
        sql_f.write("-- Migration 0003: TV Series Themes and Nanogenres for Cloudflare D1\n")
        sql_f.write("-- ==============================================================================\n\n")

        sql_f.write("CREATE TABLE IF NOT EXISTS tv_themes (\n")
        sql_f.write("  tv_id INTEGER NOT NULL,\n")
        sql_f.write("  theme_id INTEGER NOT NULL,\n")
        sql_f.write("  PRIMARY KEY (tv_id, theme_id)\n")
        sql_f.write(");\n")
        sql_f.write("CREATE INDEX IF NOT EXISTS idx_tv_themes_theme ON tv_themes(theme_id);\n")
        sql_f.write("CREATE INDEX IF NOT EXISTS idx_tv_themes_tv ON tv_themes(tv_id);\n\n")

        sql_f.write("CREATE TABLE IF NOT EXISTS tv_nanogenres (\n")
        sql_f.write("  tv_id INTEGER NOT NULL,\n")
        sql_f.write("  nanogenre_id INTEGER NOT NULL,\n")
        sql_f.write("  PRIMARY KEY (tv_id, nanogenre_id)\n")
        sql_f.write(");\n")
        sql_f.write("CREATE INDEX IF NOT EXISTS idx_tv_nanogenres_nano ON tv_nanogenres(nanogenre_id);\n")
        sql_f.write("CREATE INDEX IF NOT EXISTS idx_tv_nanogenres_tv ON tv_nanogenres(tv_id);\n\n")

        sql_f.write("-- --- TV Themes Data ---\n")
        for tid, th_id in tv_theme_links:
            sql_f.write(f"INSERT OR IGNORE INTO tv_themes (tv_id, theme_id) VALUES ({tid}, {th_id});\n")

        sql_f.write("\n-- --- TV Nanogenres Data ---\n")
        for tid, n_id in tv_nano_links:
            sql_f.write(f"INSERT OR IGNORE INTO tv_nanogenres (tv_id, nanogenre_id) VALUES ({tid}, {n_id});\n")

    print(f"  ✓ {MIGRATION_SQL} written ({os.path.getsize(MIGRATION_SQL):,} bytes).")

    print("\n" + "=" * 70)
    print("🎉 ALL TV SHOWS FULLY TAGGED AND DATABASE SYNCHRONIZED!")
    print("=" * 70)


if __name__ == "__main__":
    main()

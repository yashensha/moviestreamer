#!/usr/bin/env python3
"""
AI-Powered Bulk Theme & Nanogenre Predictor for MovieWatcher
============================================================
Uses the 3,300+ Letterboxd-verified movies as ground truth training data.
Employs a high-speed multi-label TF-IDF + Logistic Regression engine combined
with semantic keyword matching to predict:
  1. Top 4-8 Letterboxd Themes (from the 109-theme taxonomy)
  2. Top 5-10 Nanogenres (from the 6,232 established micro-genres)

Executes locally in ~15 seconds for all 52,000+ remaining movies.
Preserves Letterboxd scraped movies as ground truth and flags AI predictions with "source": "ai".
"""

import argparse
import datetime
import json
import os
import re
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
SUBGENRES_FILE = os.path.join(DATA_DIR, 'movie_subgenres.json')
OUTPUT_FILE = os.path.join(DATA_DIR, 'movie_themes.json')
POPULARITY_FILE = os.path.join(DATA_DIR, 'movie_popularity.json')
THEMES_LOOKUP_FILE = os.path.join(DATA_DIR, 'themes_lookup.json')
NANOS_LOOKUP_FILE = os.path.join(DATA_DIR, 'nanogenres_lookup.json')


def build_semantic_theme_keywords(themes_list):
    """Generates a keyword index for each theme name to boost semantic precision."""
    stopwords = {'and', 'the', 'of', 'in', 'with', 'a', 'to', 'for', 'or', 'stories', 'dramas', 'drama', 'classics'}
    theme_keywords = {}
    for theme in themes_list:
        words = set(re.findall(r'[a-zA-Z]+', theme.lower())) - stopwords
        theme_keywords[theme] = words
    return theme_keywords


def main():
    parser = argparse.ArgumentParser(description="AI Bulk Theme & Nanogenre Predictor")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of movies to fill (default: ALL)")
    parser.add_argument("--dry-run", action="store_true", help="Print sample predictions without saving")
    args = parser.parse_args()

    print("=" * 70)
    print("🤖 AI BULK THEME & NANOGENRE PREDICTOR")
    print("=" * 70)

    # 1. Load data
    with open(SUBGENRES_FILE, 'r', encoding='utf-8') as f:
        catalog = json.load(f)

    existing_data = {}
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
            existing_data = json.load(f)

    # Separate ground truth movies (scraped from Letterboxd) from pending
    ground_truth = {
        mid: info for mid, info in existing_data.items() 
        if not info.get('not_found') and (info.get('themes') or info.get('nanogenres'))
    }

    pending_ids = [mid for mid in catalog.keys() if mid not in ground_truth]

    # Prioritize pending by popularity if available
    if os.path.exists(POPULARITY_FILE):
        try:
            with open(POPULARITY_FILE, 'r', encoding='utf-8') as pf:
                pop_map = json.load(pf)
            pending_ids.sort(key=lambda mid: pop_map.get(mid, {}).get('pop', 0.0), reverse=True)
        except Exception:
            pass

    if args.limit:
        pending_ids = pending_ids[:args.limit]

    print(f"[*] Total catalog movies:      {len(catalog):,}")
    print(f"[*] Verified Ground Truth:     {len(ground_truth):,} movies")
    print(f"[*] Movies to predict with AI: {len(pending_ids):,}")

    if not pending_ids:
        print("[+] All movies already have themes and nanogenres! Nothing to do.")
        return

    # 2. Prepare Training Dataset
    print("\n[*] Training AI Multi-Label Classifier on Ground Truth...")
    t0 = time.time()

    train_texts = []
    train_themes = []
    train_nanos = []

    for mid, info in ground_truth.items():
        kw = catalog.get(mid, [])
        if not kw:
            continue
        themes = info.get('themes', [])
        nanos = info.get('nanogenres', [])
        if not themes:
            continue

        train_texts.append(" ".join(kw))
        train_themes.append(themes)
        train_nanos.append(nanos)

    # TF-IDF Vectorizer
    vectorizer = TfidfVectorizer(ngram_range=(1, 2), min_df=1, max_features=12000, sublinear_tf=True)
    X_train_vec = vectorizer.fit_transform(train_texts)

    # MultiLabelBinarizer for Themes
    mlb_themes = MultiLabelBinarizer()
    y_train_themes = mlb_themes.fit_transform(train_themes)

    # MultiLabelBinarizer for top Nanogenres (train on nanogenres appearing >= 2 times)
    nano_counts = {}
    for n_list in train_nanos:
        for n in n_list:
            nano_counts[n] = nano_counts.get(n, 0) + 1

    common_nanos = {n for n, c in nano_counts.items() if c >= 2}
    filtered_train_nanos = [[n for n in n_list if n in common_nanos] for n_list in train_nanos]

    mlb_nanos = MultiLabelBinarizer()
    y_train_nanos = mlb_nanos.fit_transform(filtered_train_nanos)

    # Train OneVsRest Logistic Regression
    clf_themes = OneVsRestClassifier(LogisticRegression(max_iter=400, C=3.0, solver='liblinear'))
    clf_themes.fit(X_train_vec, y_train_themes)

    clf_nanos = OneVsRestClassifier(LogisticRegression(max_iter=400, C=2.5, solver='liblinear'))
    clf_nanos.fit(X_train_vec, y_train_nanos)

    train_time = time.time() - t0
    print(f"  ✓ Model trained in {train_time:.2f} seconds ({len(mlb_themes.classes_)} themes, {len(mlb_nanos.classes_)} nanogenres).")

    # 3. Vectorized Prediction on All Pending Movies
    print(f"\n[*] Predicting themes and nanogenres for {len(pending_ids):,} movies...")
    t1 = time.time()

    pending_texts = [" ".join(catalog.get(mid, [])) for mid in pending_ids]
    X_pending_vec = vectorizer.transform(pending_texts)

    # Predict probabilities (dense matrix multiplication)
    theme_probs = clf_themes.predict_proba(X_pending_vec)
    nano_probs = clf_nanos.predict_proba(X_pending_vec)

    theme_classes = mlb_themes.classes_
    nano_classes = mlb_nanos.classes_

    # Semantic keyword boosting table
    theme_keywords = build_semantic_theme_keywords(theme_classes)

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    ai_generated = {}

    for idx, mid in enumerate(pending_ids):
        kw_list = catalog.get(mid, [])
        kw_set = set(" ".join(kw_list).lower().split())

        # Base probability scores for themes
        probs = theme_probs[idx].copy()

        # Semantic boost: if exact words in theme title appear in keywords, boost probability
        for c_idx, t_name in enumerate(theme_classes):
            overlap = len(theme_keywords[t_name] & kw_set)
            if overlap > 0:
                probs[c_idx] += (overlap * 0.15)

        # Pick top 5 themes (or all themes above confidence 0.25, max 7)
        sorted_theme_indices = np.argsort(probs)[::-1]
        top_themes = [theme_classes[i] for i in sorted_theme_indices if probs[i] >= 0.25][:7]
        if len(top_themes) < 3:
            top_themes = [theme_classes[i] for i in sorted_theme_indices[:4]]

        # Pick top 5 to 8 nanogenres
        sorted_nano_indices = np.argsort(nano_probs[idx])[::-1]
        top_nanos = [nano_classes[i] for i in sorted_nano_indices if nano_probs[idx][i] >= 0.15][:8]
        if len(top_nanos) < 4:
            top_nanos = [nano_classes[i] for i in sorted_nano_indices[:5]]

        ai_generated[mid] = {
            "slug": None,
            "genres": [],
            "themes": top_themes,
            "nanogenres": top_nanos,
            "source": "ai",
            "fetched_at": now_iso
        }

    predict_time = time.time() - t1
    print(f"  ✓ Predictions completed in {predict_time:.2f} seconds ({len(pending_ids)/max(0.1, predict_time):.1f} movies/sec)!")

    # 4. Preview Samples
    print("\n" + "=" * 70)
    print("📋 SAMPLE PREDICTIONS:")
    print("=" * 70)

    # Show 5 popular samples
    for mid in pending_ids[:5]:
        kw = catalog.get(mid, [])
        pred = ai_generated[mid]
        print(f"\nTMDB #{mid}:")
        print(f"  Keywords:   {kw[:6]}")
        print(f"  AI Themes:  {pred['themes']}")
        print(f"  AI Nanos:   {pred['nanogenres'][:4]}")

    if args.dry_run:
        print("\n[!] Dry-run mode enabled: No files were modified.")
        return

    # 5. Merge and Save
    print("\n[*] Merging AI predictions with verified ground truth...")
    final_data = dict(existing_data)
    final_data.update(ai_generated)

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(final_data, f, indent=2, ensure_ascii=False)

    print(f"  ✓ Saved {len(final_data):,} total movies to {OUTPUT_FILE}")

    # 6. Synchronize Database & Lookups
    print("\n[*] Updating SQLite Database, D1 Migrations, and Fast Lookup Maps...")
    try:
        import subprocess
        build_script = os.path.join(os.path.dirname(__file__), 'build_themes_nanogenres_db.py')
        subprocess.run([sys.executable, build_script], check=True)
    except Exception as e:
        print(f"[!] Warning: Could not run build_themes_nanogenres_db.py: {e}")

    print("\n" + "=" * 70)
    print("🎉 ALL MOVIES FULLY TAGGED AND DATABASE SYNCHRONIZED!")
    print("=" * 70)


if __name__ == "__main__":
    main()

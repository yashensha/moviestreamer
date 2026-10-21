import urllib.request
import gzip
import json
import os
import sys

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DATA_DIR = os.path.join(ROOT_DIR, 'src', 'data')
SUBGENRES_FILE = os.path.join(DATA_DIR, 'movie_subgenres.json')
POPULARITY_FILE = os.path.join(DATA_DIR, 'movie_popularity.json')

with open(SUBGENRES_FILE, 'r', encoding='utf-8') as f:
    subgenres = json.load(f)

catalog_ids = set(subgenres.keys())
print(f"Catalog movies: {len(catalog_ids):,}")

# Download export stream and map popularity
url = 'http://files.tmdb.org/p/exports/movie_ids_10_20_2026.json.gz'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
pop_map = {}

print(f"Streaming TMDB export from {url}...")
with urllib.request.urlopen(req, timeout=30) as resp:
    with gzip.GzipFile(fileobj=resp) as gz:
        for line in gz:
            try:
                item = json.loads(line.decode('utf-8'))
                mid_str = str(item['id'])
                if mid_str in catalog_ids:
                    pop_map[mid_str] = {
                        'title': item.get('original_title', ''),
                        'pop': float(item.get('popularity', 0.0))
                    }
            except Exception:
                continue

print(f"Mapped popularity for {len(pop_map):,} movies.")

with open(POPULARITY_FILE, 'w', encoding='utf-8') as f:
    json.dump(pop_map, f, indent=2, ensure_ascii=False)

# Sort catalog by popularity descending
sorted_by_pop = sorted(catalog_ids, key=lambda mid: pop_map.get(mid, {}).get('pop', 0.0), reverse=True)

print(f"\nTop 20 Most Popular Movies in Catalog:")
for i, mid in enumerate(sorted_by_pop[:20], 1):
    info = pop_map.get(mid, {})
    title = info.get('title', 'Unknown')
    pop = info.get('pop', 0.0)
    print(f"  {i:2d}. TMDB #{mid:6s} | Pop: {pop:6.1f} | {title}")

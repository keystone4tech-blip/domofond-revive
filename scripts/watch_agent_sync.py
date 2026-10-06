# scripts/watch_agent_sync.py
# Умный фоновый наблюдатель за входящим каналом SYNC_FROM_CLAUDE.md и общим AGENT_SYNC.md
# Мгновенно просыпается при создании/изменении любого из этих файлов и оповещает систему.

import os
import time
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
WATCH_FILES = [
    os.path.join(BASE_DIR, "SYNC_FROM_CLAUDE.md"),
    os.path.join(BASE_DIR, "AGENT_SYNC.md"),
]
CHECK_INTERVAL_SEC = 5
TIMEOUT_SEC = 1200  # 20 минут

def get_stats():
    stats = {}
    for fp in WATCH_FILES:
        if os.path.exists(fp):
            st = os.stat(fp)
            stats[fp] = (st.st_mtime, st.st_size)
        else:
            stats[fp] = (0, 0)
    return stats

def main():
    print(f"[Watcher] Запущен улучшенный наблюдатель (файлы: SYNC_FROM_CLAUDE.md, AGENT_SYNC.md, опрос: {CHECK_INTERVAL_SEC}с)...")
    initial_stats = get_stats()
    
    elapsed = 0
    while elapsed < TIMEOUT_SEC:
        time.sleep(CHECK_INTERVAL_SEC)
        elapsed += CHECK_INTERVAL_SEC
        
        current_stats = get_stats()
        for fp, (mtime, size) in current_stats.items():
            init_mtime, init_size = initial_stats[fp]
            if mtime != init_mtime or size != init_size:
                name = os.path.basename(fp)
                print(f"[Watcher] 🔔 ОБНАРУЖЕНО ИЗМЕНЕНИЕ В {name}!")
                try:
                    with open(fp, "r", encoding="utf-8", errors="replace") as f:
                        lines = f.readlines()
                        tail = "".join(lines[-10:])
                        print(f"[Watcher] Последние строки:\n{tail}")
                except Exception as e:
                    print(f"[Watcher] Ошибка чтения: {e}")
                sys.exit(0)

    print("[Watcher] Таймаут ожидания.")
    sys.exit(0)

if __name__ == "__main__":
    main()

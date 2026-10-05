import requests
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

urls = [
    "https://xn--80adtefnid5g.xn--p1ai/crm",
    "https://xn--80adtefnid5g.xn--p1ai/fsm",
    "https://xn--80adtefnid5g.xn--p1ai/admin",
]

for url in urls:
    try:
        r = requests.get(url, verify=False, timeout=10)
        print(f"URL: {url} -> Status: {r.status_code}, Length: {len(r.content)}")
    except Exception as e:
        print(f"URL: {url} -> Error: {e}")

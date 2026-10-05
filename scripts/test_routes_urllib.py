import urllib.request
import ssl
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

urls = [
    "https://xn--80adtefnid5g.xn--p1ai/crm",
    "https://xn--80adtefnid5g.xn--p1ai/fsm",
    "https://xn--80adtefnid5g.xn--p1ai/admin",
]

for url in urls:
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, context=ctx, timeout=10) as response:
            print(f"{url} -> HTTP {response.status}")
    except Exception as e:
        print(f"{url} -> Error: {e}")

import urllib.request
import json
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

url = "https://api.github.com/repos/keystone4tech-blip/domofond-revive/actions/runs?per_page=5"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})

try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        for r in data.get('workflow_runs', []):
            print(f"ID: {r['id']}, Name: {r['name']}, Event: {r['event']}, Status: {r['status']}, Conclusion: {r['conclusion']}, Commit: {r['head_commit']['message'][:40]}, URL: {r['html_url']}")
except Exception as e:
    print("Error:", e)

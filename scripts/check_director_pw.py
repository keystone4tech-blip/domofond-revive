import bcrypt

h = "$2b$10$uY45GUInHs4/sZen4n2XiuC3gvO/zTQp/63ZPMw3ue0Bj6X6Kc3Hm"
for pwd in ["Domofondar2026!", "domofondar2026!", "Domofondar2026", "123456", "admin"]:
    match = bcrypt.checkpw(pwd.encode('utf-8'), h.encode('utf-8'))
    print(f"Password '{pwd}': {match}")

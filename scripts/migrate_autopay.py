# scripts/migrate_autopay.py
import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

sql = """
CREATE TABLE IF NOT EXISTS autopay_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id UUID,
    account_number VARCHAR(64) NOT NULL,
    payment_method_id VARCHAR(128) NOT NULL,
    card_first6 VARCHAR(16),
    card_last4 VARCHAR(8),
    card_type VARCHAR(32),
    card_expiry_year VARCHAR(8),
    card_expiry_month VARCHAR(8),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_autopay_account UNIQUE(account_number)
);
CREATE INDEX IF NOT EXISTS idx_autopay_user ON autopay_subscriptions(user_id);
"""

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
try:
    client.connect('45.8.99.238', username='root', password='j2Pz7,PPqzEte.')
    cmd = f'docker exec -i domofondar_postgres psql -U domofondar -d domofondar -c "{sql}"'
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    print("STDOUT:", out)
    if err:
        print("STDERR:", err)
    print("Миграция таблицы autopay_subscriptions успешно завершена!")
finally:
    client.close()

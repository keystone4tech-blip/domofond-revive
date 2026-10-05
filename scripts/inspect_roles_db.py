import paramiko
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HOST = "45.8.99.238"
USER = "root"
PASS = "j2Pz7,PPqzEte."

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, 22, USER, PASS, timeout=30)

cmd = '''docker exec domofondar_postgres psql -U domofondar -d domofondar -c "SELECT id, name, is_system FROM crm_roles;"'''
stdin, stdout, stderr = client.exec_command(cmd)
print("--- CRM ROLES ---")
print(stdout.read().decode('utf-8', errors='replace'))

cmd_emp = '''docker exec domofondar_postgres psql -U domofondar -d domofondar -c "SELECT id, full_name, role, position FROM employees LIMIT 10;"'''
stdin, stdout, stderr = client.exec_command(cmd_emp)
print("--- EMPLOYEES ---")
print(stdout.read().decode('utf-8', errors='replace'))

cmd_user_roles = '''docker exec domofondar_postgres psql -U domofondar -d domofondar -c "SELECT user_id, role FROM user_roles;"'''
stdin, stdout, stderr = client.exec_command(cmd_user_roles)
print("--- USER ROLES ---")
print(stdout.read().decode('utf-8', errors='replace'))

client.close()

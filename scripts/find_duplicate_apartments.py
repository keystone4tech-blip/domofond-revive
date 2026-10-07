import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('45.8.99.238', username='root', password='j2Pz7,PPqzEte.')

print("=== 1. ALL REQUESTS WITH DUPLICATE APARTMENT ===")
cmd1 = """
SELECT id, order_type, address, apartment, message 
FROM requests 
WHERE address ~* 'кв[.]?\\s*\\d+.*кв[.]?\\s*\\d+' 
   OR message ~* 'кв[.]?\\s*\\d+.*кв[.]?\\s*\\d+';
"""
stdin, stdout, stderr = c.exec_command(f'docker exec domofondar_postgres psql -U domofondar -d domofondar -c "{cmd1}"')
print(stdout.read().decode('utf-8', errors='replace'))

print("=== 2. ALL WORK ORDERS ===")
cmd2 = """
SELECT count(*) 
FROM work_orders;
"""
stdin, stdout, stderr = c.exec_command(f'docker exec domofondar_postgres psql -U domofondar -d domofondar -c "{cmd2}"')
print("WORK ORDERS COUNT:", stdout.read().decode('utf-8', errors='replace'))

cmd2_sample = """
SELECT id, number, address, apartment 
FROM work_orders 
LIMIT 10;
"""
stdin, stdout, stderr = c.exec_command(f'docker exec domofondar_postgres psql -U domofondar -d domofondar -c "{cmd2_sample}"')
print("WORK ORDERS SAMPLE:", stdout.read().decode('utf-8', errors='replace'))

cmd2_dup = """
SELECT id, number, address, apartment 
FROM work_orders 
WHERE address ~* 'кв[.]?\\s*\\d+.*кв[.]?\\s*\\d+' 
   OR (apartment IS NOT NULL AND apartment != '' AND address ~* ('кв[.]?\\s*' || apartment));
"""
stdin, stdout, stderr = c.exec_command(f'docker exec domofondar_postgres psql -U domofondar -d domofondar -c "{cmd2_dup}"')
print("WORK ORDERS WITH ADDRESS ALREADY CONTAINING APARTMENT:\n", stdout.read().decode('utf-8', errors='replace'))

print("=== 3. ALL ACTS ===")
cmd3 = """
SELECT count(*) 
FROM acts;
"""
stdin, stdout, stderr = c.exec_command(f'docker exec domofondar_postgres psql -U domofondar -d domofondar -c "{cmd3}"')
print("ACTS COUNT:", stdout.read().decode('utf-8', errors='replace'))

cmd3_dup = """
SELECT id, number, address 
FROM acts 
WHERE address ~* 'кв[.]?\\s*\\d+.*кв[.]?\\s*\\d+';
"""
stdin, stdout, stderr = c.exec_command(f'docker exec domofondar_postgres psql -U domofondar -d domofondar -c "{cmd3_dup}"')
print("ACTS WITH DUPLICATE:\n", stdout.read().decode('utf-8', errors='replace'))

c.close()

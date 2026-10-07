import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('45.8.99.238', username='root', password='j2Pz7,PPqzEte.')

cmd = "docker exec -i domofondar_postgres psql -U domofondar -d domofondar"
stdin, stdout, stderr = c.exec_command(cmd)

sql = """
\\pset pager off
SELECT id, name, phone, assigned_employee_id, accepted_employee_id FROM requests WHERE assigned_employee_id IN ('870a913a-830d-4940-9a75-aeeca95418dc', '838cbb6f-58f7-492a-bc4c-96b52a46c321') OR accepted_employee_id IN ('870a913a-830d-4940-9a75-aeeca95418dc', '838cbb6f-58f7-492a-bc4c-96b52a46c321');
SELECT id, name, phone, order_type FROM requests WHERE client_id IN ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '734a2378-d896-436e-97fd-5c25222fc96b');
"""

stdin.write(sql)
stdin.channel.shutdown_write()

print("STDOUT:\n", stdout.read().decode('utf-8', errors='replace'))
print("STDERR:\n", stderr.read().decode('utf-8', errors='replace'))

c.close()

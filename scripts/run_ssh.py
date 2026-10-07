import paramiko
import sys

cmd = sys.argv[1] if len(sys.argv) > 1 else "docker ps"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("45.8.99.238", 22, "root", "j2Pz7,PPqzEte.", timeout=30)

_, stdout, stderr = ssh.exec_command(cmd)
print("STDOUT:")
print(stdout.read().decode('utf-8'))
err = stderr.read().decode('utf-8')
if err:
    print("STDERR:", err)
ssh.close()

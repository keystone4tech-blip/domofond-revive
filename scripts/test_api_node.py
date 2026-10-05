import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('45.8.99.238', username='root', password='j2Pz7,PPqzEte.')

cmd = "docker exec domofondar_backend node -e \"const http=require('http');http.get('http://127.0.0.1:5000/api/app/version',res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>console.log('Result:',d));});\""
stdin, stdout, stderr = client.exec_command(cmd)
print(stdout.read().decode('utf-8', errors='replace'))

client.close()

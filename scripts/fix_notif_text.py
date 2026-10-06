import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('45.8.99.238', username='root', password='j2Pz7,PPqzEte.')

msg = "Ваши новые реквизиты успешно подтверждены оператором: Краснодар, Куликова Поля (ул), д. 16, п. 4, кв. 128. Все данные профиля обновлены."
sql = f"""UPDATE profiles SET data_change_notification = jsonb_set(data_change_notification::jsonb, '{{message}}', to_jsonb('{msg}'::text)) WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';"""

stdin, stdout, stderr = c.exec_command(f'docker exec domofondar_postgres psql -U domofondar -d domofondar -c "{sql}"')
print("UPDATE NOTIF RESULT:\n", stdout.read().decode('utf-8', errors='replace'))
print("ERR:\n", stderr.read().decode('utf-8', errors='replace'))

c.close()

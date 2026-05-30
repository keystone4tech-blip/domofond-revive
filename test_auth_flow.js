async function run() {
  console.log('Logging in...');
  const res1 = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@domofond.ru', password: 'admin123' })
  });
  
  if (!res1.ok) {
    console.error('Login failed:', await res1.text());
    return;
  }
  
  const data = await res1.json();
  console.log('Token acquired. Testing PostgREST...');
  
  const res2 = await fetch('http://localhost:3000/profiles?id=eq.' + data.user.id, {
    headers: {
      'Authorization': 'Bearer ' + data.token
    }
  });
  
  if (!res2.ok) {
    console.error('PostgREST failed:', res2.status, await res2.text());
    return;
  }
  
  const profiles = await res2.json();
  console.log('PostgREST success! Profiles:', profiles);
}
run();

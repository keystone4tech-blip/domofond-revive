const http = require('http');

async function runTest() {
  console.log('Testing login...');
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@domofond.ru', password: 'admin123' })
  });
  
  if (!loginRes.ok) {
    console.log('Login failed:', await loginRes.text());
    return;
  }
  
  const loginData = await loginRes.json();
  console.log('Login success! Token:', loginData.token.substring(0, 20) + '...');
  
  console.log('Testing PostgREST profile fetch...');
  const profileRes = await fetch('http://localhost:3000/profiles?id=eq.' + loginData.user.id, {
    headers: {
      'Authorization': 'Bearer ' + loginData.token
    }
  });
  
  if (!profileRes.ok) {
    console.log('Profile fetch failed:', profileRes.status, await profileRes.text());
    return;
  }
  
  const profileData = await profileRes.json();
  console.log('Profile fetch success! Data:', profileData);
}

runTest().catch(console.error);

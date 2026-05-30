const jwt = require('jsonwebtoken');

const base64Secret = 'c3VwZXJzZWNyZXRqd3RrZXl0aGF0aXNhdGxlYXN0MzJieXRlc2xvbmch';
const bufferSecret = Buffer.from(base64Secret, 'base64');

// Generate Token
const token = jwt.sign(
  { id: '1234', email: 'test@example.com', role: 'authenticated', sub: '1234' },
  bufferSecret,
  { expiresIn: '7d' }
);

console.log('Token:', token);

// Verify Token
try {
  const decoded = jwt.verify(token, bufferSecret);
  console.log('Verified correctly:', decoded);
} catch (e) {
  console.log('Verification failed:', e.message);
}

// What if PostgREST treats the config strictly as a string instead of base64 decoded?
// In newer PostgREST versions, PGRST_JWT_SECRET must be passed as JSON if we want to be 100% sure.
// Wait, is it possible the issue is the JWT algorithm? jsonwebtoken defaults to HS256, which PostgREST accepts.
// Let's decode the JWT header.
const parts = token.split('.');
console.log('Header:', Buffer.from(parts[0], 'base64').toString());

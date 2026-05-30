const jwt = require('jsonwebtoken');

const base64Secret = 'dGhpcy1pcy1hLXZlcnktc2VjcmV0LWtleS0zMi1ieXRlcw==';
const decodedBuffer = Buffer.from(base64Secret, 'base64');

console.log('Base64 Length:', base64Secret.length);
console.log('Decoded Length:', decodedBuffer.length);
console.log('Decoded String:', decodedBuffer.toString('utf8'));

const token = jwt.sign(
  { id: '123', email: 'test@example.com', role: 'authenticated', sub: '123' },
  decodedBuffer,
  { expiresIn: '7d' }
);

console.log('Token:', token);

// Verify
try {
  jwt.verify(token, decodedBuffer);
  console.log('Verified by Node using buffer');
} catch (e) {
  console.log('Failed:', e);
}

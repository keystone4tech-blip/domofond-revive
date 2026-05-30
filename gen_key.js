const crypto = require('crypto');
const base64UrlEncode = (buffer) => buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const key = crypto.randomBytes(32);
const base64 = key.toString('base64');
const base64url = base64UrlEncode(key);

console.log('BASE64:', base64);
console.log('BASE64URL:', base64url);
console.log('JWK:', JSON.stringify({ kty: 'oct', k: base64url }));

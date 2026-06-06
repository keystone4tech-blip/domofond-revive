const fs = require('fs');
const content = fs.readFileSync('scratch/index_bundle.js', 'utf8');
const chunk = content.substring(1705000, 1713000);
fs.writeFileSync('scratch/chunk.txt', chunk);
console.log("Chunk saved!");

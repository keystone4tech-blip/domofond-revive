const fs = require('fs');
const content = fs.readFileSync('scratch/index_bundle.js', 'utf8');
const chunk = content.substring(1759000, 1764000);
fs.writeFileSync('scratch/hero_chunk.txt', chunk);
console.log("Hero chunk saved!");

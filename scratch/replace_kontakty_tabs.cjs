const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'pages', 'Kontakty.tsx');
if (fs.existsSync(filePath)) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/\r\n/g, '\n');

  const oldClass = 'data-[state=active]:bg-amber-500';
  const newClass = 'data-[state=active]:bg-blue-600';

  if (content.includes(oldClass)) {
    // Используем split/join для точной замены без регулярных выражений
    content = content.split(oldClass).join(newClass);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Successfully updated tabs color in Kontakty.tsx");
  } else {
    console.log("No amber tabs active state found in Kontakty.tsx!");
  }
} else {
  console.log("Kontakty.tsx not found!");
}

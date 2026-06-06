const fs = require('fs');
const path = require('path');

const reqPath = path.join(__dirname, '..', 'src', 'components', 'Requisites.tsx');
if (fs.existsSync(reqPath)) {
  let content = fs.readFileSync(reqPath, 'utf8');
  content = content.replace(/\r\n/g, '\n');

  // 1. Добавим импорт ShinyButton
  const importTarget = `import { useState } from "react";`;
  const importReplacement = `import { useState } from "react";\nimport { ShinyButton } from "@/components/ui/shiny-button";`;

  if (content.includes(importTarget) && !content.includes('import { ShinyButton }')) {
    content = content.replace(importTarget, importReplacement);
  }

  // 2. Заменим саму кнопку
  const targetButton = `          <Button 
            onClick={handleDownloadDoc}
            className="btn-premium-gold bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-2 h-9 text-xs font-semibold px-4 rounded-xl shadow-md transition-all duration-300"
          >
            <Download className="h-4 w-4" />
            Скачать DOC
          </Button>`;

  const replacementButton = `          <ShinyButton 
            onClick={handleDownloadDoc}
            className="h-9 text-xs font-semibold px-4 rounded-xl shadow-md"
          >
            <Download className="h-4 w-4" />
            Скачать DOC
          </ShinyButton>`;

  if (content.includes(targetButton)) {
    content = content.replace(targetButton, replacementButton);
    fs.writeFileSync(reqPath, content, 'utf8');
    console.log("Successfully updated button in Requisites.tsx");
  } else {
    console.log("Target button in Requisites.tsx not found!");
  }
} else {
  console.log("Requisites.tsx not found!");
}

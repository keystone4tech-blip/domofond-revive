const fs = require('fs');
const path = require('path');

// 1. NewsSection.tsx
const newsPath = path.join(__dirname, '..', 'src', 'components', 'NewsSection.tsx');
if (fs.existsSync(newsPath)) {
  let content = fs.readFileSync(newsPath, 'utf8');
  content = content.replace(/\r\n/g, '\n');

  const targetNewsMore = `                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    openModal(item);
                  }}
                >
                  Подробнее
                </Button>`;

  const replacementNewsMore = `                <ShinyButton
                  className="ml-auto text-xs py-1.5 px-3 rounded-xl"
                  onClick={(e) => {
                    e.stopPropagation();
                    openModal(item);
                  }}
                >
                  Подробнее
                </ShinyButton>`;

  const targetNewsClose = `                <Button onClick={closeModal}>
                  Закрыть
                </Button>`;

  const replacementNewsClose = `                <ShinyButton onClick={closeModal} className="py-2 px-4 rounded-xl text-sm">
                  Закрыть
                </ShinyButton>`;

  let newsUpdated = 0;
  if (content.includes(targetNewsMore)) {
    content = content.replace(targetNewsMore, replacementNewsMore);
    newsUpdated++;
  } else {
    console.log("NewsSection More button not found!");
  }

  if (content.includes(targetNewsClose)) {
    content = content.replace(targetNewsClose, replacementNewsClose);
    newsUpdated++;
  } else {
    console.log("NewsSection Close button not found!");
  }

  if (newsUpdated > 0) {
    fs.writeFileSync(newsPath, content, 'utf8');
    console.log(`Successfully updated ${newsUpdated} buttons in NewsSection.tsx`);
  }
} else {
  console.log("NewsSection.tsx not found!");
}

// 2. PromotionsSection.tsx
const promoPath = path.join(__dirname, '..', 'src', 'components', 'PromotionsSection.tsx');
if (fs.existsSync(promoPath)) {
  let content = fs.readFileSync(promoPath, 'utf8');
  content = content.replace(/\r\n/g, '\n');

  const targetPromoMore = `                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    openModal(promotion);
                  }}
                >
                  Подробнее
                </Button>`;

  const replacementPromoMore = `                <ShinyButton
                  className="ml-auto text-xs py-1.5 px-3 rounded-xl"
                  onClick={(e) => {
                    e.stopPropagation();
                    openModal(promotion);
                  }}
                >
                  Подробнее
                </ShinyButton>`;

  const targetPromoClose = `                <Button onClick={closeModal}>
                  Закрыть
                </Button>`;

  const replacementPromoClose = `                <ShinyButton onClick={closeModal} className="py-2 px-4 rounded-xl text-sm">
                  Закрыть
                </ShinyButton>`;

  let promoUpdated = 0;
  if (content.includes(targetPromoMore)) {
    content = content.replace(targetPromoMore, replacementPromoMore);
    promoUpdated++;
  } else {
    console.log("PromotionsSection More button not found!");
  }

  if (content.includes(targetPromoClose)) {
    content = content.replace(targetPromoClose, replacementPromoClose);
    promoUpdated++;
  } else {
    console.log("PromotionsSection Close button not found!");
  }

  if (promoUpdated > 0) {
    fs.writeFileSync(promoPath, content, 'utf8');
    console.log(`Successfully updated ${promoUpdated} buttons in PromotionsSection.tsx`);
  }
} else {
  console.log("PromotionsSection.tsx not found!");
}

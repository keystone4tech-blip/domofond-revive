const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/Calculator.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Точный блок, который мы хотим заменить
const targetBlock = `                      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="lg" className="w-full btn-premium-gold hover:shadow-gold-glow font-bold h-11 text-sm">
                            Узнать стоимость
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md glass-premium border-none rounded-[24px] shadow-2xl p-6 text-left animate-in fade-in duration-200">`;

// Новый блок разметки
const replacementBlock = `                      <Button 
                        size="lg" 
                        className="w-full btn-premium-gold hover:shadow-gold-glow font-bold h-11 text-sm"
                        onClick={() => {
                          const hasEntrances = !!numericValues.entrances.trim();
                          const hasApartments = !!numericValues.totalApartments.trim();
                          if (!hasEntrances || !hasApartments) {
                            toast({
                              title: "Параметры дома не заполнены",
                              description: "Пожалуйста, обязательно укажите количество подъездов и квартир в доме перед расчетом.",
                              variant: "destructive"
                            });
                            return;
                          }
                          setIsDialogOpen(true);
                        }}
                      >
                        Узнать стоимость
                      </Button>

                      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogContent className="sm:max-w-md glass-premium border-none rounded-[24px] shadow-2xl p-6 text-left animate-in fade-in duration-200">`;

const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedTarget = targetBlock.replace(/\r\n/g, '\n');
const normalizedReplacement = replacementBlock.replace(/\r\n/g, '\n');

if (normalizedContent.includes(normalizedTarget)) {
  const updatedContent = normalizedContent.replace(normalizedTarget, normalizedReplacement);
  fs.writeFileSync(filePath, updatedContent, 'utf8');
  console.log('SUCCESS: Calculator Dialog replaced successfully!');
} else {
  console.error('ERROR: Target block for Calculator Dialog not found in file!');
  // Найдем наиболее длинный отрезок который совпадает чтобы понять где расхождение
  const lines = normalizedTarget.split('\n');
  let matchedBlock = '';
  for (let i = 0; i < lines.length; i++) {
    const testBlock = lines.slice(0, i + 1).join('\n');
    if (normalizedContent.includes(testBlock)) {
      matchedBlock = testBlock;
    } else {
      console.log('Failed to match starting from line:', i + 1, 'Content of line:', lines[i]);
      break;
    }
  }
}

const { exec } = require('child_process');

// Скрипт PowerShell, который мы хотим запустить
const psScript = `
$word = New-Object -ComObject Word.Application
$doc = $word.Documents.Open('c:\\Users\\Keystone-Tech\\Desktop\\Домофондар\\РЕКВИЗИТЫ ООО ДомофонДар.doc')
$text = $doc.Content.Text
$doc.Close()
$word.Quit()
Write-Output "=== TEXT START ==="
Write-Output $text
Write-Output "=== TEXT END ==="
`;

// Закодируем его в Base64 UTF-16LE
const buffer = Buffer.from(psScript, 'utf16le');
const base64 = buffer.toString('base64');

console.log("Запускаем PowerShell команду через EncodedCommand...");
exec(`powershell.exe -NoProfile -EncodedCommand ${base64}`, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
  if (error) {
    console.error("Ошибка выполнения:", error);
    return;
  }
  console.log(stdout);
  if (stderr) {
    console.error("stderr:", stderr);
  }
});

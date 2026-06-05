// Скрипт для тестирования сохранения расчетов через PostgREST боевого сервера
const http = require('http');

const options = {
  hostname: '185.104.114.184',
  port: 3000,
  path: '/calculations',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
};

const payload = JSON.stringify({
  name: "Тест Калькулятора",
  phone: "+79998887766",
  entrances: 1,
  total_apartments: 20,
  smart_intercoms: 1,
  additional_cameras: 0,
  elevator_cameras: 0,
  gates: 0,
  tariff_per_apt: 150,
  is_individual: false,
  tariff_details: {
    test: true
  }
});

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.status}`);
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('BODY:', data);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(payload);
req.end();

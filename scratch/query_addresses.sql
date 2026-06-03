-- Запрос 1: Все адреса с "войсков" (поиск домов 6, 6а)
SELECT DISTINCT address, apartment FROM accounts WHERE address ILIKE '%войсков%' ORDER BY address, apartment LIMIT 30;

-- Запрос 2: Все адреса с "корнилов" (поиск корпусов)
SELECT DISTINCT address, apartment FROM accounts WHERE address ILIKE '%корнилов%' ORDER BY address, apartment LIMIT 30;

-- Запрос 3: Все адреса с "бжегокай" (поиск 31/1 корпус 1)
SELECT DISTINCT address, apartment FROM accounts WHERE address ILIKE '%бжегокай%' ORDER BY address, apartment LIMIT 30;

-- Запрос 4: Все уникальные адреса (дома) с буквами или корпусами
SELECT DISTINCT address FROM accounts WHERE address ~ '[а-яА-Яa-zA-Z]' AND (address ILIKE '%корп%' OR address ~ '\d+[а-яА-Яa-zA-Z]' OR address ILIKE '%/%') ORDER BY address LIMIT 50;

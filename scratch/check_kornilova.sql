-- Все адреса по Корнилова из таблицы accounts (сырые данные)
SELECT DISTINCT address FROM accounts WHERE address LIKE '%Корнилов%' ORDER BY address;

-- Сколько записей всего по Корнилова
SELECT count(*) as total FROM accounts WHERE address LIKE '%Корнилов%';

-- Первые 5 записей полностью
SELECT account_number, address, apartment FROM accounts WHERE address LIKE '%Корнилов%' LIMIT 5;

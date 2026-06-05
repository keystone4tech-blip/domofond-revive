-- Проверка в таблице accounts (все возможные написания Корнилова без учета регистра)
SELECT DISTINCT address FROM accounts WHERE address ILIKE '%корнилов%' ORDER BY address LIMIT 100;

-- Количество строк в accounts для каждого уникального дома на улице Корнилова (без квартир и подъездов)
SELECT regexp_replace(address, ', п \d+, кв. \d+$', '') as house_addr, count(*) 
FROM accounts 
WHERE address ILIKE '%корнилов%' 
GROUP BY house_addr
ORDER BY house_addr;

-- Проверка во вью unique_houses
SELECT house_address FROM unique_houses WHERE house_address ILIKE '%корнилов%' ORDER BY house_address;

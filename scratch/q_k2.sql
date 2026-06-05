-- Все уникальные дома по ул. Корнилова в таблице accounts
SELECT DISTINCT 
  regexp_replace(regexp_replace(address, ',\s*(?:п(?:одъезд)?\.?\s*\d+).*$', '', 'i'), ',\s*(?:кв\.?\s*\d+).*$', '', 'i') AS house 
FROM accounts 
WHERE address ILIKE '%корнилов%';

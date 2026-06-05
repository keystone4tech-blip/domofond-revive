-- Поиск всех адресов и квартир по ул. Корнилова
SELECT DISTINCT address, apartment FROM accounts WHERE address ILIKE '%корнилов%' ORDER BY address, apartment LIMIT 100;

-- Поиск уникальных домов по ул. Корнилова во вьюхе unique_houses
SELECT house_address FROM unique_houses WHERE house_address ILIKE '%корнилов%' ORDER BY house_address LIMIT 100;

-- Определение вьюхи unique_houses
SELECT pg_get_viewdef('unique_houses', true) AS view_definition;

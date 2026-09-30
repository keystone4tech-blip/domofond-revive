-- ============================================================================
-- Восстановление города/района в таблице entrances (подъезды).
-- Сейчас во всех 296 записях entrances город = "Краснодар", хотя в accounts
-- районы есть (Краснодар / пос. Южный / Новая Адыгея). Берём город из accounts
-- по улице — связь улица→город однозначная.
--
-- Запуск:
--   docker exec -i domofondar_postgres psql -U domofondar -d domofondar < fix_entrances_city.sql
-- ============================================================================

UPDATE entrances e
SET city = sc.city,
    updated_at = CURRENT_TIMESTAMP
FROM (
  SELECT regexp_replace(lower(street), '[^а-яё0-9]', '', 'g') AS skey,
         (array_agg(split_part(address, ',', 1) ORDER BY split_part(address, ',', 1)))[1] AS city
  FROM accounts
  WHERE street IS NOT NULL AND position(',' in address) > 0
  GROUP BY 1
) sc
WHERE regexp_replace(lower(e.street), '[^а-яё0-9]', '', 'g') = sc.skey
  AND e.city IS DISTINCT FROM sc.city;

-- Проверка распределения городов после обновления
SELECT city, count(*) AS entrances_count
FROM entrances
GROUP BY city
ORDER BY entrances_count DESC;

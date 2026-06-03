SELECT DISTINCT
  regexp_replace(address, ',\s*п\s+\d+,\s*кв\.\s*\d+\s*$', '', 'i') AS house_address
FROM accounts
WHERE address ILIKE '%войсков%'
ORDER BY house_address;

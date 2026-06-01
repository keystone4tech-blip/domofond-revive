CREATE OR REPLACE VIEW unique_houses AS
SELECT DISTINCT 
  regexp_replace(
    regexp_replace(address, ',\s*(?:п(?:одъезд)?\.?\s*\d+).*$', '', 'i'), 
    ',\s*(?:кв\.?\s*\d+).*$', '', 'i'
  ) AS house_address
FROM accounts;

GRANT SELECT ON unique_houses TO anon, authenticated;

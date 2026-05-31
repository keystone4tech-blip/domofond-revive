CREATE OR REPLACE VIEW unique_houses AS
SELECT DISTINCT split_part(address, ',', 1) || ',' || split_part(address, ',', 2) || ',' || split_part(address, ',', 3) AS house_address
FROM accounts;

GRANT SELECT ON unique_houses TO anon, authenticated;

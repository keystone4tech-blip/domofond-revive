SELECT DISTINCT 
  regexp_replace(regexp_replace(address, '^[^,]+,\s*', ''), ',\s*д\..*$', '') AS street_name 
FROM accounts;

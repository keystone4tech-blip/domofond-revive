SELECT DISTINCT trim(split_part(address, ',', 2)) AS street FROM accounts ORDER BY street;

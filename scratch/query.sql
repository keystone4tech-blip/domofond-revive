SELECT DISTINCT substring(address from ',\s*(?:п(?:одъезд)?\.?\s*(\d+))') AS entrance FROM accounts WHERE address ILIKE '%Корнилов%' ORDER BY entrance;

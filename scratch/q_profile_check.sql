SELECT u.id, u.email, p.full_name, p.phone, p.address, p.apartment, p.is_verified 
FROM users u 
LEFT JOIN profiles p ON u.id = p.id 
WHERE u.email ILIKE '%viruscorp%';

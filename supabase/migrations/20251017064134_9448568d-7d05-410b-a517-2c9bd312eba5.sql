-- Remove unique constraint on page and block_name to allow multiple premium blocks
ALTER TABLE site_blocks DROP CONSTRAINT IF EXISTS site_blocks_page_block_name_key;
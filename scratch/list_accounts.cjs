const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
let supabaseUrl = 'https://jjaeybwuhnokrcprgait.supabase.co';
let supabaseKey = '';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    if (line.includes('VITE_SUPABASE_PUBLISHABLE_KEY=')) {
      supabaseKey = line.split('VITE_SUPABASE_PUBLISHABLE_KEY=')[1].trim().replace(/['"]/g, '');
    }
  }
}

if (!supabaseKey) {
  console.error("No key found!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('account_number, address, apartment, debt_amount, period')
    .limit(10);

  if (error) {
    console.error("Error fetching accounts:", error);
    return;
  }

  console.log("First 10 accounts:", JSON.stringify(accounts, null, 2));
}

check();

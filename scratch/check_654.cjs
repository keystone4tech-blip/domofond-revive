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
  const accountNum = '0000000654';
  console.log(`Checking account: ${accountNum}`);
  
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('account_number', accountNum)
    .order('period', { ascending: false });

  if (error) {
    console.error("Error fetching account:", error);
    return;
  }

  console.log("Found accounts:", JSON.stringify(accounts, null, 2));

  if (!accounts || accounts.length === 0) {
    console.log("Trying ILIKE %654%...");
    const { data: ilikeAccounts, error: err2 } = await supabase
      .from('accounts')
      .select('*')
      .ilike('account_number', '%654%')
      .order('period', { ascending: false });

    if (err2) {
      console.error("Error with ILIKE:", err2);
      return;
    }
    console.log("Found by ILIKE:", JSON.stringify(ilikeAccounts, null, 2));
  }
}

check();

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://lxsfghmlyqyygiscrxhu.supabase.co'; // из .env или дефолт
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error("No SUPABASE_ANON_KEY found in .env!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const accountNum = '0000000654';
  console.log(`Checking account: ${accountNum}`);
  
  // 1. Ищем счет 0000000654
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
    console.log("Account not found by eq('account_number', '0000000654'). Trying ILIKE...");
    const { data: ilikeAccounts, error: err2 } = await supabase
      .from('accounts')
      .select('*')
      .ilike('account_number', '%654%')
      .order('period', { ascending: false });

    if (err2) {
      console.error("Error with ILIKE:", err2);
      return;
    }
    console.log("Found by ILIKE %654%:", JSON.stringify(ilikeAccounts, null, 2));
  }
}

check();

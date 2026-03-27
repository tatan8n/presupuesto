require('dotenv').config({ path: 'backend/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function check() {
  const { data, error } = await supabase.from('budget_items').select('*').limit(1);
  if (error) console.error("Error:", error);
  else console.log(data ? Object.keys(data[0]) : "No data");
}
check();

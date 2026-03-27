const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://agpuziiahfydzzkibuux.supabase.co";
const SUPABASE_KEY = "sb_publishable_zI5PcNMZGfb7Lpg0t5z4LQ_QYlpWMOb";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkTransfers() {
  const { data, error } = await supabase
    .from('budget_transfers')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(JSON.stringify(data, null, 2));
}

checkTransfers();

const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://agpuziiahfydzzkibuux.supabase.co";
const SUPABASE_KEY = "sb_publishable_zI5PcNMZGfb7Lpg0t5z4LQ_QYlpWMOb";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkAreas() {
  const { data: lines, error } = await supabase
    .from('budget_items')
    .select('id_consecutivo, area, nombre_elemento, estado')
    .in('id_consecutivo', [15, 18, 20]);

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(JSON.stringify(lines, null, 2));
}

checkAreas();

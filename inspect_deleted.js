const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://agpuziiahfydzzkibuux.supabase.co";
const SUPABASE_KEY = "sb_publishable_zI5PcNMZGfb7Lpg0t5z4LQ_QYlpWMOb";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspect() {
  const { data, error } = await supabase
    .from('budget_items')
    .select('*, budget_allocations(*)')
    .eq('estado', 'eliminada')
    .order('updated_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error:", error);
    return;
  }

  data.forEach(line => {
    const totalActual = line.budget_allocations.reduce((sum, a) => sum + (a.monto || 0), 0);
    const totalOriginal = line.budget_allocations.reduce((sum, a) => sum + (a.monto_original || 0), 0);
    console.log(`ID: ${line.id_consecutivo}, Nombre: ${line.nombre_elemento}, ICGI: ${line.icgi}, Actual: ${totalActual}, Original: ${totalOriginal}`);
  });
}

inspect();

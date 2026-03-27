const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = "https://agpuziiahfydzzkibuux.supabase.co";
const SUPABASE_KEY = "sb_publishable_zI5PcNMZGfb7Lpg0t5z4LQ_QYlpWMOb";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function auditAdmin() {
  const { data: lines, error } = await supabase
    .from('budget_items')
    .select('*, budget_allocations(*)')
    .eq('area', 'Admin');

  if (error) {
    console.error("Error:", error);
    return;
  }

  let totalInit = 0;
  let totalAct = 0;

  console.log("ID | Estado | Nombre | Inicial | Actual | Diff");
  console.log("---|---|---|---|---|---");

  lines.forEach(l => {
    const isDeleted = l.estado === 'eliminada';
    const pInit = l.budget_allocations.reduce((sum, a) => sum + (a.monto_original || 0), 0);
    const pAct = isDeleted ? 0 : l.budget_allocations.reduce((sum, a) => sum + (a.monto || 0), 0);
    
    totalInit += pInit;
    totalAct += pAct;

    if (Math.abs(pInit - pAct) > 1) {
      console.log(`${l.id_consecutivo} | ${l.estado} | ${l.nombre_elemento.substring(0,25)} | ${pInit} | ${pAct} | ${pInit - pAct}`);
    }
  });

  console.log(`\nTOTAL ADMIN: Inicial=${totalInit}, Actual=${totalAct}, Diferencia=${totalInit - totalAct}`);
}

auditAdmin();

const { createClient } = require('@supabase/supabase-js');
const config = require('./backend/config');
const supabase = createClient(config.supabase.url, config.supabase.key);

async function cleanDb() {
  console.log('Fetching lines from ID 179...');
  const { data: lines, error } = await supabase
    .from('budget_items')
    .select('id_linea, id_consecutivo, nombre_elemento')
    .gte('id_consecutivo', 178)
    .order('id_consecutivo');
    
  if (error) { console.error(error); return; }
  
  console.log('Lines found:', lines.length);
  lines.forEach(l => console.log(`[${l.id_consecutivo}] ${l.nombre_elemento}`));
  
  const toDelete = lines.filter(l => l.id_consecutivo >= 179 && l.id_consecutivo !== 182);
  const toKeep = lines.find(l => l.id_consecutivo === 182);
  
  if (toDelete.length > 0) {
    const idsToDelete = toDelete.map(l => l.id_linea);
    console.log(`\nDeleting ${idsToDelete.length} lines...`);
    
    // Deleting associated allocations first (if cascade is not set, though Supabase usually handles it)
    await supabase.from('budget_allocations').delete().in('id_linea', idsToDelete);
    await supabase.from('budget_transfers').delete().in('from_id_linea', idsToDelete).or(`to_id_linea.in.(${idsToDelete.join(',')})`);
    
    // Delete main items
    const { error: delError } = await supabase.from('budget_items').delete().in('id_linea', idsToDelete);
    if (delError) console.error('Error deleting:', delError);
    else console.log('Successfully deleted duplicates.');
  }
  
  if (toKeep) {
    console.log(`\nUpdating ${toKeep.nombre_elemento} to id_consecutivo = 179...`);
    const { error: updError } = await supabase
      .from('budget_items')
      .update({ id_consecutivo: 179 })
      .eq('id_linea', toKeep.id_linea);
      
    if (updError) console.error('Error updating:', updError);
    else console.log('Successfully reassigned to 179.');
  }

  console.log('\nDone!');
}

cleanDb();

const path = require('path');
const budgetService = require('./services/BudgetService');

async function uploadData() {
  try {
    console.log('Iniciando carga de datos a Supabase...');
    const excelPath = path.join(__dirname, '..', 'Presupuesto general A-MAQ 2026 Rev 13-01-25 - 7300.xlsx');
    
    // El servicio leerá el Excel y hará un upsert a Supabase
    const result = await budgetService.loadBudget(excelPath, 'Detalle');
    
    console.log(`✅ Carga finalizada correctamente. Se procesaron ${result.totalLines} líneas.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al cargar los datos:', error);
    process.exit(1);
  }
}

uploadData();

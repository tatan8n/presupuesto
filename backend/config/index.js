const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  port: process.env.PORT || 3001,
  excelFilePath: process.env.EXCEL_FILE_PATH || '',
  excelSheetName: process.env.EXCEL_SHEET_NAME || 'Detalle',
  dolibarr: {
    url: process.env.DOLIBARR_URL || '',
    apiKey: process.env.DOLIBARR_API_KEY || '',
    year: process.env.DOLIBARR_YEAR || '2026',
  },
  supabase: {
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_KEY || '',
  },
  columnMapping: {
    cuenta: 'Cuenta',
    cuentaContable: 'Cuenta contable',
    area: 'Área',
    nombreElemento: 'Nombre del elemento',
    escenario: 'Escenario',
    fecha: 'Fecha',
    enero: 'Enero',
    febrero: 'Febrero',
    marzo: 'Marzo',
    abril: 'Abril',
    mayo: 'Mayo',
    junio: 'Junio',
    julio: 'Julio',
    agosto: 'Agosto',
    septiembre: 'Septiembre',
    octubre: 'Octubre',
    noviembre: 'Noviembre',
    diciembre: 'Diciembre',
    total: 'Total',
    icgi: 'ICGI',
    porcentaje: '% Mat, CIF, com',
    linea: 'Línea',
  },
  months: [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ],
};

module.exports = config;

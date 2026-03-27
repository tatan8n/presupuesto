const config = require('./backend/config');
const { createClient } = require('@supabase/supabase-js');
const supabaseRepository = require('./backend/repositories/supabaseRepository');
const budgetService = require('./backend/services/BudgetService');

async function check() {
  const kpis = await budgetService.getKPIs({});
  console.log("Admin KPIs:", JSON.stringify(kpis.byArea['Admin'], null, 2));
}

check().catch(console.error);

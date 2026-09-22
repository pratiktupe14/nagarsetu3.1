const { createClient } = require('../backend/node_modules/@supabase/supabase-js');
const dotenv = require('../backend/node_modules/dotenv');
dotenv.config({ path: './backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

console.log('Supabase URL:', supabaseUrl);

if (!supabaseUrl || !supabaseKey) {
  console.log('No Supabase credentials provided');
  process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('\n--- Querying Supabase department_heads for rahul.kumar@nagarsetu.gov.in ---');
  const { data: dhRow, error: dhErr } = await supabase
    .from('department_heads')
    .select('*, departments(*)')
    .eq('email', 'rahul.kumar@nagarsetu.gov.in')
    .eq('status', 'active')
    .maybeSingle();

  console.log('dhRow:', dhRow);
  console.log('dhErr:', dhErr);

  console.log('\n--- Querying Supabase departments table ---');
  const { data: depts, error: deptErr } = await supabase.from('departments').select('*');
  console.log('departments:', depts);

  console.log('\n--- Querying Supabase complaints table ---');
  const { data: comps, error: compErr } = await supabase.from('complaints').select('id, complaint_number, department_id, category, title').limit(10);
  console.log('complaints sample:', comps);

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

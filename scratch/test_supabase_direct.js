const { createClient } = require('../backend/node_modules/@supabase/supabase-js');
require('../backend/node_modules/dotenv').config({ path: './.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Testing Supabase with URL:', supabaseUrl);
console.log('Service key exists:', Boolean(serviceKey));

const supabase = createClient(supabaseUrl, serviceKey);

async function check() {
  const { data: depts, error: errD } = await supabase.from('departments').select('*');
  console.log('Departments:', depts?.length, errD?.message || 'OK');
  if (depts) {
    console.log('Dept samples:', depts.slice(0, 3));
  }

  const { data: users, error: errU } = await supabase.from('profiles').select('*');
  console.log('Profiles:', users?.length, errU?.message || 'OK');

  const { data: comps, error: errC } = await supabase.from('complaints').select('*');
  console.log('Complaints in Supabase:', comps?.length, errC?.message || 'OK');
}

check();

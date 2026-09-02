const { createClient } = require('../backend/node_modules/@supabase/supabase-js');
require('../backend/node_modules/dotenv').config({ path: './.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testRpc() {
  const { data, error } = await supabase.rpc('exec_sql', { query_string: 'SELECT NOW()' });
  console.log('rpc exec_sql result:', data, error?.message);
}

testRpc();

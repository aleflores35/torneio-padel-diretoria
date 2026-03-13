const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Usar service role para o backend

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase URL ou Key não configuradas no .env");
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;

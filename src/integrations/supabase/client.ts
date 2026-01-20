import { createClient } from '@supabase/supabase-js';
import { Database } from './types';

// Configuração CORRETA do Supabase
// Use variáveis de ambiente OU valores diretos para produção

// OPÇÃO A: Usando variáveis de ambiente (recomendado para produção)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// OPÇÃO B: Valores hardcoded para teste (descomente se necessário)
// const supabaseUrl = 'https://kpaijxpliyqckmdowbc.supabase.co';
// const supabaseAnonKey = 'sua-chave-anonima-aqui';

// Validação e debug
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ ERRO: Variáveis de ambiente do Supabase não configuradas!');
  console.error('Verifique se o arquivo .env existe e contém:');
  console.error('VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY');
}

console.log('🔧 Supabase configurado com URL:', supabaseUrl?.substring(0, 50) + '...');

// Cria o cliente Supabase com configurações otimizadas
export const supabase = createClient<Database>(
  supabaseUrl || '', 
  supabaseAnonKey || '', 
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: 'gideon-finance-auth',
      storage: localStorage,
      flowType: 'pkce',
    },
    global: {
      headers: {
        'X-Client-Info': 'gideon-finance/1.0.0',
      },
    },
  }
);

// Função auxiliar para testar conexão
export const testSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('❌ Erro na conexão com Supabase:', error.message);
      return false;
    }
    console.log('✅ Conexão com Supabase estabelecida');
    return true;
  } catch (error) {
    console.error('❌ Erro inesperado:', error);
    return false;
  }
};
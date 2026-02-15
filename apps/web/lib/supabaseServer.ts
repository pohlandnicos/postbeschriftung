import { createClient } from '@supabase/supabase-js';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export function getSupabaseAdmin() {
  const url = requireEnv('SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        'X-Client-Info': 'docucloud-server'
      }
    }
  });
}

export function getTenantId(): string {
  return requireEnv('DOCUCLOUD_TENANT_ID');
}

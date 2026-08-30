import { createClient } from 'npm:@supabase/supabase-js@2';

const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (request) => {
  if (request.method !== 'POST') return respond(405, { code: 'method_not_allowed' });
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return respond(401, { code: 'authentication_required' });
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) return respond(503, { code: 'server_not_configured' });
  let body: unknown;
  try { body = await request.json(); } catch { return respond(400, { code: 'invalid_json' }); }
  if ((body as { confirmation?: unknown })?.confirmation !== 'DELETE') return respond(400, { code: 'confirmation_required' });
  const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data, error } = await authClient.auth.getUser();
  if (error || !data.user) return respond(401, { code: 'invalid_session' });
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id);
  if (deleteError) return respond(500, { code: 'delete_failed' });
  console.log(JSON.stringify({ outcome: 'account_deleted', userIdHash: data.user.id.slice(0, 8) }));
  return respond(200, { deleted: true });
});

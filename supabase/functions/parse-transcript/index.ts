import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@4.5.4';

const MAX_BODY_BYTES = 16_384;
const requestSchema = z.object({
  transcript: z.string().trim().min(1).max(2000),
  locale: z.string().min(2).max(35),
  timezone: z.string().min(1).max(80),
  defaultCurrency: z.string().regex(/^[A-Z]{3}$/),
  accounts: z.array(z.string().min(1).max(80)).max(50),
  categories: z.array(z.string().min(1).max(80)).max(100),
  budgetCategories: z.array(z.string().min(1).max(80)).max(100),
  referenceTime: z.string().datetime({ offset: true }),
}).strict();

const transactionSchema = z.object({
  type: z.enum(['expense', 'income']),
  amount: z.string().regex(/^\d+(?:\.\d+)?$/).nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  merchant: z.string().trim().max(160).nullable(),
  category: z.string().trim().max(160).nullable(),
  budget: z.string().trim().max(160).nullable(),
  account: z.string().trim().max(160).nullable(),
  occurredAt: z.string().datetime({ offset: true }).nullable(),
  note: z.string().trim().max(500).nullable(),
  confidence: z.number().min(0).max(1),
}).strict();

const outputSchema = z.object({
  transactions: z.array(transactionSchema).min(1).max(10),
  missingFields: z.array(z.string().min(1).max(40)).max(30),
  needsConfirmation: z.literal(true),
}).strict();

const headers = { 'Content-Type': 'application/json' };
const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (request) => {
  const requestId = crypto.randomUUID();
  const started = Date.now();
  try {
    if (request.method !== 'POST') return respond(405, { code: 'method_not_allowed', requestId });
    const declaredLength = Number(request.headers.get('content-length') ?? 0);
    if (declaredLength > MAX_BODY_BYTES) return respond(413, { code: 'request_too_large', requestId });

    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) return respond(401, { code: 'authentication_required', requestId });
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceKey) return respond(503, { code: 'server_not_configured', requestId });
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData.user) return respond(401, { code: 'invalid_session', requestId });

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) return respond(413, { code: 'request_too_large', requestId });
    let rawJson: unknown;
    try { rawJson = JSON.parse(rawBody); } catch { return respond(400, { code: 'invalid_json', requestId }); }
    const parsed = requestSchema.safeParse(rawJson);
    if (!parsed.success) return respond(400, { code: 'invalid_request', requestId });

    const serviceClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const limit = Math.min(Math.max(Number(Deno.env.get('AI_RATE_LIMIT_PER_HOUR') ?? 30), 1), 100);
    const { data: allowed, error: rateError } = await serviceClient.rpc('check_ai_rate_limit', { p_user_id: userData.user.id, p_limit: limit });
    if (rateError) return respond(503, { code: 'rate_limit_unavailable', requestId });
    if (!allowed) return respond(429, { code: 'rate_limit_exceeded', requestId });

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    const model = Deno.env.get('GEMINI_MODEL');
    if (!apiKey || !model) return respond(503, { code: 'ai_not_configured', requestId });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    const prompt = `You parse English personal-finance voice commands into JSON.
Never invent amounts, dates, merchants, currencies, accounts, or categories. Unknown values must be null.
Use only these accounts: ${JSON.stringify(parsed.data.accounts)}.
Use only these categories: ${JSON.stringify(parsed.data.categories)}.
Use only these budget categories: ${JSON.stringify(parsed.data.budgetCategories)}.
The phrase "in [name]" or "under [name] budget" may explicitly assign an expense to a budget category. If no budget is explicitly mentioned, return budget null so the client can apply its local default mapping.
Default currency: ${parsed.data.defaultCurrency}. Locale: ${parsed.data.locale}. Timezone: ${parsed.data.timezone}.
Reference time: ${parsed.data.referenceTime}.
Support multiple transactions. Return needsConfirmation true. Do not include commentary.
Transcript: ${JSON.stringify(parsed.data.transcript)}`;
    let geminiResponse: Response;
    try {
      geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0,
            responseMimeType: 'application/json',
            responseJsonSchema: {
              type: 'object', required: ['transactions', 'missingFields', 'needsConfirmation'],
              properties: {
                transactions: { type: 'array', minItems: 1, maxItems: 10, items: { type: 'object', required: ['type', 'amount', 'currency', 'merchant', 'category', 'budget', 'account', 'occurredAt', 'note', 'confidence'], properties: {
                  type: { type: 'string', enum: ['expense', 'income'] }, amount: { type: ['string', 'null'] }, currency: { type: ['string', 'null'] }, merchant: { type: ['string', 'null'] }, category: { type: ['string', 'null'] }, budget: { type: ['string', 'null'] }, account: { type: ['string', 'null'] }, occurredAt: { type: ['string', 'null'] }, note: { type: ['string', 'null'] }, confidence: { type: 'number', minimum: 0, maximum: 1 },
                } } },
                missingFields: { type: 'array', items: { type: 'string' } }, needsConfirmation: { type: 'boolean' },
              },
            },
          },
        }),
      });
    } finally { clearTimeout(timeout); }
    if (!geminiResponse.ok) return respond(502, { code: 'ai_provider_error', requestId });
    const providerJson = await geminiResponse.json();
    const text = providerJson?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string') return respond(502, { code: 'ai_empty_response', requestId });
    let modelOutput: unknown;
    try { modelOutput = JSON.parse(text); } catch { return respond(502, { code: 'ai_invalid_json', requestId }); }
    const validated = outputSchema.safeParse(modelOutput);
    if (!validated.success) return respond(502, { code: 'ai_schema_rejected', requestId });
    console.log(JSON.stringify({ requestId, userIdHash: userData.user.id.slice(0, 8), outcome: 'ok', durationMs: Date.now() - started, count: validated.data.transactions.length }));
    return respond(200, validated.data);
  } catch (error) {
    const code = error instanceof DOMException && error.name === 'AbortError' ? 'ai_timeout' : 'internal_error';
    console.error(JSON.stringify({ requestId, outcome: code, durationMs: Date.now() - started }));
    return respond(code === 'ai_timeout' ? 504 : 500, { code, requestId });
  }
});

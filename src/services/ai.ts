import { aiOutputSchema, aiRequestSchema, type AiOutput } from '@/src/domain/schemas';
import { requireSupabase } from './supabase';

export async function parseWithCloudAi(input: unknown): Promise<AiOutput> {
  const request = aiRequestSchema.parse(input);
  const supabase = requireSupabase();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) throw new Error('Sign in to use optional cloud AI parsing.');
  const { data, error } = await supabase.functions.invoke('parse-transcript', { body: request });
  if (error) throw new Error(error.message || 'Cloud parsing is unavailable.');
  return aiOutputSchema.parse(data);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export function getSupabasePublicConfig() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase не налаштовано. Перевірте змінні середовища.");
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
  };
}

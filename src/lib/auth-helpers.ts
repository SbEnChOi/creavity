import type { SupabaseClient, User } from "@supabase/supabase-js";

export async function ensureProfile(
  supabase: SupabaseClient,
  user: User,
  fallbackName: string
) {
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) return;

  await supabase.from("profiles").insert({
    id: user.id,
    email: user.email ?? null,
    display_name: fallbackName,   // 스키마: display_name
  });
}

import { createSupabaseServerClient } from "@/lib/supabase/server";
import SettingsClient from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: me }, { data: members }, { data: mentors }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, avatar_color, grade")
      .eq("id", user!.id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("id, display_name, avatar_color, grade")
      .order("display_name", { ascending: true }),
    supabase
      .from("mentor_pairings")
      .select("mentor_id")
      .eq("mentee_id", user!.id),
  ]);

  return (
    <SettingsClient
      currentUserId={user!.id}
      me={me ?? { id: user!.id, display_name: null, avatar_color: null, grade: null }}
      members={(members ?? []).filter((m) => m.id !== user!.id)}
      mentorIds={(mentors ?? []).map((m) => m.mentor_id)}
    />
  );
}

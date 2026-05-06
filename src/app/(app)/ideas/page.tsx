import { createSupabaseServerClient } from "@/lib/supabase/server";
import IdeasClient, { type IdeaAuthor, type IdeaRow } from "./ideas-client";

export const dynamic = "force-dynamic";

export default async function IdeasPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: ideas } = await supabase
    .from("ideas")
    .select("id, author_id, title, body, visibility, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const list = (ideas ?? []) as IdeaRow[];
  const authorIds = Array.from(new Set(list.map((i) => i.author_id)));

  const { data: profiles } = authorIds.length
    ? await supabase
        .from("profiles")
        .select("id, display_name, avatar_color")
        .in("id", authorIds)
    : { data: [] as IdeaAuthor[] };

  const authorMap: Record<string, IdeaAuthor> = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, p as IdeaAuthor])
  );

  return (
    <IdeasClient
      ideas={list}
      authorMap={authorMap}
      currentUserId={user!.id}
    />
  );
}

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Report } from "@/types/report";
import AdminClient, { type AdminMember, type AdminReport } from "./admin-client";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 관리자 확인 (RLS도 막지만 UI에서도 차단)
  const { data: me } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user!.id)
    .maybeSingle();

  if (!me?.is_admin) redirect("/dashboard");

  const [{ data: members }, { data: reports }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, avatar_color, grade, is_admin")
      .order("display_name", { ascending: true }),
    supabase
      .from("reports")
      .select("*")
      .order("updated_at", { ascending: false }),
  ]);

  const reportList = (reports ?? []) as Report[];
  const profileMap: Record<string, AdminMember> = Object.fromEntries(
    (members ?? []).map((m) => [m.id, m as AdminMember])
  );

  const reportsWithAuthor: AdminReport[] = reportList.map((r) => ({
    ...r,
    author: profileMap[r.author_id] ?? null,
  }));

  return (
    <AdminClient
      members={(members ?? []) as AdminMember[]}
      reports={reportsWithAuthor}
      currentUserId={user!.id}
    />
  );
}

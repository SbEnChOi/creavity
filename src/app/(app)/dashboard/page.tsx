import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Report } from "@/types/report";
import DashboardClient from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS가 author_id 필터링하지만 명시적으로도 걸어둠
  const { data: reports, error } = await supabase
    .from("reports")
    .select("*")
    .eq("author_id", user!.id)
    .order("updated_at", { ascending: false });

  if (error) console.error("reports fetch error:", error.message);

  return <DashboardClient reports={(reports ?? []) as Report[]} />;
}

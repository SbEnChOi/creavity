import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const user = await getServerUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_color, is_admin, club_id, clubs(name)")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="flex min-h-screen bg-background creavy-app-shell">
      <Sidebar profile={profile} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}

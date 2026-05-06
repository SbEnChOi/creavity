import { createClient } from "@supabase/supabase-js";

// 절대 클라이언트 컴포넌트에서 import하지 말 것 — 서버 전용 (service_role key 사용)
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY가 환경변수에 설정되어 있지 않습니다."
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

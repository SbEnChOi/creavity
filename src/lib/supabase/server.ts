import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Server Component에서 호출될 때 무시 — 미들웨어에서 갱신됨
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // 위와 동일
          }
        },
      },
    }
  );
}

/**
 * 요청(request) 단위로 인증 사용자를 한 번만 조회한다.
 * layout과 page가 같은 렌더에서 각자 getUser()를 호출하던 중복 왕복을 제거한다.
 * React cache는 서버 렌더 1회 범위에서만 유효하므로 사용자 간 공유되지 않는다.
 */
export const getServerUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});


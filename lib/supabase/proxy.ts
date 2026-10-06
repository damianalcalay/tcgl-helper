import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "../utils";
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!hasEnvVars) return response;
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values) => {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  const { data } = await client.auth.getClaims();
  const publicRoute =
    request.nextUrl.pathname === "/pro-tv" ||
    ["/api/replay-image", "/api/replay-cards"].includes(
      request.nextUrl.pathname,
    );
  if (
    !data?.claims &&
    !request.nextUrl.pathname.startsWith("/auth") &&
    !publicRoute
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }
  return response;
}

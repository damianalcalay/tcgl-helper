const allowed = (url: URL) =>
  url.protocol === "https:" &&
  (url.hostname === "assets.tcgdex.net" ||
    url.hostname === "api.tcgdex.net" ||
    (process.env.NEXT_PUBLIC_SUPABASE_URL &&
      url.origin === new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin &&
      url.pathname.startsWith("/storage/v1/object/")));
export async function GET(request: Request) {
  try {
    const url = new URL(new URL(request.url).searchParams.get("url") ?? "");
    if (!allowed(url))
      return new Response("Unsupported image origin", { status: 400 });
    const response = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !/^image\/(png|jpeg|webp)$/.test(type))
      return new Response("Image unavailable", { status: 502 });
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 8000000)
      return new Response("Image too large", { status: 413 });
    return new Response(bytes, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return new Response("Image unavailable", { status: 502 });
  }
}

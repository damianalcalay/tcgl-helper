import { createClient } from "@/lib/supabase/server";
import { tcgdexGet, type CardData } from "@/lib/tcgdex";

export async function POST(request: Request) {
  const client = await createClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user)
    return Response.json(
      { error: "Sign in to upload card art." },
      { status: 401 },
    );
  if (Number(request.headers.get("content-length")) > 9 * 1024 * 1024)
    return Response.json(
      { error: "Image too large (8 MB maximum)." },
      { status: 413 },
    );
  try {
    const form = await request.formData(),
      id = form.get("id"),
      file = form.get("file");
    if (
      typeof id !== "string" ||
      !/^[a-zA-Z0-9.-]{1,80}$/.test(id) ||
      !(file instanceof File)
    )
      return Response.json(
        { error: "Choose a card and an image." },
        { status: 400 },
      );
    if (
      !file.size ||
      file.size > 8 * 1024 * 1024 ||
      !["image/png", "image/jpeg", "image/webp"].includes(file.type)
    )
      return Response.json(
        { error: "Use a PNG, JPEG, or WebP image up to 8 MB." },
        { status: 400 },
      );
    const bytes = new Uint8Array(await file.arrayBuffer());
    const png =
      bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const webp =
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    if (
      !(file.type === "image/png"
        ? png
        : file.type === "image/jpeg"
          ? jpeg
          : webp)
    )
      return Response.json(
        { error: "The file contents do not match its image type." },
        { status: 400 },
      );
    await tcgdexGet<CardData>(`cards/${id}`);
    const path = `${auth.user.id}/${id}/${crypto.randomUUID()}.${png ? "png" : jpeg ? "jpg" : "webp"}`;
    const { error: uploadError } = await client.storage
      .from("card-art")
      .upload(path, bytes, { contentType: file.type, upsert: false });
    if (uploadError) throw new Error(uploadError.message);
    const { error } = await client
      .from("card_image_overrides")
      .upsert({
        tcgdex_id: id,
        path,
        uploaded_by: auth.user.id,
        updated_at: new Date().toISOString(),
      });
    if (error) {
      await client.storage.from("card-art").remove([path]);
      throw new Error(
        "Could not register the image. Install the shared-card-art migration and retry.",
      );
    }
    return Response.json({
      image: client.storage.from("card-art").getPublicUrl(path).data.publicUrl,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not upload image. Retry.",
      },
      { status: 502 },
    );
  }
}

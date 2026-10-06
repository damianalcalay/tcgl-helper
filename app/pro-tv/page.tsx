import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { notFound } from "next/navigation";
import { ProTvView } from "@/components/pro-tv/pro-tv-view";
export default async function ProTvPage() {
  if (!hasEnvVars) return <p>Configure Supabase to use Pro TV.</p>;
  const client = await createClient();
  const [{ data: admin }, { data: settings, error: settingError }] =
    await Promise.all([
      client.rpc("is_app_admin"),
      client.from("pro_tv_settings").select("enabled").eq("id", true).single(),
    ]);
  if (settingError)
    return (
      <p>Install the replay / Pro TV migration to configure the catalogue.</p>
    );
  if (!settings.enabled && !admin) notFound();
  const { data: matches, error } = await client
    .from("pro_tv_matches")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return <p>Unable to load the catalogue. Please try again.</p>;
  return (
    <ProTvView
      matches={matches ?? []}
      admin={Boolean(admin)}
      enabled={settings.enabled}
    />
  );
}

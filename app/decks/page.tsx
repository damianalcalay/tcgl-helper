import { loadAppData } from "@/lib/data";
import { DataNotice } from "@/components/shared/data-notice";
import { DecksView } from "@/components/decks/decks-view";
export default async function DecksPage() {
  const result = await loadAppData();
  return result.data ? (
    <DecksView data={result.data} />
  ) : (
    <DataNotice setup={result.setup} error={result.error} />
  );
}
export const dynamic = "force-dynamic";

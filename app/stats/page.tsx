import { loadAppData } from "@/lib/data";
import { DataNotice } from "@/components/shared/data-notice";
import { StatsView } from "@/components/stats/stats-view";
export default async function StatsPage() {
  const result = await loadAppData();
  return result.data ? (
    <StatsView data={result.data} />
  ) : (
    <DataNotice setup={result.setup} error={result.error} />
  );
}
export const dynamic = "force-dynamic";

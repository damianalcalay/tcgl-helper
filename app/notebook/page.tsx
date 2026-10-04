import { loadAppData } from "@/lib/data";
import { DataNotice } from "@/components/shared/data-notice";
import { NotebookView } from "@/components/notebook/notebook-view";
export default async function NotebookPage() {
  const result = await loadAppData();
  return result.data ? (
    <NotebookView data={result.data} />
  ) : (
    <DataNotice setup={result.setup} error={result.error} />
  );
}
export const dynamic = "force-dynamic";

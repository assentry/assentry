import { Suspense } from "react";
import { DeveloperConsole } from "../../../components/developers/DeveloperConsole";

export default function DeveloperConsolePage() {
  // The console keeps its place in the URL (?app=…&section=…), which needs a
  // Suspense boundary for useSearchParams.
  return (
    <Suspense fallback={<div className="min-h-screen bg-navy-950" />}>
      <DeveloperConsole />
    </Suspense>
  );
}

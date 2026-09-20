import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { MapView } from "./components/map/MapView";
import { Viewport3D } from "./components/scene/Viewport3D";
import { TopBar } from "./components/TopBar";
import { ParcelPanel } from "./components/panels/ParcelPanel";
import { InspectorPanel } from "./components/panels/InspectorPanel";
import { RegistryPage } from "./components/registry/RegistryPage";
import { ReviewQueue } from "./components/review/ReviewQueue";
import { CertificateModal, ImportModal, NewVolumeModal, Toast } from "./components/modals";
import { PlanImportModal } from "./components/PlanImportModal";
import { PipelineModal } from "./components/pipeline/PipelineModal";
import { useUI } from "./store/ui";
import { useRegistry } from "./store/registry";
import { EmptyRegister } from "./components/EmptyRegister";
import { useLive } from "./store/live";

const HALF = "w-[calc(50%-6px)]";

export default function App() {
  const path = useLocation().pathname;
  const onRegistry = path.startsWith("/app/registry");
  const onReview = path.startsWith("/app/review");
  const workspace = useUI((s) => s.workspace);
  const connect = useLive((s) => s.connect);
  const empty = useRegistry((s) => s.parcels.length === 0);

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    document.documentElement.dataset.view = "workspace";
    return () => {
      delete document.documentElement.dataset.view;
    };
  }, []);

  const mapClass =
    workspace === "split"
      ? `left-0 ${HALF} z-10`
      : workspace === "map"
        ? "left-0 w-full z-10"
        : "left-0 w-full -z-10 opacity-0 pointer-events-none";

  const modelClass =
    workspace === "split"
      ? `right-0 ${HALF} z-10`
      : workspace === "model"
        ? "right-0 w-full z-10"
        : "right-0 w-full -z-10 opacity-0 pointer-events-none";

  return (
    <div className="flex h-full select-none flex-col bg-void">
      <TopBar />

      {onReview ? (
        <ReviewQueue />
      ) : onRegistry ? (
        <RegistryPage />
      ) : (
        <main className="flex min-h-0 flex-1 gap-3 p-3">
          <ParcelPanel />
          <section className="relative min-w-0 flex-1">
            <div className={`absolute inset-y-0 transition-[width] duration-200 ${mapClass}`}>
              <MapView />
            </div>
            <div
              className={`absolute inset-y-0 overflow-hidden rounded-md border border-line transition-[width] duration-200 ${modelClass}`}
            >
              <Viewport3D />
            </div>
            {empty && <EmptyRegister />}
          </section>
          <InspectorPanel />
        </main>
      )}

      <ImportModal />
      <NewVolumeModal />
      <PlanImportModal />
      <PipelineModal />
      <CertificateModal />
      <Toast />
    </div>
  );
}

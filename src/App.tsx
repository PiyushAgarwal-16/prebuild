import { MapView } from "./components/map/MapView";
import { Viewport3D } from "./components/scene/Viewport3D";
import { TopBar } from "./components/TopBar";
import { ParcelPanel } from "./components/panels/ParcelPanel";
import { InspectorPanel } from "./components/panels/InspectorPanel";
import { RegistryPage } from "./components/registry/RegistryPage";
import { CertificateModal, ImportModal, NewVolumeModal, Toast } from "./components/modals";
import { useUI } from "./store/ui";

const HALF = "w-[calc(50%-6px)]";

export default function App() {
  const page = useUI((s) => s.page);
  const workspace = useUI((s) => s.workspace);

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

      {page === "registry" ? (
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
          </section>
          <InspectorPanel />
        </main>
      )}

      <ImportModal />
      <NewVolumeModal />
      <CertificateModal />
      <Toast />
    </div>
  );
}

import { useRef, useState } from "react";
import { useRegistry } from "../store/registry";
import { useUI } from "../store/ui";
import type { Workspace } from "../store/ui";
import { exportCSV, exportGLB, exportGeoJSON, exportPNG } from "../lib/exporters";
import {
  IconAlert,
  IconCube,
  IconExport,
  IconLayers,
  IconMap,
  IconPlus,
  IconPolygon,
  IconRefresh,
  IconSparkle,
  IconSplit,
  IconUpload,
} from "./icons";

const MODES: [Workspace, string, typeof IconMap][] = [
  ["split", "Split", IconSplit],
  ["map", "Map", IconMap],
  ["model", "Model", IconCube],
];

function Button({
  onClick,
  children,
  tone = "ghost",
  title,
}: {
  onClick: () => void;
  children: React.ReactNode;
  tone?: "ghost" | "solid";
  title?: string;
}) {
  const base =
    "flex h-8 items-center gap-1.5 rounded-sm px-2.5 text-[11px] font-medium transition-colors";
  const skin =
    tone === "solid"
      ? "bg-text text-base hover:bg-accent"
      : "border border-line bg-surface text-dim hover:border-line-strong hover:text-text";
  return (
    <button title={title} onClick={onClick} className={`${base} ${skin}`}>
      {children}
    </button>
  );
}

export function TopBar() {
  const parcels = useRegistry((s) => s.parcels);
  const strata = useRegistry((s) => s.strata);
  const conflicts = useRegistry((s) => s.conflicts);
  const selectedParcelId = useRegistry((s) => s.selectedParcelId);
  const resetToSeed = useRegistry((s) => s.resetToSeed);

  const page = useUI((s) => s.page);
  const setPage = useUI((s) => s.setPage);
  const workspace = useUI((s) => s.workspace);
  const setWorkspace = useUI((s) => s.setWorkspace);
  const setDrawing = useUI((s) => s.setDrawing);
  const drawing = useUI((s) => s.drawing);
  const setImportOpen = useUI((s) => s.setImportOpen);
  const setNewVolumeOpen = useUI((s) => s.setNewVolumeOpen);
  const setPlanOpen = useUI((s) => s.setPlanOpen);
  const showToast = useUI((s) => s.showToast);

  const [exportOpen, setExportOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();

  const critical = conflicts.filter((c) => c.severity === "critical").length;
  const parcel = parcels.find((p) => p.id === selectedParcelId);

  const run = (label: string, fn: () => void | Promise<void>) => async () => {
    setExportOpen(false);
    try {
      await fn();
      showToast(`${label} exported`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : `${label} failed`);
    }
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-text text-base">
          <IconLayers size={16} />
        </div>
        <div className="leading-tight">
          <div className="text-[13px] font-semibold tracking-tight">ULPIN 3D</div>
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-faint">
            Vertical property registry
          </div>
        </div>
      </div>

      <div className="flex items-center rounded-sm border border-line p-0.5">
        {(["workspace", "registry"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPage(p)}
            className={`h-7 rounded-xs px-3 text-[11px] capitalize transition-colors ${
              page === p ? "bg-text text-base" : "text-dim hover:text-text"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {page === "workspace" && (
        <div className="flex items-center rounded-sm border border-line p-0.5">
          {MODES.map(([mode, label, Icon]) => (
            <button
              key={mode}
              onClick={() => setWorkspace(mode)}
              title={label}
              className={`flex h-7 items-center gap-1.5 rounded-xs px-2.5 text-[11px] transition-colors ${
                workspace === mode ? "bg-raised text-text" : "text-faint hover:text-text"
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="ml-1 hidden items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-faint lg:flex">
        <span>{parcels.length} parcels</span>
        <span>{strata.length} volumes</span>
        {critical > 0 && (
          <span className="flex items-center gap-1 text-[#b4553f]">
            <IconAlert size={12} /> {critical} critical
          </span>
        )}
      </div>

      <div className="flex-1" />

      {parcel && (
        <div className="hidden font-mono text-[10px] text-faint xl:block">
          {parcel.jurisdiction.villageName} · {parcel.jurisdiction.districtName} ·{" "}
          {parcel.jurisdiction.stateName}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          tone={drawing ? "solid" : "ghost"}
          onClick={() => {
            setWorkspace(workspace === "model" ? "split" : workspace);
            setDrawing(!drawing);
          }}
          title="Draw a new surface parcel on the map"
        >
          <IconPolygon size={13} /> Survey parcel
        </Button>
        <Button onClick={() => setNewVolumeOpen(true)} title="Register a new vertical volume">
          <IconPlus size={13} /> Volume
        </Button>
        <Button onClick={() => setPlanOpen(true)} title="Digitise a floor plan into vertical volumes">
          <IconSparkle size={13} /> Floor plan
        </Button>
        <Button onClick={() => setImportOpen(true)} title="Import GeoJSON">
          <IconUpload size={13} /> Import
        </Button>

        <div
          className="relative"
          onMouseEnter={() => clearTimeout(closeTimer.current)}
          onMouseLeave={() => {
            closeTimer.current = setTimeout(() => setExportOpen(false), 220);
          }}
        >
          <Button onClick={() => setExportOpen(!exportOpen)}>
            <IconExport size={13} /> Export
          </Button>
          {exportOpen && (
            <div className="pb-rise absolute right-0 top-9 z-30 w-52 overflow-hidden rounded-sm border border-line bg-surface shadow-pop">
              {[
                ["GeoJSON (parcels + strata)", run("GeoJSON", exportGeoJSON)],
                ["CSV register extract", run("CSV", exportCSV)],
                ["GLB 3D model", run("GLB", exportGLB)],
                ["PNG of 3D view", run("PNG", () => exportPNG(2))],
              ].map(([label, fn]) => (
                <button
                  key={label as string}
                  onClick={fn as () => void}
                  className="block w-full px-3 py-2 text-left text-[11px] text-dim hover:bg-hover hover:text-text"
                >
                  {label as string}
                </button>
              ))}
            </div>
          )}
        </div>

        <Button
          onClick={() => {
            resetToSeed();
            showToast("Registry reset to sample dataset");
          }}
          title="Reset to the sample dataset"
        >
          <IconRefresh size={13} />
        </Button>
      </div>
    </header>
  );
}

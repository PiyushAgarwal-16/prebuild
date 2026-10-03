import { useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useRegistry } from "../store/registry";
import { useRole } from "../store/role";
import { useUI } from "../store/ui";
import type { Workspace } from "../store/ui";
import { exportCSV, exportCityJSON, exportGLB, exportGeoJSON, exportPNG } from "../lib/exporters";
import {
  IconAlert,
  IconCube,
  IconExport,
  IconMap,
  IconPlus,
  IconPolygon,
  IconRefresh,
  IconSparkle,
  IconSplit,
  IconStack,
  IconUpload,
} from "./icons";

const SURFACES = [
  { path: "/app", label: "Workspace", roles: ["surveyor", "officer"] },
  { path: "/app/review", label: "Review", roles: ["officer"] },
  { path: "/app/registry", label: "Registry", roles: ["surveyor", "officer", "public"] },
] as const;

const ROLES = ["surveyor", "officer", "public"] as const;

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
    "flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm px-2.5 text-[11px] font-medium transition-colors";
  const skin =
    tone === "solid"
      ? "bg-accent text-white hover:bg-accent-strong"
      : "border border-white/15 bg-white/5 text-white/75 hover:border-white/35 hover:text-white";
  return (
    <button title={title} onClick={onClick} className={`${base} ${skin}`}>
      {children}
    </button>
  );
}

function Wordmark() {
  return (
    <Link
      to="/"
      title="Back to the landing page"
      className="flex items-baseline gap-1 transition-opacity hover:opacity-75"
    >
      <span className="text-[21px] font-semibold leading-none tracking-[-0.04em] text-white">
        ulpin
      </span>
      <span className="text-[12px] font-light leading-none tracking-[-0.025em] text-white">3d</span>
      <svg viewBox="0 0 16 16" aria-hidden className="h-[9px] w-[9px] fill-accent-dim">
        <path d="M8 1 15 8 8 15 1 8Z" />
      </svg>
    </Link>
  );
}

export function TopBar() {
  const parcels = useRegistry((s) => s.parcels);
  const strata = useRegistry((s) => s.strata);
  const conflicts = useRegistry((s) => s.conflicts);
  const selectedParcelId = useRegistry((s) => s.selectedParcelId);
  const clearAll = useRegistry((s) => s.clearAll);

  const path = useLocation().pathname;
  const onRegistry = path.startsWith("/app/registry");
  const onWorkspace = path === "/app";
  const role = useRole((s) => s.role);
  const setRole = useRole((s) => s.setRole);
  const workspace = useUI((s) => s.workspace);
  const setWorkspace = useUI((s) => s.setWorkspace);
  const setDrawing = useUI((s) => s.setDrawing);
  const drawing = useUI((s) => s.drawing);
  const setImportOpen = useUI((s) => s.setImportOpen);
  const setNewVolumeOpen = useUI((s) => s.setNewVolumeOpen);
  const setPlanOpen = useUI((s) => s.setPlanOpen);
  const setPipelineOpen = useUI((s) => s.setPipelineOpen);
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
    <header className="flex h-14 shrink-0 items-center gap-4 overflow-x-auto bg-ink px-4">
      <Wordmark />

      <nav className="flex shrink-0 items-center gap-5">
        {SURFACES.filter((s) => (s.roles as readonly string[]).includes(role)).map((surface) => {
          const active =
            surface.path === "/app" ? path === "/app" : path.startsWith(surface.path);
          return (
            <Link
              key={surface.path}
              to={surface.path}
              aria-current={active ? "page" : undefined}
              className={`whitespace-nowrap border-b-2 py-1 text-[13px] transition-colors ${
                active
                  ? "border-accent-dim text-accent-dim"
                  : "border-transparent text-white/60 hover:text-white"
              }`}
            >
              {surface.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex shrink-0 items-center gap-0.5 rounded-sm border border-white/15 p-0.5">
        {ROLES.map((option) => (
          <button
            key={option}
            onClick={() => setRole(option)}
            title={`Act as ${option}`}
            className={`h-7 rounded-xs px-2.5 text-[11px] capitalize transition-colors ${
              role === option ? "bg-white/15 text-white" : "text-white/50 hover:text-white"
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      {onWorkspace && (
        <div className="flex shrink-0 items-center gap-0.5 rounded-sm border border-white/15 p-0.5">
          {MODES.map(([mode, label, Icon]) => (
            <button
              key={mode}
              onClick={() => setWorkspace(mode)}
              title={label}
              className={`flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xs px-2.5 text-[11px] transition-colors ${
                workspace === mode ? "bg-white/15 text-white" : "text-white/50 hover:text-white"
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="ml-1 hidden shrink-0 items-center gap-3 whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-white/40 2xl:flex">
        <span>{parcels.length} parcels</span>
        <span>{strata.length} volumes</span>
        {critical > 0 && (
          <span className="flex items-center gap-1 text-[#ff9c86]">
            <IconAlert size={12} /> {critical} critical
          </span>
        )}
      </div>

      <div className="flex-1" />

      {parcel && (
        <div className="hidden shrink-0 whitespace-nowrap font-mono text-[10px] text-white/35 2xl:block">
          {parcel.jurisdiction.villageName} · {parcel.jurisdiction.districtName} ·{" "}
          {parcel.jurisdiction.stateName}
        </div>
      )}

      <div className="flex shrink-0 items-center gap-2">
        <Button
          tone={drawing ? "solid" : "ghost"}
          onClick={() => {
            setWorkspace(workspace === "model" ? "split" : workspace);
            setDrawing(!drawing);
          }}
          title="Draw a new surface parcel on the map"
        >
          <IconPolygon size={13} /> <span className="hidden xl:inline">Survey parcel</span>
        </Button>
        <Button
          tone="solid"
          onClick={() => setPipelineOpen(true)}
          title="Fetch raised buildings from map data for the current view"
        >
          <IconStack size={13} /> <span className="hidden xl:inline">Fetch buildings</span>
        </Button>
        <Button onClick={() => setNewVolumeOpen(true)} title="Register a new vertical volume">
          <IconPlus size={13} /> <span className="hidden xl:inline">Volume</span>
        </Button>
        <Button onClick={() => setPlanOpen(true)} title="Digitise a floor plan into vertical volumes">
          <IconSparkle size={13} /> <span className="hidden xl:inline">Floor plan</span>
        </Button>
        <Button onClick={() => setImportOpen(true)} title="Import GeoJSON">
          <IconUpload size={13} /> <span className="hidden xl:inline">Import</span>
        </Button>

        <div
          className="relative"
          onMouseEnter={() => clearTimeout(closeTimer.current)}
          onMouseLeave={() => {
            closeTimer.current = setTimeout(() => setExportOpen(false), 220);
          }}
        >
          <Button onClick={() => setExportOpen(!exportOpen)}>
            <IconExport size={13} /> <span className="hidden xl:inline">Export</span>
          </Button>
          {exportOpen && (
            <div className="pb-rise absolute right-0 top-9 z-30 w-52 overflow-hidden rounded-sm border border-line bg-surface shadow-pop">
              {[
                ["GeoJSON (parcels + strata)", run("GeoJSON", exportGeoJSON)],
                ["CityJSON (CityGML 3.0 model)", run("CityJSON", exportCityJSON)],
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
            clearAll();
            showToast("Register cleared");
          }}
          title="Clear every record from the register"
        >
          <IconRefresh size={13} />
        </Button>
      </div>
    </header>
  );
}

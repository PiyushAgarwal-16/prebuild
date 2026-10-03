import { useMemo, useState } from "react";
import { useRegistry } from "../../store/registry";
import { useUI } from "../../store/ui";
import { toDerivedBuilding } from "../../registry/fromWorkspace";
import { lodgeSubmission } from "../../registry/client";
import { sectionLabelClass } from "../ui/primitives";
import { IconCheck } from "../icons";

interface Step {
  title: string;
  hint: string;
  action: string;
  done: boolean;
  run: () => void | Promise<void>;
}

export function GuidedBuild() {
  const parcels = useRegistry((s) => s.parcels);
  const strata = useRegistry((s) => s.strata);
  const selectedParcelId = useRegistry((s) => s.selectedParcelId);
  const selectedStratumId = useRegistry((s) => s.selectedStratumId);
  const selectStratum = useRegistry((s) => s.selectStratum);

  const setDrawing = useUI((s) => s.setDrawing);
  const setPipelineOpen = useUI((s) => s.setPipelineOpen);
  const setPlanOpen = useUI((s) => s.setPlanOpen);
  const setWorkspace = useUI((s) => s.setWorkspace);
  const showToast = useUI((s) => s.showToast);

  const [lodged, setLodged] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [busy, setBusy] = useState(false);

  const parcel = parcels.find((p) => p.id === selectedParcelId) ?? parcels[0];
  const own = useMemo(
    () => (parcel ? strata.filter((s) => s.parcelId === parcel.id) : []),
    [parcel, strata],
  );

  const divided = useMemo(() => {
    const perLevel = new Map<string, number>();
    for (const s of own) {
      const key = `${s.band}${s.level}`;
      perLevel.set(key, (perLevel.get(key) ?? 0) + 1);
    }
    return [...perLevel.values()].some((n) => n > 1);
  }, [own]);

  const tallest = useMemo(
    () => [...own].sort((a, b) => b.zMax - a.zMax)[0] ?? null,
    [own],
  );

  const steps: Step[] = [
    {
      title: "Land parcel",
      hint: "Draw the surface boundary, or pull real parcels from map data.",
      action: "Draw on map",
      done: parcels.length > 0,
      run: () => {
        setWorkspace("map");
        setDrawing(true);
      },
    },
    {
      title: "Footprint, height and floors",
      hint: "Real building outlines with storey counts, stacked one volume per floor.",
      action: "Fetch buildings",
      done: own.length > 0,
      run: () => setPipelineOpen(true),
    },
    {
      title: "Divide the floor into apartments",
      hint: "A floor plan becomes separately owned spaces, corrected by you.",
      action: "Digitise floor plan",
      done: divided,
      run: () => setPlanOpen(true),
    },
    {
      title: "Extrude and identify",
      hint: "Each space becomes a 3D volume with its own ULPIN.",
      action: "View the stack",
      done: own.length > 0,
      run: () => setWorkspace("model"),
    },
    {
      title: "Inspect a flat",
      hint: "Floor, area, height range, parent ULPIN, undivided share, documents.",
      action: "Open the tallest volume",
      done: Boolean(selectedStratumId),
      run: () => {
        if (!tallest) return showToast("Nothing to inspect yet");
        selectStratum(tallest.id);
        setWorkspace("split");
      },
    },
    {
      title: "Validate and lodge",
      hint: "Geometry and ownership conflicts are checked before anything is registered.",
      action: busy ? "Lodging…" : "Lodge for review",
      done: lodged,
      run: async () => {
        if (!parcel || !own.length) return showToast("Nothing to lodge yet");
        setBusy(true);
        try {
          const { submission } = await lodgeSubmission(
            [toDerivedBuilding(parcel, strata)],
            parcel.jurisdiction.stateCode,
            `Guided build · ${own.length} volumes`,
          );
          setLodged(true);
          showToast(`${submission.reference} lodged — switch to Officer to review`);
        } catch (err) {
          showToast(err instanceof Error ? err.message : "Lodgement failed");
        } finally {
          setBusy(false);
        }
      },
    },
  ];

  const current = steps.findIndex((s) => !s.done);
  const complete = current === -1;

  return (
    <div className="border-b border-line">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center justify-between px-3 pb-2 pt-3"
      >
        <span className={sectionLabelClass}>
          Guided build{complete ? " · complete" : ` · step ${current + 1} of ${steps.length}`}
        </span>
        <span className="font-mono text-[10px] text-faint">{collapsed ? "+" : "−"}</span>
      </button>

      {!collapsed && (
        <div className="px-2 pb-2">
          {steps.map((step, i) => {
            const active = i === current;
            return (
              <div
                key={step.title}
                className={`rounded-sm border px-2.5 py-2 ${
                  active ? "mb-1 border-accent-dim bg-raised" : "mb-0.5 border-transparent"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] ${
                      step.done
                        ? "bg-[#2f8f6f] text-white"
                        : active
                          ? "bg-accent text-white"
                          : "border border-line text-faint"
                    }`}
                  >
                    {step.done ? <IconCheck size={9} /> : i + 1}
                  </span>
                  <span
                    className={`flex-1 text-[12px] ${step.done && !active ? "text-faint" : "text-text"}`}
                  >
                    {step.title}
                  </span>
                </div>

                {active && (
                  <>
                    <p className="mt-1.5 pl-6 text-[11px] leading-relaxed text-dim">{step.hint}</p>
                    <button
                      onClick={() => void step.run()}
                      disabled={busy}
                      className="ml-6 mt-2 h-7 rounded-sm bg-accent px-3 text-[11px] font-medium text-white hover:bg-accent-strong disabled:opacity-50"
                    >
                      {step.action}
                    </button>
                  </>
                )}
              </div>
            );
          })}

          {complete && (
            <p className="px-2.5 pb-1 pt-1 text-[11px] leading-relaxed text-[#2f6a4b]">
              Every stage passed. Switch the role to Officer to review the lodgement.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

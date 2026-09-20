import { useUI } from "../store/ui";
import { IconStack } from "./icons";
import { sectionLabelClass } from "./ui/primitives";

export function EmptyRegister() {
  const setPipelineOpen = useUI((s) => s.setPipelineOpen);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-6">
      <div className="pointer-events-auto w-[380px] rounded-sm border border-line bg-surface/95 p-5 text-center shadow-pop backdrop-blur-sm">
        <span className={sectionLabelClass}>
          Empty register
        </span>
        <h2 className="mt-2 text-[22px] font-light leading-[1.15] tracking-[-0.04em] text-text">
          Nothing is recorded here yet.
        </h2>
        <p className="mt-2 text-[12px] leading-relaxed text-dim">
          Pan the map behind this card to the area you want to record, then pull raised building
          structures from map data. Every stack is validated before it can enter the register.
        </p>
        <button
          onClick={() => setPipelineOpen(true)}
          className="mt-4 inline-flex h-9 items-center gap-2 rounded-sm bg-accent px-4 text-[12px] font-medium text-white transition-colors hover:bg-accent-strong"
        >
          <IconStack size={14} /> Fetch buildings for this view
        </button>
        <p className="mt-3 text-[10px] leading-relaxed text-faint">
          Buildings come from OpenStreetMap, ground elevation from ASTER GDEM. Nothing here is
          sample data.
        </p>
      </div>
    </div>
  );
}

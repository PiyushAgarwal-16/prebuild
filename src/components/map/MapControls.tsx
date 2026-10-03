import { useUI } from "../../store/ui";
import { useLive } from "../../store/live";
import { useViewport } from "../../store/viewport";
import { BASEMAP_ORDER, BASEMAPS } from "./basemap";
import { LiveBadge } from "../live/LiveBadge";

const TOGGLE = "rounded-xs px-2 py-1 text-[11px] transition-colors";

export function MapControls() {
  const basemap = useUI((s) => s.basemap);
  const setBasemap = useUI((s) => s.setBasemap);
  const followRover = useLive((s) => s.followRover);
  const setFollowRover = useLive((s) => s.setFollowRover);
  const linked = useViewport((s) => s.linked);
  const setLinked = useViewport((s) => s.setLinked);

  return (
    <div className="pointer-events-auto absolute left-3 top-3 flex flex-col gap-2">
      <LiveBadge />
      <div className="flex items-center gap-1 rounded-sm border border-line bg-surface/95 p-1 shadow-soft">
        {BASEMAP_ORDER.map((id) => (
          <button
            key={id}
            onClick={() => setBasemap(id)}
            className={`${TOGGLE} ${basemap === id ? "bg-accent text-white" : "text-dim hover:text-text"}`}
          >
            {BASEMAPS[id].label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 rounded-sm border border-line bg-surface/95 p-1 shadow-soft">
        <button
          onClick={() => setFollowRover(!followRover)}
          className={`${TOGGLE} ${followRover ? "bg-accent text-white" : "text-dim hover:text-text"}`}
        >
          Follow rover
        </button>
        <button
          onClick={() => setLinked(!linked)}
          className={`${TOGGLE} ${linked ? "bg-accent text-white" : "text-dim hover:text-text"}`}
        >
          Link views
        </button>
      </div>
    </div>
  );
}

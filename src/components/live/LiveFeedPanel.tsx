import { useState } from "react";
import { useLive } from "../../store/live";
import { FIX_COLOR, FIX_LABEL, formatClock, formatMillimetres } from "../../live/format";

const ROW = "flex items-baseline justify-between gap-3 py-0.5";
const KEY = "font-mono text-[10px] uppercase tracking-wide text-faint";
const VALUE = "font-mono text-[10px] text-text";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line pt-2">
      <div className="pb-1 text-[10px] font-medium uppercase tracking-wide text-dim">{title}</div>
      {children}
    </div>
  );
}

export function LiveFeedPanel() {
  const [open, setOpen] = useState(false);
  const stations = useLive((s) => s.stations);
  const rover = useLive((s) => s.rover);
  const imagery = useLive((s) => s.imagery);
  const synthetic = useLive((s) => s.synthetic);
  const clearTrack = useLive((s) => s.clearTrack);

  return (
    <div className="pointer-events-auto absolute bottom-3 left-3 w-[268px] rounded-sm border border-line bg-surface/95 p-2 shadow-soft">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-[11px] font-medium text-text"
      >
        <span>Live geospatial feed</span>
        <span className="font-mono text-[10px] text-faint">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="mt-2 flex flex-col gap-2">
          {rover && (
            <Section title="Rover">
              <div className={ROW}>
                <span className={KEY}>Fix</span>
                <span className={VALUE} style={{ color: FIX_COLOR[rover.fix] }}>
                  {FIX_LABEL[rover.fix]}
                </span>
              </div>
              <div className={ROW}>
                <span className={KEY}>Horiz RMS</span>
                <span className={VALUE}>{formatMillimetres(rover.horizontalRmsM)}</span>
              </div>
              <div className={ROW}>
                <span className={KEY}>Vert RMS</span>
                <span className={VALUE}>{formatMillimetres(rover.verticalRmsM)}</span>
              </div>
              <div className={ROW}>
                <span className={KEY}>Baseline</span>
                <span className={VALUE}>{rover.baselineKm.toFixed(2)} km</span>
              </div>
              <div className={ROW}>
                <span className={KEY}>Satellites</span>
                <span className={VALUE}>
                  {rover.satellites} · HDOP {rover.hdop.toFixed(2)}
                </span>
              </div>
            </Section>
          )}

          {stations.length > 0 && (
            <Section title={`CORS network (${stations.filter((s) => s.online).length}/${stations.length})`}>
              {stations.map((station) => (
                <div key={station.id} className={ROW}>
                  <span className={KEY}>{station.id}</span>
                  <span className={VALUE} style={{ color: FIX_COLOR[station.fix] }}>
                    {station.online ? `${station.satellites} sv · ${station.correctionAgeSec}s` : "offline"}
                  </span>
                </div>
              ))}
            </Section>
          )}

          {imagery.length > 0 && (
            <Section title="Imagery">
              {imagery.map((layer) => (
                <div key={layer.layerId} className={ROW}>
                  <span className={KEY}>{layer.label}</span>
                  <span className={VALUE}>
                    {formatClock(layer.capturedAt)} · {layer.gsdCm}cm
                  </span>
                </div>
              ))}
            </Section>
          )}

          <div className="flex items-center justify-between border-t border-line pt-2">
            <button onClick={clearTrack} className="text-[10px] text-dim hover:text-text">
              Clear track
            </button>
            {synthetic && (
              <span className="font-mono text-[9px] uppercase tracking-wide text-faint">
                Locally generated
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

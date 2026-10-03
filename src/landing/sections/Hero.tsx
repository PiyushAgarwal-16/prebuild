import { ScannerSection } from "./ScannerSection";
import { useScanner } from "../scanner/ScannerContext";

export function Hero() {
  const { paused, available, toggle } = useScanner();

  return (
    <ScannerSection
      id="home"
      className="hero"
      image="/images/city.webp"
      alt="Aerial view of a dense city block, the ground parcels beneath it carrying stacked property volumes"
      priority
      ariaLabel="Interactive vertical cadastre landscape"
    >
      <div className="hero-heading">
        <h1>
          Land is a volume.
          <br className="mobile-break" /> Record it that way.
        </h1>
        <p>Real-time 3D ULPIN generation and vertical property mapping.</p>
      </div>
      <div className="scan-controls">
        <button className="scan-toggle" aria-pressed={paused} onClick={toggle} disabled={!available}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M5 3v10M11 3v10" />
          </svg>
          <span>{!available ? "Image view" : paused ? "Enable scan" : "Pause scan"}</span>
        </button>
        <span className="scan-hint">Move to discover ↗</span>
      </div>
      <div className="hero-caption">
        <span className="status-dot" /> Live map and 3D views <span>/</span> Field feed is locally
        generated, not a live CORS network
      </div>
      <a className="scroll-cue" href="#about" aria-label="Why a third axis">
        <svg className="arrow" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3v17m-6-6 6 6 6-6" />
        </svg>
      </a>
    </ScannerSection>
  );
}

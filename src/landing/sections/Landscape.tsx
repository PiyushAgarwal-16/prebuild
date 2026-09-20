import { useState } from "react";
import { STAGES } from "../content";
import { ScannerSection } from "./ScannerSection";

export function Landscape() {
  const [expanded, setExpanded] = useState(0);

  return (
    <ScannerSection
      id="platform"
      className="asset-landscape"
      image="/images/city.webp"
      alt="City architecture annotated with the stages of building a vertical cadastre"
      labelledBy="landscape-title"
    >
      <div className="pixel-edge" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <h2 id="landscape-title">
        One column.
        <br />
        Many parcels.
      </h2>
      <div className="asset-pins">
        {STAGES.map((stage, i) => (
          <button
            key={stage.name}
            className={`asset-pin ${stage.position}`}
            aria-expanded={expanded === i}
            onClick={() => setExpanded(expanded === i ? -1 : i)}
          >
            <span className="pin-anchor" aria-hidden="true" />
            <span className="pin-content">
              <span className="pin-title">
                {stage.name}
                <span aria-hidden="true">↗</span>
              </span>
              <span className="pin-description">{stage.description}</span>
            </span>
          </button>
        ))}
      </div>
      <span className="landscape-caption">SELECT A POINT TO FOLLOW THE PIPELINE</span>
    </ScannerSection>
  );
}

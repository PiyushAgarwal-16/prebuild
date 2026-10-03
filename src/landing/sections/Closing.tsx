import { Link } from "react-router-dom";
import { ScannerSection } from "./ScannerSection";

export function Closing() {
  return (
    <ScannerSection
      className="closing"
      image="/images/city.webp"
      alt=""
      labelledBy="closing-title"
    >
      <div className="closing-content">
        <h2 id="closing-title">
          Real parcels.
          <br />
          Real volumes.
        </h2>
        <Link className="light-button" to="/app">
          Open the workspace
          <svg className="arrow" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 12h15m-6-6 6 6-6 6" />
          </svg>
        </Link>
      </div>
    </ScannerSection>
  );
}

import { CONNECTION_LABELS } from "../content";

export function Connection() {
  return (
    <section className="connection section-frame" aria-labelledby="connection-title">
      <div className="section-heading">
        <h2 id="connection-title">
          From field capture
          <br />
          to an issued identifier.
        </h2>
        <p>
          ULPIN 3D sits between what the survey instruments see and what the registry records. Every
          volume carries its geometry, its tenure, and the checks it passed.
        </p>
      </div>
      <div
        className="connection-graphic"
        aria-label="Capture, control, cadastre, and conflict detection connect to one identifier"
      >
        <svg
          className="connection-lines"
          viewBox="0 0 1000 360"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M120 80H360L500 180 640 80H880M120 280H360L500 180 640 280H880M500 0V360" />
          <path className="flow-line" d="M120 80H360L500 180 640 280H880" />
        </svg>
        <div className="connection-center">
          <div className="diamond-stack" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <strong>ulpin</strong>
          <span>3D</span>
        </div>
        {CONNECTION_LABELS.map((label) => (
          <span key={label.className} className={`connection-label ${label.className}`}>
            {label.text}
          </span>
        ))}
      </div>
      <div className="tech-strip">
        <span>BUILT AROUND</span>
        <span className="standard-mark">
          ◈ <b>ULPIN</b>
        </span>
        <span>14-character land parcel identifier</span>
        <span>GeoJSON · CSV · GLB ↗</span>
      </div>
    </section>
  );
}

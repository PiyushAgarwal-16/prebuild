import { useState } from "react";
import { DEMO_ACTIONS, DEMO_DESCRIPTIONS, DEMO_STEPS } from "../content";

export function Demo() {
  const [step, setStep] = useState(0);

  return (
    <section className="demo-section section-frame" id="explore" aria-labelledby="demo-title">
      <div className="section-heading">
        <h2 id="demo-title">
          Follow one column
          <br />
          from ground to air.
        </h2>
        <p>
          Four steps take a surveyed boundary to a stack of identified volumes. The workspace runs all
          four on live map and 3D views.
        </p>
      </div>
      <div className="demo-workspace">
        <div className="demo-summary">
          <span className="small-label">
            <i className="status-dot" /> PIPELINE WALKTHROUGH
          </span>
          <h3>Sy. No. 104/2</h3>
          <p>Illustrative parcel · Bengaluru Urban, Karnataka.</p>
          <div className="demo-asset-mark" aria-hidden="true">
            <svg viewBox="0 0 200 200">
              <path d="m100 20 80 45v75l-80 45-80-45V65Zm0 0v80m-80-35 80 35 80-35m-80 35v85m-80-45 80-40 80 40" />
            </svg>
          </div>
          <span className="demo-caption">ONE PARCEL, ONE COLUMN, MANY OWNERS</span>
        </div>
        <div className="demo-flow">
          <ol className="workflow-steps">
            {DEMO_STEPS.map((label, i) => (
              <li key={label} className={i === step ? "current" : i < step ? "done" : ""}>
                <span className="step-number">0{i + 1}</span>
                <span>{label}</span>
                <span className="step-state">
                  {i < step ? "Complete" : i === step ? "Ready" : "Upcoming"}
                </span>
              </li>
            ))}
          </ol>
          <div className="demo-next">
            <p id="demo-description" aria-live="polite">
              {DEMO_DESCRIPTIONS[step]}
            </p>
            <button className="dark-button" onClick={() => setStep((step + 1) % DEMO_STEPS.length)}>
              <span>{DEMO_ACTIONS[step]}</span>
              <svg className="arrow" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 12h15m-6-6 6 6-6 6" />
              </svg>
            </button>
            <button className="reset-button" onClick={() => setStep(0)}>
              Reset walkthrough
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

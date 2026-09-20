import { useRef, useState } from "react";
import { APPLICATIONS } from "../content";

export function Applications() {
  const [active, setActive] = useState(APPLICATIONS[0].id);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next = index;
    if (e.key === "ArrowRight") next = (index + 1) % APPLICATIONS.length;
    else if (e.key === "ArrowLeft") next = (index + APPLICATIONS.length - 1) % APPLICATIONS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = APPLICATIONS.length - 1;
    else return;
    e.preventDefault();
    setActive(APPLICATIONS[next].id);
    tabs.current[next]?.focus();
  };

  return (
    <section className="applications section-frame" id="assets" aria-labelledby="applications-title">
      <div className="section-heading">
        <h2 id="applications-title">
          Real columns.
          <br />
          Real records.
        </h2>
        <p>
          Three classes of entity share one identifier scheme: the ground parcel, the volumes stacked
          on it, and the rights that run through the column.
        </p>
      </div>

      <div className="application-tabs" role="tablist" aria-label="Recorded entity classes">
        {APPLICATIONS.map((app, i) => (
          <button
            key={app.id}
            ref={(node) => {
              tabs.current[i] = node;
            }}
            id={`tab-${app.id}`}
            role="tab"
            aria-selected={active === app.id}
            aria-controls={`panel-${app.id}`}
            tabIndex={active === app.id ? 0 : -1}
            onClick={() => setActive(app.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {app.tab}
            <span aria-hidden="true">↗</span>
          </button>
        ))}
      </div>

      {APPLICATIONS.map((app) => (
        <div
          key={app.id}
          className="application-panel"
          id={`panel-${app.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${app.id}`}
          tabIndex={0}
          hidden={active !== app.id}
        >
          <div className={`application-image ${app.id}-image`}>
            <img
              src={`/images/${app.image}.webp`}
              alt={`Illustrative city landscape for ${app.tab.toLowerCase()}`}
              loading="lazy"
              width={2016}
              height={1232}
            />
            <span className="image-bracket" />
            <span className="image-label">{app.label}</span>
          </div>
          <div className="application-content">
            <span className="small-label">{app.audience}</span>
            <h3>{app.title}</h3>
            <p>{app.text}</p>
            <dl>
              {app.facts.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <a className="text-link" href="#explore">
              Follow the pipeline
              <svg className="arrow" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 12h15m-6-6 6 6-6 6" />
              </svg>
            </a>
          </div>
        </div>
      ))}

      <p className="section-footnote">
        Entity classes as the prototype records them today. No jurisdiction has adopted this
        extension of the ULPIN scheme.
      </p>
    </section>
  );
}

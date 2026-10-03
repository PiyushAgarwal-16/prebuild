export function Access() {
  return (
    <section className="access-section section-frame" id="network">
      <div className="section-heading">
        <h2>
          One registry surface.
          <br />
          Every layer connected.
        </h2>
        <p>
          For survey departments, planning authorities, utilities, and the developers who have to wire
          all three together.
        </p>
      </div>
      <div className="access-columns">
        <article>
          <span className="small-label">REGISTRY WORKFLOWS</span>
          <h3>
            Bring the parcel.
            <br />
            Keep the identifier.
          </h3>
          <p>
            The 14-character ULPIN already issued against a ground parcel stays the root. Bands,
            levels, and units extend it, so a volume identifier still resolves to the land beneath it.
          </p>
          <a className="text-link" href="#assets">
            See what it records <span aria-hidden="true">→</span>
          </a>
        </article>
        <article>
          <span className="small-label">LIVE FIELD DATA</span>
          <h3>
            Stream the survey.
            <br />
            Watch it land.
          </h3>
          <p>
            GNSS and imagery frames arrive over a stream, not a refresh button. The map, the 3D view,
            and the conflict checks all read the same live state.
          </p>
          <details>
            <summary>
              View the feed surface <span aria-hidden="true">+</span>
            </summary>
            <div className="integration-details">
              <p>
                A Hono server publishes rover, CORS, and imagery-freshness frames over server-sent
                events; the workspace subscribes once and never polls.
              </p>
              <code>
                GET /api/live/stream
                <br />
                GET /api/live/snapshot
                <br />
                GET /api/live/health
                <br />
                POST /api/extract-plan
              </code>
              <p>
                Frames are generated locally today. No NTRIP caster or drone downlink is connected,
                and the workspace labels the feed as synthetic wherever it is shown.
              </p>
            </div>
          </details>
        </article>
      </div>
    </section>
  );
}

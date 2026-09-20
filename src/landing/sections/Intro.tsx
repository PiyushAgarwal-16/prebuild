export function Intro() {
  return (
    <section className="intro section-frame" id="about">
      <h2>
        A parcel map is flat.
        <br />
        The property above it
        <br />
        is not.
      </h2>
      <div className="intro-bottom">
        <span className="section-name">
          <i /> WHY ULPIN 3D
        </span>
        <p>
          A flat cadastre can say who owns the land. It cannot say who owns the fourteenth floor, the
          basement parking beneath it, or the cable running through the column between them. ULPIN 3D
          records those as volumes with identifiers of their own.
        </p>
      </div>
      <span className="frame-node left" />
      <span className="frame-node right" />
    </section>
  );
}

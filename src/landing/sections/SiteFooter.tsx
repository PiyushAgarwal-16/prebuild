export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <a className="wordmark" href="#home">
          ulpin<span>3d</span>
        </a>
        <p>Vertical property mapping on the identifier the cadastre already uses.</p>
        <div>
          <a href="#assets">What it records</a>
          <a href="#platform">How it works</a>
          <a href="#network">Field data</a>
          <a href="#about">Why 3D</a>
        </div>
      </div>
      <div className="footer-statement">
        Real parcels.
        <br />
        <span>Stacked.</span>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} ULPIN 3D</span>
        <span>Prototype · Smart India Hackathon</span>
        <a href="#home">Back to top ↑</a>
      </div>
    </footer>
  );
}

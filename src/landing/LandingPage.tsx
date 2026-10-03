import { useLayoutEffect } from "react";
import "./styles/index.css";
import { NAV_SECTIONS } from "./content";
import { useScrollSpy } from "./useScrollSpy";
import { ScannerProvider } from "./scanner/ScannerContext";
import { SiteHeader } from "./sections/SiteHeader";
import { Hero } from "./sections/Hero";
import { Intro } from "./sections/Intro";
import { Landscape } from "./sections/Landscape";
import { Connection } from "./sections/Connection";
import { Applications } from "./sections/Applications";
import { Demo } from "./sections/Demo";
import { Access } from "./sections/Access";
import { Closing } from "./sections/Closing";
import { SiteFooter } from "./sections/SiteFooter";

export default function LandingPage() {
  const active = useScrollSpy(NAV_SECTIONS);

  useLayoutEffect(() => {
    const previous = document.title;
    document.title = "ULPIN 3D — Vertical property mapping in real time";
    document.documentElement.dataset.view = "landing";
    return () => {
      document.title = previous;
      delete document.documentElement.dataset.view;
    };
  }, []);

  return (
    <ScannerProvider>
      <div className="landing-root">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SiteHeader active={active} />
        <main id="main">
          <Hero />
          <Intro />
          <Landscape />
          <Connection />
          <Applications />
          <Demo />
          <Access />
          <Closing />
        </main>
        <SiteFooter />
      </div>
    </ScannerProvider>
  );
}

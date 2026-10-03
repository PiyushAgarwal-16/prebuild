import { useRef } from "react";
import { useScanner } from "../scanner/ScannerContext";
import { useScannerSection } from "../scanner/useScannerSection";

export function ScannerSection({
  id,
  className,
  image,
  alt,
  priority,
  labelledBy,
  ariaLabel,
  children,
}: {
  id?: string;
  className: string;
  image: string;
  alt: string;
  priority?: boolean;
  labelledBy?: string;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { paused } = useScanner();
  useScannerSection(section, canvas, paused);

  return (
    <section
      ref={section}
      id={id}
      className={`${className} scanner`}
      data-scanner
      aria-labelledby={labelledBy}
      aria-label={ariaLabel}
    >
      <img
        className="map-photo"
        src={image}
        width={2016}
        height={1232}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
      />
      <canvas className="scan-canvas" ref={canvas} aria-hidden />
      {children}
    </section>
  );
}

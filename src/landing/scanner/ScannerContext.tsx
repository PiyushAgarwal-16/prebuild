import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { loadScanLayers } from "./layers";

interface ScannerState {
  paused: boolean;
  available: boolean;
  toggle: () => void;
}

const ScannerContext = createContext<ScannerState>({
  paused: false,
  available: true,
  toggle: () => {},
});

export function ScannerProvider({ children }: { children: React.ReactNode }) {
  const [paused, setPaused] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setPaused(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    loadScanLayers().catch(() => setAvailable(false));
  }, []);

  const toggle = useCallback(() => setPaused((p) => !p), []);
  const value = useMemo(() => ({ paused, available, toggle }), [paused, available, toggle]);

  return <ScannerContext.Provider value={value}>{children}</ScannerContext.Provider>;
}

export function useScanner(): ScannerState {
  return useContext(ScannerContext);
}

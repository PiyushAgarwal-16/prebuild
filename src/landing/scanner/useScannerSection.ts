import { useEffect, useRef, type RefObject } from "react";
import { buildThermalLayer, loadScanLayers } from "./layers";

interface Cell {
  x: number;
  y: number;
  layer: number;
  frameOnly: boolean;
  born: number;
  touched: number;
}

interface SectionApi {
  setPaused: (paused: boolean) => void;
}

const CELL_LIMIT = 90;
const FADE_MS = 1250;

export function useScannerSection(
  sectionRef: RefObject<HTMLElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  paused: boolean,
): void {
  const api = useRef<SectionApi | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    section.tabIndex = 0;
    section.setAttribute("aria-keyshortcuts", "ArrowUp ArrowDown ArrowLeft ArrowRight");
    section.setAttribute(
      "aria-description",
      "Move the pointer or touch to reveal image layers. When focused, use the arrow keys to move the scanner.",
    );

    let width = 0;
    let height = 0;
    let cellSize = 60;
    let frame = 0;
    let visible = false;
    let isPaused = paused;
    let demoShown = false;
    let lastCell = "";
    let pointer = { x: 0, y: 0 };
    let prepared: HTMLCanvasElement[] = [];
    let sourceImages: HTMLImageElement[] = [];
    const cells = new Map<string, Cell>();

    const hash = (x: number, y: number) =>
      Math.abs(Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1;

    function prepareLayers() {
      prepared = sourceImages.map((image) => {
        const buffer = document.createElement("canvas");
        buffer.width = Math.ceil(width);
        buffer.height = Math.ceil(height);
        const context = buffer.getContext("2d")!;
        const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
        context.drawImage(
          image,
          (width - image.naturalWidth * scale) / 2,
          (height - image.naturalHeight * scale) / 2,
          image.naturalWidth * scale,
          image.naturalHeight * scale,
        );
        return buffer;
      });
      if (prepared[1]) prepared.push(buildThermalLayer(prepared[1]));
    }

    function resize() {
      const rect = section!.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      cellSize = width < 700 ? 42 : 60;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      pointer = { x: width * 0.64, y: height * 0.39 };
      cells.clear();
      lastCell = "";
      prepareLayers();
    }

    function start() {
      if (!frame && visible && !isPaused && !document.hidden) frame = requestAnimationFrame(draw);
    }

    function brush(x: number, y: number, force = false) {
      if (isPaused || !visible || !prepared.length) return;
      const col = Math.floor(x / cellSize);
      const row = Math.floor(y / cellSize);
      const key = `${col}:${row}`;
      if (lastCell === key && !force) return;
      lastCell = key;
      pointer = { x, y };
      const now = performance.now();
      const layer = hash(col, row) < 0.62 ? 0 : hash(col, row) < 0.8 ? 1 : 2;
      const offsets = [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
        [-1, 0],
        [1, -1],
        [2, 1],
        [0, 2],
        [-1, 1],
        [2, 0],
      ];
      offsets.forEach(([dx, dy], index) => {
        const cx = col + dx;
        const cy = row + dy;
        if (cx < 0 || cy < 0 || cx * cellSize >= width || cy * cellSize >= height) return;
        const id = `${cx}:${cy}`;
        const old = cells.get(id);
        cells.set(id, {
          x: cx * cellSize,
          y: cy * cellSize,
          layer: index < 4 ? layer : (layer + index) % 3,
          frameOnly: index > 5,
          born: old?.born ?? now,
          touched: now,
        });
      });
      while (cells.size > CELL_LIMIT) cells.delete(cells.keys().next().value!);
      start();
    }

    function diamond(x: number, y: number, radius: number) {
      ctx!.beginPath();
      ctx!.moveTo(x, y - radius);
      ctx!.lineTo(x + radius, y);
      ctx!.lineTo(x, y + radius);
      ctx!.lineTo(x - radius, y);
      ctx!.closePath();
      ctx!.fill();
    }

    function draw(now: number) {
      frame = 0;
      ctx!.clearRect(0, 0, width, height);
      if (!visible || isPaused || document.hidden) return;
      for (const [key, cell] of cells) {
        const age = now - cell.touched;
        if (age > FADE_MS) {
          cells.delete(key);
          continue;
        }
        const alpha =
          Math.min(1, (now - cell.born) / 160) * Math.max(0, 1 - Math.max(0, age - 320) / 930);
        ctx!.globalAlpha = alpha;
        if (!cell.frameOnly) {
          const w = Math.min(cellSize, width - cell.x);
          const h = Math.min(cellSize, height - cell.y);
          ctx!.drawImage(prepared[cell.layer], cell.x, cell.y, w, h, cell.x, cell.y, w, h);
        } else {
          ctx!.fillStyle = "#ffffff07";
          ctx!.fillRect(cell.x, cell.y, cellSize, cellSize);
        }
        ctx!.strokeStyle = cell.frameOnly ? "#ffffff40" : "#ffffff80";
        ctx!.lineWidth = 0.65;
        ctx!.strokeRect(cell.x + 0.5, cell.y + 0.5, cellSize - 1, cellSize - 1);
        ctx!.fillStyle = "#f9f9f5";
        for (const [dx, dy] of [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ]) {
          diamond(cell.x + dx * cellSize, cell.y + dy * cellSize, 2.6);
        }
      }
      if (cells.size) {
        const cx = Math.floor(pointer.x / cellSize) * cellSize;
        const cy = Math.floor(pointer.y / cellSize) * cellSize;
        const recent = Math.max(...Array.from(cells.values(), (cell) => cell.touched));
        ctx!.globalAlpha = Math.max(0, 1 - (now - recent) / FADE_MS) * 0.65;
        ctx!.strokeStyle = "#d8e6ff";
        ctx!.lineWidth = 0.7;
        ctx!.beginPath();
        ctx!.moveTo(cx - cellSize, cy);
        ctx!.lineTo(cx, cy + cellSize);
        ctx!.lineTo(cx + cellSize * 2, cy);
        ctx!.lineTo(cx + cellSize * 2, cy + cellSize * 2);
        ctx!.stroke();
        ctx!.save();
        ctx!.translate(pointer.x, pointer.y);
        ctx!.rotate(Math.PI / 4);
        ctx!.strokeStyle = "#ffffff";
        ctx!.strokeRect(-8, -8, 16, 16);
        ctx!.strokeRect(-12, -12, 24, 24);
        ctx!.restore();
      }
      ctx!.globalAlpha = 1;
      if (cells.size) start();
    }

    function clear() {
      cancelAnimationFrame(frame);
      frame = 0;
      cells.clear();
      lastCell = "";
      ctx!.clearRect(0, 0, width, height);
    }

    function refresh() {
      clear();
      if (!isPaused) brush(width * 0.64, height * 0.39, true);
    }

    const onPointerMove = (event: PointerEvent) => {
      if ((event.target as Element).closest("a,button")) return;
      const rect = section!.getBoundingClientRect();
      brush(event.clientX - rect.left, event.clientY - rect.top);
    };
    const onPointerDown = (event: PointerEvent) => {
      if ((event.target as Element).closest("a,button")) return;
      const rect = section!.getBoundingClientRect();
      brush(event.clientX - rect.left, event.clientY - rect.top, true);
    };
    const onPointerLeave = () => {
      lastCell = "";
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target !== section || !event.key.startsWith("Arrow")) return;
      event.preventDefault();
      const dx = event.key === "ArrowRight" ? cellSize : event.key === "ArrowLeft" ? -cellSize : 0;
      const dy = event.key === "ArrowDown" ? cellSize : event.key === "ArrowUp" ? -cellSize : 0;
      brush(
        Math.max(0, Math.min(width - cellSize * 2, pointer.x + dx)),
        Math.max(0, Math.min(height - cellSize * 2, pointer.y + dy)),
        true,
      );
    };
    const onVisibility = () => {
      if (document.hidden) refresh();
    };

    section.addEventListener("pointermove", onPointerMove, { passive: true });
    section.addEventListener("pointerdown", onPointerDown, { passive: true });
    section.addEventListener("pointerleave", onPointerLeave);
    section.addEventListener("keydown", onKeyDown);
    document.addEventListener("visibilitychange", onVisibility);

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (!visible) clear();
        else if (prepared.length && !demoShown) {
          demoShown = true;
          brush(width * 0.64, height * 0.39, true);
        }
      },
      { threshold: 0.12 },
    );
    observer.observe(section);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(section);

    let disposed = false;
    loadScanLayers()
      .then((images) => {
        if (disposed) return;
        sourceImages = images;
        resize();
        if (visible && !demoShown) {
          demoShown = true;
          brush(width * 0.64, height * 0.39, true);
        }
        section.dataset.scanReady = "true";
      })
      .catch(() => {
        if (!disposed) section.dataset.scanReady = "false";
      });

    api.current = {
      setPaused: (next) => {
        isPaused = next;
        refresh();
      },
    };

    return () => {
      disposed = true;
      api.current = null;
      cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();
      section.removeEventListener("pointermove", onPointerMove);
      section.removeEventListener("pointerdown", onPointerDown);
      section.removeEventListener("pointerleave", onPointerLeave);
      section.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionRef, canvasRef]);

  useEffect(() => {
    api.current?.setPaused(paused);
  }, [paused]);
}

export const SCAN_LAYER_SOURCES = ["/images/city-mesh.webp", "/images/city-xray.webp"];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

let pending: Promise<HTMLImageElement[]> | null = null;

export function loadScanLayers(): Promise<HTMLImageElement[]> {
  if (!pending) pending = Promise.all(SCAN_LAYER_SOURCES.map(loadImage));
  return pending;
}

export function buildThermalLayer(source: HTMLCanvasElement): HTMLCanvasElement {
  const thermal = document.createElement("canvas");
  thermal.width = source.width;
  thermal.height = source.height;
  const context = thermal.getContext("2d")!;
  context.drawImage(source, 0, 0);
  const pixels = context.getImageData(0, 0, thermal.width, thermal.height);
  const palette = [
    [13, 22, 84],
    [27, 105, 210],
    [20, 208, 208],
    [149, 233, 93],
    [254, 208, 45],
    [244, 64, 31],
  ];
  for (let index = 0; index < pixels.data.length; index += 4) {
    const intensity =
      (pixels.data[index] * 0.3 + pixels.data[index + 1] * 0.59 + pixels.data[index + 2] * 0.11) / 255;
    const position = Math.min(4.999, intensity * 5);
    const low = Math.floor(position);
    const blend = position - low;
    for (let channel = 0; channel < 3; channel++) {
      pixels.data[index + channel] =
        palette[low][channel] * (1 - blend) + palette[low + 1][channel] * blend;
    }
  }
  context.putImageData(pixels, 0, 0);
  return thermal;
}

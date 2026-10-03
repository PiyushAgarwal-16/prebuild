"""Automated building extraction from imagery.

Sidecar to the TypeScript pipeline. Fetches or accepts imagery, segments it, and returns
building footprint polygons in lon/lat so the Node pipeline can derive volumes from them.
"""
from __future__ import annotations

import base64
import io
import json
import math
import os
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Callable, Literal

import cv2
import httpx
import numpy as np
from fastapi import FastAPI, HTTPException
from PIL import Image, ImageDraw, ImageFont
from pydantic import BaseModel, Field
from shapely.geometry import Polygon
from shapely.strtree import STRtree

ENV_FILE = Path(__file__).resolve().parents[2] / ".env"
if ENV_FILE.exists():
    for line in ENV_FILE.read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())

BACKEND = os.environ.get("VISION_BACKEND", "sam")
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")


def pick_device() -> str:
    forced = os.environ.get("VISION_DEVICE")
    if forced:
        return forced
    try:
        import torch

        if torch.cuda.is_available():
            return "cuda"
        return "mps" if torch.backends.mps.is_available() else "cpu"
    except Exception:
        return "cpu"


DEVICE = pick_device()
TILE_URL = os.environ.get(
    "IMAGERY_TILE_URL",
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
)
TILE_ATTRIBUTION = os.environ.get("IMAGERY_ATTRIBUTION", "Esri World Imagery")
USER_AGENT = "ulpin3d-vision/0.2 (vertical cadastre prototype)"

WEIGHTS = Path(__file__).parent / "weights" / "sam_vit_b_01ec64.pth"
WEIGHTS_URL = "https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth"

TILE_PX = 256
MAX_ZOOM = 18
MIN_ZOOM = 15
MAX_SCENE_PX = 2560
WINDOW_PX = 1024
OVERLAP_PX = 128
EDGE_MARGIN_PX = 2

MIN_SOLIDITY = 0.85
MIN_RECTANGULARITY = 0.65
MAX_ASPECT = 5.0
MAX_EXCESS_GREEN = 0.06
MAX_GREEN_DOMINANT = 0.5
MAX_CIRCULARITY = 0.85
MIN_BRIGHTNESS = 45.0
MAX_BUILDING_M2 = 4000.0
DEDUP_IOU = 0.4

CLASSIFIER_MODEL = os.environ.get("VISION_CLASSIFIER_MODEL") or os.environ.get("OPENAI_VISION_MODEL") or "gpt-4o"
CLASSIFIER_URL = "https://api.openai.com/v1/chat/completions"
TILE_SIDE = 200
SHEET_COLS = 4
SHEET_ROWS = 4
CLASSIFIER_WORKERS = 6

app = FastAPI(title="ULPIN 3D vision service", version="0.2.0")


class BBox(BaseModel):
    south: float
    west: float
    north: float
    east: float


class ExtractRequest(BaseModel):
    image: str = Field(description="data: URL or bare base64 of the scene")
    bbox: BBox
    min_area_m2: float = 25.0
    backend: Literal["sam", "contours"] | None = None


class SceneRequest(BaseModel):
    bbox: BBox
    min_area_m2: float = 25.0
    zoom: int | None = None
    classify: bool = True


class Footprint(BaseModel):
    ring: list[tuple[float, float]]
    area_m2: float
    confidence: float


class ExtractResponse(BaseModel):
    backend: str
    footprints: list[Footprint]
    note: str


class ClassifierReport(BaseModel):
    model: str | None
    attempted: int
    kept: int
    dropped: int
    error: str | None


class SceneResponse(ExtractResponse):
    classifier: ClassifierReport
    zoom: int
    gsd_m: float
    scene_px: tuple[int, int]
    windows: int
    candidates: int
    tile_source: str
    elapsed_s: float


LonLat = Callable[[float, float], tuple[float, float]]


def decode_rgb(image: str) -> np.ndarray:
    raw = image.split(",", 1)[1] if image.startswith("data:") else image
    return np.array(Image.open(io.BytesIO(base64.b64decode(raw))).convert("RGB"))


def to_lonlat(bbox: BBox, shape: tuple[int, int], row: float, col: float) -> tuple[float, float]:
    height, width = shape
    lon = bbox.west + (col / max(width - 1, 1)) * (bbox.east - bbox.west)
    lat = bbox.north - (row / max(height - 1, 1)) * (bbox.north - bbox.south)
    return lon, lat


def ring_area_m2(ring: list[tuple[float, float]]) -> float:
    if len(ring) < 3:
        return 0.0
    lat0 = sum(p[1] for p in ring) / len(ring)
    mx = 111320.0 * np.cos(np.radians(lat0))
    my = 111132.0
    total = 0.0
    for i in range(len(ring)):
        x0, y0 = ring[i][0] * mx, ring[i][1] * my
        x1, y1 = ring[(i + 1) % len(ring)][0] * mx, ring[(i + 1) % len(ring)][1] * my
        total += x0 * y1 - x1 * y0
    return abs(total) / 2


def world_px(lon: float, lat: float, zoom: int) -> tuple[float, float]:
    n = TILE_PX * 2**zoom
    s = math.sin(math.radians(lat))
    x = (lon + 180.0) / 360.0 * n
    y = (0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * n
    return x, y


def lonlat_of_world_px(x: float, y: float, zoom: int) -> tuple[float, float]:
    n = TILE_PX * 2**zoom
    lon = x / n * 360.0 - 180.0
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    return lon, lat


def ground_resolution_m(lat: float, zoom: int) -> float:
    return 156543.03392 * math.cos(math.radians(lat)) / 2**zoom


def scene_size(bbox: BBox, zoom: int) -> tuple[int, int]:
    x0, y0 = world_px(bbox.west, bbox.north, zoom)
    x1, y1 = world_px(bbox.east, bbox.south, zoom)
    return math.ceil(x1 - x0), math.ceil(y1 - y0)


def choose_zoom(bbox: BBox, requested: int | None) -> int:
    if requested is not None:
        return min(max(requested, MIN_ZOOM), MAX_ZOOM)
    for zoom in range(MAX_ZOOM, MIN_ZOOM - 1, -1):
        width, height = scene_size(bbox, zoom)
        if max(width, height) <= MAX_SCENE_PX:
            return zoom
    raise HTTPException(422, "Area too large for one scene; shrink the bounding box")


def fetch_tile(client: httpx.Client, zoom: int, x: int, y: int) -> np.ndarray | None:
    url = TILE_URL.format(z=zoom, x=x, y=y)
    try:
        res = client.get(url)
        if res.status_code != 200:
            return None
        return np.array(Image.open(io.BytesIO(res.content)).convert("RGB"))
    except Exception:
        return None


def fetch_scene(bbox: BBox, zoom: int) -> tuple[np.ndarray, LonLat, float, int]:
    x0, y0 = world_px(bbox.west, bbox.north, zoom)
    x1, y1 = world_px(bbox.east, bbox.south, zoom)
    tx0, tx1 = int(x0 // TILE_PX), int(x1 // TILE_PX)
    ty0, ty1 = int(y0 // TILE_PX), int(y1 // TILE_PX)
    coords = [(tx, ty) for ty in range(ty0, ty1 + 1) for tx in range(tx0, tx1 + 1)]

    with httpx.Client(headers={"User-Agent": USER_AGENT}, timeout=30.0) as client:
        with ThreadPoolExecutor(max_workers=8) as pool:
            tiles = list(pool.map(lambda c: fetch_tile(client, zoom, c[0], c[1]), coords))

    failed = sum(1 for t in tiles if t is None)
    if failed > max(1, len(coords) // 10):
        raise HTTPException(502, f"Imagery source failed for {failed} of {len(coords)} tiles")

    canvas = np.zeros(((ty1 - ty0 + 1) * TILE_PX, (tx1 - tx0 + 1) * TILE_PX, 3), dtype=np.uint8)
    for (tx, ty), tile in zip(coords, tiles):
        if tile is None:
            continue
        row, col = (ty - ty0) * TILE_PX, (tx - tx0) * TILE_PX
        canvas[row : row + TILE_PX, col : col + TILE_PX] = tile

    left = int(round(x0 - tx0 * TILE_PX))
    top = int(round(y0 - ty0 * TILE_PX))
    width, height = scene_size(bbox, zoom)
    scene = canvas[top : top + height, left : left + width]

    origin_x, origin_y = x0, y0
    lat_mid = (bbox.north + bbox.south) / 2

    def lonlat(col: float, row: float) -> tuple[float, float]:
        return lonlat_of_world_px(origin_x + col, origin_y + row, zoom)

    return scene, lonlat, ground_resolution_m(lat_mid, zoom), len(coords)


def extract_contours(grey: np.ndarray, bbox: BBox, min_area: float) -> list[Footprint]:
    from skimage import measure

    threshold = float(np.percentile(grey, 70))
    mask = grey > threshold
    out: list[Footprint] = []
    for contour in measure.find_contours(mask.astype(float), 0.5):
        simplified = measure.approximate_polygon(contour, tolerance=2.0)
        if len(simplified) < 4:
            continue
        ring = [to_lonlat(bbox, grey.shape, r, c) for r, c in simplified[:-1]]
        area = ring_area_m2(ring)
        if area < min_area:
            continue
        out.append(Footprint(ring=ring, area_m2=round(area, 1), confidence=0.25))
    return out


_generator = None


def ensure_weights() -> None:
    if WEIGHTS.exists():
        return
    WEIGHTS.parent.mkdir(parents=True, exist_ok=True)
    partial = WEIGHTS.with_suffix(".part")
    with httpx.stream("GET", WEIGHTS_URL, follow_redirects=True, timeout=None) as res:
        res.raise_for_status()
        with open(partial, "wb") as out:
            for chunk in res.iter_bytes(1 << 20):
                out.write(chunk)
    partial.rename(WEIGHTS)


def load_generator():
    global _generator
    if _generator is not None:
        return _generator
    ensure_weights()
    import torch
    from segment_anything import SamAutomaticMaskGenerator, sam_model_registry

    if DEVICE == "mps":
        as_tensor = torch.as_tensor

        def as_tensor_f32(data, *args, **kwargs):
            if isinstance(data, np.ndarray) and data.dtype == np.float64:
                data = data.astype(np.float32)
            return as_tensor(data, *args, **kwargs)

        torch.as_tensor = as_tensor_f32

    model = sam_model_registry["vit_b"](checkpoint=str(WEIGHTS))
    model.to(DEVICE)
    _generator = SamAutomaticMaskGenerator(
        model,
        points_per_side=24,
        pred_iou_thresh=0.86,
        stability_score_thresh=0.9,
        crop_n_layers=0,
        min_mask_region_area=40,
    )
    return _generator


def window_starts(length: int) -> list[int]:
    if length <= WINDOW_PX:
        return [0]
    step = WINDOW_PX - OVERLAP_PX
    starts = list(range(0, length - WINDOW_PX + 1, step))
    if starts[-1] + WINDOW_PX < length:
        starts.append(length - WINDOW_PX)
    return starts


def touches_cut(bbox_xywh: list[float], size: tuple[int, int], at_scene_edge: tuple[bool, bool, bool, bool]) -> bool:
    x, y, w, h = bbox_xywh
    height, width = size
    left, top, right, bottom = at_scene_edge
    return (
        (x <= EDGE_MARGIN_PX and not left)
        or (y <= EDGE_MARGIN_PX and not top)
        or (x + w >= width - EDGE_MARGIN_PX and not right)
        or (y + h >= height - EDGE_MARGIN_PX and not bottom)
    )


def building_polygon(mask: np.ndarray, offset: tuple[int, int]) -> Polygon | None:
    contours, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    largest = max(contours, key=cv2.contourArea)
    if len(largest) < 4:
        return None
    points = [(float(p[0][0] + offset[0]), float(p[0][1] + offset[1])) for p in largest]
    poly = Polygon(points)
    if not poly.is_valid:
        poly = poly.buffer(0)
    if poly.is_empty or poly.geom_type != "Polygon":
        return None
    return poly.simplify(1.0)


def building_score(
    poly: Polygon, patch: np.ndarray, mask: np.ndarray, gsd_m: float, min_area_m2: float, model_score: float
) -> float | None:
    area_m2 = poly.area * gsd_m**2
    if area_m2 < min_area_m2 or area_m2 > MAX_BUILDING_M2:
        return None
    solidity = poly.area / max(poly.convex_hull.area, 1e-9)
    if solidity < MIN_SOLIDITY:
        return None
    rect = poly.minimum_rotated_rectangle
    rectangularity = poly.area / max(rect.area, 1e-9)
    if rectangularity < MIN_RECTANGULARITY:
        return None
    circularity = 4 * math.pi * poly.area / max(poly.length**2, 1e-9)
    if circularity > MAX_CIRCULARITY:
        return None
    corners = list(rect.exterior.coords)
    sides = sorted(
        [math.dist(corners[0], corners[1]), math.dist(corners[1], corners[2])]
    )
    if sides[0] < 1e-9 or sides[1] / sides[0] > MAX_ASPECT:
        return None
    pixels = patch[mask].astype(np.float64)
    if not len(pixels):
        return None
    r, g, b = pixels[:, 0].mean(), pixels[:, 1].mean(), pixels[:, 2].mean()
    if (r + g + b) / 3 < MIN_BRIGHTNESS:
        return None
    if (2 * g - r - b) / (r + g + b + 1.0) > MAX_EXCESS_GREEN:
        return None
    green_dominant = float(np.mean((pixels[:, 1] >= pixels[:, 0]) & (pixels[:, 1] >= pixels[:, 2])))
    if green_dominant > MAX_GREEN_DOMINANT:
        return None
    return float(min(1.0, (model_score + rectangularity + solidity) / 3))


def extract_sam(
    rgb: np.ndarray, lonlat: LonLat, gsd_m: float, min_area_m2: float
) -> tuple[list[Footprint], list[Polygon], int, int]:
    generator = load_generator()
    height, width = rgb.shape[:2]
    candidates: list[tuple[Polygon, float]] = []
    windows = 0

    ys, xs = window_starts(height), window_starts(width)
    for y in ys:
        for x in xs:
            patch = rgb[y : y + WINDOW_PX, x : x + WINDOW_PX]
            windows += 1
            edges = (
                x == 0,
                y == 0,
                x + patch.shape[1] >= width,
                y + patch.shape[0] >= height,
            )
            for mask in generator.generate(patch):
                if touches_cut(mask["bbox"], patch.shape[:2], edges):
                    continue
                poly = building_polygon(mask["segmentation"], (x, y))
                if poly is None:
                    continue
                model_score = (float(mask["predicted_iou"]) + float(mask["stability_score"])) / 2
                score = building_score(poly, patch, mask["segmentation"], gsd_m, min_area_m2, model_score)
                if score is not None:
                    candidates.append((poly, score))

    candidates.sort(key=lambda c: c[1], reverse=True)
    kept: list[tuple[Polygon, float]] = []
    tree_polys: list[Polygon] = []
    for poly, score in candidates:
        if tree_polys:
            tree = STRtree(tree_polys)
            clash = False
            for idx in tree.query(poly):
                other = tree_polys[int(idx)]
                inter = poly.intersection(other).area
                if inter / max(poly.union(other).area, 1e-9) >= DEDUP_IOU:
                    clash = True
                    break
            if clash:
                continue
        kept.append((poly, score))
        tree_polys.append(poly)

    footprints: list[Footprint] = []
    for poly, score in kept:
        coords = list(poly.exterior.coords)[:-1]
        ring = [lonlat(px, py) for px, py in coords]
        footprints.append(
            Footprint(ring=ring, area_m2=round(poly.area * gsd_m**2, 1), confidence=round(score, 3))
        )
    return footprints, [poly for poly, _ in kept], windows, len(candidates)


def tile_for(rgb: np.ndarray, poly: Polygon, label: int) -> Image.Image:
    minx, miny, maxx, maxy = poly.bounds
    pad = max(12.0, 0.4 * max(maxx - minx, maxy - miny))
    height, width = rgb.shape[:2]
    x0, y0 = max(int(minx - pad), 0), max(int(miny - pad), 0)
    x1, y1 = min(int(maxx + pad), width), min(int(maxy + pad), height)
    crop = Image.fromarray(rgb[y0:y1, x0:x1]).convert("RGB")
    scale = (TILE_SIDE - 8) / max(crop.width, crop.height)
    crop = crop.resize((max(1, int(crop.width * scale)), max(1, int(crop.height * scale))))
    outline = [((x - x0) * scale, (y - y0) * scale) for x, y in poly.exterior.coords]
    ImageDraw.Draw(crop).line(outline, fill=(255, 0, 0), width=2)
    tile = Image.new("RGB", (TILE_SIDE, TILE_SIDE), (30, 30, 30))
    tile.paste(crop, (4, 4))
    ImageDraw.Draw(tile).text((8, 6), str(label), fill=(255, 255, 0), font=ImageFont.load_default(size=18))
    return tile


def sheet_of(tiles: list[Image.Image]) -> str:
    sheet = Image.new("RGB", (SHEET_COLS * TILE_SIDE, SHEET_ROWS * TILE_SIDE), (30, 30, 30))
    for i, tile in enumerate(tiles):
        sheet.paste(tile, ((i % SHEET_COLS) * TILE_SIDE, (i // SHEET_COLS) * TILE_SIDE))
    buf = io.BytesIO()
    sheet.save(buf, "JPEG", quality=88)
    return base64.b64encode(buf.getvalue()).decode()


CLASSIFIER_PROMPT = (
    "Each numbered tile is a top-down satellite crop with a red outline drawn around one detected region. "
    "For every tile decide whether the red outline encloses the whole roof of a single building "
    "(house, apartment block, shed, commercial or industrial roof). "
    "Answer false for tree canopy, bare ground, roads, pavement, water or pools, vehicles, shadows, "
    "sports fields, or an outline that covers only a small part of a larger roof. "
    'Reply with strict JSON only: {"results":[{"id":1,"building":true}]} covering every tile id.'
)


def classify_sheet(client: httpx.Client, key: str, ids: list[int], b64: str) -> dict[int, bool]:
    res = client.post(
        CLASSIFIER_URL,
        headers={"Authorization": f"Bearer {key}"},
        json={
            "model": CLASSIFIER_MODEL,
            "response_format": {"type": "json_object"},
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": CLASSIFIER_PROMPT},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}", "detail": "high"}},
                    ],
                }
            ],
        },
    )
    res.raise_for_status()
    content = res.json()["choices"][0]["message"].get("content")
    verdicts = json.loads(content)["results"] if content else []
    return {int(v["id"]): bool(v["building"]) for v in verdicts if "id" in v and "building" in v}


def classify_footprints(rgb: np.ndarray, polys: list[Polygon]) -> tuple[list[bool | None], ClassifierReport]:
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        return [None] * len(polys), ClassifierReport(
            model=None, attempted=0, kept=len(polys), dropped=0, error="OPENAI_API_KEY is not set"
        )

    per_sheet = SHEET_COLS * SHEET_ROWS
    batches = [list(range(i, min(i + per_sheet, len(polys)))) for i in range(0, len(polys), per_sheet)]
    verdicts: list[bool | None] = [None] * len(polys)
    errors: list[str] = []

    with httpx.Client(timeout=120.0) as client:

        def run(batch: list[int]) -> None:
            tiles = [tile_for(rgb, polys[idx], n + 1) for n, idx in enumerate(batch)]
            try:
                answers = classify_sheet(client, key, list(range(1, len(batch) + 1)), sheet_of(tiles))
            except Exception as err:
                errors.append(str(err)[:160])
                return
            for n, idx in enumerate(batch):
                verdicts[idx] = answers.get(n + 1)

        with ThreadPoolExecutor(max_workers=CLASSIFIER_WORKERS) as pool:
            list(pool.map(run, batches))

    answered = [v for v in verdicts if v is not None]
    return verdicts, ClassifierReport(
        model=CLASSIFIER_MODEL,
        attempted=len(answered),
        kept=sum(1 for v in verdicts if v is not False),
        dropped=sum(1 for v in verdicts if v is False),
        error=errors[0] if errors else None,
    )


@app.get("/health")
def health() -> dict:
    try:
        import torch

        device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
        torch_available = True
    except Exception:
        device, torch_available = "cpu", False
    return {
        "ok": True,
        "backend": BACKEND,
        "torch": torch_available,
        "available_device": device,
        "inference_device": DEVICE,
        "weights_present": WEIGHTS.exists(),
        "model_loaded": _generator is not None,
        "tile_source": TILE_ATTRIBUTION,
    }


@app.post("/extract/scene", response_model=SceneResponse)
def extract_scene(req: SceneRequest) -> SceneResponse:
    started = time.time()
    zoom = choose_zoom(req.bbox, req.zoom)
    rgb, lonlat, gsd_m, _tiles = fetch_scene(req.bbox, zoom)
    footprints, polys, windows, candidates = extract_sam(rgb, lonlat, gsd_m, req.min_area_m2)
    if req.classify:
        verdicts, classifier = classify_footprints(rgb, polys)
        footprints = [f for f, v in zip(footprints, verdicts) if v is not False]
    else:
        classifier = ClassifierReport(model=None, attempted=0, kept=len(footprints), dropped=0, error=None)
    return SceneResponse(
        backend="sam",
        footprints=footprints,
        classifier=classifier,
        note=(
            "SAM vit_b masks filtered by shape and colour"
            + (f", then confirmed by {classifier.model}" if classifier.model and classifier.attempted else "")
            + "."
        ),
        zoom=zoom,
        gsd_m=round(gsd_m, 3),
        scene_px=(rgb.shape[1], rgb.shape[0]),
        windows=windows,
        candidates=candidates,
        tile_source=TILE_ATTRIBUTION,
        elapsed_s=round(time.time() - started, 1),
    )


@app.post("/extract/footprints", response_model=ExtractResponse)
def extract(req: ExtractRequest) -> ExtractResponse:
    backend = req.backend or BACKEND
    rgb = decode_rgb(req.image)
    if backend == "sam":
        height, width = rgb.shape[:2]
        lat_mid = (req.bbox.north + req.bbox.south) / 2
        width_m = (req.bbox.east - req.bbox.west) * 111320.0 * math.cos(math.radians(lat_mid))
        gsd_m = width_m / max(width, 1)

        def lonlat(col: float, row: float) -> tuple[float, float]:
            return to_lonlat(req.bbox, (height, width), row, col)

        footprints, _polys, _windows, _candidates = extract_sam(rgb, lonlat, gsd_m, req.min_area_m2)
        return ExtractResponse(backend="sam", footprints=footprints, note="SAM vit_b with shape filters")
    grey = np.array(Image.fromarray(rgb).convert("L"))
    return ExtractResponse(
        backend="contours",
        footprints=extract_contours(grey, req.bbox, req.min_area_m2),
        note="Classical thresholding. Low accuracy — a placeholder that exercises the contract, not a building extractor.",
    )

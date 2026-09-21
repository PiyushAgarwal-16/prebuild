"""Automated building extraction from imagery.

Sidecar to the TypeScript pipeline. Takes a georeferenced image, returns building
footprint polygons in lon/lat so the Node pipeline can derive volumes from them.
"""
from __future__ import annotations

import base64
import io
import os
from typing import Literal

import numpy as np
from fastapi import FastAPI
from PIL import Image
from pydantic import BaseModel, Field

BACKEND = os.environ.get("VISION_BACKEND", "contours")

app = FastAPI(title="ULPIN 3D vision service", version="0.1.0")


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


class Footprint(BaseModel):
    ring: list[tuple[float, float]]
    area_m2: float
    confidence: float


class ExtractResponse(BaseModel):
    backend: str
    footprints: list[Footprint]
    note: str


def decode(image: str) -> np.ndarray:
    raw = image.split(",", 1)[1] if image.startswith("data:") else image
    return np.array(Image.open(io.BytesIO(base64.b64decode(raw))).convert("L"))


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


def extract_contours(grey: np.ndarray, bbox: BBox, min_area: float) -> list[Footprint]:
    """Classical fallback: threshold, label, trace. Weak, but needs no weights."""
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


def extract_sam(grey: np.ndarray, bbox: BBox, min_area: float) -> list[Footprint]:
    """Segment Anything via segment-geospatial. Downloads weights on first call."""
    raise NotImplementedError(
        "SAM backend is wired but has never been run in this environment. "
        "Install segment-geospatial, set VISION_BACKEND=sam, and verify the output "
        "against known buildings before trusting it."
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
        "device": device,
        "sam_verified": False,
    }


@app.post("/extract/footprints", response_model=ExtractResponse)
def extract(req: ExtractRequest) -> ExtractResponse:
    backend = req.backend or BACKEND
    grey = decode(req.image)
    if backend == "sam":
        return ExtractResponse(
            backend="sam", footprints=extract_sam(grey, req.bbox, req.min_area_m2), note="unverified"
        )
    return ExtractResponse(
        backend="contours",
        footprints=extract_contours(grey, req.bbox, req.min_area_m2),
        note="Classical thresholding. Low accuracy — a placeholder that exercises the contract, not a building extractor.",
    )

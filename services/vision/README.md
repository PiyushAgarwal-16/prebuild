# Vision service

Automated building extraction from imagery, as a Python sidecar to the TypeScript pipeline.

The Node pipeline calls this over HTTP for the one thing TypeScript cannot do well: running
segmentation models over raster imagery. Everything else — derivation, validation, identity,
lodgement — stays in the main server.

## Why a separate service

The geospatial ML ecosystem (`segment-geospatial`, `torchgeo`, `roofer`, PDAL) is Python and C++.
Rather than reimplement any of it, the pipeline treats extraction as a remote stage with a stable
contract, so the backend can be swapped without touching the register.

## Endpoints

| Route | Purpose |
| --- | --- |
| `GET /health` | Backend availability, device, whether model weights are present |
| `POST /extract/footprints` | Image + bounding box in, building footprint polygons out (lon/lat) |

## Backends

- **`sam`** — Segment Anything via `segment-geospatial`. Downloads weights (~360 MB for ViT-B) on
  first call. Best quality, needs torch.
- **`contours`** — classical thresholding and contour tracing. No weights, no torch, poor accuracy.
  Present so the service runs and the contract is exercisable without a 2 GB install.

Set `VISION_BACKEND` to choose. Default is `contours`, so the service starts anywhere.

## Running

```bash
pip install -r requirements.txt
uvicorn app:app --port 5182
```

## Status

The contract and the `contours` backend are implemented and runnable. The `sam` backend is wired
but has not been run against real imagery here, and SAM weights have never been downloaded in this
environment. Do not describe SAM extraction as working until someone has run it and looked at the
output — the same rule applied to floor-plan extraction, which turned out to place 7 of 8 rooms
incorrectly.

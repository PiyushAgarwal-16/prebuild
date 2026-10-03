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
| `GET /health` | Backend, torch device, whether weights are present and the model loaded |
| `POST /extract/scene` | Bounding box in; fetches imagery tiles, runs SAM, returns footprint polygons (lon/lat) with confidence, ground resolution and tile source |
| `POST /extract/footprints` | Uploaded image plus bounding box in, footprint polygons out |

## How extraction works

1. `choose_zoom` picks the highest zoom up to 18 that keeps the scene within 2560 px, then tiles are fetched and stitched (`IMAGERY_TILE_URL`, default Esri World Imagery).
2. The scene is cut into 1024 px windows with 128 px overlap and SAM (`vit_b`) generates automatic masks per window.
3. Masks cut by a window border are dropped. Remaining masks are traced to polygons and filtered on area, solidity, rectangularity, circularity, aspect ratio, brightness and two vegetation tests.
4. Overlapping detections are de-duplicated at IoU 0.4 and pixel coordinates are converted to lon/lat with exact Web Mercator maths.

SAM has no notion of a building. The shape filters are heuristics, and the confidence score is mostly SAM's own mask quality, so it does not separate buildings from other compact regions.

5. A vision model then checks each detection. Crops with the outline drawn are tiled 16 to a sheet, sent to `VISION_CLASSIFIER_MODEL` (default `OPENAI_VISION_MODEL`, else `gpt-4o`), and any tile the model marks as not a whole building is dropped. Detections the model does not answer for are kept. The key is read from `OPENAI_API_KEY`, and from the repo `.env` if the process environment lacks it. Pass `"classify": false` to skip this step.

## Backends

- **`sam`** (default) — Segment Anything `vit_b`, weights (~360 MB) download on first use into `weights/`.
- **`contours`** — thresholding and contour tracing, kept only as a no-weights fallback for `/extract/footprints`. Not a building extractor.

The device is picked automatically (CUDA, then Apple MPS, then CPU) and can be forced with `VISION_DEVICE`. On MPS a small scene took 7 to 10 s against 14 to 22 s on CPU with identical output; a float32 patch in `load_generator` works around SAM's float64 point prompts.

A hosted vision LLM was tried in place of SAM on the same Bengaluru scene. It answered in about 3.5 s but returned 17 polygons, 24% inside a mapped building, 3% of mapped buildings covered and no IoU 0.5 matches, so it is not a substitute for segmentation.

## Running

```bash
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r requirements.txt
.venv/bin/uvicorn app:app --port 5182
```

The Node server reaches it at `VISION_URL` (default `http://127.0.0.1:5182`). In the app, choose an option under "Satellite imagery" in the pipeline modal.

## Measured accuracy

One measurement, 0.004° box in Bengaluru at 0.58 m/px, against uncapped OpenStreetMap footprints (64 buildings, 66 detections):

| Measure | Result |
| --- | --- |
| Detections lying at least 50% inside a mapped building | 65% |
| Mapped buildings at least 50% covered by detections | 44% |
| Detections matched at IoU 0.5 | 23% |
| Mean IoU of matches | 0.65 |

With the vision-model check on the same scene (23 of 66 detections dropped, about 3 s extra):

| Measure | Without | With |
| --- | --- | --- |
| Detections | 66 | 43 |
| Inside a mapped building | 65% | 79% |
| Mapped buildings covered | 44% | 28% |
| Matched at IoU 0.5 | 23% | 16% |
| Detections with no mapped building nearby | 17 | 7 |

It trades recall for precision: fewer false detections, but it also drops roof fragments and some real buildings. The measurement is one box against OSM, which is itself incomplete.

OSM and the imagery are offset by a couple of metres, which costs IoU matches: shifting detections 2 m moved matches from 15 to 22 of 66. Mumbai and Delhi boxes have too few OSM buildings to score, so their results were only checked by eye: in dense settlements most outlines sat on real roofs but many buildings were missed, and large roofs were missed entirely.

## Status

- Working: tile fetch, SAM on CPU or MPS, the pipeline wiring, the cross-check report, optional addition of unmapped candidates.
- Not working well: precision and recall above. Dirt patches, pools and dense tree canopy can pass the shape filters. Large complexes are often split into roof fragments.
- Not done: a semantic building classifier, GPU or MPS inference, a labelled ground-truth set outside OSM, and any check of whether the imagery provider's terms allow extracting data for a product.

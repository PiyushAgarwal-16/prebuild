# Data — where it comes from, and what is real

## The measurement that governs this project

Measured 2026-09-20 against the Overture Maps 2026-08-19 release. Identical query, both areas:

| Area | Buildings | With height or floor count | Tallest |
| --- | --- | --- | --- |
| Bengaluru (Cubbon Park) | 274 | **7.3 %** | 60 m / 20 floors |
| Brooklyn (Fort Greene) | 2,108 | **98.5 %** | 110 m / 29 floors |

Footprints are abundant for India. **Vertical information is not.** This 13× gap is not a backlog
we can wait out — it is the problem the statement asks us to solve.

### Why the gap is structural

India's **National Geospatial Policy 2022** grants Indian companies *exclusive* rights to terrestrial
mobile mapping, street-view surveys and ground truthing within India. A foreign provider cannot
collect this data itself and must license it from an Indian entity. That is why Google has no
photorealistic 3D tiles for Indian cities, and why Genesys International (aerial and mobile LiDAR,
partnered with Survey of India) and MapmyIndia exist.

## How we get data today

| Layer | Source | Status |
| --- | --- | --- |
| Building footprints + storey counts | OpenStreetMap via Overpass | **Real.** Three-mirror fallback, 5-minute cache, small viewports auto-widened |
| Ground elevation | ASTER GDEM via OpenTopoData | **Real.** Sanity-checked: 910–952 m Bengaluru, 9–33 m Mumbai, 230–270 m Gurugram |
| Basemap imagery | OpenStreetMap raster, Esri World Imagery | **Real** |
| Floor plans | User upload → OpenAI vision (`gpt-4o`) | **Real call, low spatial accuracy** |
| GNSS / CORS + rover | Locally generated | **Synthetic.** Labelled in the UI and reported as `synthetic: true` by the API |
| Cadastral parcels | — | **Absent.** Building footprints substitute |
| Ownership, tenure, encumbrance | — | **Absent** |

### Vision extraction accuracy, measured

Tested against `samples/floor-plan-level-1.png`, a purpose-built 24 × 16 m plan with ground truth in
`samples/floor-plan-level-1.expected.json`.

| | `gpt-4o-mini` | `gpt-4o` |
| --- | --- | --- |
| Building width / depth / storey height | exact | exact |
| All 8 labels and `kind` classifications | exact | exact |
| All width / depth dimensions | exact | exact |
| **Positions** | **all 8 units at x = 0** | quadrants correct; flats ~1.0 m out, cores 2–3.5 m out |

Scored at ±0.6 m, `gpt-4o` places **1 of 8** correctly. Run through the plan validator, the raw
output raises **9 findings** — four flats outside the footprint and five overlaps, including
*Lift Core × Corridor = 6.40 m²*.

**Conclusion: a vision model reads a floor plan's text and dimensions well and its spatial layout
badly.** Extraction output is therefore treated as a *proposal requiring a surveyor's correction*,
never as survey-grade geometry. This is the same model-proposes / human-certifies pattern used by
3DBAG and Shenzhen.

## Sources evaluated but not integrated

- **Overture Maps** — buildings theme on S3 as GeoParquet, stable GERS ids, no rate limit. Returns
  **274 buildings where our Overpass query caps at 60**. The obvious next upgrade.
- **Google Open Buildings V3** (CC-BY-4.0), **Microsoft Building Footprints** (ODbL) — India-wide
  ML footprints, no height.
- **ISRO Bhuvan** — OGC WMS/WFS, imagery to 1 m, 177 cities high-resolution; Bhuvan-NUIS carries the
  AMRUT urban GIS layer for 500 cities. Free with registration.
- **CartoDEM / Bhoonidhi** — Cartosat-1 national DEM, free with registration.
- **Cartosat-3** — 0.25 m panchromatic, order-based via NRSC.
- **Genesys International / MapmyIndia** — the only realistic sources of true 3D LiDAR city models
  for India. Commercial.

### Correction on DEM/DSM

An earlier plan proposed closing the height gap with DEM/DSM. **This does not work.** Every freely
available DEM — CartoDEM, ASTER30m, AW3D30, Copernicus GLO-30 — is 30 m posting, too coarse to
resolve individual buildings in a dense Indian city. Per-building height needs ~1–5 m stereo.
Height must come from a surveyor's drone or LiDAR lodgement, or from corrected plan extraction.

## Endpoint notes

- Only `overpass-api.de` and `maps.mail.ru` were reachable in testing. `overpass.kumi.systems` and
  `overpass.private.coffee` do not resolve.
- **Never** use `overpass.osm.ch` as a fallback: it returns HTTP 200 with zero elements for Indian
  bounding boxes because it carries only Swiss data. A silent wrong answer is worse than an error.
- Public Overpass instances throttle per IP; a burst of queries will return 504 for several minutes.

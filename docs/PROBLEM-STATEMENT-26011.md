# SIH 26011 — Requirement Mapping

**Problem Statement:** 3D ULPIN Generation and Vertical Property Mapping System
**Organisation:** Ministry of Rural Development · Dept of Land Resources (DoLR)
**Category:** Software · **Theme:** Smart Automation

This document maps every clause of the statement to what the system actually does. Status is
deliberately conservative: a capability is "built" only if it has been run and observed.

## Unique spatial identities

| Required | Status | How |
| --- | --- | --- |
| Surface land parcels | **Built** | 14-char root: 2-digit LGD state code + 11-char geohash of the parcel centroid + ISO 7064 MOD 37,36 check character |
| Multi-storey apartments | **Built** | Root + band/level/unit, one identifier per volume |
| Underground infrastructure | **Built** | Subsurface (`S`) and basement (`B`) bands with signed elevations; easements modelled as volumes |

## Data integration

| Required input | Status | Detail |
| --- | --- | --- |
| Drone imagery | **Not integrated** | No orthomosaic, GCP or RMSE handling. Satellite basemap tiles are not drone imagery |
| LiDAR / 3D point cloud | **Not integrated** | — |
| GIS parcel layers | **Partial** | GeoJSON import, honours an externally declared ULPIN. No cadastral source exists openly, so building footprints substitute for parcels |
| Building floor plans | **Built, low accuracy** | Vision extraction runs live. Labels, room types and sizes reliable; absolute positions poor — see [`DATA.md`](DATA.md) |
| GNSS / CORS coordinates | **Live transport, synthetic data** | SSE feed of rover and CORS frames at 4 Hz / 1 Hz, labelled `SYNTHETIC` in the UI |
| DEM / DSM | **DEM only** | Terrain sampled per parcel for a declared ground datum. No DSM |

**2 of 6 inputs are genuinely real.**

## AI / ML capabilities

| Required | Status | What actually runs |
| --- | --- | --- |
| Automated building extraction | **Not built** | Footprints are downloaded from sources that already extracted them. Nothing is extracted from imagery here |
| Floor segmentation | **Partial** | A vision model reads a floor plan into rectangles; a text model classifies levels from metadata. Neither segments imagery or point clouds |
| Vertical parcel delineation | **Built** | Rule-based: footprint × storey height → banded volumes with signed elevations |
| Intelligent topology validation | **Built — strongest capability** | Eight checks that gate approval, plus conflict detection against the live register |

**1 of 4 capabilities is properly built.**

## Expected outcomes

| Outcome | Status |
| --- | --- |
| Generating standardised 3D ULPINs | **Built** — issued on approval, self-validating, offline-decodable |
| Mapping vertical and underground ownership rights | **Built** — six bands from subsurface to airspace, tenure per volume |
| Supporting volumetric cadastre systems | **Built** — CityJSON 2.0 export, **zero errors against the official CityJSON schema** |
| Enabling accurate urban property governance | **Partial** — lodgement, review, approval and audit exist; authentication does not |
| Reducing ownership conflicts and ambiguities | **Built** — a second lodgement over registered volumes is refused, with each overlap named and quantified in metres |
| Improving infrastructure planning and utility management | **Partial** — utility corridors model correctly as subsurface volumes; no dig-clearance query yet |

## Honest summary for evaluators

The system is a **working register with real integrity rules**, not a survey pipeline. Its strongest
capability is the one the statement lists last — topology validation and conflict reduction — and
that is demonstrable in four minutes with a refusal, not a render.

Its weakest area is data acquisition, for a structural reason documented in [`DATA.md`](DATA.md):
only ~7% of Indian urban buildings carry height information in any open dataset, against ~98% in
comparable US cities. The system's response is to flag every unverified height rather than fabricate
a skyline.

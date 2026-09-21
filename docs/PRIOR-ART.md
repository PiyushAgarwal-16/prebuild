# Prior art — what exists, and what is new here

## Reference systems

| System | Country | What it does | What we take from it |
| --- | --- | --- | --- |
| **3DBAG / roofer** | Netherlands | Fully automatic LoD1.2 / 1.3 / 2.2 reconstruction from a point cloud plus a roofprint polygon, run over **all 10 million Dutch buildings**. Needs classified LiDAR at ≥8 pts/m² | Proof that automated building extraction works at national scale — and the model-proposes / surveyor-certifies pattern |
| **AHN** | Netherlands | Repeat national airborne LiDAR programme | LiDAR as a periodically refreshed national asset, not a per-project purchase |
| **Esri Parcel Fabric** | — | Records-driven fabric where every change is a record with lineage; handles 2D, 3D and 4D parcels | Parcel lineage (split, merge, re-survey) preserved rather than overwritten |
| **Shenzhen** | China | Two-tier storage: regular extruded volumes as polygon + lowest/highest altitude; genuinely irregular solids as full 3D. Registers pure 3D spaces with an easement to reach the ground | Our 2.5D volume model is the same pragmatic pattern |
| **Singapore SiReNT** | Singapore | National CORS network feeding cadastral survey | The role our GNSS feed plays — and SVAMITVA's CORS is the Indian equivalent |
| **Singapore Digital Underground** | Singapore | National programme for a reliable subsurface utility map | Utilities as first-class volumes; the dig-clearance query |
| **val3dity** | TU Delft | Validates 3D primitives against **ISO 19107**; accepts CityGML, CityJSON, OBJ, OFF | The reference definition of "intelligent topology validation" |
| **CityJSON / cjio** | TU Delft | Compact encoding of the CityGML data model; `cjio` is the official tooling | Our interoperability target |
| **SVAMITVA** | India | Drone survey of **3.29 lakh villages**, **3.10 crore property cards**, using orthophotos and a CORS network | Domestic proof that drone cadastre works at national scale |

## What has been done before

Individually, almost every piece: geo-derived identifiers, extruded volume models, 3D topology
validation, lodgement workflows, national LiDAR reconstruction. None of this is novel in isolation,
and claiming otherwise in front of a DoLR evaluator would be a mistake.

## What is new here

**1. A vertical extension of ULPIN specifically, rather than a parallel identifier.**
Most 3D cadastre work invents a new key. We keep the 14-character root India already issues and
extend it with band/level/unit, so a volume identifier still resolves to the land beneath it. The
system also distinguishes a `generated` root from a `declared` one taken from an external record,
and refuses to recompute a check character it did not issue.

**2. An identifier that validates and locates itself with no registry.**
The geohash is *inside* the identifier. A field officer with no connectivity can verify a check
character and recover the parcel centroid to roughly 15 cm from the string alone. Most registry
systems require a database round-trip to answer either question.

**3. Validation as an approval gate, wired to the register.**
val3dity validates a file. Our checks run *against live registered volumes* and block an officer's
approval, naming each conflict and quantifying the overlap in metres. The demo turns on a refusal.

**4. Explicit provenance as a product feature.**
Given that only ~7% of Indian buildings carry height data, the honest design is to mark every
unverified value rather than fabricate a skyline. Synthetic feeds are labelled, assumed heights are
flagged, declared identifiers are exempted from our checksum, and public verification withholds
holder identity. A register's credibility is its product.

**5. Model-proposes / surveyor-certifies, implemented rather than asserted.**
The measured failure mode of vision extraction — good labels, bad positions — is designed for
directly: a correction canvas over the original drawing, with the register button reading
"Corrections needed" until the geometry is clean.

## What we deliberately do not claim

- No automated building extraction from imagery. Footprints come from sources that already did it.
- No LiDAR pipeline, no DSM-derived heights.
- Floor "segmentation" is a vision model reading a drawing, not segmentation of a point cloud.
- Roles are a demonstration switch, not authentication.

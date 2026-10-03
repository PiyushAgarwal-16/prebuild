# ULPIN 3D — Product Description

## The problem in one paragraph

India's land record system identifies a **surface parcel**. It cannot say who owns the 3.2 metres
of air between 23.7 m and 26.9 m above that parcel — which is where an apartment actually exists.
The same gap swallows basement parking, metro viaducts, subsurface utility corridors, rooftop solar
rights and transferable development rights. All of these are bought, sold, mortgaged and litigated
as if they were land, while the register describes only the ground beneath them.

A flat cadastre works for a farm in a village. It fails for a city that grew upwards.

## What ULPIN 3D is

A **vertical property register**. It treats the surface parcel as a root identity and issues every
legally distinct *volume* above and below it its own identifier.

A volume is a footprint polygon, an elevation range, a use class, a tenure type and a right holder.
Because identity is derived from geometry, two claims on the same cubic metres are detectable
**arithmetically**, rather than by a judge reading two deeds.

> The identifier is not a database key. The 14-character root encodes the parcel centroid as a
> geohash; the vertical extension encodes band, level and unit. A 3D ULPIN can therefore be
> validated and geographically located with no network, no lookup and no registry access.

## Who uses it

The system is built around a three-actor loop, not a single-user editor.

| Actor | Job to be done | What the system gives them |
| --- | --- | --- |
| **Licensed surveyor** | Turn survey and plan data into a certified 3D parcel submission | Ingest, AI-assisted extraction, a correction canvas, pre-validation, lodgement |
| **Revenue officer** | Decide whether a submitted volume may enter the authoritative record | Review queue, conflict report against existing registrations, approve / object / reject, audit trail |
| **Citizen, bank, court** | Confirm a unit exists, is registered, and is unencumbered — before paying | Public verification that withholds holder identity |

Everyone else — utilities, planning authorities, sub-registrars — is an extension of that loop.
The citizen is the beneficiary; the **surveyor is the user whose workflow must be won**, because
if lodgement is painful nothing ever enters the system.

## The loop, concretely

1. Surveyor pulls building footprints for a map viewport. The system samples terrain for a ground
   datum and derives one volume per storey.
2. Optionally uploads a floor plan. A vision model proposes the spaces; the surveyor corrects them
   on a canvas overlaid on the drawing, and certifies.
3. Topology validation runs. Overlaps, gaps, unwatertight solids and undeclared datums block
   progress.
4. The surveyor lodges. An officer reviews, sees conflicts against already-registered volumes by
   name and overlap depth, and approves or objects.
5. Approval issues identifiers. A citizen can then verify any of them.

## What is genuinely differentiated

- **The identifier is self-validating and geo-decodable offline.** Check character plus embedded
  geohash. No network, no database.
- **Validation is a gate, not a report.** The system refuses bad geometry. Lodging the same volumes
  twice is rejected with the overlap quoted in metres. This is what separates a register from a
  viewer.
- **Provenance is explicit.** Synthetic feeds are labelled synthetic, assumed heights are flagged,
  identifiers declare whether they were generated here or taken from an external record, and public
  lookups never return a holder's name.
- **Standards-compliant output.** CityJSON 2.0 export, verified against the official schema.

## What it is not

Not a survey pipeline: there is no drone or LiDAR ingestion. Not connected to any authoritative
land record: building footprints stand in for cadastral parcels because no state publishes parcel
geometry openly. Roles are a demonstration switch, not authentication. Ownership and tenure — the
legal layer — are not populated.

See [`DATA.md`](DATA.md) for exactly which layers are real and which are assumed.

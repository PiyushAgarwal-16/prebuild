export interface Stage {
  name: string;
  description: string;
  position: string;
}

export interface Application {
  id: string;
  tab: string;
  audience: string;
  title: string;
  text: string;
  image: string;
  label: string;
  facts: [string, string][];
}

export const NAV_SECTIONS = ["home", "about", "platform", "assets"] as const;

export const STAGES: Stage[] = [
  {
    name: "Survey",
    description: "Fix the ground parcel from live GNSS, drone imagery, or an existing GIS layer.",
    position: "pin-survey",
  },
  {
    name: "Extract",
    description: "Digitise floor plans into stacked volumes with real heights and footprints.",
    position: "pin-extract",
  },
  {
    name: "Delineate",
    description: "Cut the column into vertical parcels, each with its own tenure and holder.",
    position: "pin-delineate",
  },
  {
    name: "Validate",
    description: "Check every volume against its neighbours before an identifier is issued.",
    position: "pin-validate",
  },
];

export const APPLICATIONS: Application[] = [
  {
    id: "parcel",
    tab: "Ground parcels",
    audience: "FOR SURVEY & REVENUE DEPARTMENTS",
    title: "The parcel you know. Now with a third axis.",
    text: "Start from the surveyed boundary and the 14-character ULPIN already issued against it. The ground parcel stays the root; everything above and below extends from it.",
    image: "city",
    label: "GROUND PARCEL / ULPIN BASE",
    facts: [
      ["Identifier", "14-character ULPIN"],
      ["Geometry", "Surveyed boundary ring"],
      ["Datum", "Parcel ground elevation"],
    ],
  },
  {
    id: "strata",
    tab: "Strata volumes",
    audience: "FOR DEVELOPERS & HOUSING SOCIETIES",
    title: "Every floor, its own parcel.",
    text: "Each unit becomes a closed volume with a footprint, a floor, and a ceiling. Band, level, and unit extend the parent ULPIN into an identifier that names one volume and no other.",
    image: "city",
    label: "STRATA VOLUME / ULPIN EXTENSION",
    facts: [
      ["Identifier", "ULPIN base + band/level/unit"],
      ["Extent", "Footprint with z-min and z-max"],
      ["Tenure", "Per volume, not per building"],
    ],
  },
  {
    id: "rights",
    tab: "Vertical rights",
    audience: "FOR UTILITIES & PLANNERS",
    title: "Rights above. Rights below.",
    text: "Air rights, easements, and subsurface corridors occupy the same column as the building. Recording them as volumes makes an overlap something the registry can detect rather than something a court discovers.",
    image: "city-mesh",
    label: "AIR & SUBSURFACE RIGHTS",
    facts: [
      ["Bands", "Subsurface, basement, ground, floor, air"],
      ["Conflicts", "Volume overlap, tenure-aware"],
      ["Exports", "GeoJSON, CSV, GLB"],
    ],
  },
];

export const DEMO_STEPS = [
  "Draw the ground parcel",
  "Digitise the floor plan",
  "Stack the volumes",
  "Issue the ULPIN",
];

export const DEMO_DESCRIPTIONS = [
  "Trace the boundary on a live basemap, or import it from an existing GIS layer.",
  "A vision model reads the floor plan and returns footprints, levels, and heights.",
  "Each unit becomes a volume in the column, with its own tenure and holder.",
  "The registry checks for overlaps, then issues an identifier per volume.",
];

export const DEMO_ACTIONS = [
  "Digitise the plan",
  "Stack the volumes",
  "Issue the ULPIN",
  "Start again",
];

export const CONNECTION_LABELS = [
  { className: "top-left", text: "Drone & LiDAR capture" },
  { className: "bottom-left", text: "GNSS / CORS control" },
  { className: "top-right", text: "Volumetric cadastre" },
  { className: "bottom-right", text: "Conflict detection" },
];

import { EXTRACT_INSIDE_COVER, EXTRACT_MATCH_IOU, EXTRACT_NOVEL_OVERLAP } from "../config.js";
import { overlapAreaM2, ringAreaM2 } from "../../geo.js";
import type { ExtractedFootprint, ExtractionAccuracy, SourceBuilding } from "../types.js";

export interface ExtractionComparison {
  accuracy: ExtractionAccuracy;
  novel: ExtractedFootprint[];
}

export function compareToReference(
  extracted: ExtractedFootprint[],
  reference: SourceBuilding[],
  referenceComplete: boolean,
): ExtractionComparison {
  const extractedAreas = extracted.map((f) => ringAreaM2(f.ring));
  const referenceAreas = reference.map((b) => ringAreaM2(b.ring));
  const referenceHit = new Set<number>();
  const novel: ExtractedFootprint[] = [];
  const covered = reference.map(() => 0);
  let matched = 0;
  let inside = 0;
  let iouSum = 0;

  extracted.forEach((footprint, i) => {
    let bestIou = 0;
    let bestIndex = -1;
    let maxCover = 0;
    reference.forEach((building, j) => {
      const shared = overlapAreaM2(footprint.ring, building.ring);
      if (shared <= 0) return;
      const union = extractedAreas[i] + referenceAreas[j] - shared;
      const iou = union > 0 ? shared / union : 0;
      if (iou > bestIou) {
        bestIou = iou;
        bestIndex = j;
      }
      maxCover = Math.max(maxCover, shared / Math.max(extractedAreas[i], 1e-9));
      covered[j] += shared;
    });
    if (maxCover >= EXTRACT_INSIDE_COVER) inside += 1;
    if (bestIou >= EXTRACT_MATCH_IOU) {
      matched += 1;
      iouSum += bestIou;
      referenceHit.add(bestIndex);
    }
    if (maxCover < EXTRACT_NOVEL_OVERLAP) novel.push(footprint);
  });

  return {
    accuracy: {
      extracted: extracted.length,
      reference: reference.length,
      matched,
      precision: extracted.length ? matched / extracted.length : 0,
      recall: reference.length ? referenceHit.size / reference.length : 0,
      meanIou: matched ? iouSum / matched : 0,
      inside,
      insideRate: extracted.length ? inside / extracted.length : 0,
      coverageRecall: reference.length
        ? covered.filter((area, j) => area / Math.max(referenceAreas[j], 1e-9) >= EXTRACT_INSIDE_COVER).length /
          reference.length
        : 0,
      referenceComplete,
    },
    novel,
  };
}

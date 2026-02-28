/**
 * Pose Similarity Scorer — Cosine similarity between normalized limb vectors.
 * Core scoring engine: compares reference pose vs user pose per body segment.
 */

import { normalizePose } from './poseNormalizer';

// ─── Body Segment Definitions ───
// Each segment is defined by pairs of [start, end] landmark indices
export const BODY_SEGMENTS = {
    leftArm: { pairs: [[11, 13], [13, 15]], label: 'Left Arm', weight: 1.5, emoji: '💪' },
    rightArm: { pairs: [[12, 14], [14, 16]], label: 'Right Arm', weight: 1.5, emoji: '💪' },
    leftLeg: { pairs: [[23, 25], [25, 27]], label: 'Left Leg', weight: 1.5, emoji: '🦵' },
    rightLeg: { pairs: [[24, 26], [26, 28]], label: 'Right Leg', weight: 1.5, emoji: '🦵' },
    torso: { pairs: [[11, 12], [11, 23], [12, 24], [23, 24]], label: 'Torso', weight: 1.0, emoji: '🫁' },
    head: { pairs: [[0, 11], [0, 12]], label: 'Head', weight: 0.5, emoji: '🗣️' },
};

/**
 * Vector between two 3D points
 */
function vecBetween(a, b) {
    return {
        x: b.x - a.x,
        y: b.y - a.y,
        z: b.z - a.z
    };
}

/**
 * Cosine similarity between two 3D vectors
 * Returns value in [-1, 1] where 1 = identical direction
 */
function cosineSim(v1, v2) {
    const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    const mag1 = Math.sqrt(v1.x ** 2 + v1.y ** 2 + v1.z ** 2);
    const mag2 = Math.sqrt(v2.x ** 2 + v2.y ** 2 + v2.z ** 2);

    if (mag1 < 0.0001 || mag2 < 0.0001) return 0;
    return dot / (mag1 * mag2);
}

/**
 * Compare two poses and return per-segment and overall similarity scores.
 *
 * @param {Array} refLandmarks - Reference pose landmarks (raw from MediaPipe)
 * @param {Array} userLandmarks - User's pose landmarks (raw from MediaPipe)
 * @returns {Object} { overall: 0-100, segments: { leftArm: 0-100, ... }, timestamp }
 */
export function comparePoses(refLandmarks, userLandmarks) {
    const refNorm = normalizePose(refLandmarks);
    const userNorm = normalizePose(userLandmarks);

    if (!refNorm || !userNorm) {
        return null;
    }

    const segmentScores = {};

    for (const [name, seg] of Object.entries(BODY_SEGMENTS)) {
        let totalSim = 0;
        let validPairs = 0;

        for (const [a, b] of seg.pairs) {
            // Check visibility of both landmarks in both poses
            const minVis = Math.min(
                refNorm[a].visibility, refNorm[b].visibility,
                userNorm[a].visibility, userNorm[b].visibility
            );

            if (minVis < 0.4) continue; // Skip low-confidence joints

            const refVec = vecBetween(refNorm[a], refNorm[b]);
            const userVec = vecBetween(userNorm[a], userNorm[b]);
            const sim = cosineSim(refVec, userVec);

            totalSim += sim;
            validPairs++;
        }

        if (validPairs === 0) {
            segmentScores[name] = null; // Can't score this segment
        } else {
            // Scale from [-1, 1] to [0, 100]
            const rawScore = totalSim / validPairs;
            segmentScores[name] = Math.max(0, Math.min(100, ((rawScore + 1) / 2) * 100));
        }
    }

    // Overall score = weighted average of segments
    let weightedSum = 0;
    let weightTotal = 0;

    for (const [name, score] of Object.entries(segmentScores)) {
        if (score === null) continue;
        const weight = BODY_SEGMENTS[name].weight;
        weightedSum += score * weight;
        weightTotal += weight;
    }

    const overall = weightTotal > 0 ? weightedSum / weightTotal : 0;

    return {
        overall: Math.round(overall * 10) / 10,
        segments: segmentScores,
        timestamp: Date.now()
    };
}

/**
 * Get color for a score value (0-100)
 */
export function scoreToColor(score) {
    if (score === null) return '#64748b'; // Gray for unknown
    if (score >= 85) return '#22c55e';    // Green — excellent
    if (score >= 70) return '#84cc16';    // Lime — good
    if (score >= 55) return '#f59e0b';    // Amber — needs work
    if (score >= 40) return '#f97316';    // Orange — off
    return '#ef4444';                      // Red — very off
}

/**
 * Get text label for a score
 */
export function scoreToLabel(score) {
    if (score === null) return 'N/A';
    if (score >= 85) return 'Perfect!';
    if (score >= 70) return 'Good';
    if (score >= 55) return 'Close';
    if (score >= 40) return 'Off';
    return 'Way Off';
}

/**
 * Get a grade letter for a score
 */
export function scoreToGrade(score) {
    if (score === null) return '—';
    if (score >= 90) return 'S';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
}

/**
 * Pose Similarity v2 — Multi-signal comparison engine
 *
 * Uses THREE comparison methods for accuracy:
 * 1. Joint angle matching (elbow bend, knee bend, etc.)
 * 2. Relative position matching (where joints are relative to torso)
 * 3. Vector direction matching (limb orientation)
 *
 * This catches issues the old cosine-only approach missed:
 * - Arm at same angle but different height → now penalized
 * - Correct direction but wrong bend amount → now penalized
 */

import { normalizePose, distance } from './poseNormalizer';

// ─── Body Segment Definitions ───
export const BODY_SEGMENTS = {
    leftArm: {
        joints: [11, 13, 15],   // shoulder → elbow → wrist
        positions: [11, 13, 15],
        label: 'Left Arm', weight: 1.5, emoji: '💪'
    },
    rightArm: {
        joints: [12, 14, 16],   // shoulder → elbow → wrist
        positions: [12, 14, 16],
        label: 'Right Arm', weight: 1.5, emoji: '💪'
    },
    leftLeg: {
        joints: [23, 25, 27],   // hip → knee → ankle
        positions: [23, 25, 27],
        label: 'Left Leg', weight: 1.5, emoji: '🦵'
    },
    rightLeg: {
        joints: [24, 26, 28],   // hip → knee → ankle
        positions: [24, 26, 28],
        label: 'Right Leg', weight: 1.5, emoji: '🦵'
    },
    torso: {
        joints: [11, 12, 23, 24], // shoulders and hips
        positions: [11, 12, 23, 24],
        label: 'Torso', weight: 1.0, emoji: '🫁',
        useTorsoAngles: true
    },
    head: {
        joints: [0, 11, 12],    // nose → shoulders
        positions: [0, 7, 8],   // nose, ears
        label: 'Head', weight: 0.5, emoji: '🗣️'
    },
};

// ─── Math helpers ───

function vec(a, b) {
    return { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
}

function angleBetween3(a, b, c) {
    // Angle at point b formed by a-b-c, in degrees
    const v1 = vec(b, a);
    const v2 = vec(b, c);
    const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    const m1 = Math.sqrt(v1.x ** 2 + v1.y ** 2 + v1.z ** 2);
    const m2 = Math.sqrt(v2.x ** 2 + v2.y ** 2 + v2.z ** 2);
    if (m1 < 0.001 || m2 < 0.001) return 0;
    return Math.acos(Math.max(-1, Math.min(1, dot / (m1 * m2)))) * 180 / Math.PI;
}

function cosineSim(v1, v2) {
    const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    const m1 = Math.sqrt(v1.x ** 2 + v1.y ** 2 + v1.z ** 2);
    const m2 = Math.sqrt(v2.x ** 2 + v2.y ** 2 + v2.z ** 2);
    if (m1 < 0.001 || m2 < 0.001) return 0;
    return dot / (m1 * m2);
}

function positionDistance(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

function minVisibility(norm, indices) {
    return Math.min(...indices.map(i => norm[i]?.visibility || 0));
}

// ─── Scoring functions ───

/**
 * Score based on joint angle difference (0-100)
 * An angle difference of 0° → 100, 45° → ~50, 90° → 0
 */
function angleScore(refAngle, userAngle) {
    const diff = Math.abs(refAngle - userAngle);
    return Math.max(0, 100 - (diff * 2.2)); // 45° diff = ~1% score
}

/**
 * Score based on normalized position distance (0-100)
 * After normalization, distances are relative to torso length
 * A distance of 0 → 100, 0.5 → ~50, 1.0 → ~0
 */
function positionScore(refPt, userPt) {
    const d = positionDistance(refPt, userPt);
    return Math.max(0, 100 * Math.exp(-d * 3)); // Exponential falloff
}

/**
 * Score based on vector direction similarity (0-100)
 */
function directionScore(refA, refB, userA, userB) {
    const refV = vec(refA, refB);
    const userV = vec(userA, userB);
    const sim = cosineSim(refV, userV);
    return Math.max(0, ((sim + 1) / 2) * 100);
}

// ─── Main comparison ───

/**
 * Compare two poses using multi-signal scoring.
 *
 * @param {Array} refLandmarks - Reference pose landmarks
 * @param {Array} userLandmarks - User's pose landmarks
 * @returns {Object} { overall: 0-100, segments: { leftArm: 0-100, ... }, timestamp }
 */
export function comparePoses(refLandmarks, userLandmarks) {
    const refNorm = normalizePose(refLandmarks);
    const userNorm = normalizePose(userLandmarks);

    if (!refNorm || !userNorm) return null;

    const segmentScores = {};

    for (const [name, seg] of Object.entries(BODY_SEGMENTS)) {
        const vis = minVisibility(refNorm, seg.joints) + minVisibility(userNorm, seg.joints);
        if (vis < 0.8) { // Both need decent visibility
            segmentScores[name] = null;
            continue;
        }

        const scores = [];

        if (seg.useTorsoAngles) {
            // Torso: compare shoulder-hip angles
            const refShoulderAngle = angleBetween3(refNorm[11], refNorm[23], refNorm[24]);
            const userShoulderAngle = angleBetween3(userNorm[11], userNorm[23], userNorm[24]);
            scores.push(angleScore(refShoulderAngle, userShoulderAngle));

            const refHipAngle = angleBetween3(refNorm[12], refNorm[24], refNorm[23]);
            const userHipAngle = angleBetween3(userNorm[12], userNorm[24], userNorm[23]);
            scores.push(angleScore(refHipAngle, userHipAngle));

            // Position of shoulders relative to hips
            scores.push(positionScore(refNorm[11], userNorm[11]));
            scores.push(positionScore(refNorm[12], userNorm[12]));
        } else if (seg.joints.length >= 3) {
            // Limbs: use joint angle at the middle joint (elbow/knee)
            const [a, b, c] = seg.joints;
            const refAngle = angleBetween3(refNorm[a], refNorm[b], refNorm[c]);
            const userAngle = angleBetween3(userNorm[a], userNorm[b], userNorm[c]);

            // Weight: 40% angle, 35% position, 25% direction
            scores.push(angleScore(refAngle, userAngle) * 0.4);

            // Position of endpoint (wrist/ankle) relative to body center
            scores.push(positionScore(refNorm[c], userNorm[c]) * 0.35);

            // Direction of the limb segments
            const dir1 = directionScore(refNorm[a], refNorm[b], userNorm[a], userNorm[b]);
            const dir2 = directionScore(refNorm[b], refNorm[c], userNorm[b], userNorm[c]);
            scores.push(((dir1 + dir2) / 2) * 0.25);
        } else {
            // Head or simple segments: mainly position
            for (const idx of seg.positions) {
                if (refNorm[idx] && userNorm[idx]) {
                    scores.push(positionScore(refNorm[idx], userNorm[idx]));
                }
            }
        }

        if (scores.length === 0) {
            segmentScores[name] = null;
        } else {
            const total = scores.reduce((a, b) => a + b, 0);
            // For weighted limbs, the weights already sum to 1.0
            const avg = seg.useTorsoAngles || seg.joints.length < 3
                ? total / scores.length
                : total; // Already weighted to sum to 1.0
            segmentScores[name] = Math.max(0, Math.min(100, avg));
        }
    }

    // Overall = weighted average
    let weightedSum = 0, weightTotal = 0;
    for (const [name, score] of Object.entries(segmentScores)) {
        if (score === null) continue;
        const w = BODY_SEGMENTS[name].weight;
        weightedSum += score * w;
        weightTotal += w;
    }

    return {
        overall: weightTotal > 0 ? Math.round((weightedSum / weightTotal) * 10) / 10 : 0,
        segments: segmentScores,
        timestamp: Date.now()
    };
}

// ─── Utility exports ───

export function scoreToColor(score) {
    if (score === null) return '#64748b';
    if (score >= 85) return '#22c55e';
    if (score >= 70) return '#84cc16';
    if (score >= 55) return '#f59e0b';
    if (score >= 40) return '#f97316';
    return '#ef4444';
}

export function scoreToLabel(score) {
    if (score === null) return 'N/A';
    if (score >= 85) return 'Perfect!';
    if (score >= 70) return 'Good';
    if (score >= 55) return 'Close';
    if (score >= 40) return 'Off';
    return 'Way Off';
}

export function scoreToGrade(score) {
    if (score === null) return '—';
    if (score >= 90) return 'S';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
}

/**
 * Audio Coach — Real-time voice feedback using Web Speech API
 * Provides spoken corrections like "Kick your left leg further up"
 */

const COOLDOWN_MS = 4000; // Minimum time between voice cues
const SCORE_THRESHOLD_SPEAK = 55; // Only speak when a segment is below this
const SCORE_THRESHOLD_PRAISE = 85; // Praise when above this

let lastSpeakTime = 0;
let lastSpokenSegment = null;
let enabled = true;
let utteranceQueue = [];

// ─── Direction Detection ───
// Determines if a body part needs to go higher/lower/wider etc.
// by comparing normalized poses
const JOINT_NAMES = {
    11: 'left shoulder', 12: 'right shoulder',
    13: 'left elbow', 14: 'right elbow',
    15: 'left wrist', 16: 'right wrist',
    23: 'left hip', 24: 'right hip',
    25: 'left knee', 26: 'right knee',
    27: 'left ankle', 28: 'right ankle',
};

const SEGMENT_TO_JOINTS = {
    leftArm: { primary: [15, 13], label: 'left arm' },
    rightArm: { primary: [16, 14], label: 'right arm' },
    leftLeg: { primary: [27, 25], label: 'left leg' },
    rightLeg: { primary: [28, 26], label: 'right leg' },
    torso: { primary: [11, 23], label: 'torso' },
    head: { primary: [0, 11], label: 'head' },
};

/**
 * Analyze the difference between reference and user pose for a specific segment
 * and return a human-readable correction.
 */
function analyzeDifference(refLandmarks, userLandmarks, segmentKey) {
    const seg = SEGMENT_TO_JOINTS[segmentKey];
    if (!seg) return null;

    const [tipIdx, baseIdx] = seg.primary;
    const ref = refLandmarks[tipIdx];
    const user = userLandmarks[tipIdx];
    const refBase = refLandmarks[baseIdx];
    const userBase = userLandmarks[baseIdx];

    if (!ref || !user || !refBase || !userBase) return null;
    if ((ref.visibility || 0) < 0.4 || (user.visibility || 0) < 0.4) return null;

    // Calculate position differences relative to base
    const refRelY = ref.y - refBase.y;
    const userRelY = user.y - userBase.y;
    const refRelX = ref.x - refBase.x;
    const userRelX = user.x - userBase.x;

    const yDiff = userRelY - refRelY; // positive = user is too low
    const xDiff = userRelX - refRelX; // positive = user is too far right

    const label = seg.label;

    // Determine the most significant correction
    const absY = Math.abs(yDiff);
    const absX = Math.abs(xDiff);

    if (absY > absX && absY > 0.04) {
        if (yDiff > 0) {
            return `Raise your ${label} higher`;
        } else {
            return `Lower your ${label} a bit`;
        }
    } else if (absX > 0.04) {
        // In webcam (mirrored), left/right is flipped for user
        if (xDiff > 0) {
            return `Bring your ${label} more to the left`;
        } else {
            return `Extend your ${label} more to the right`;
        }
    }

    return `Adjust your ${label} position`;
}

/**
 * Generate a voice cue from current comparison data.
 * Called every comparison frame — internally handles cooldown.
 *
 * @param {Object} comparison - { overall, segments }
 * @param {Array} refLandmarks - Reference landmarks
 * @param {Array} userLandmarks - User landmarks
 */
export function generateVoiceCue(comparison, refLandmarks, userLandmarks) {
    if (!enabled || !comparison) return;

    const now = Date.now();
    if (now - lastSpeakTime < COOLDOWN_MS) return;

    // Find the worst-scoring segment
    let worstSeg = null;
    let worstScore = 100;

    for (const [key, score] of Object.entries(comparison.segments)) {
        if (score === null) continue;
        if (score < worstScore) {
            worstScore = score;
            worstSeg = key;
        }
    }

    // Don't speak if everything is above threshold
    if (worstScore >= SCORE_THRESHOLD_SPEAK) {
        // Occasional praise
        if (comparison.overall >= SCORE_THRESHOLD_PRAISE && now - lastSpeakTime > 8000) {
            speak("Great form! You're nailing it!");
            lastSpeakTime = now;
        }
        return;
    }

    // Don't repeat the same segment back-to-back
    if (worstSeg === lastSpokenSegment && now - lastSpeakTime < COOLDOWN_MS * 2) return;

    // Get specific directional feedback
    let message = null;
    if (refLandmarks && userLandmarks) {
        message = analyzeDifference(refLandmarks, userLandmarks, worstSeg);
    }

    if (!message) {
        const label = SEGMENT_TO_JOINTS[worstSeg]?.label || worstSeg;
        message = `Watch your ${label}`;
    }

    speak(message);
    lastSpeakTime = now;
    lastSpokenSegment = worstSeg;
}

/**
 * Speak a message using Web Speech API
 */
function speak(text) {
    if (!window.speechSynthesis) return;

    // Cancel any queued speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;  // Slightly faster for responsiveness
    utterance.pitch = 1.0;
    utterance.volume = 0.85;

    // Try to pick a good voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
        v.name.includes('Samantha') || v.name.includes('Karen') ||
        v.name.includes('Daniel') || v.name.includes('Google')
    );
    if (preferred) utterance.voice = preferred;

    window.speechSynthesis.speak(utterance);
}

/**
 * Enable/disable voice coaching
 */
export function setAudioCoachEnabled(val) {
    enabled = val;
    if (!val) {
        window.speechSynthesis?.cancel();
    }
}

export function isAudioCoachEnabled() {
    return enabled;
}

/**
 * Reset state (between sessions)
 */
export function resetAudioCoach() {
    lastSpeakTime = 0;
    lastSpokenSegment = null;
    window.speechSynthesis?.cancel();
}

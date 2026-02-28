/**
 * Audio Coach v2 — Faster, less laggy real-time voice feedback
 *
 * Fixes:
 * - Pre-initializes voices on first user interaction
 * - Uses shorter, punchier cues (2-4 words max)
 * - Better debouncing with segment rotation
 * - Cancels previous speech immediately before new
 */

const COOLDOWN_MS = 3500;
const SCORE_THRESHOLD = 50;
const PRAISE_THRESHOLD = 88;

let lastSpeakTime = 0;
let lastSpokenSegment = null;
let spokenCount = 0;
let enabled = true;
let voicesReady = false;
let preferredVoice = null;

// Pre-load voices (call on first user click)
export function initVoices() {
    if (voicesReady) return;
    const synth = window.speechSynthesis;
    if (!synth) return;

    // Force voice loading
    synth.getVoices();
    synth.onvoiceschanged = () => {
        const voices = synth.getVoices();
        preferredVoice = voices.find(v =>
            v.name.includes('Samantha') || v.name.includes('Karen') ||
            v.name.includes('Google US') || v.name.includes('Daniel')
        ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
        voicesReady = true;
    };
    // Trigger load
    synth.getVoices();

    // Warm up with silent utterance
    const warm = new SpeechSynthesisUtterance('');
    warm.volume = 0;
    synth.speak(warm);
}

const SEGMENT_JOINTS = {
    leftArm: { tip: 15, base: 13, label: 'left arm' },
    rightArm: { tip: 16, base: 14, label: 'right arm' },
    leftLeg: { tip: 27, base: 25, label: 'left leg' },
    rightLeg: { tip: 28, base: 26, label: 'right leg' },
    torso: { tip: 11, base: 23, label: 'torso' },
    head: { tip: 0, base: 11, label: 'head' },
};

// Short, punchy cues — designed to be spoken in <1 second
function getShortCue(segKey, refLandmarks, userLandmarks) {
    const seg = SEGMENT_JOINTS[segKey];
    if (!seg || !refLandmarks || !userLandmarks) return `Watch your ${seg?.label || segKey}`;

    const ref = refLandmarks[seg.tip];
    const user = userLandmarks[seg.tip];
    const refBase = refLandmarks[seg.base];
    const userBase = userLandmarks[seg.base];

    if (!ref || !user || (ref.visibility || 0) < 0.4 || (user.visibility || 0) < 0.4) {
        return `Watch ${seg.label}`;
    }

    const yDiff = (user.y - userBase.y) - (ref.y - refBase.y);
    const xDiff = (user.x - userBase.x) - (ref.x - refBase.x);

    const label = seg.label;

    if (Math.abs(yDiff) > Math.abs(xDiff) && Math.abs(yDiff) > 0.04) {
        return yDiff > 0 ? `${label} higher` : `${label} lower`;
    }
    if (Math.abs(xDiff) > 0.04) {
        return xDiff > 0 ? `${label} left` : `${label} right`;
    }
    return `adjust ${label}`;
}

/**
 * Generate and speak a voice cue. Called every comparison frame.
 */
export function generateVoiceCue(comparison, refLandmarks, userLandmarks) {
    if (!enabled || !comparison || !window.speechSynthesis) return;

    const now = Date.now();
    if (now - lastSpeakTime < COOLDOWN_MS) return;

    // Find worst segment
    let worstSeg = null;
    let worstScore = 100;
    for (const [key, score] of Object.entries(comparison.segments)) {
        if (score === null) continue;
        if (score < worstScore) { worstScore = score; worstSeg = key; }
    }

    if (worstScore >= SCORE_THRESHOLD) {
        // Occasional praise (every 3rd chance)
        if (comparison.overall >= PRAISE_THRESHOLD && now - lastSpeakTime > 8000) {
            spokenCount++;
            if (spokenCount % 3 === 0) {
                speak('Nice!');
                lastSpeakTime = now;
            }
        }
        return;
    }

    // Avoid repeating same segment twice in a row
    if (worstSeg === lastSpokenSegment && now - lastSpeakTime < COOLDOWN_MS * 2.5) return;

    const cue = getShortCue(worstSeg, refLandmarks, userLandmarks);
    speak(cue);
    lastSpeakTime = now;
    lastSpokenSegment = worstSeg;
    spokenCount++;
}

function speak(text) {
    const synth = window.speechSynthesis;
    if (!synth) return;

    // Cancel any pending speech immediately
    synth.cancel();

    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.3;      // Fast
    u.pitch = 1.05;
    u.volume = 0.8;
    if (preferredVoice) u.voice = preferredVoice;
    synth.speak(u);
}

export function setAudioCoachEnabled(val) {
    enabled = val;
    if (!val) window.speechSynthesis?.cancel();
}

export function isAudioCoachEnabled() { return enabled; }

export function resetAudioCoach() {
    lastSpeakTime = 0;
    lastSpokenSegment = null;
    spokenCount = 0;
    window.speechSynthesis?.cancel();
}

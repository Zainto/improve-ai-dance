/**
 * Audio Coach v3 — Natural instructor-style voice feedback
 *
 * Speaks like a real dance teacher:
 * "Move your hips more!", "Extend that arm!", "Beautiful, keep it up!"
 */

const COOLDOWN_MS = 3500;
const SCORE_THRESHOLD = 55;
const PRAISE_THRESHOLD = 85;

let lastSpeakTime = 0;
let lastSpokenSegment = null;
let spokenCount = 0;
let enabled = true;
let voicesReady = false;
let preferredVoice = null;

// Pre-load voices on first user interaction
export function initVoices() {
    if (voicesReady) return;
    const synth = window.speechSynthesis;
    if (!synth) return;

    const loadVoices = () => {
        const voices = synth.getVoices();
        if (voices.length === 0) return;
        preferredVoice = voices.find(v =>
            v.name.includes('Samantha') || v.name.includes('Google US') ||
            v.name.includes('Karen') || v.name.includes('Moira')
        ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
        voicesReady = true;
    };

    synth.onvoiceschanged = loadVoices;
    loadVoices();

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

// ─── Natural instructor-style cues ───
// Each segment has multiple phrase templates so it doesn't sound repetitive
const INSTRUCTOR_CUES = {
    leftArm: {
        higher: [
            "Lift that left arm up!",
            "Left arm needs to go higher!",
            "Reach up with your left arm!",
            "Get that left arm up higher!",
        ],
        lower: [
            "Bring your left arm down a touch!",
            "Left arm is too high, lower it!",
            "Easy on the left arm, bring it down!",
        ],
        left: [
            "Extend your left arm out more!",
            "Stretch that left arm wider!",
            "Open up your left arm!",
        ],
        right: [
            "Pull your left arm in a bit!",
            "Bring your left arm closer!",
            "Tighten up that left arm!",
        ],
        general: [
            "Watch your left arm placement!",
            "Check your left arm!",
        ],
    },
    rightArm: {
        higher: [
            "Right arm up, higher!",
            "Lift that right arm!",
            "Get your right arm up there!",
            "Reach higher with your right!",
        ],
        lower: [
            "Bring your right arm down!",
            "Right arm's too high, lower it!",
            "Drop that right arm down a bit!",
        ],
        left: [
            "Pull your right arm in more!",
            "Tighten your right arm closer!",
        ],
        right: [
            "Extend your right arm out!",
            "Stretch that right arm wider!",
            "Open up your right side!",
        ],
        general: [
            "Watch your right arm!",
            "Fix that right arm position!",
        ],
    },
    leftLeg: {
        higher: [
            "Kick that left leg higher!",
            "Left leg needs to go up more!",
            "Lift your left leg!",
            "Get that left foot up!",
        ],
        lower: [
            "Bring your left leg down!",
            "Left leg is too high!",
            "Plant that left foot lower!",
        ],
        left: [
            "Step wider with your left!",
            "Left leg out more!",
            "Open up that left step!",
        ],
        right: [
            "Bring your left leg in!",
            "Tighter with the left foot!",
        ],
        general: [
            "Watch your left leg!",
            "Fix your left footwork!",
        ],
    },
    rightLeg: {
        higher: [
            "Right leg up higher!",
            "Kick that right leg up!",
            "Lift your right leg more!",
            "Get that right foot up!",
        ],
        lower: [
            "Right leg down!",
            "Bring that right leg down a bit!",
        ],
        left: [
            "Bring your right leg in!",
            "Tighter right step!",
        ],
        right: [
            "Step out wider with your right!",
            "Right leg out more!",
            "Open up your right side!",
        ],
        general: [
            "Fix your right leg!",
            "Watch that right footwork!",
        ],
    },
    torso: {
        higher: [
            "Stand up taller!",
            "Straighten up your back!",
            "Chest up!",
        ],
        lower: [
            "Bend down more!",
            "Drop your center lower!",
            "Get lower!",
        ],
        left: [
            "Rotate your body left!",
            "Turn your hips left!",
            "Shift your body left!",
        ],
        right: [
            "Rotate your body right!",
            "Turn your hips right!",
            "Shift your body right!",
        ],
        general: [
            "Move your hips more!",
            "Engage your core!",
            "Watch your body alignment!",
            "Use your hips!",
        ],
    },
    head: {
        higher: [
            "Chin up!",
            "Head up, look forward!",
            "Lift your head!",
        ],
        lower: [
            "Drop your head down!",
            "Look down a bit more!",
        ],
        left: [
            "Turn your head left!",
            "Look to the left!",
        ],
        right: [
            "Turn your head right!",
            "Look to the right!",
        ],
        general: [
            "Watch your head position!",
            "Fix your head angle!",
        ],
    },
};

const PRAISE_PHRASES = [
    "Beautiful, keep it up!",
    "Yes! That's it!",
    "Looking great!",
    "Perfect, stay with it!",
    "You're killing it!",
    "Nice moves!",
    "Love it, keep going!",
];

function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getInstructorCue(segKey, refLandmarks, userLandmarks) {
    const seg = SEGMENT_JOINTS[segKey];
    const cues = INSTRUCTOR_CUES[segKey];
    if (!seg || !cues) return pickRandom(cues?.general || [`Watch your ${seg?.label || segKey}!`]);

    if (!refLandmarks || !userLandmarks) return pickRandom(cues.general);

    const ref = refLandmarks[seg.tip];
    const user = userLandmarks[seg.tip];
    const refBase = refLandmarks[seg.base];
    const userBase = userLandmarks[seg.base];

    if (!ref || !user || (ref.visibility || 0) < 0.4 || (user.visibility || 0) < 0.4) {
        return pickRandom(cues.general);
    }

    const yDiff = (user.y - userBase.y) - (ref.y - refBase.y);
    const xDiff = (user.x - userBase.x) - (ref.x - refBase.x);

    if (Math.abs(yDiff) > Math.abs(xDiff) && Math.abs(yDiff) > 0.04) {
        return pickRandom(yDiff > 0 ? cues.higher : cues.lower);
    }
    if (Math.abs(xDiff) > 0.04) {
        return pickRandom(xDiff > 0 ? cues.left : cues.right);
    }
    return pickRandom(cues.general);
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
        // Occasional praise
        if (comparison.overall >= PRAISE_THRESHOLD && now - lastSpeakTime > 7000) {
            spokenCount++;
            if (spokenCount % 2 === 0) {
                speak(pickRandom(PRAISE_PHRASES));
                lastSpeakTime = now;
            }
        }
        return;
    }

    // Avoid same segment twice in a row
    if (worstSeg === lastSpokenSegment && now - lastSpeakTime < COOLDOWN_MS * 2) return;

    const cue = getInstructorCue(worstSeg, refLandmarks, userLandmarks);
    speak(cue);
    lastSpeakTime = now;
    lastSpokenSegment = worstSeg;
    spokenCount++;
}

function speak(text) {
    const synth = window.speechSynthesis;
    if (!synth) return;

    synth.cancel();

    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.15;
    u.pitch = 1.05;
    u.volume = 0.85;
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

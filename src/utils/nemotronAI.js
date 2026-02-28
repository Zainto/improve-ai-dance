/**
 * NVIDIA Nemotron AI Feedback — Uses PoseScript-inspired descriptive vocabulary
 * to generate natural language dance corrections via Nemotron API.
 *
 * Proxied via /api/nvidia (Vite dev) or backend /api/feedback (production)
 * Model: nvidia/llama-3.3-nemotron-super-49b-v1
 */

const API_URL = '/api/nvidia/chat/completions';
const MODEL = 'nvidia/llama-3.3-nemotron-super-49b-v1';

/**
 * Generate smart AI coaching feedback from session data using Nemotron.
 */
export async function generateAIFeedback(sessionAnalysis, apiKey) {
    if (!apiKey) return null;

    const { overallAvg, focusAreas, strengths, timeline, segmentStats } = sessionAnalysis;
    const prompt = buildPoseScriptPrompt(overallAvg, focusAreas, strengths, timeline, segmentStats);

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 400,
                temperature: 0.7,
                top_p: 0.9,
                stream: false,
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('Nemotron API error:', response.status, errText);
            return `API Error (${response.status}): ${errText}`;
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || 'No response from AI.';
    } catch (err) {
        console.error('Nemotron API call failed:', err);
        return `Connection error: ${err.message}. Make sure the dev server is running.`;
    }
}

// PoseScript-inspired system prompt — uses the vocabulary from NAVER's PoseScript
// and PoseFix papers to generate natural, body-aware corrections
const SYSTEM_PROMPT = `You are DanceCoach AI, an expert dance instructor powered by PoseScript-style body awareness.

You describe poses and corrections using precise anatomical language inspired by PoseScript (ECCV 2022) and PoseFix (ICCV 2023):

BODY PART VOCABULARY:
- Arms: "extended outward", "bent at the elbow", "raised overhead", "reaching forward", "tucked close to the body"
- Legs: "planted wide", "knee bent deeply", "kicked up high", "stepping forward", "crossed behind"
- Torso: "leaning forward", "twisted to the side", "upright and centered", "hips shifted", "core engaged"
- Head: "tilted to the side", "looking over the shoulder", "chin tucked", "facing forward"

CORRECTION PATTERNS (from PoseFix style):
- Compare the target pose to what was done: "Your left arm should be extended overhead, but it was bent at the elbow"
- Give spatial corrections: "Rotate your hips more to the left", "Widen your stance"
- Describe the movement quality: "The movement needs to be more fluid", "Snap into the position faster"

RULES:
- Keep under 200 words
- Be warm, encouraging, and specific
- Focus on the 2-3 most impactful corrections
- Use the body vocabulary above naturally
- End with encouragement and one specific thing to practice first
- Reference specific timestamps if provided`;

function buildPoseScriptPrompt(overallAvg, focusAreas, strengths, timeline, segmentStats) {
    let p = `Analyze my dance session and give PoseScript-style corrections:\n\n`;
    p += `Overall accuracy: ${Math.round(overallAvg)}%\n\n`;

    if (focusAreas.length > 0) {
        p += `PROBLEM AREAS (need correction):\n`;
        for (const area of focusAreas.slice(0, 3)) {
            p += `- ${area.label}: ${Math.round(area.avg)}% match`;
            if (area.trend > 5) p += ` [improving +${Math.round(area.trend)}%]`;
            if (area.trend < -5) p += ` [declining ${Math.round(area.trend)}%]`;
            if (area.consistency < 50) p += ` [very inconsistent]`;
            if (area.struggles?.length > 0) p += ` [${area.struggles.length} periods of struggle]`;
            p += `\n`;
        }
        p += `\n`;
    }

    if (strengths.length > 0) {
        p += `STRONG AREAS: ${strengths.map(s => `${s.label} (${Math.round(s.avg)}%)`).join(', ')}\n\n`;
    }

    if (timeline.length > 0) {
        p += `TIMELINE:\n`;
        for (const phase of timeline) {
            p += `- ${phase.label}: ${phase.avg}%`;
            if (phase.weakestSegment) p += ` (weakest: ${phase.weakestSegment} at ${phase.weakestScore}%)`;
            p += `\n`;
        }
        p += `\n`;
    }

    p += `Give me specific, PoseScript-style corrections. Describe what my body SHOULD be doing vs what it IS doing. What should I practice first?`;
    return p;
}

export function getStoredApiKey() {
    try {
        const envKey = import.meta.env.VITE_NEMOTRON_API_KEY;
        if (envKey) return envKey;
        return localStorage.getItem('nemotron_api_key') || '';
    } catch {
        return '';
    }
}

export function storeApiKey(key) {
    try { localStorage.setItem('nemotron_api_key', key); } catch { }
}

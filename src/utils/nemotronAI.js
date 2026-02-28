/**
 * NVIDIA Nemotron AI Feedback — Calls the Python backend which combines
 * PoseScript-style pose descriptions with Nemotron AI for rich coaching.
 *
 * Backend: FastAPI at /api/feedback (proxied via Vite or direct in production)
 * Fallback: Direct Nemotron API via Vite proxy if backend is unavailable
 */

const BACKEND_URL = '/api/feedback';       // Python backend endpoint
const FALLBACK_URL = '/api/nvidia/chat/completions'; // Direct Nemotron via Vite proxy
const MODEL = 'nvidia/llama-3.3-nemotron-super-49b-v1';

/**
 * Generate smart AI coaching feedback.
 * Tries backend first (PoseScript + Nemotron), falls back to direct Nemotron.
 */
export async function generateAIFeedback(sessionAnalysis, apiKey, sessionFrames = null) {
    if (!apiKey) return null;

    // Try Python backend first (has PoseScript analysis)
    try {
        const backendResult = await callBackend(sessionAnalysis, apiKey, sessionFrames);
        if (backendResult) return backendResult;
    } catch (err) {
        console.warn('Backend unavailable, falling back to direct Nemotron:', err.message);
    }

    // Fallback: direct Nemotron API via Vite proxy
    return callNemotronDirect(sessionAnalysis, apiKey);
}

async function callBackend(sessionAnalysis, apiKey, sessionFrames) {
    const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            session_analysis: sessionAnalysis,
            session_frames: sessionFrames,
            api_key: apiKey,
        }),
    });

    if (!response.ok) {
        const errText = await response.text();
        console.error('Backend error:', response.status, errText);
        return null;
    }

    const data = await response.json();
    return data.feedback || null;
}

async function callNemotronDirect(sessionAnalysis, apiKey) {
    const { overallAvg, focusAreas, strengths, timeline } = sessionAnalysis;

    let prompt = `Analyze my dance session and give PoseScript-style corrections:\n\n`;
    prompt += `Overall accuracy: ${Math.round(overallAvg)}%\n\n`;

    if (focusAreas?.length > 0) {
        prompt += `PROBLEM AREAS:\n`;
        for (const area of focusAreas.slice(0, 3)) {
            prompt += `- ${area.label}: ${Math.round(area.avg)}% match`;
            if (area.trend > 5) prompt += ` [improving]`;
            if (area.trend < -5) prompt += ` [declining]`;
            prompt += `\n`;
        }
        prompt += `\n`;
    }

    if (strengths?.length > 0) {
        prompt += `STRONG AREAS: ${strengths.map(s => `${s.label} (${Math.round(s.avg)}%)`).join(', ')}\n\n`;
    }

    if (timeline?.length > 0) {
        prompt += `TIMELINE:\n`;
        for (const phase of timeline) {
            prompt += `- ${phase.label}: ${phase.avg}%`;
            if (phase.weakestSegment) prompt += ` (weakest: ${phase.weakestSegment})`;
            prompt += `\n`;
        }
    }

    prompt += `\nGive specific corrections. What should I practice first?`;

    try {
        const response = await fetch(FALLBACK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { role: 'system', content: 'You are DanceCoach AI, an expert dance instructor. Give warm, specific feedback under 200 words. Use dance terminology and end with encouragement.' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 400,
                temperature: 0.7,
                stream: false,
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            return `API Error (${response.status}): ${errText}`;
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || 'No response from AI.';
    } catch (err) {
        return `Connection error: ${err.message}`;
    }
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

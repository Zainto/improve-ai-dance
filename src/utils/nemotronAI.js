/**
 * NVIDIA Nemotron AI Feedback — Uses the Nemotron model via OpenAI-compatible API
 * to generate personalized, context-aware dance coaching feedback.
 *
 * Endpoint: https://integrate.api.nvidia.com/v1/chat/completions
 * Model: nvidia/llama-3.1-nemotron-70b-instruct
 */

const API_URL = '/api/nvidia/chat/completions';   // Proxied via Vite to avoid CORS
const MODEL = 'nvidia/llama-3.1-nemotron-70b-instruct';

/**
 * Generate smart AI coaching feedback from session data using Nemotron.
 *
 * @param {Object} sessionAnalysis - Output from feedbackEngine.analyzeSession()
 * @param {string} apiKey - NVIDIA API key
 * @returns {Promise<string>} Personalized coaching feedback
 */
export async function generateAIFeedback(sessionAnalysis, apiKey) {
    if (!apiKey) {
        return null;
    }

    const { overallAvg, focusAreas, strengths, timeline, segmentStats } = sessionAnalysis;

    // Build a concise prompt with session data
    const prompt = buildPrompt(overallAvg, focusAreas, strengths, timeline, segmentStats);

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
                    {
                        role: 'system',
                        content: `You are DanceCoach AI, an expert dance instructor and movement analyst. You give warm, encouraging, specific feedback to dancers based on their pose accuracy data. Keep responses under 200 words. Be conversational, supportive, and actionable. Use dance terminology naturally. Focus on the 1-2 most impactful corrections. Always end with encouragement.`
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 300,
                temperature: 0.7,
                top_p: 0.9,
            }),
        });

        if (!response.ok) {
            console.error('Nemotron API error:', response.status, await response.text());
            return null;
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || null;
    } catch (err) {
        console.error('Nemotron API call failed:', err);
        return null;
    }
}

function buildPrompt(overallAvg, focusAreas, strengths, timeline, segmentStats) {
    let prompt = `Here's my dance practice session data. Give me personalized coaching feedback.\n\n`;
    prompt += `Overall accuracy: ${Math.round(overallAvg)}%\n\n`;

    if (focusAreas.length > 0) {
        prompt += `Areas I struggled with:\n`;
        for (const area of focusAreas.slice(0, 3)) {
            prompt += `- ${area.label}: ${Math.round(area.avg)}% accuracy`;
            if (area.trend > 5) prompt += ` (improving during session)`;
            if (area.trend < -5) prompt += ` (getting worse over time)`;
            prompt += `\n`;
        }
        prompt += `\n`;
    }

    if (strengths.length > 0) {
        prompt += `My strengths: ${strengths.map(s => `${s.label} (${Math.round(s.avg)}%)`).join(', ')}\n\n`;
    }

    if (timeline.length > 0) {
        prompt += `Performance over time:\n`;
        for (const phase of timeline) {
            prompt += `- ${phase.label}: ${phase.avg}%${phase.weakestSegment ? ` (weakest: ${phase.weakestSegment})` : ''}\n`;
        }
        prompt += `\n`;
    }

    prompt += `What should I focus on most to improve? Give me specific exercises or techniques.`;

    return prompt;
}

/**
 * Check if an API key is available (env var > localStorage)
 */
export function getStoredApiKey() {
    try {
        // Prefer env variable (set in .env as VITE_NEMOTRON_API_KEY)
        const envKey = import.meta.env.VITE_NEMOTRON_API_KEY;
        if (envKey) return envKey;
        return localStorage.getItem('nemotron_api_key') || '';
    } catch {
        return '';
    }
}

export function storeApiKey(key) {
    try {
        localStorage.setItem('nemotron_api_key', key);
    } catch {
        // ignore
    }
}

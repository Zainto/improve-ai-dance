import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { BODY_SEGMENTS, scoreToColor } from '../utils/poseSimilarity';

/**
 * Session Summary — shows analytics after a practice session ends.
 */
export default function SessionSummary({ sessionData, onClose }) {
    const stats = useMemo(() => {
        if (!sessionData || sessionData.length === 0) return null;

        const scores = sessionData.map(d => d.overall);
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const peak = Math.max(...scores);
        const low = Math.min(...scores);
        const durationMs = sessionData[sessionData.length - 1].timestamp - sessionData[0].timestamp;
        const durationSec = Math.max(1, Math.round(durationMs / 1000));

        // Time series (sampled)
        const sampleInterval = Math.max(1, Math.floor(sessionData.length / 50));
        const timeSeries = sessionData
            .filter((_, i) => i % sampleInterval === 0)
            .map((d, i) => ({
                time: `${Math.round(i * sampleInterval / (sessionData.length / durationSec))}s`,
                score: Math.round(d.overall)
            }));

        // Per-segment averages
        const segAvgs = {};
        for (const key of Object.keys(BODY_SEGMENTS)) {
            const vals = sessionData.map(d => d.segments[key]).filter(v => v !== null);
            segAvgs[key] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
        }

        const segmentBars = Object.entries(segAvgs)
            .filter(([_, v]) => v !== null)
            .map(([key, avg]) => ({
                name: BODY_SEGMENTS[key].label,
                score: Math.round(avg),
                color: scoreToColor(avg),
                emoji: BODY_SEGMENTS[key].emoji
            }))
            .sort((a, b) => a.score - b.score); // worst first

        return { avg, peak, low, durationSec, timeSeries, segmentBars };
    }, [sessionData]);

    if (!stats) {
        return (
            <div className="card fade-in">
                <div className="card-title">Session Summary</div>
                <p style={{ color: 'var(--text-muted)' }}>No session data.</p>
            </div>
        );
    }

    const avgColor = scoreToColor(stats.avg);

    return (
        <div className="fade-in" id="session-summary">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2>📊 Session Summary</h2>
                {onClose && <button className="btn btn-outline" onClick={onClose}>← Back</button>}
            </div>

            {/* Key Stats */}
            <div className="summary-grid">
                <div className="card summary-stat">
                    <div className="summary-value" style={{ color: avgColor }}>{stats.avg.toFixed(1)}%</div>
                    <div className="summary-label">Avg Accuracy</div>
                </div>
                <div className="card summary-stat">
                    <div className="summary-value" style={{ color: scoreToColor(stats.peak) }}>{Math.round(stats.peak)}%</div>
                    <div className="summary-label">Best Moment</div>
                </div>
                <div className="card summary-stat">
                    <div className="summary-value" style={{ color: scoreToColor(stats.low) }}>{Math.round(stats.low)}%</div>
                    <div className="summary-label">Weakest Moment</div>
                </div>
                <div className="card summary-stat">
                    <div className="summary-value" style={{ color: 'var(--accent-3)' }}>{stats.durationSec}s</div>
                    <div className="summary-label">Duration</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '24px' }}>
                {/* Score Over Time */}
                <div className="card">
                    <div className="card-title">Accuracy Over Time</div>
                    <div className="chart-container">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={stats.timeSeries}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(165,168,208,0.08)" />
                                <XAxis dataKey="time" tick={{ fill: '#6b6e99', fontSize: 11 }} />
                                <YAxis domain={[0, 100]} tick={{ fill: '#6b6e99', fontSize: 11 }} />
                                <Tooltip
                                    contentStyle={{
                                        background: '#161940',
                                        border: '1px solid rgba(165,168,208,0.15)',
                                        borderRadius: '10px',
                                        color: '#f0f0ff'
                                    }}
                                />
                                <Line type="monotone" dataKey="score" stroke="#a855f7" strokeWidth={2} dot={false} name="Accuracy %" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Body Part Ranking */}
                <div className="card">
                    <div className="card-title">Body Part Ranking</div>
                    <div className="chart-container">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.segmentBars} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(165,168,208,0.08)" />
                                <XAxis type="number" domain={[0, 100]} tick={{ fill: '#6b6e99', fontSize: 11 }} />
                                <YAxis type="category" dataKey="name" tick={{ fill: '#a5a8d0', fontSize: 11 }} width={80} />
                                <Tooltip
                                    contentStyle={{
                                        background: '#161940',
                                        border: '1px solid rgba(165,168,208,0.15)',
                                        borderRadius: '10px',
                                        color: '#f0f0ff'
                                    }}
                                />
                                <Bar dataKey="score" name="Accuracy %" radius={[0, 4, 4, 0]}>
                                    {stats.segmentBars.map((entry, i) => (
                                        <Cell key={i} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Improvement Tips */}
            <div className="card" style={{ border: '1px solid rgba(168,85,247,0.2)', background: 'var(--gradient-brand-subtle)' }}>
                <div className="card-title">💡 Quick Tips</div>
                {stats.segmentBars.slice(0, 3).map((seg, i) => (
                    <div key={i} style={{ display: 'flex', gap: '12px', padding: '10px 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
                        <span style={{
                            width: '24px', height: '24px', borderRadius: '50%',
                            background: i === 0 ? 'linear-gradient(135deg, #ef4444, #f97316)' : 'var(--bg-card)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '12px', fontWeight: 700
                        }}>{i + 1}</span>
                        <div>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: seg.color }}>
                                {seg.emoji} {seg.name} — {seg.score}%
                            </span>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                {getTip(seg.name, seg.score)}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function getTip(segment, score) {
    const tips = {
        'Left Arm': 'Focus on matching arm extension and angle. Try slowing down the reference to study arm positions.',
        'Right Arm': 'Watch the reference arm position frame by frame. Keep elbows at the right angle.',
        'Left Leg': 'Pay attention to leg placement and knee bend. Footwork is often the trickiest part.',
        'Right Leg': 'Match the reference leg positioning. Try stepping through the moves slowly first.',
        'Torso': 'Your core alignment is key. Keep your shoulders and hips aligned with the reference.',
        'Head': 'Head position affects the overall look. Try maintaining the reference angle naturally.',
    };

    if (score >= 80) return `${segment} looks great! Keep up the excellent form.`;
    return tips[segment] || 'Try slowing down the reference and practicing one move at a time.';
}

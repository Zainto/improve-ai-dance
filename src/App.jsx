import { useState, useCallback, useRef, useEffect } from 'react';
import VideoPlayer from './components/VideoPlayer';
import WebcamFeed from './components/WebcamFeed';
import ScoreDisplay from './components/ScoreDisplay';
import SessionSummary from './components/SessionSummary';
import { comparePoses } from './utils/poseSimilarity';
import { generateVoiceCue, setAudioCoachEnabled, resetAudioCoach } from './utils/audioCoach';

const VIEWS = { WELCOME: 'welcome', PRACTICE: 'practice', SUMMARY: 'summary' };

export default function App() {
    const [view, setView] = useState(VIEWS.WELCOME);
    const [videoFile, setVideoFile] = useState(null);
    const [videoName, setVideoName] = useState('');
    const [isActive, setIsActive] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [mirrored, setMirrored] = useState(true);
    const [comparison, setComparison] = useState(null);
    const [sessionData, setSessionData] = useState([]);
    const [sessionTime, setSessionTime] = useState(0);
    const [voiceCoach, setVoiceCoach] = useState(true);

    const videoPlayerRef = useRef(null);
    const webcamRef = useRef(null);
    const comparisonLoopRef = useRef(null);
    const sessionTimerRef = useRef(null);
    const sampleCountRef = useRef(0);
    const [dragging, setDragging] = useState(false);

    // ─── File Upload ───
    const handleFileUpload = useCallback((file) => {
        if (!file || !file.type.startsWith('video/')) return;
        setVideoFile(file);
        setVideoName(file.name);
        setView(VIEWS.PRACTICE);
        setSessionData([]);
        setComparison(null);
        setSessionTime(0);
        setIsActive(false);
    }, []);

    const handleFileInput = (e) => {
        const file = e.target.files?.[0];
        if (file) handleFileUpload(file);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFileUpload(file);
    };

    // ─── Start / Stop Session ───
    const handleStart = useCallback(() => {
        setIsActive(true);
        setSessionData([]);
        setComparison(null);
        setSessionTime(0);
        sampleCountRef.current = 0;
        resetAudioCoach();

        // Start reference video
        if (videoPlayerRef.current) {
            videoPlayerRef.current.seekTo(0);
            videoPlayerRef.current.play();
        }

        // Session timer
        sessionTimerRef.current = setInterval(() => {
            setSessionTime(t => t + 1);
        }, 1000);

        // Comparison loop — compare poses every ~100ms
        comparisonLoopRef.current = setInterval(() => {
            const refPose = videoPlayerRef.current?.getCurrentPose();
            const userPose = webcamRef.current?.getCurrentPose();

            if (refPose && userPose) {
                const result = comparePoses(refPose, userPose);
                if (result) {
                    setComparison(result);

                    // Real-time voice coaching
                    generateVoiceCue(result, refPose, userPose);

                    // Sample every 3rd comparison for session history
                    sampleCountRef.current++;
                    if (sampleCountRef.current % 3 === 0) {
                        setSessionData(prev => [...prev, result]);
                    }
                }
            }
        }, 100);
    }, []);

    const handleStop = useCallback(() => {
        setIsActive(false);
        resetAudioCoach();

        if (videoPlayerRef.current) {
            videoPlayerRef.current.pause();
        }

        if (comparisonLoopRef.current) {
            clearInterval(comparisonLoopRef.current);
            comparisonLoopRef.current = null;
        }

        if (sessionTimerRef.current) {
            clearInterval(sessionTimerRef.current);
            sessionTimerRef.current = null;
        }

        // Show summary if we have enough data
        if (sessionData.length > 5) {
            setView(VIEWS.SUMMARY);
        }
    }, [sessionData]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (comparisonLoopRef.current) clearInterval(comparisonLoopRef.current);
            if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
        };
    }, []);

    // Auto-stop when reference video ends
    useEffect(() => {
        if (!isActive) return;

        const checkEnd = setInterval(() => {
            const video = videoPlayerRef.current?.getVideo();
            if (video && video.ended) {
                handleStop();
            }
        }, 500);

        return () => clearInterval(checkEnd);
    }, [isActive, handleStop]);

    const formatTime = (s) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    };

    return (
        <div className="app">
            {/* Header */}
            <header className="app-header">
                <div className="logo">
                    <div className="logo-icon">💃</div>
                    <div>
                        <div className="logo-text">DanceCoach AI</div>
                        <div className="logo-tag">Real-Time Dance Feedback</div>
                    </div>
                </div>
                <nav className="nav">
                    <button
                        className={`nav-btn ${view === VIEWS.WELCOME ? 'active' : ''}`}
                        onClick={() => { setIsActive(false); setView(VIEWS.WELCOME); }}
                    >Home</button>
                    <button
                        className={`nav-btn ${view === VIEWS.PRACTICE ? 'active' : ''}`}
                        onClick={() => videoFile && setView(VIEWS.PRACTICE)}
                    >Practice</button>
                </nav>
            </header>

            {/* ─── Welcome ─── */}
            {view === VIEWS.WELCOME && (
                <div className="welcome fade-in" id="welcome">
                    <div className="welcome-icon">💃</div>
                    <h1 className="welcome-title">DanceCoach AI</h1>
                    <p className="welcome-sub">
                        See yourself dance better — in real time. Upload any dance video, and our AI will
                        compare your movements body-part by body-part, showing you exactly where to improve.
                        No app install needed, all AI runs in your browser.
                    </p>

                    <div className="features">
                        <div className="card feature">
                            <div className="feature-icon">🎯</div>
                            <div className="feature-title">Body-Part Scoring</div>
                            <div className="feature-desc">See exactly which limbs match and which need work — arms, legs, torso, head</div>
                        </div>
                        <div className="card feature">
                            <div className="feature-icon">⚡</div>
                            <div className="feature-title">Real-Time Feedback</div>
                            <div className="feature-desc">Live side-by-side comparison at 20+ FPS with color-coded skeleton</div>
                        </div>
                        <div className="card feature">
                            <div className="feature-icon">🔒</div>
                            <div className="feature-title">Privacy First</div>
                            <div className="feature-desc">All AI runs in your browser — your video never leaves your device</div>
                        </div>
                    </div>

                    {/* Upload zone */}
                    <div
                        className={`upload-zone ${dragging ? 'dragging' : ''}`}
                        onClick={() => document.getElementById('file-input').click()}
                        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={handleDrop}
                        id="upload-zone"
                    >
                        <div className="upload-icon">📁</div>
                        <div className="upload-text">Drop a dance video here</div>
                        <div className="upload-hint">or click to browse • MP4, MOV, WebM</div>
                        <input
                            id="file-input"
                            type="file"
                            accept="video/*"
                            onChange={handleFileInput}
                            style={{ display: 'none' }}
                        />
                    </div>

                    <div style={{
                        marginTop: '40px',
                        display: 'flex',
                        gap: '28px',
                        fontSize: '13px',
                        color: 'var(--text-muted)',
                        flexWrap: 'wrap',
                        justifyContent: 'center'
                    }}>
                        <div>🆓 100% free to use</div>
                        <div>📷 Just a webcam needed</div>
                        <div>🧠 33-point body tracking</div>
                    </div>
                </div>
            )}

            {/* ─── Practice ─── */}
            {view === VIEWS.PRACTICE && (
                <div className="fade-in">
                    {/* Split screen */}
                    <div className="split-screen">
                        <VideoPlayer
                            ref={videoPlayerRef}
                            videoFile={videoFile}
                            speed={speed}
                        />
                        <WebcamFeed
                            ref={webcamRef}
                            isActive={isActive}
                            segmentScores={comparison?.segments}
                            mirrored={mirrored}
                        />
                    </div>

                    {/* Score Display */}
                    <ScoreDisplay comparison={comparison} />

                    {/* Controls */}
                    <div className="controls-bar card" style={{ padding: '12px 20px' }}>
                        <div className="controls-group">
                            {isActive ? (
                                <button className="btn btn-danger" onClick={handleStop} id="stop-btn">
                                    ⏹ Stop Session
                                </button>
                            ) : (
                                <button className="btn btn-primary btn-lg" onClick={handleStart} id="start-btn">
                                    ▶ Start Dancing
                                </button>
                            )}

                            {/* New video */}
                            <button
                                className="btn btn-outline"
                                onClick={() => {
                                    setIsActive(false);
                                    document.getElementById('file-input-practice').click();
                                }}
                            >
                                📁 New Video
                            </button>
                            <input
                                id="file-input-practice"
                                type="file"
                                accept="video/*"
                                onChange={handleFileInput}
                                style={{ display: 'none' }}
                            />
                        </div>

                        <div className="controls-group">
                            {/* Speed */}
                            {[0.5, 0.75, 1].map(s => (
                                <button
                                    key={s}
                                    className={`speed-btn ${speed === s ? 'active' : ''}`}
                                    onClick={() => setSpeed(s)}
                                >
                                    {s}×
                                </button>
                            ))}

                            {/* Mirror */}
                            <button
                                className={`toggle-btn ${mirrored ? 'active' : ''}`}
                                onClick={() => setMirrored(!mirrored)}
                            >
                                🪞 Mirror
                            </button>

                            {/* Voice Coach */}
                            <button
                                className={`toggle-btn ${voiceCoach ? 'active' : ''}`}
                                onClick={() => {
                                    const next = !voiceCoach;
                                    setVoiceCoach(next);
                                    setAudioCoachEnabled(next);
                                }}
                            >
                                {voiceCoach ? '🔊' : '🔇'} Voice Coach
                            </button>
                        </div>

                        <div className="controls-group">
                            {isActive && <span className="timer">⏱ {formatTime(sessionTime)}</span>}
                            {videoName && (
                                <span style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    🎵 {videoName}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Summary ─── */}
            {view === VIEWS.SUMMARY && (
                <SessionSummary
                    sessionData={sessionData}
                    onClose={() => setView(VIEWS.PRACTICE)}
                />
            )}
        </div>
    );
}

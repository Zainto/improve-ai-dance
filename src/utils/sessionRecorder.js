/**
 * Session Recorder — Records the user's webcam during practice
 * using MediaRecorder API. Stores as Blob for playback.
 */

let mediaRecorder = null;
let recordedChunks = [];
let recordingBlob = null;
let recordingUrl = null;

/**
 * Start recording the webcam stream
 * @param {MediaStream} stream - The webcam stream to record
 */
export function startRecording(stream) {
    if (!stream || !window.MediaRecorder) return false;

    try {
        recordedChunks = [];
        recordingBlob = null;
        if (recordingUrl) { URL.revokeObjectURL(recordingUrl); recordingUrl = null; }

        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
            ? 'video/webm;codecs=vp9'
            : MediaRecorder.isTypeSupported('video/webm')
                ? 'video/webm'
                : 'video/mp4';

        mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2000000 });

        mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                recordedChunks.push(e.data);
            }
        };

        mediaRecorder.onstop = () => {
            recordingBlob = new Blob(recordedChunks, { type: mimeType });
            recordingUrl = URL.createObjectURL(recordingBlob);
        };

        mediaRecorder.start(1000); // Capture in 1s chunks
        return true;
    } catch (err) {
        console.error('Failed to start recording:', err);
        return false;
    }
}

/**
 * Stop recording and finalize the blob
 * @returns {Promise<string|null>} URL of the recorded video
 */
export function stopRecording() {
    return new Promise((resolve) => {
        if (!mediaRecorder || mediaRecorder.state === 'inactive') {
            resolve(recordingUrl);
            return;
        }

        mediaRecorder.onstop = () => {
            const mimeType = mediaRecorder.mimeType || 'video/webm';
            recordingBlob = new Blob(recordedChunks, { type: mimeType });
            if (recordingUrl) URL.revokeObjectURL(recordingUrl);
            recordingUrl = URL.createObjectURL(recordingBlob);
            resolve(recordingUrl);
        };

        mediaRecorder.stop();
    });
}

/**
 * Get the recording URL (available after stopRecording)
 */
export function getRecordingUrl() {
    return recordingUrl;
}

/**
 * Get the recording Blob
 */
export function getRecordingBlob() {
    return recordingBlob;
}

/**
 * Cleanup recording data
 */
export function clearRecording() {
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    recordingUrl = null;
    recordingBlob = null;
    recordedChunks = [];
    mediaRecorder = null;
}

/**
 * Check if recording is supported
 */
export function isRecordingSupported() {
    return typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined';
}

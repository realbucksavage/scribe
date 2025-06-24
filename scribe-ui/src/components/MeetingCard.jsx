import React, {useState, useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import {meetingsApi} from '../services/api';

// Make sure you have FontAwesome loaded globally in your app, e.g. via CDN or npm package

const blinkingStyle = `
  @keyframes blinker {
    50% { opacity: 0; }
  }
`;

const buttonBaseStyle = {
    borderRadius: 0, // no rounding
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
    cursor: 'pointer',
};

const MeetingCard = ({meeting, onMeetingUpdated}) => {
    const navigate = useNavigate();
    const [isStopping, setIsStopping] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [duration, setDuration] = useState('00:00:00');

    const isActive = !meeting.stoppedAt;

    const handleClick = () => {
        navigate(`/transcript/${meeting.id}`);
    };

    useEffect(() => {
        if (!meeting.startedAt) return;

        const start = new Date(meeting.startedAt).getTime();

        function updateDuration() {
            const end = meeting.stoppedAt ? new Date(meeting.stoppedAt).getTime() : Date.now();
            const diffMs = end - start;

            const totalSeconds = Math.floor(diffMs / 1000);
            const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
            const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
            const seconds = String(totalSeconds % 60).padStart(2, '0');
            setDuration(`${hours}:${minutes}:${seconds}`);
        }

        updateDuration();

        if (isActive) {
            const interval = setInterval(updateDuration, 1000);
            return () => clearInterval(interval);
        }
    }, [meeting.startedAt, meeting.stoppedAt, isActive]);

    const handleStopRecording = async (e) => {
        e.stopPropagation();
        if (isStopping) return;

        setIsStopping(true);
        try {
            await meetingsApi.stopMeeting(meeting.id);
            if (onMeetingUpdated) onMeetingUpdated();
        } catch (error) {
            console.error('Error stopping recording:', error);
        } finally {
            setIsStopping(false);
        }
    };

    const handleDeleteRecording = async (e) => {
        e.stopPropagation();
        if (isDeleting) return;

        setIsDeleting(true);
        try {
            await meetingsApi.deleteMeeting(meeting.id);
            if (onMeetingUpdated) onMeetingUpdated();
        } catch (error) {
            console.error('Error deleting recording:', error);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDownloadRecording = async (e) => {
        e.stopPropagation();
        if (isDownloading) return;

        setIsDownloading(true);
        try {
            await meetingsApi.downloadRecording(meeting.id);
        } catch (error) {
            console.error('Error downloading recording:', error);
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <>
            <style>{blinkingStyle}</style>

            <div
                onClick={handleClick}
                className="card"
                style={{
                    cursor: 'pointer',
                    transition: 'all 0.15s ease-in-out',
                    borderLeft: isActive ? '3px solid #4f8cc9' : '3px solid transparent',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    // much lighter shadow on hover
                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.07)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                }}
                title="Click to view transcript"
            >
                <div className="card-body">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                        <h5
                            className="mb-0 fw-medium"
                            style={{display: 'flex', alignItems: 'center', gap: '8px'}}
                        >
                            {meeting.title || 'Untitled Meeting'}

                            {isActive && (
                                <span
                                    aria-label="Recording active"
                                    title="Recording active"
                                    style={{
                                        display: 'inline-block',
                                        width: 12,
                                        height: 12,
                                        borderRadius: '50%',
                                        backgroundColor: '#e06c75',
                                        animation: 'blinker 1.2s linear infinite',
                                    }}
                                />
                            )}
                        </h5>

                        <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                            {isActive && (
                                <span
                                    className="text-xs fw-medium px-2 py-1"
                                    style={{
                                        backgroundColor: '#4f8cc9',
                                        color: '#282c34',
                                        borderRadius: 12,
                                        border: '1px solid #3a75b8',
                                    }}
                                >
                  Active
                </span>
                            )}

                            {meeting.recordingReady && (
                                <span
                                    className="badge badge-recording"
                                    style={{
                                        backgroundColor: '#98c379',
                                        color: '#282c34',
                                        border: '1px solid #6a8e45'
                                    }}
                                >
                  Recording Ready
                </span>
                            )}

                            {meeting.transcriptionReady && (
                                <span
                                    className="badge badge-transcripts"
                                    style={{
                                        backgroundColor: '#e5c07b',
                                        color: '#282c34',
                                        border: '1px solid #b59245',
                                    }}
                                >
                  Transcripts Ready
                </span>
                            )}
                        </div>
                    </div>

                    <div className="text-sm text-muted mb-2">
                        <div className="mb-1">
                            <span className="fw-medium">Started:</span>{' '}
                            {new Date(meeting.startedAt).toLocaleString()}
                        </div>
                        {meeting.stoppedAt && (
                            <div>
                                <span className="fw-medium">Stopped:</span>{' '}
                                {new Date(meeting.stoppedAt).toLocaleString()}
                            </div>
                        )}
                    </div>

                    <div className="text-sm text-muted mb-3" aria-live="polite">
                        <span className="fw-medium">Duration:</span> {duration}
                    </div>

                    <div className="d-flex gap-2">
                        {isActive && (
                            <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                onClick={handleStopRecording}
                                disabled={isStopping}
                                title="Stop recording"
                                style={buttonBaseStyle}
                                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.12)')}
                                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
                            >
                                <i className="fas fa-stop"/>
                                {isStopping ? 'Stopping...' : 'Stop Recording'}
                            </button>
                        )}

                        {meeting.recordingReady && (
                            <button
                                type="button"
                                className="btn btn-sm btn-success"
                                onClick={handleDownloadRecording}
                                disabled={isDownloading}
                                title="Download recording"
                                style={buttonBaseStyle}
                                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.12)')}
                                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
                            >
                                <i className="fas fa-download"/>
                                {isDownloading ? 'Downloading...' : 'Download Recording'}
                            </button>
                        )}

                        <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={handleDeleteRecording}
                            disabled={isDeleting}
                            title="Delete recording"
                            style={buttonBaseStyle}
                            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.12)')}
                            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
                        >
                            <i className="fas fa-trash-alt"/>
                            {isDeleting ? 'Deleting...' : 'Delete Recording'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default MeetingCard;

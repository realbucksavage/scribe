import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { meetingsApi } from '../services/api';

const speakerColors = [
  '#4f8cc9',
  '#28a745',
  '#ffc107',
  '#17a2b8',
  '#dc3545',
  '#6c757d',
];

const MeetingTranscriptPage = () => {
  const { id } = useParams();
  const location = useLocation();

  const [meeting, setMeeting] = useState(location.state?.meeting || null);
  const [error, setError] = useState(null);
  const [speakerMap, setSpeakerMap] = useState({});
  const [audio, setAudio] = useState(null);
  const [showTimestamps, setShowTimestamps] = useState(false);
  const [playingSegmentIndex, setPlayingSegmentIndex] = useState(null);
  const [showTranslated, setShowTranslated] = useState(false);

  const handleLanguageToggle = () => {
    setShowTranslated(prev => !prev);
  };

  const audioRef = useRef(null);
  const segmentRefs = useRef({});

  // Load meeting data if not passed via location.state
  useEffect(() => {
    if (!meeting) {
      meetingsApi.getMeeting(id)
          .then(setMeeting)
          .catch(err => setError(err.response?.data?.detail || 'Failed to load meeting'));
    }
  }, [id, meeting]);

  // Build speaker to index map for coloring badges
  useEffect(() => {
    if (meeting?.transcriptionSegments) {
      const uniqueSpeakers = [...new Set(meeting.transcriptionSegments.map(s => s.speaker))];
      const map = {};
      uniqueSpeakers.forEach((speaker, idx) => { map[speaker] = idx; });
      setSpeakerMap(map);
    }
  }, [meeting]);

  // Fetch audio blob and create URL
  const fetchAudio = async () => {
    try {
      const blob = await meetingsApi.getRecording(id);
      const audioUrl = URL.createObjectURL(blob);
      setAudio(audioUrl);
    } catch (err) {
      console.error('Failed to load audio', err);
    }
  };

  // Fetch audio if recording is ready
  useEffect(() => {
    if (meeting?.recordingReady) {
      fetchAudio();
    }
  }, [meeting]);

  // Format seconds as mm:ss
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Play audio from segment start time
  const playSegment = (segment, index) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = segment.start;
    audioRef.current.play();
    setPlayingSegmentIndex(index);
  };

  // Update playing segment based on current audio time
  const handleTimeUpdate = () => {
    if (!audioRef.current || !meeting?.transcriptionSegments) return;
    const currentTime = audioRef.current.currentTime;
    const segments = meeting.transcriptionSegments;

    let currentIndex = null;
    for (let i = 0; i < segments.length; i++) {
      const start = segments[i].start;
      const end = i + 1 < segments.length ? segments[i + 1].start : (audioRef.current.duration || start + 10);
      if (currentTime >= start && currentTime < end) {
        currentIndex = i;
        break;
      }
    }
    if (currentIndex !== playingSegmentIndex) {
      setPlayingSegmentIndex(currentIndex);
    }
  };

  // Scroll active segment into view
  useEffect(() => {
    if (playingSegmentIndex === null) return;
    const el = segmentRefs.current[playingSegmentIndex];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [playingSegmentIndex]);

  // Group consecutive segments by speaker
  const groupedConsecutiveBySpeaker = () => {
    if (!meeting?.transcriptionSegments) return [];
    const groups = [];
    let currentGroup = null;

    meeting.transcriptionSegments.forEach((seg, idx) => {
      if (!currentGroup || currentGroup.speaker !== seg.speaker) {
        if (currentGroup) groups.push(currentGroup);
        currentGroup = { speaker: seg.speaker, segments: [] };
      }
      currentGroup.segments.push({ ...seg, index: idx });
    });

    if (currentGroup) groups.push(currentGroup);
    return groups;
  };

  // Render colored speaker badge
  const renderSpeakerBadge = (speakerId) => {
    const speakerIdx = speakerMap[speakerId] ?? 0;
    const color = speakerColors[speakerIdx % speakerColors.length];
    return (
        <div
            style={{
              backgroundColor: color,
              color: 'white',
              width: '24px',
              height: '24px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: '600',
              marginRight: '0.5rem',
              flexShrink: 0
            }}
            aria-label={`Speaker ${speakerIdx + 1}`}
        >
          {speakerIdx + 1}
        </div>
    );
  };

  if (error) {
    return (
        <div className="container">
          <div style={{
            backgroundColor: '#f8d7da',
            color: '#721c24',
            padding: '1rem',
            borderRadius: '4px',
            border: '1px solid #f5c6cb'
          }}>
            {error}
          </div>
        </div>
    );
  }

  if (!meeting) {
    return (
        <div className="container">
          <div className="text-center py-4 text-muted">Loading meeting...</div>
        </div>
    );
  }

  const groups = groupedConsecutiveBySpeaker();

  return (
      <div className="container" style={{ maxWidth: '1400px' }}>
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
          {/* Main transcript area */}
          <div style={{ flex: '1', minWidth: '0' }}>
            <div className="card">
              <div className="card-header">
                <div className="d-flex justify-content-between align-items-center">
                  <span className="fw-medium">Meeting Transcript</span>

                  <div className="d-flex align-items-center gap-3">
                    <label className="d-flex align-items-center gap-2 text-sm" style={{ cursor: 'pointer' }}>
                      <input
                          type="checkbox"
                          checked={showTimestamps}
                          onChange={() => setShowTimestamps(v => !v)}
                          style={{ cursor: 'pointer' }}
                      />
                      Show timestamps
                    </label>

                    <label className="d-flex align-items-center gap-2 text-sm" style={{ cursor: 'pointer' }}>
                      <input
                          type="checkbox"
                          checked={showTranslated}
                          onChange={handleLanguageToggle}
                          style={{ cursor: 'pointer' }}
                      />
                      Show translated text
                    </label>
                  </div>
                </div>
              </div>

              <div className="card-body">
                {audio && (
                    <audio
                        ref={audioRef}
                        src={audio}
                        controls
                        style={{
                          width: '100%',
                          marginBottom: '1.5rem',
                          height: '40px'
                        }}
                        onTimeUpdate={handleTimeUpdate}
                        onPause={() => setPlayingSegmentIndex(null)}
                        onEnded={() => setPlayingSegmentIndex(null)}
                    />
                )}

                <div style={{
                  maxHeight: '70vh',
                  overflowY: 'auto',
                  border: '1px solid #e9ecef',
                  borderRadius: '4px',
                  padding: '1rem'
                }}>
                  {groups.map(({ speaker, segments }, i) => {
                    const speakerNum = speakerMap[speaker] ?? 0;
                    return (
                        <div key={i} style={{ marginBottom: '1.5rem' }}>
                          <div className="d-flex align-items-center mb-2">
                            {renderSpeakerBadge(speaker)}
                            <span className="fw-medium">Speaker {speakerNum + 1}</span>
                          </div>
                          {segments.map(({ index, start }) => {
                            const isActive = index === playingSegmentIndex;
                            // Use showTranslated toggle to decide text to show:
                            const displayText = showTranslated
                                ? meeting.transcriptionSegments[index].trans || ''
                                : meeting.transcriptionSegments[index].text || '';

                            return (
                                <div
                                    key={index}
                                    ref={el => (segmentRefs.current[index] = el)}
                                    onClick={() => playSegment({ start }, index)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        playSegment({ start }, index);
                                      }
                                    }}
                                    tabIndex={0}
                                    style={{
                                      padding: '0.75rem',
                                      marginBottom: '0.25rem',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      transition: 'background-color 0.15s ease-in-out, border-left-color 0.15s ease-in-out',
                                      backgroundColor: isActive ? '#d9eaff' : 'transparent',
                                      color: isActive ? '#000' : 'inherit',
                                      borderLeft: isActive ? '4px solid #4f8cc9' : '4px solid transparent',
                                    }}
                                    onMouseEnter={e => {
                                      if (!isActive) {
                                        e.target.style.backgroundColor = '#f0f4ff';
                                      }
                                    }}
                                    onMouseLeave={e => {
                                      if (!isActive) {
                                        e.target.style.backgroundColor = 'transparent';
                                      }
                                    }}
                                    aria-label={`Speaker ${speakerNum + 1} at ${formatTime(start)}. Click to play.`}
                                >
                                  <p className="mb-0 text-sm" style={{
                                    lineHeight: '1.5',
                                    whiteSpace: 'pre-wrap',
                                    color: isActive ? '#000' : 'inherit',
                                  }}>
                                    {displayText.trim()}
                                  </p>
                                  {showTimestamps && (
                                      <p className="mb-0 text-xs text-muted mt-1">
                                        {formatTime(start)}
                                      </p>
                                  )}
                                </div>
                            );
                          })}
                        </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div style={{ width: '300px', flexShrink: 0 }}>
            <div className="card">
              <div className="card-header">
                <span className="fw-medium">Meeting Details</span>
              </div>
              <div className="card-body">
                <div className="text-sm" style={{ lineHeight: '1.6' }}>
                  <div className="mb-2">
                    <span className="fw-medium text-muted">Title:</span><br />
                    {meeting.title}
                  </div>
                  <div className="mb-2">
                    <span className="fw-medium text-muted">Started:</span><br />
                    {new Date(meeting.startedAt).toLocaleString()}
                  </div>
                  <div className="mb-2">
                    <span className="fw-medium text-muted">Stopped:</span><br />
                    {meeting.stoppedAt ? new Date(meeting.stoppedAt).toLocaleString() : 'Active'}
                  </div>
                  <div className="mb-2">
                    <span className="fw-medium text-muted">Duration:</span><br />
                    {Math.floor((new Date(meeting.stoppedAt || new Date()) - new Date(meeting.startedAt)) / 1000 / 60)} minutes
                  </div>
                  <div className="mb-2">
                    <span className="fw-medium text-muted">Recording:</span><br />
                    <span style={{ color: meeting.recordingReady ? '#28a745' : '#6c757d' }}>
                    {meeting.recordingReady ? 'Available' : 'Not Available'}
                  </span>
                  </div>
                  <div className="mb-3">
                    <span className="fw-medium text-muted">Transcript:</span><br />
                    <span style={{ color: meeting.transcriptionReady ? '#28a745' : '#6c757d' }}>
                    {meeting.transcriptionReady ? 'Available' : 'Not Available'}
                  </span>
                  </div>
                  {meeting.recordingReady && !audio && (
                      <button
                          className="btn btn-primary btn-sm"
                          onClick={fetchAudio}
                      >
                        Load Recording
                      </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
};

export default MeetingTranscriptPage;

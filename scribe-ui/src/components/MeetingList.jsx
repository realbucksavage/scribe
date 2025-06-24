import React from 'react';
import MeetingCard from './MeetingCard';

const MeetingList = ({ meetings, loading, onRefresh, onMeetingUpdated }) => {
    const completedMeetings = meetings.filter(m => m.stoppedAt);
    const activeMeetings = meetings.filter(m => !m.stoppedAt);

    return (
        <div className="card">
            <div className="card-header">
                <div className="d-flex justify-content-between align-items-center">
                    <span className="fw-medium">Meetings ({meetings.length})</span>
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={onRefresh}
                        disabled={loading}
                    >
                        {loading ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>
            </div>

            <div className="card-body">
                {loading && meetings.length === 0 ? (
                    <div className="text-center py-4 text-muted">
                        <div className="mb-2">Loading meetings...</div>
                    </div>
                ) : meetings.length === 0 ? (
                    <div className="text-center py-4 text-muted">
                        <div className="mb-2">No meetings yet</div>
                        <div className="text-xs">Start your first meeting above!</div>
                    </div>
                ) : (
                    <>
                        {activeMeetings.length > 0 && (
                            <div className="mb-4">
                                <h6 className="fw-medium mb-3" style={{ color: '#4f8cc9' }}>
                                    Active Meetings
                                </h6>
                                <div className="mb-3">
                                    {activeMeetings.map(meeting => (
                                        <div key={meeting.id} className="mb-3">
                                            <MeetingCard
                                                meeting={meeting}
                                                onMeetingUpdated={onMeetingUpdated}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {completedMeetings.length > 0 && (
                            <div>
                                <h6 className="fw-medium mb-3" style={{ color: '#6c757d' }}>
                                    Completed Meetings
                                </h6>
                                <div>
                                    {completedMeetings.map(meeting => (
                                        <div key={meeting.id} className="mb-3">
                                            <MeetingCard
                                                meeting={meeting}
                                                onMeetingUpdated={onMeetingUpdated}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {meetings.length > 0 && (
                <div className="card-footer">
                    <div className="d-flex justify-content-between text-sm">
                        <div className="text-muted">
                            <span className="fw-medium">{meetings.length}</span> Total
                        </div>
                        <div style={{ color: '#6c757d' }}>
                            <span className="fw-medium">{completedMeetings.length}</span> Completed
                        </div>
                        <div style={{ color: '#4f8cc9' }}>
                            <span className="fw-medium">{activeMeetings.length}</span> Active
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MeetingList;

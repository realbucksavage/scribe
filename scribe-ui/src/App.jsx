import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { meetingsApi } from './services/api';
import ErrorAlert from './components/ErrorAlert';
import CreateMeeting from './components/CreateMeeting';
import MeetingList from './components/MeetingList';
import TranscriptPage from './components/MeetingTranscriptPage';

function App() {
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchMeetings = async () => {
        try {
            setLoading(true);
            const data = await meetingsApi.getAllMeetings();
            setMeetings(data);
            setError('');
        } catch (err) {
            setError(err.response?.data?.detail || err.message || 'Failed to fetch meetings');
        } finally {
            setLoading(false);
        }
    };

    const handleMeetingAction = async (action) => {
        try {
            await action();
            await fetchMeetings();
        } catch (err) {
            setError(err.response?.data?.detail || err.message || 'An error occurred');
        }
    };

    useEffect(() => {
        fetchMeetings();
        const interval = setInterval(fetchMeetings, 30000);
        return () => clearInterval(interval);
    }, []);

    const activeMeeting = meetings.find(m => !m.stoppedAt);

    return (
        <Router>
            <div className="app">
                {/* Sticky page header */}
                <div
                    className="page-header"
                    style={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 1000,
                        backgroundColor: '#282c34',
                        color: '#fff',
                        borderBottom: '1px solid #444',
                    }}
                >
                    <div className="container">
                        <h1 className="page-title" style={{ color: '#61dafb', cursor: 'pointer' }}>
                            <Link to="/" style={{ color: '#61dafb', textDecoration: 'none' }}>
                                scribe
                            </Link>
                        </h1>
                    </div>
                </div>

                <div className="container" style={{ marginTop: '1rem' }}>
                    <Routes>
                        <Route
                            path="/"
                            element={
                                <>
                                    <ErrorAlert error={error} onClose={() => setError('')} />

                                    <CreateMeeting
                                        onMeetingCreated={() => handleMeetingAction(() => Promise.resolve())}
                                        activeMeeting={activeMeeting}
                                    />

                                    <MeetingList
                                        meetings={meetings}
                                        loading={loading}
                                        onRefresh={fetchMeetings}
                                        onMeetingUpdated={() => handleMeetingAction(() => Promise.resolve())}
                                    />
                                </>
                            }
                        />
                        <Route path="/transcript/:id" element={<TranscriptPage />} />
                    </Routes>
                </div>
            </div>
        </Router>
    );
}

export default App;

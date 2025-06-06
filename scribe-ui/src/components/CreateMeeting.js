import React, { useState } from "react";
import { meetingsApi } from "../services/api";

const CreateMeeting = ({ onMeetingCreated, activeMeeting }) => {
    const [title, setTitle] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim()) return;

        try {
            setIsCreating(true);
            await meetingsApi.createMeeting(title);
            setTitle("");
            onMeetingCreated();
        } catch (error) {
            console.error("Failed to create meeting", error);
        } finally {
            setIsCreating(false);
        }
    };

    const isDisabled = isCreating || !!activeMeeting || !title.trim();

    return (
        <div className="card">
            <div className="card-header">
                <span className="fw-medium">Start New Meeting</span>
            </div>
            <div className="card-body">
                <form onSubmit={handleSubmit} className="d-flex gap-3">
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Enter meeting title..."
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        disabled={isCreating || !!activeMeeting}
                        maxLength={100}
                        style={{ flex: 1 }}
                    />
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={isDisabled}
                    >
                        {isCreating ? "Starting..." : "Start Meeting"}
                    </button>
                </form>

                {activeMeeting && (
                    <div className="mt-3 p-3" style={{
                        backgroundColor: '#fff3cd',
                        border: '1px solid #ffeaa7',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                        color: '#856404'
                    }}>
                        <strong>Active Meeting:</strong> Cannot start a new meeting while "{activeMeeting.title}" is running.
                    </div>
                )}
            </div>
        </div>
    );
};

export default CreateMeeting;

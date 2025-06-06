import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

function getFilenameFromHeader(header) {
    if (!header) return null;

    const match = header.match(/filename="?(.+)"?/);
    return match ? match[1] : null;
}

export const meetingsApi = {
    // Get all meetings
    getAllMeetings: async () => {
        const response = await api.get('/meetings');
        return response.data;
    },

    getMeeting: async (meetingId) => {
        const response = await api.get(`/meetings/${meetingId}`)
        return response.data;
    },

    // Create a new meeting
    createMeeting: async (title) => {
        const response = await api.post('/meetings', {title});
        return response.data;
    },

    // Stop a meeting
    stopMeeting: async (meetingId) => {
        const response = await api.post(`/meetings/${meetingId}/stop`);
        return response.data;
    },

    // Delete a meeting
    deleteMeeting: async (meetingId) => {
        await api.delete(`/meetings/${meetingId}`);
    },

    downloadRecording: async (meetingId) => {
        const response = await api.get(`/meetings/${meetingId}/recording`, {responseType: "blob"});
        const blob = new Blob([response.data], {type: response.headers['content-type']});
        const filename = getFilenameFromHeader(response.headers['content-disposition']) || 'recording.webm';

        // Create download link
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
    },
    getRecording: async (meetingId) => {
        const response = await api.get(`/meetings/${meetingId}/recording`, {responseType: "blob"});
        return new Blob([response.data], {type: response.headers['content-type']})
    }
};

export default api;
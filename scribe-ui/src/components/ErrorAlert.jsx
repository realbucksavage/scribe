import React from 'react';

const ErrorAlert = ({ error, onClose }) => {
    if (!error) return null;

    return (
        <div role="alert" className="error-alert">
            <i className="fas fa-exclamation-circle error-icon" aria-hidden="true"></i>
            <span className="error-message">{error}</span>
            <button onClick={onClose} aria-label="Close alert" className="error-close-btn">
                &times;
            </button>
        </div>
    );
};

export default ErrorAlert;

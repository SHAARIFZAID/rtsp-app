

// frontend/src/ControlPanel.jsx

import React, { useState } from 'react';

function ControlPanel({ overlays, onCreate, onDelete, onStartStream, onStopStream }) {
  const [newText, setNewText] = useState(''); 

  const handleCreateText = () => {
    if (newText.trim() === '') return;
    onCreate({ type: 'text', content: newText });
    setNewText('');
  };

  const handleUploadLogo = () => {
    onCreate({ type: 'image', content: 'https://via.placeholder.com/150x50.png?text=Logo' });
  };

  return (
    <div className="control-panel">
      <div className="panel-section">
        <h3>1. Start Stream</h3>
        <div className="input-group">
          <input 
            type="text" 
            placeholder="Using local test.mp4" 
            disabled={true}
          />
          <button className="connect-btn" onClick={onStartStream}>Connect</button>
          <button className="stop-btn" onClick={onStopStream}>Stop</button>
        </div>
      </div>
      <div className="panel-section">
        <h3>2. Add New Overlay</h3>
        <div className="input-group">
          <input 
            type="text" 
            placeholder="New Text Overlay Content" 
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
          />
        </div>
        <div className="button-group">
          <button className="add-text-btn" onClick={handleCreateText}>Add Text Overlay</button>
          <button className="upload-logo-btn" onClick={handleUploadLogo}>Upload Logo</button>
        </div>
      </div>
      <div className="panel-section">
        <h3>3. Saved Overlays</h3>
        <ul className="overlay-list">
          {overlays.length > 0 ? overlays.map(overlay => (
            <li key={overlay._id}>
              <span>[{overlay.type}] {overlay.content.substring(0, 20)}...</span>
              <button className="delete-btn" onClick={() => onDelete(overlay._id)}>🗑️</button>
            </li>
          )) : (
            <li className="no-overlays-msg">No overlays saved yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

export default ControlPanel;

// frontend/src/App.jsx

import React, { useState, useEffect } from 'react';
import VideoViewport from './VideoViewport'; 
import ControlPanel from './ControlPanel';   
import './App.css'; 

const API_URL = 'http://localhost:5001/api/overlays';
const STREAM_API_URL_BASE = 'http://localhost:5001/api';

function App() {
  const [overlays, setOverlays] = useState([]);
  const [apiMessage, setApiMessage] = useState('Connecting to API...');
  const [loading, setLoading] = useState(true);
  const [currentStreamUrl, setCurrentStreamUrl] = useState(null);

  const fetchOverlays = () => {
    fetch(API_URL).then(res => res.json()).then(data => {
        if (data.error) setApiMessage(`❌ Error: ${data.error}`);
        else setOverlays(data);
    }).catch(err => setApiMessage(`❌ API Connection Failed: ${err.message}`));
  };

  useEffect(() => {
    fetchOverlays();
    setLoading(false);
  }, []);

  const handleCreate = (newOverlayData) => { fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newOverlayData) }).then(() => fetchOverlays()); };
  const handleDelete = (id) => { fetch(`${API_URL}/${id}`, { method: 'DELETE' }).then(() => fetchOverlays()); };
  const handleUpdate = (id, updatedFields) => { fetch(`${API_URL}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedFields) }).then(() => fetchOverlays()); };

  const handleStartStream = () => {
      setApiMessage('Requesting stream from backend...');
      fetch(`${STREAM_API_URL_BASE}/start_rtsp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}), // Body is empty as backend uses local file
      })
      .then(res => res.json())
      .then(data => {
          if (data.error) {
              setApiMessage(`❌ Stream error: ${data.error}`);
              setCurrentStreamUrl(null);
          } else {
              // FINAL FIX: Wait 3 seconds before updating the URL
              setApiMessage('✅ Backend started stream. Waiting for video files...');
              setTimeout(() => {
                setCurrentStreamUrl(data.hls_url);
                setApiMessage('✅ Stream is ready. Press play.');
              }, 3000); // 3-second delay
          }
      })
      .catch(err => {
          setApiMessage(`❌ Network error: ${err.message}`);
      });
  };

  const handleStopStream = () => {
      fetch(`${STREAM_API_URL_BASE}/stop_rtsp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      .then(() => {
          setCurrentStreamUrl(null);
          setApiMessage('Stream stopped.');
      });
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="rtsp-app">
      <h1>RTSP Livestream & Overlay Manager</h1>
      <p className={`api-status ${apiMessage.includes('❌') ? 'error' : 'success'}`}>{apiMessage}</p>
      <div className="main-layout">
        <VideoViewport 
          overlays={overlays} 
          onUpdate={handleUpdate} 
          streamUrl={currentStreamUrl}
        />
        <ControlPanel 
          overlays={overlays}
          onCreate={handleCreate}
          onDelete={handleDelete}
          onStartStream={handleStartStream}
          onStopStream={handleStopStream}
        />
      </div>
    </div>
  );
}

export default App;
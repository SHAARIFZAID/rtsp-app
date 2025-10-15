
// frontend/src/VideoViewport.jsx

import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { Rnd } from 'react-rnd';

function VideoViewport({ overlays, onUpdate, streamUrl }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {
          console.log("User interaction is needed to play the video.");
        });
      });
      return () => { // Cleanup on component unmount
        hls.destroy();
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video.addEventListener('canplay', () => {
        video.play().catch(() => {
          console.log("User interaction is needed to play the video.");
        });
      });
    }
  }, [streamUrl]);

  const handleStop = (id, x, y, width, height) => {
    const updatedFields = { x, y, width, height };
    onUpdate(id, updatedFields);
  };

  return (
    <div className="video-viewport">
      {streamUrl && <span className="live-badge">🔴 LIVE</span>} 
      <div className="player-wrapper">
        <video ref={videoRef} controls autoPlay muted style={{ width: '100%', height: '100%', backgroundColor: '#000' }} />
        
        {overlays.map(overlay => (
          <Rnd
            key={overlay._id} 
            default={{
              x: overlay.x || 50,
              y: overlay.y || 50,
              width: overlay.width || 200,
              height: overlay.height || 50,
            }}
            onDragStop={(e, d) => handleStop(overlay._id, d.x, d.y, overlay.width, overlay.height)}
            onResizeStop={(e, d, ref, delta, pos) => handleStop(overlay._id, pos.x, pos.y, parseInt(ref.style.width), parseInt(ref.style.height))}
            bounds=".player-wrapper" 
            className="custom-overlay" 
          >
            {overlay.type === 'text' 
                ? <div className="overlay-text">{overlay.content}</div>
                : <img src={overlay.content} alt="Logo" className="overlay-image" />
            }
          </Rnd>
        ))}
      </div>
    </div>
  );
}

export default VideoViewport;
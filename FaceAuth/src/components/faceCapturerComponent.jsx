// src/components/FaceCaptureContainer.js

import React from 'react';

export const FaceCaptureContainer = ({ videoRef, canvasRef }) => (
  <div className='face-container' style={{ marginTop: 18 }}>
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className='video-el'
      style={{ transform: 'scaleX(-1)' }} // Mirror the video for user comfort
    />
    <canvas ref={canvasRef} className='overlay-canvas' />
  </div>
);

// src/components/FaceCaptureContainer.js

import React from 'react';

export const FaceCaptureContainer = ({ videoRef, canvasRef }) => (
  <div className='face-container'>
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className='video-el'
      style={{ transform: 'scaleX(-1)' }}
    />
    <canvas ref={canvasRef} className='overlay-canvas' />
  </div>
);

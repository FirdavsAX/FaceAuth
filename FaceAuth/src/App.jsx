// src/App.js

import React, { useState } from 'react';
import * as faceapi from 'face-api.js';
import './App.css'; // Keep original CSS
import { FaceCaptureContainer } from './components/faceCapturerComponent';
import { useFaceDetection } from './services/useFaceDetection';

export default function App() {
  const [username, setUsername] = useState('');

  // Use the custom hook to get all video/face logic, status, and control function
  const { videoRef, canvasRef, status, modelsLoaded, captureDescriptor } =
    useFaceDetection();

  // localStatus/state for UI messages (auth/register results)
  const [localStatus, setLocalStatus] = useState('');

  // --- Face Authentication Logic (Cleaned up) ---

  const registerFace = async () => {
    const name = username.trim();
    if (!name) {
      alert('Enter a username before registering.');
      return;
    }

    const desc = await captureDescriptor();
    if (!desc) {
      alert('No face captured. Check camera and try again.');
      return;
    }

    const arr = Array.from(desc);
    const stored = JSON.parse(localStorage.getItem('faceAuthUsers') || '{}');
    stored[name] = arr;
    localStorage.setItem('faceAuthUsers', JSON.stringify(stored));

    const msg = `Registered ${name} (${arr.length} dims)`;
    setLocalStatus(`✅ ${msg}`);
    alert(msg);
    setUsername('');
  };

  const loginWithFace = async () => {
    const stored = JSON.parse(localStorage.getItem('faceAuthUsers') || '{}');
    const names = Object.keys(stored);
    if (names.length === 0) {
      setLocalStatus('No registered users. Register first.');
      alert('No registered users. Register first.');
      return;
    }

    const desc = await captureDescriptor();
    if (!desc) {
      alert('No face captured. Check camera and try again.');
      return;
    }

    const labeledDescriptors = names.map((n) => {
      const floats = new Float32Array(stored[n]);
      return new faceapi.LabeledFaceDescriptors(n, [floats]);
    });

    const matcher = new faceapi.FaceMatcher(labeledDescriptors, 0.6);
    const best = matcher.findBestMatch(desc);

    if (best.label === 'unknown') {
      const msg = `No match (distance ${best.distance.toFixed(2)})`;
      setLocalStatus(`❌ ${msg}`);
      alert(msg);
    } else {
      const msg = `Authenticated as ${
        best.label
      } (distance ${best.distance.toFixed(2)})`;
      setLocalStatus(`✅ ${msg}`);
      alert(msg);
      // optional: localStorage.setItem('loggedInUser', best.label);
    }
  };

  const clearUsers = () => {
    localStorage.removeItem('faceAuthUsers');
    setLocalStatus('🗑 Cleared all registered users');
  };

  return (
    <div id='root'>
      <h1>FaceAuth — Register and Login with Face</h1>

      {/* camera / detection status (from hook) */}
      <p className='read-the-docs' style={{ marginBottom: 4 }}>
        Camera: {status}
      </p>

      {/* auth/register status (from app actions) */}
      {localStatus && (
        <p className='read-the-docs' style={{ fontWeight: 600 }}>
          {localStatus}
        </p>
      )}

      <div
        style={{
          maxWidth: 760,
          margin: '0 auto',
          display: 'flex',
          gap: 14,
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}
      >
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder='Username for registration'
          disabled={!modelsLoaded}
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.02)',
            color: 'inherit',
          }}
        />
        <button
          onClick={registerFace}
          disabled={!modelsLoaded}
          style={{ padding: '10px 14px', borderRadius: 8 }}
        >
          Register Face
        </button>
        <button
          onClick={loginWithFace}
          disabled={!modelsLoaded}
          style={{ padding: '10px 14px', borderRadius: 8 }}
        >
          Login with Face
        </button>
        <button
          onClick={clearUsers}
          style={{ padding: '10px 14px', borderRadius: 8 }}
        >
          Clear Users
        </button>
      </div>

      {/* Render the dedicated visual component */}
      <FaceCaptureContainer videoRef={videoRef} canvasRef={canvasRef} />

      <div className='card'>
        <p className='read-the-docs'>
          <strong>Info:</strong> Models served from <code>/models</code>. Keep
          camera steady during capture for best results.
        </p>
      </div>
    </div>
  );
}

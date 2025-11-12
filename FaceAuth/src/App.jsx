// src/App.js

import React, { useState } from 'react';
import * as faceapi from 'face-api.js';
import './App.css';
import { FaceCaptureContainer } from './components/faceCapturerComponent';
import { useFaceDetection } from './services/useFaceDetection';

export default function App() {
  const [username, setUsername] = useState('');
  const { videoRef, canvasRef, status, modelsLoaded, captureDescriptor } =
    useFaceDetection();
  const [localStatus, setLocalStatus] = useState('');

  const drawMatchLabel = (canvas, box, text) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    // small background
    const padding = 6;
    const fontSize = Math.max(12, Math.round(canvas.width / 60));
    ctx.font = `${fontSize}px sans-serif`;
    const textWidth = ctx.measureText(text).width;
    const tx = Math.max(4, box.x);
    const ty = Math.max(fontSize + 8, box.y - 8);
    ctx.fillStyle = 'rgba(2,6,23,0.7)';
    ctx.fillRect(
      tx - padding,
      ty - fontSize - padding / 2,
      textWidth + padding * 2,
      fontSize + padding
    );
    ctx.fillStyle = '#bde9d8';
    ctx.fillText(text, tx, ty);
  };

  const registerFace = async () => {
    const name = username.trim();
    if (!name) {
      setLocalStatus('Enter username to register');
      return;
    }
    const capture = await captureDescriptor();
    if (!capture) {
      setLocalStatus('No face captured');
      return;
    }

    const arr = Array.from(capture.descriptor);
    const storedRaw = JSON.parse(localStorage.getItem('faceAuthUsers') || '{}');

    // ensure array of samples per user
    if (!storedRaw[name]) storedRaw[name] = [];
    storedRaw[name].push(arr);
    localStorage.setItem('faceAuthUsers', JSON.stringify(storedRaw));

    setLocalStatus(`Registered ${name} (samples: ${storedRaw[name].length})`);
    setUsername('');
    alert(`Registered ${name}`);
  };

  const loginWithFace = async () => {
    const storedRaw = JSON.parse(localStorage.getItem('faceAuthUsers') || '{}');
    const names = Object.keys(storedRaw);
    if (names.length === 0) {
      setLocalStatus('No users registered');
      alert('No users registered');
      return;
    }

    const capture = await captureDescriptor();
    if (!capture) {
      setLocalStatus('No face captured');
      return;
    }

    // build labeled descriptors (multiple samples per user)
    const labeled = names.map((n) => {
      const arrs = storedRaw[n] || [];
      const feats = arrs.map((a) => new Float32Array(a));
      return new faceapi.LabeledFaceDescriptors(n, feats);
    });

    const matcher = new faceapi.FaceMatcher(labeled, 0.6);
    const best = matcher.findBestMatch(capture.descriptor);

    if (best.label === 'unknown') {
      setLocalStatus(`No match (distance ${best.distance.toFixed(2)})`);
      alert('No match found');
    } else {
      const msg = `Authenticated: ${best.label} (dist ${best.distance.toFixed(
        2
      )})`;
      setLocalStatus(msg);
      alert(msg);
      // draw name on canvas near face box
      const canvas = canvasRef.current;
      // clear previous overlays then draw label
      if (canvas) {
        const ctx = canvas.getContext('2d');
        // keep existing overlay drawings from loop; add label on top
        drawMatchLabel(canvas, capture.box, best.label);
      }
    }
  };

  const clearUsers = () => {
    localStorage.removeItem('faceAuthUsers');
    setLocalStatus('Cleared users');
    alert('Cleared registered users');
  };

  return (
    <div id='root' className='app-root'>
      <div className='header'>
        <h1>FaceAuth</h1>
        <div className='status-badges'>
          <span className={`badge ${modelsLoaded ? 'ok' : 'loading'}`}>
            {modelsLoaded ? 'Models ready' : 'Loading models'}
          </span>
          <span className='badge'>Camera: {status}</span>
        </div>
      </div>

      {localStatus && <div className='notice'>{localStatus}</div>}

      <div className='controls'>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder='Username for registration'
          disabled={!modelsLoaded}
          className='input'
        />
        <button
          onClick={registerFace}
          disabled={!modelsLoaded}
          className='btn primary'
        >
          Register Face
        </button>
        <button
          onClick={loginWithFace}
          disabled={!modelsLoaded}
          className='btn'
        >
          Login with Face
        </button>
        <button onClick={clearUsers} className='btn danger'>
          Clear Users
        </button>
      </div>

      <FaceCaptureContainer videoRef={videoRef} canvasRef={canvasRef} />

      <footer className='footer'>
        Models are served from /models — this is a local demo. For production
        use a backend, secure storage and consent.
      </footer>
    </div>
  );
}

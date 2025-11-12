// src/App.js

import React, { useState } from 'react';
import * as faceapi from 'face-api.js';
import './App.css';
import { FaceCaptureContainer } from './components/faceCapturerComponent';
import { useFaceDetection } from './services/useFaceDetection';

export default function App() {
  const { videoRef, canvasRef, status, modelsLoaded, captureDescriptor } =
    useFaceDetection();
  const [localStatus, setLocalStatus] = useState('');
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [modalName, setModalName] = useState('');
  const [registering, setRegistering] = useState(false);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const startRegisterFlow = () => {
    setModalName('');
    setShowRegisterModal(true);
  };

  const doRegister = async (name) => {
    if (!name || !name.trim()) {
      setLocalStatus('Enter a valid name');
      return;
    }
    setShowRegisterModal(false);
    setRegistering(true);

    const samples = 3; // number of captures per user
    const storedRaw = JSON.parse(localStorage.getItem('faceAuthUsers') || '{}');
    if (!storedRaw[name]) storedRaw[name] = [];

    try {
      for (let i = 0; i < samples; i++) {
        setLocalStatus(`Capturing sample ${i + 1}/${samples} — hold still`);
        // small countdown for user
        for (let c = 3; c > 0; c--) {
          setLocalStatus(`Capturing sample ${i + 1}/${samples} in ${c}...`);
          await sleep(700);
        }

        const capture = await captureDescriptor();
        if (!capture) {
          setLocalStatus('No face detected. Try again.');
          setRegistering(false);
          return;
        }
        storedRaw[name].push(Array.from(capture.descriptor));

        // briefly draw label on canvas
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx.save();
          ctx.fillStyle = 'rgba(2,6,23,0.7)';
          ctx.fillRect(8, 8, 160, 34);
          ctx.fillStyle = '#bde9d8';
          ctx.font = '14px sans-serif';
          ctx.fillText(`Sample ${i + 1} captured`, 16, 30);
          ctx.restore();
        }

        await sleep(600);
      }

      localStorage.setItem('faceAuthUsers', JSON.stringify(storedRaw));
      setLocalStatus(`Registered ${name} (${storedRaw[name].length} samples)`);
      alert(`Registered ${name}`);
    } catch (err) {
      console.error(err);
      setLocalStatus('Registration error');
      alert('Registration error: ' + (err.message || err));
    } finally {
      setRegistering(false);
    }
  };

  const loginWithFace = async () => {
    const storedRaw = JSON.parse(localStorage.getItem('faceAuthUsers') || '{}');
    const names = Object.keys(storedRaw);
    if (names.length === 0) {
      setLocalStatus('No users registered');
      alert('No users registered');
      return;
    }

    setLocalStatus('Capturing for authentication — hold still');
    const capture = await captureDescriptor();
    if (!capture) {
      setLocalStatus('No face captured');
      return;
    }

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

      // draw label on canvas near face box
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        // draw background + text
        const tx = Math.max(8, capture.box.x);
        const ty = Math.max(24, capture.box.y - 8);
        ctx.fillStyle = 'rgba(2,6,23,0.7)';
        ctx.fillRect(tx - 6, ty - 18, 140, 22);
        ctx.fillStyle = '#bde9d8';
        ctx.font = '14px sans-serif';
        ctx.fillText(best.label, tx, ty);
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
        <button
          onClick={startRegisterFlow}
          disabled={!modelsLoaded || registering}
          className='btn primary'
        >
          Register Face
        </button>
        <button
          onClick={loginWithFace}
          disabled={!modelsLoaded || registering}
          className='btn'
        >
          Login with Face
        </button>
        <button
          onClick={clearUsers}
          disabled={registering}
          className='btn danger'
        >
          Clear Users
        </button>
      </div>

      <FaceCaptureContainer videoRef={videoRef} canvasRef={canvasRef} />

      <footer className='footer'>
        Models are served from /models — this is a local demo. For production
        use a backend, secure storage and consent.
      </footer>

      {/* Register modal */}
      {showRegisterModal && (
        <div
          className='modal-overlay'
          onClick={() => !registering && setShowRegisterModal(false)}
        >
          <div className='modal' onClick={(e) => e.stopPropagation()}>
            <h3>Register Face</h3>
            <input
              value={modalName}
              onChange={(e) => setModalName(e.target.value)}
              placeholder='Enter name'
              disabled={registering}
              className='input'
            />
            <div
              style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-end',
                marginTop: 12,
              }}
            >
              <button
                onClick={() => setShowRegisterModal(false)}
                className='btn'
                disabled={registering}
              >
                Cancel
              </button>
              <button
                onClick={() => doRegister(modalName)}
                className='btn primary'
                disabled={registering || !modalName.trim()}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

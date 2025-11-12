import React, { useRef, useEffect, useState } from 'react';
import * as faceapi from 'face-api.js';
import './App.css';

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [status, setStatus] = useState('Loading models...');
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [username, setUsername] = useState('');

  // tiny face options used by both live loop and single-capture
  const detectorOptions = new faceapi.TinyFaceDetectorOptions({
    inputSize: 224,
    scoreThreshold: 0.4,
  });

  useEffect(() => {
    let detectInterval;
    let stream;

    async function loadAndStart() {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
          faceapi.nets.faceExpressionNet.loadFromUri('/models'),
          faceapi.nets.ageGenderNet.loadFromUri('/models'),
        ]);
        setModelsLoaded(true);
        setStatus('Models loaded — starting camera…');

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setStatus('Camera started — ready');

        // optional overlay loop (keeps showing landmarks/expressions)
        const videoEl = videoRef.current;
        const canvas = canvasRef.current;

        const resizeCanvas = () => {
          if (!videoEl || !canvas) return;
          canvas.width = videoEl.videoWidth || videoEl.clientWidth || 640;
          canvas.height = videoEl.videoHeight || videoEl.clientHeight || 480;
        };
        resizeCanvas();
        videoEl.addEventListener('loadedmetadata', resizeCanvas);
        window.addEventListener('resize', resizeCanvas);

        detectInterval = setInterval(async () => {
          if (!videoEl || videoEl.paused || videoEl.ended) return;
          const detections = await faceapi
            .detectAllFaces(videoEl, detectorOptions)
            .withFaceLandmarks()
            .withFaceExpressions()
            .withAgeAndGender();

          const displaySize = {
            width: videoEl.videoWidth,
            height: videoEl.videoHeight,
          };
          faceapi.matchDimensions(canvas, displaySize);
          const resized = faceapi.resizeResults(detections, displaySize);

          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          faceapi.draw.drawDetections(canvas, resized);
          faceapi.draw.drawFaceLandmarks(canvas, resized);
          faceapi.draw.drawFaceExpressions(canvas, resized);
        }, 150);
      } catch (err) {
        console.error(err);
        setStatus('Error loading models or camera: ' + (err.message || err));
      }
    }

    loadAndStart();

    return () => {
      clearInterval(detectInterval);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // helper: capture single face descriptor from current video frame
  async function captureDescriptor() {
    if (!modelsLoaded) {
      setStatus('Models not loaded yet');
      return null;
    }
    const videoEl = videoRef.current;
    if (!videoEl) return null;

    setStatus('Capturing face — please hold still');
    const result = await faceapi
      .detectSingleFace(videoEl, detectorOptions)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!result) {
      setStatus('No face detected. Try again.');
      return null;
    }
    setStatus('Face captured');
    return result.descriptor; // Float32Array
  }

  // register: store descriptor under username in localStorage
  async function registerFace() {
    const name = (username || '').trim();
    if (!name) {
      setStatus('Enter a username before registering.');
      return;
    }
    const desc = await captureDescriptor();
    if (!desc) return;
    // serialize Float32Array -> Array of numbers
    const arr = Array.from(desc);
    const stored = JSON.parse(localStorage.getItem('faceAuthUsers') || '{}');
    stored[name] = arr;
    localStorage.setItem('faceAuthUsers', JSON.stringify(stored));
    setStatus(`Registered ${name} (${Math.round(arr.length)} dims)`);
    setUsername('');
  }

  // login: capture descriptor and match against stored labeled descriptors
  async function loginWithFace() {
    const stored = JSON.parse(localStorage.getItem('faceAuthUsers') || '{}');
    const names = Object.keys(stored);
    if (names.length === 0) {
      setStatus('No registered users. Register first.');
      return;
    }

    const desc = await captureDescriptor();
    if (!desc) return;

    // build LabeledFaceDescriptors
    const labeledDescriptors = names.map((n) => {
      const floats = new Float32Array(stored[n]);
      return new faceapi.LabeledFaceDescriptors(n, [floats]);
    });

    const matcher = new faceapi.FaceMatcher(labeledDescriptors, 0.6); // 0.6 threshold
    const best = matcher.findBestMatch(desc);
    if (best.label === 'unknown') {
      setStatus(`No match (distance ${best.distance.toFixed(2)}).`);
    } else {
      setStatus(
        `Authenticated as ${best.label} (distance ${best.distance.toFixed(2)}).`
      );
      // here you can set session, redirect, etc.
      // localStorage.setItem('loggedInUser', best.label);
    }
  }

  return (
    <div id='root'>
      <h1>FaceAuth — Register and Login with Face</h1>
      <p className='read-the-docs'>{status}</p>

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
          style={{
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.02)',
            color: 'inherit',
          }}
        />
        <button
          onClick={registerFace}
          style={{ padding: '10px 14px', borderRadius: 8 }}
        >
          Register Face
        </button>
        <button
          onClick={loginWithFace}
          style={{ padding: '10px 14px', borderRadius: 8 }}
        >
          Login with Face
        </button>
        <button
          onClick={() => {
            localStorage.removeItem('faceAuthUsers');
            setStatus('Cleared registered users');
          }}
          style={{ padding: '10px 14px', borderRadius: 8 }}
        >
          Clear Users
        </button>
      </div>

      <div className='face-container' style={{ marginTop: 18 }}>
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

      <div className='card'>
        <p className='read-the-docs'>
          Models served from /models. Keep camera steady during capture for best
          results.
        </p>
      </div>
    </div>
  );
}

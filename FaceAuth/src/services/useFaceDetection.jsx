// src/hooks/useFaceDetection.js

import { useRef, useEffect, useState, useCallback } from 'react';
import * as faceapi from 'face-api.js';

const detectorOptions = new faceapi.TinyFaceDetectorOptions({
  inputSize: 224,
  scoreThreshold: 0.4,
});

export const useFaceDetection = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [status, setStatus] = useState('Initializing...');
  const [modelsLoaded, setModelsLoaded] = useState(false);

  // --- Initial Setup and Continuous Detection ---
  useEffect(() => {
    let detectInterval;
    let stream;

    const initFaceApi = async () => {
      try {
        setStatus('Loading face detection models...');
        // Load all necessary models
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
          faceapi.nets.faceExpressionNet.loadFromUri('/models'),
          faceapi.nets.ageGenderNet.loadFromUri('/models'),
        ]);
        setModelsLoaded(true);
        setStatus('Models loaded — starting camera...');

        // Get video stream
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setStatus('Camera ready ✅');

        const videoEl = videoRef.current;
        const canvas = canvasRef.current;

        const resizeCanvas = () => {
          if (!videoEl || !canvas) return;
          const width = videoEl.videoWidth || 640;
          const height = videoEl.videoHeight || 480;
          canvas.width = width;
          canvas.height = height;
        };

        videoEl.addEventListener('loadedmetadata', resizeCanvas);
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        // Main detection loop for drawing
        detectInterval = setInterval(async () => {
          if (!videoEl || videoEl.paused || videoEl.ended) return;

          const detections = await faceapi
            .detectAllFaces(videoEl, detectorOptions)
            .withFaceLandmarks()
            .withFaceExpressions()
            .withAgeAndGender();

          const displaySize = { width: canvas.width, height: canvas.height };
          const resized = faceapi.resizeResults(detections, displaySize);

          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Draw detections on canvas
          faceapi.draw.drawDetections(canvas, resized);
          faceapi.draw.drawFaceLandmarks(canvas, resized);
          faceapi.draw.drawFaceExpressions(canvas, resized);
          // faceapi.draw.draw.drawAgeAndGender(canvas, resized); // Optional: add age/gender drawing
        }, 150); // Run detection every 150ms
      } catch (err) {
        console.error('Face API Initialization Error:', err);
        setStatus(
          `❌ Error: ${err.message || 'Failed to initialize Face API.'}`
        );
      }
    };

    initFaceApi();

    // Cleanup function
    return () => {
      clearInterval(detectInterval);
      window.removeEventListener('resize', () => {});
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []); // Empty dependency array means this runs only on mount/unmount

  // --- Capture Face Descriptor Function ---
  const captureDescriptor = useCallback(async () => {
    if (!modelsLoaded) {
      setStatus('⚠️ Models not loaded yet');
      return null;
    }
    const videoEl = videoRef.current;
    if (!videoEl) return null;

    setStatus('Capturing face — please hold still...');
    // Detect single face with landmarks and descriptor
    const result = await faceapi
      .detectSingleFace(videoEl, detectorOptions)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!result) {
      setStatus('No face detected. Try again.');
      return null;
    }

    setStatus('✅ Face captured successfully');
    // Return the face descriptor (Float32Array)
    return result.descriptor;
  }, [modelsLoaded]);

  // Return values for the consumer component (App.js)
  return {
    videoRef,
    canvasRef,
    status,
    modelsLoaded,
    captureDescriptor,
  };
};

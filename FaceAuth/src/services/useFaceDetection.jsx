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

  useEffect(() => {
    let detectInterval;
    let stream;

    const initFaceApi = async () => {
      try {
        setStatus('Loading models...');
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
          faceapi.nets.faceExpressionNet.loadFromUri('/models'),
          faceapi.nets.ageGenderNet.loadFromUri('/models'),
        ]);
        setModelsLoaded(true);
        setStatus('Starting camera...');

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus('Camera ready');

        const videoEl = videoRef.current;
        const canvas = canvasRef.current;
        const resizeCanvas = () => {
          if (!videoEl || !canvas) return;
          canvas.width = videoEl.videoWidth || videoEl.clientWidth || 640;
          canvas.height = videoEl.videoHeight || videoEl.clientHeight || 480;
        };
        videoEl.addEventListener('loadedmetadata', resizeCanvas);
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

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

          faceapi.draw.drawDetections(canvas, resized);
          faceapi.draw.drawFaceLandmarks(canvas, resized);
          faceapi.draw.drawFaceExpressions(canvas, resized);
        }, 150);
      } catch (err) {
        console.error('Face API init error', err);
        setStatus('Error: ' + (err.message || err));
      }
    };

    initFaceApi();

    return () => {
      clearInterval(detectInterval);
      window.removeEventListener('resize', () => {});
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const captureDescriptor = useCallback(async () => {
    if (!modelsLoaded) {
      setStatus('Models not loaded');
      return null;
    }
    const videoEl = videoRef.current;
    const canvas = canvasRef.current;
    if (!videoEl || !canvas) {
      setStatus('No video available');
      return null;
    }

    setStatus('Capturing face — hold still');
    try {
      const result = await faceapi
        .detectSingleFace(videoEl, detectorOptions)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!result) {
        setStatus('No face detected');
        return null;
      }

      // Ensure canvas size matches video
      canvas.width = videoEl.videoWidth || canvas.width;
      canvas.height = videoEl.videoHeight || canvas.height;

      setStatus('Face captured');
      return {
        descriptor: result.descriptor, // Float32Array
        box: result.detection.box, // { x, y, width, height } in video coords
      };
    } catch (err) {
      console.error('captureDescriptor error', err);
      setStatus('Capture error');
      return null;
    }
  }, [modelsLoaded]);

  return { videoRef, canvasRef, status, modelsLoaded, captureDescriptor };
};

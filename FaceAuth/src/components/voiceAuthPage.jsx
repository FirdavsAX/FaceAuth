import { useState, useRef } from 'react';
import Recorder from 'recorder-js';
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

export default function VoiceAuthPage() {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [registeredEmbedding, setRegisteredEmbedding] = useState(null);
  const [matchScore, setMatchScore] = useState(null);

  const audioContextRef = useRef(null);
  const recorderRef = useRef(null);

  // 🎤 Start Recording
  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContextRef.current = new (window.AudioContext ||
      window.webkitAudioContext)();
    recorderRef.current = new Recorder(audioContextRef.current, {
      numChannels: 1,
    });
    recorderRef.current.init(stream);
    recorderRef.current.start();
    setRecording(true);
  };

  // ⏹ Stop Recording
  const stopRecording = async () => {
    const { blob } = await recorderRef.current.stop();
    setAudioBlob(blob);
    setRecording(false);
  };

  // 🗣 Speech-to-Text (STT)
  const transcribeAudio = async () => {
    if (!audioBlob) return alert('Record audio first!');

    const file = new File([audioBlob], 'audio.wav', { type: 'audio/wav' });

    const response = await client.audio.transcriptions.create({
      model: 'gpt-4o-mini-tts',
      file,
    });

    setTranscript(response.text);
  };

  // 🧠 Extract Embedding
  const getEmbedding = async (blob) => {
    const file = new File([blob], 'voice.wav', { type: 'audio/wav' });

    const response = await client.embeddings.create({
      model: 'text-embedding-3-large', // works for audio too
      input: file,
    });

    return response.data[0].embedding;
  };

  // 🔐 Register Voice
  const registerVoice = async () => {
    if (!audioBlob) return alert('Record voice first!');

    const embedding = await getEmbedding(audioBlob);
    setRegisteredEmbedding(embedding);

    alert('Voice registered successfully!');
  };

  // 🔍 Verify Voice
  const verifyVoice = async () => {
    if (!audioBlob) return alert('Record new voice!');
    if (!registeredEmbedding) return alert('Register voice first!');

    const newEmbedding = await getEmbedding(audioBlob);

    // Cosine similarity
    const dot = registeredEmbedding
      .map((v, i) => v * newEmbedding[i])
      .reduce((a, b) => a + b, 0);

    const magA = Math.sqrt(
      registeredEmbedding.map((v) => v * v).reduce((a, b) => a + b, 0)
    );
    const magB = Math.sqrt(
      newEmbedding.map((v) => v * v).reduce((a, b) => a + b, 0)
    );

    const similarity = dot / (magA * magB);

    setMatchScore(similarity);
    alert(
      similarity > 0.75 ? 'Voice Match! Authenticated.' : 'Voice NOT matched!'
    );
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>🎤 Voice Authentication Lab</h1>

      <button onClick={recording ? stopRecording : startRecording}>
        {recording ? '⏹ Stop Recording' : '🎙 Start Recording'}
      </button>

      {audioBlob && (
        <div>
          <h3>Audio Preview:</h3>
          <audio controls src={URL.createObjectURL(audioBlob)} />
        </div>
      )}

      <hr />

      <h2>🧠 Speech to Text</h2>
      <button onClick={transcribeAudio}>Transcribe</button>
      <p>
        <b>Transcript:</b> {transcript}
      </p>

      <hr />

      <h2>🔐 Voice Authentication</h2>
      <button onClick={registerVoice}>Register Voice</button>
      <button onClick={verifyVoice}>Verify Voice</button>

      {matchScore && (
        <p>
          Match Score: <b>{matchScore.toFixed(3)}</b>{' '}
          {matchScore > 0.75 ? '✅ (Match)' : '❌ (Not Match)'}
        </p>
      )}
    </div>
  );
}

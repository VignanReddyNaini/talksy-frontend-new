const video = document.getElementById('video');
let char = document.getElementById('char');
let word = document.getElementById('word');
let sentence = document.getElementById('sentence');
let spokenText = document.getElementById('spokenText');
let ttsInput = document.getElementById('ttsInput');
let ttsStatus = document.getElementById('ttsStatus');
let isSignActive = false;
let isSpeechActive = false;
let isTtsActive = false;

// Initialize video stream
if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
  navigator.mediaDevices.getUserMedia({ video: true, audio: false }) // No audio
    .then(stream => {
      video.srcObject = stream;
    })
    .catch(err => console.error('Error accessing media:', err));
}

// Capture video frame as base64
function captureFrame() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;  // Match model input width
  canvas.height = 64; // Match model input height
  const context = canvas.getContext('2d');
  const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
  const x = (canvas.width - video.videoWidth * scale) / 2;
  const y = (canvas.height - video.videoHeight * scale) / 2;
  context.drawImage(video, x, y, video.videoWidth * scale, video.videoHeight * scale);
  return canvas.toDataURL('image/jpeg');
}

// Start sign detection
function startSign() {
  isSignActive = true;
  function sendFrame() {
    if (!isSignActive) return;
    const frameData = captureFrame();
    fetch('https://talksy-backend-fresh.onrender.com/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video: frameData })
    })
    .then(response => {
      if (!response.ok) throw new Error('Network response was not ok');
      return response.json();
    })
    .then(data => {
      char.textContent = data.char || 'Empty';
      word.textContent = data.word || '';
      sentence.textContent = data.sentence || '';
    })
    .catch(err => console.error('Error fetching prediction:', err));
  }
  sendFrame(); // Initial call
  const intervalId = setInterval(sendFrame, 1000); // Update every second
  window.stopSignInterval = () => clearInterval(intervalId);
}

// Stop sign detection
function stopSign() {
  isSignActive = false;
  if (window.stopSignInterval) window.stopSignInterval();
  char.textContent = 'Empty';
  word.textContent = '';
  sentence.textContent = '';
}

// Start speech recognition
function startSpeech() {
  if (!isSpeechActive) {
    isSpeechActive = true;
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      spokenText.textContent = 'Speech recognition not supported in this browser.';
      return;
    }
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      spokenText.textContent = event.results[0][0].transcript;
    };
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech') spokenText.textContent = 'No speech detected. Please speak.';
    };
    recognition.start();
  }
}

// Stop speech recognition
function stopSpeech() {
  isSpeechActive = false;
  if (window.SpeechRecognition || window.webkitSpeechRecognition) {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.stop();
  }
}

// Start text-to-speech
function startTts() {
  if (!isTtsActive) {
    isTtsActive = true;
    ttsStatus.textContent = 'Speaking...';
    const utterance = new SpeechSynthesisUtterance(ttsInput.value || 'No text to speak');
    utterance.onend = () => {
      isTtsActive = false;
      ttsStatus.textContent = 'TTS Inactive';
    };
    utterance.onerror = (event) => {
      console.error('TTS error:', event.error);
      isTtsActive = false;
      ttsStatus.textContent = 'TTS Inactive';
    };
    window.speechSynthesis.speak(utterance);
  }
}

// Stop text-to-speech
function stopTts() {
  isTtsActive = false;
  window.speechSynthesis.cancel();
  ttsStatus.textContent = 'TTS Inactive';
}

// Clear all fields
function clearAll() {
  char.textContent = 'Empty';
  word.textContent = '';
  sentence.textContent = '';
  spokenText.textContent = '';
  ttsInput.value = '';
  ttsStatus.textContent = 'TTS Inactive';
  isSignActive = false;
  isSpeechActive = false;
  isTtsActive = false;
}
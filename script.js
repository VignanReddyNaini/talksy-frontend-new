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
let retryCount = 0;
const MAX_RETRIES = 3;

// Initialize video stream
if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
  navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    .then(stream => {
      video.srcObject = stream;
    })
    .catch(err => {
      console.error('Error accessing media:', err);
      sentence.textContent = 'Camera access denied or unavailable';
    });
}

// Capture video frame as base64
function captureFrame() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  
  // Handle case where video might not be ready
  if (video.videoWidth === 0 || video.videoHeight === 0) {
    context.fillStyle = 'gray';
    context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg');
  }
  
  const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
  const x = (canvas.width - video.videoWidth * scale) / 2;
  const y = (canvas.height - video.videoHeight * scale) / 2;
  context.drawImage(video, x, y, video.videoWidth * scale, video.videoHeight * scale);
  return canvas.toDataURL('image/jpeg');
}

// Send frame to API with retry mechanism
async function sendFrameWithRetry(frameData) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch('https://talksy-backend-fresh.onrender.com/predict', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'omit',
        body: JSON.stringify({ video: frameData })
      });
      
      console.log('API response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      
      return await response.json();
    } catch (err) {
      console.error(`Attempt ${attempt + 1} failed:`, err);
      
      if (attempt === MAX_RETRIES - 1) {
        throw err; // Rethrow if all retries failed
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }
}

// Start sign detection
function startSign() {
  isSignActive = true;
  sentence.textContent = 'Starting sign detection...';
  retryCount = 0;
  
  async function processFrame() {
    if (!isSignActive) return;
    
    try {
      console.log('Preparing to send frame...');
      const frameData = captureFrame();
      console.log('Frame captured, sending to API...');
      
      const data = await sendFrameWithRetry(frameData);
      
      console.log('Prediction data received:', data);
      char.textContent = data.char || 'Empty';
      word.textContent = data.word || '';
      sentence.textContent = data.sentence || '';
      retryCount = 0; // Reset retry count on success
    } catch (err) {
      console.error('Frame processing error:', err);
      retryCount++;
      
      if (retryCount > MAX_RETRIES) {
        sentence.textContent = 'Connection error - backend may be offline';
        // Don't immediately try again, wait for next scheduled attempt
      } else {
        sentence.textContent = `Connection error - retry ${retryCount}/${MAX_RETRIES}`;
      }
    }
    
    // Schedule next frame if still active
    if (isSignActive) {
      setTimeout(processFrame, 1000);
    }
  }
  
  // Start processing frames
  processFrame();
}

// Stop sign detection
function stopSign() {
  isSignActive = false;
  char.textContent = 'Empty';
  word.textContent = '';
  sentence.textContent = 'Sign detection stopped';
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

// Test backend connection on page load
window.addEventListener('load', function() {
  fetch('https://talksy-backend-fresh.onrender.com/', {
    method: 'GET',
    mode: 'cors',
    cache: 'no-cache',
    credentials: 'omit'
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    console.log('Backend API connection test successful:', data);
    sentence.textContent = 'Connected to backend';
  })
  .catch(err => {
    console.error('Backend connection test failed:', err);
    sentence.textContent = 'Backend connection failed - service may be initializing';
  });
});
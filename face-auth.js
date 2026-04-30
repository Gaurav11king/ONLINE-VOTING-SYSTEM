// face-auth.js (browser)
const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const statusText = document.getElementById('status');
const verifyBtn = document.getElementById('verifyBtn');
const voterId = window.voterIdFromTemplate;

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    statusText.textContent = 'Camera started, detecting face...';
    video.addEventListener('playing', onPlay);
  } catch (err) {
    console.error('Camera error:', err);
    statusText.textContent = 'Camera access error: ' + err.name;
  }
}

async function onPlay() {
  const displaySize = { width: video.width, height: video.height };
  faceapi.matchDimensions(canvas, displaySize);

  setInterval(async () => {
    const detections = await faceapi
      .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions());

    const resized = faceapi.resizeResults(detections, displaySize);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    faceapi.draw.drawDetections(canvas, resized);

    if (detections.length > 0) {
      statusText.textContent = 'Face detected. You can verify.';
      verifyBtn.disabled = false;
    } else {
      statusText.textContent = 'No face detected. Please stay in frame.';
      verifyBtn.disabled = true;
    }
  }, 500);
}

verifyBtn.addEventListener('click', async () => {
  verifyBtn.disabled = true;
  statusText.textContent = 'Verifying face...';

  const res = await fetch('/verify-face', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voterId })
  });
  const data = await res.json();
  if (data.success) {
    statusText.textContent = 'Face verified ✅ Redirecting...';
    setTimeout(() => (window.location.href = `/ballot/${voterId}`), 1000);
  } else {
    statusText.textContent = 'Verification failed ❌';
    verifyBtn.disabled = false;
  }
});

startCamera();

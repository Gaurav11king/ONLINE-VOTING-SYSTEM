const video = document.getElementById('video');
const statusText = document.getElementById('status');
const verifyBtn = document.getElementById('verifyBtn');
const voterId = window.voterIdFromTemplate;

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    statusText.textContent = '✅ Camera opened! Auto-verifying...';
    
    // Auto-verify after 1 second delay (so user sees camera working)
    setTimeout(() => {
      autoVerify();
    }, 1000);
    
  } catch (err) {
    console.error('Camera error:', err);
    statusText.textContent = '❌ Camera access denied: ' + err.name;
  }
}

async function autoVerify() {
  verifyBtn.disabled = true;
  statusText.textContent = 'Verifying...';

  const res = await fetch('/verify-face', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voterId })
  });
  
  const data = await res.json();
  
  if (data.success) {
    statusText.textContent = '✅ Verified! Redirecting to ballot...';
    setTimeout(() => {
      window.location.href = `/ballot/${voterId}`;
    }, 800);
  } else {
    statusText.textContent = '❌ Verification failed: ' + (data.error || 'Unknown');
  }
}

startCamera();

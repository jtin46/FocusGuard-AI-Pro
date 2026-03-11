const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const statusText = document.getElementById('status');
const alertAudio = document.getElementById('alert-audio');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const scanLine = document.getElementById('scan-line');

let monitoringInterval;
let canvasContext;
let closedFrameCount = 0; 

// SENSITIVITY SETTINGS
const EYE_CLOSED_THRESHOLD = 0.21; // Adjusted for level head
const REQUIRED_FRAMES = 4;        // Faster response

async function initApp() {
    statusText.innerText = "INITIALIZING CORE MODELS...";
    const MODEL_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
    
    try {
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        startCamera();
    } catch (err) {
        statusText.innerText = "MODEL LOAD ERROR";
    }
}

function startCamera() {
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            video.srcObject = stream;
            video.onloadedmetadata = () => {
                canvas.width = 640;
                canvas.height = 480;
                canvasContext = canvas.getContext('2d');
                faceapi.matchDimensions(canvas, { width: 640, height: 480 });
                scanLine.classList.remove('hidden');
                runDetection();
            };
        });
}

async function runDetection() {
    monitoringInterval = setInterval(async () => {
        // Reduced minConfidence to 0.4 for better tracking when eyes narrow
        const detection = await faceapi.detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
                                        .withFaceLandmarks();

        canvasContext.clearRect(0, 0, canvas.width, canvas.height);

        if (!detection) {
            handleAlert(true, "USER NOT DETECTED");
            return;
        }

        const resized = faceapi.resizeResults(detection, { width: 640, height: 480 });
        const landmarks = resized.landmarks;
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();

        const leftEAR = calculateEAR(leftEye);
        const rightEAR = calculateEAR(rightEye);
        const isClosed = ((leftEAR + rightEAR) / 2) < EYE_CLOSED_THRESHOLD;

        const color = isClosed ? '#ff3e3e' : '#00f2ff';
        drawEye(leftEye, color);
        drawEye(rightEye, color);

        handleAlert(isClosed, "DROWSINESS DETECTED");
    }, 150);
}

function calculateEAR(eye) {
    const v1 = Math.sqrt(Math.pow(eye[1].x - eye[5].x, 2) + Math.pow(eye[1].y - eye[5].y, 2));
    const v2 = Math.sqrt(Math.pow(eye[2].x - eye[4].x, 2) + Math.pow(eye[2].y - eye[4].y, 2));
    const h = Math.sqrt(Math.pow(eye[0].x - eye[3].x, 2) + Math.pow(eye[0].y - eye[3].y, 2));
    return (v1 + v2) / (2.0 * h);
}

function drawEye(eye, color) {
    canvasContext.strokeStyle = color;
    canvasContext.lineWidth = 2;
    canvasContext.beginPath();
    canvasContext.moveTo(eye[0].x, eye[0].y);
    for(let i=1; i<eye.length; i++) canvasContext.lineTo(eye[i].x, eye[i].y);
    canvasContext.closePath();
    canvasContext.stroke();
}

function handleAlert(isDrowsy, msg) {
    if (isDrowsy) {
        closedFrameCount++;
        if (closedFrameCount >= REQUIRED_FRAMES) {
            statusText.innerText = msg;
            statusText.style.color = "#ff3e3e";
            if (alertAudio.paused) alertAudio.play();
        }
    } else {
        closedFrameCount = 0;
        statusText.innerText = "MONITORING: ACTIVE";
        statusText.style.color = "#00f2ff";
        if (!alertAudio.paused) { alertAudio.pause(); alertAudio.currentTime = 0; }
    }
}

startBtn.addEventListener('click', () => {
    alertAudio.play().then(()=>alertAudio.pause());
    initApp();
    startBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
});

stopBtn.addEventListener('click', () => location.reload());
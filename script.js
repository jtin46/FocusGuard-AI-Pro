const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const statusText = document.getElementById('status');
const alertAudio = document.getElementById('alert-audio');
const timerDisplay = document.getElementById('timer');
const alertDisplay = document.getElementById('alert-count');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const scanLine = document.getElementById('scan-line');

let monitoringInterval, timerInterval;
let seconds = 0, minutes = 0, hours = 0;
let totalAlerts = 0;
let closedFrames = 0;
let isAlarming = false;

// SENSITIVITY CALIBRATION
const EAR_THRESHOLD = 0.23; // Higher value = more sensitive to closing
const REQ_FRAMES = 4;        // How many checks before alarm

async function initApp() {
    statusText.innerText = "INITIALIZING MODELS...";
    const MODEL_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
    
    try {
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        startCamera();
        startTimer();
    } catch (e) {
        statusText.innerText = "LOAD ERROR - CHECK CONNECTION";
    }
}

function startCamera() {
    navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            canvas.width = 640; canvas.height = 480;
            faceapi.matchDimensions(canvas, { width: 640, height: 480 });
            scanLine.classList.remove('hidden');
            statusText.innerText = "MONITORING: ACTIVE";
            runDetection();
        };
    });
}

function startTimer() {
    timerInterval = setInterval(() => {
        seconds++;
        if(seconds == 60) { seconds = 0; minutes++; }
        if(minutes == 60) { minutes = 0; hours++; }
        timerDisplay.innerText = 
            `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
    }, 1000);
}

async function runDetection() {
    monitoringInterval = setInterval(async () => {
        // Using TinyFaceDetector for speed/real-time performance
        const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
                                        .withFaceLandmarks();
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!detection) {
            handleAlert(true, "USER DISTRACTED");
            return;
        }

        const landmarks = faceapi.resizeResults(detection, { width: 640, height: 480 }).landmarks;
        const leftEAR = getEAR(landmarks.getLeftEye());
        const rightEAR = getEAR(landmarks.getRightEye());
        const avgEAR = (leftEAR + rightEAR) / 2;

        const isClosed = avgEAR < EAR_THRESHOLD;
        
        // Draw Eyes
        const color = isClosed ? '#ff4757' : '#00f2ff';
        drawEye(ctx, landmarks.getLeftEye(), color);
        drawEye(ctx, landmarks.getRightEye(), color);

        handleAlert(isClosed, "WAKE UP!");
    }, 150);
}

function getEAR(eye) {
    const v1 = Math.sqrt(Math.pow(eye[1].x-eye[5].x,2) + Math.pow(eye[1].y-eye[5].y,2));
    const v2 = Math.sqrt(Math.pow(eye[2].x-eye[4].x,2) + Math.pow(eye[2].y-eye[4].y,2));
    const h = Math.sqrt(Math.pow(eye[0].x-eye[3].x,2) + Math.pow(eye[0].y-eye[3].y,2));
    return (v1 + v2) / (2.0 * h);
}

function drawEye(ctx, eye, color) {
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(eye[0].x, eye[0].y);
    for(let i=1; i<eye.length; i++) ctx.lineTo(eye[i].x, eye[i].y);
    ctx.closePath(); ctx.stroke();
}

function handleAlert(drowsy, msg) {
    if (drowsy) {
        closedFrames++;
        if (closedFrames >= REQ_FRAMES) {
            if(!isAlarming) { totalAlerts++; alertDisplay.innerText = totalAlerts; isAlarming = true; }
            statusText.innerText = msg; statusText.style.color = "#ff4757";
            if (alertAudio.paused) alertAudio.play();
        }
    } else {
        closedFrames = 0; isAlarming = false;
        statusText.innerText = "MONITORING: ACTIVE"; statusText.style.color = "#00f2ff";
        if (!alertAudio.paused) { alertAudio.pause(); alertAudio.currentTime = 0; }
    }
}

startBtn.addEventListener('click', () => {
    alertAudio.play().then(() => alertAudio.pause());
    initApp();
    startBtn.classList.add('hidden'); stopBtn.classList.remove('hidden');
});

stopBtn.addEventListener('click', () => location.reload());
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
let seconds = 0, minutes = 0;
let totalAlerts = 0;
let closedFrames = 0;
let isAlarmActive = false;

// DYNAMIC SENSITIVITY: Lower value for mobile cameras (wider angle)
const EAR_THRESHOLD = window.innerWidth < 768 ? 0.19 : 0.21;
const REQ_FRAMES = 5; // ~1 second of closure

async function initApp() {
    statusText.innerText = "CALIBRATING AI MODELS...";
    const MODEL_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
    
    try {
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        startCamera();
        startTimer();
    } catch (e) {
        statusText.innerText = "LOAD ERROR: CHECK CONNECTION";
    }
}

function startCamera() {
    const constraints = { 
        video: { 
            width: { ideal: 640 }, 
            height: { ideal: 480 }, 
            facingMode: "user" 
        } 
    };

    navigator.mediaDevices.getUserMedia(constraints).then(stream => {
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            const displaySize = { width: video.offsetWidth, height: video.offsetHeight };
            canvas.width = displaySize.width;
            canvas.height = displaySize.height;
            faceapi.matchDimensions(canvas, displaySize);
            
            scanLine.classList.remove('hidden');
            statusText.innerText = "SCANNER ACTIVE";
            runDetection(displaySize);
        };
    });
}

function startTimer() {
    timerInterval = setInterval(() => {
        seconds++;
        if(seconds == 60) { seconds = 0; minutes++; }
        timerDisplay.innerText = `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
    }, 1000);
}

async function runDetection(displaySize) {
    monitoringInterval = setInterval(async () => {
        const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
                                        .withFaceLandmarks();
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!detection) {
            handleAlert(true, "USER NOT FOUND");
            return;
        }

        const landmarks = faceapi.resizeResults(detection, displaySize).landmarks;
        const leftEAR = getEAR(landmarks.getLeftEye());
        const rightEAR = getEAR(landmarks.getRightEye());
        const avgEAR = (leftEAR + rightEAR) / 2;

        const isClosed = avgEAR < EAR_THRESHOLD;
        
        // Draw Eyes (Red if closed, Cyan if open)
        const color = isClosed ? '#ff4757' : '#00f2ff';
        drawEye(ctx, landmarks.getLeftEye(), color);
        drawEye(ctx, landmarks.getRightEye(), color);

        handleAlert(isClosed, "DROWSINESS DETECTED");
    }, 200);
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
            if(!isAlarmActive) { 
                totalAlerts++; 
                alertDisplay.innerText = totalAlerts; 
                isAlarmActive = true; 
            }
            statusText.innerText = msg;
            statusText.style.color = "#ff4757";
            if (alertAudio.paused) alertAudio.play();
        }
    } else {
        closedFrames = 0;
        isAlarmActive = false;
        statusText.innerText = "SCANNER ACTIVE";
        statusText.style.color = "#00f2ff";
        if (!alertAudio.paused) { alertAudio.pause(); alertAudio.currentTime = 0; }
    }
}

startBtn.addEventListener('click', () => {
    // Unlock audio for mobile browsers
    alertAudio.play().then(() => alertAudio.pause());
    initApp();
    startBtn.classList.add('hidden'); 
    stopBtn.classList.remove('hidden');
});

stopBtn.addEventListener('click', () => location.reload());
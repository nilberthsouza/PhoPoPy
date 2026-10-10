'use strict';

/* ============================================================
   PhoPoCopy — PWA camera with pose-overlay + timer
   ============================================================ */

const video = document.getElementById('video');
const overlayImg = document.getElementById('overlayImg');
const captureCanvas = document.getElementById('captureCanvas');
const countdownEl = document.getElementById('countdown');
const flashEl = document.getElementById('flash');
const cameraError = document.getElementById('cameraError');
const cameraErrorDetail = document.getElementById('cameraErrorDetail');
const retryCameraBtn = document.getElementById('retryCameraBtn');

const switchCameraBtn = document.getElementById('switchCameraBtn');
const timerGroup = document.getElementById('timerGroup');
const galleryBtn = document.getElementById('galleryBtn');

const loadOverlayBtn = document.getElementById('loadOverlayBtn');
const overlayFileInput = document.getElementById('overlayFileInput');
const opacityRow = document.getElementById('opacityRow');
const opacitySlider = document.getElementById('opacitySlider');
const opacityValue = document.getElementById('opacityValue');
const clearOverlayBtn = document.getElementById('clearOverlayBtn');
const overlayFitRow = document.getElementById('overlayFitRow');
const samplesRow = document.getElementById('samplesRow');

const shutterBtn = document.getElementById('shutterBtn');
const thumbBtn = document.getElementById('thumbBtn');
const thumbImg = document.getElementById('thumbImg');

const galleryModal = document.getElementById('galleryModal');
const galleryGrid = document.getElementById('galleryGrid');
const galleryEmptyMsg = document.getElementById('galleryEmptyMsg');
const closeGalleryBtn = document.getElementById('closeGalleryBtn');

const photoViewer = document.getElementById('photoViewer');
const viewerImg = document.getElementById('viewerImg');
const closeViewerBtn = document.getElementById('closeViewerBtn');
const downloadPhotoBtn = document.getElementById('downloadPhotoBtn');
const sharePhotoBtn = document.getElementById('sharePhotoBtn');
const deletePhotoBtn = document.getElementById('deletePhotoBtn');

const toastEl = document.getElementById('toast');
const installBtn = document.getElementById('installBtn');

let currentStream = null;
let facingMode = 'environment';
let timerSeconds = 0;
let countdownAbort = false;
let overlayObjectUrl = null;
let viewerCurrentId = null;

/* ---------------- Toast ---------------- */
let toastTimer = null;
function toast(msg, ms = 2200) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add('hidden'), ms);
}

/* ---------------- Camera ---------------- */
async function startCamera() {
  stopCamera();
  cameraError.classList.add('hidden');
  const constraints = {
    audio: false,
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: 1920 },
      height: { ideal: 1080 }
    }
  };
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    currentStream = stream;
    video.srcObject = stream;
    await video.play().catch(() => {});
  } catch (err) {
    console.error('getUserMedia failed', err);
    cameraError.classList.remove('hidden');
    cameraErrorDetail.textContent = err.message || String(err);
  }
}

function stopCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
    currentStream = null;
  }
}

switchCameraBtn.addEventListener('click', () => {
  facingMode = facingMode === 'environment' ? 'user' : 'environment';
  startCamera();
});

retryCameraBtn.addEventListener('click', startCamera);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopCamera();
  } else if (!currentStream) {
    startCamera();
  }
});

/* ---------------- Timer selection ---------------- */
timerGroup.addEventListener('click', (e) => {
  const btn = e.target.closest('.timerBtn');
  if (!btn) return;
  timerGroup.querySelectorAll('.timerBtn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  timerSeconds = parseInt(btn.dataset.timer, 10);
});

/* ---------------- Overlay image + opacity ---------------- */
loadOverlayBtn.addEventListener('click', () => overlayFileInput.click());

overlayFileInput.addEventListener('change', () => {
  const file = overlayFileInput.files[0];
  if (!file) return;
  if (overlayObjectUrl) URL.revokeObjectURL(overlayObjectUrl);
  overlayObjectUrl = URL.createObjectURL(file);
  overlayImg.src = overlayObjectUrl;
  overlayImg.classList.add('visible');
  opacityRow.classList.remove('hidden');
  overlayFitRow.classList.remove('hidden');
  samplesRow.querySelectorAll('.sampleThumb').forEach(b => b.classList.remove('active'));
  applyOpacity();
});

samplesRow.addEventListener('click', (e) => {
  const btn = e.target.closest('.sampleThumb');
  if (!btn) return;
  if (overlayObjectUrl) {
    URL.revokeObjectURL(overlayObjectUrl);
    overlayObjectUrl = null;
  }
  overlayFileInput.value = '';
  overlayImg.src = btn.dataset.src;
  overlayImg.classList.add('visible');
  opacityRow.classList.remove('hidden');
  overlayFitRow.classList.remove('hidden');
  samplesRow.querySelectorAll('.sampleThumb').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyOpacity();
});

function applyOpacity() {
  overlayImg.style.opacity = (parseInt(opacitySlider.value, 10) / 100).toString();
  opacityValue.textContent = `${opacitySlider.value}%`;
}
opacitySlider.addEventListener('input', applyOpacity);

clearOverlayBtn.addEventListener('click', () => {
  overlayImg.classList.remove('visible');
  overlayImg.src = '';
  if (overlayObjectUrl) {
    URL.revokeObjectURL(overlayObjectUrl);
    overlayObjectUrl = null;
  }
  opacityRow.classList.add('hidden');
  overlayFitRow.classList.add('hidden');
  overlayFileInput.value = '';
  samplesRow.querySelectorAll('.sampleThumb').forEach(b => b.classList.remove('active'));
});

overlayFitRow.addEventListener('click', (e) => {
  const btn = e.target.closest('.fitBtn');
  if (!btn) return;
  overlayFitRow.querySelectorAll('.fitBtn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  overlayImg.classList.remove('fit-cover', 'fit-stretch');
  if (btn.dataset.fit === 'cover') overlayImg.classList.add('fit-cover');
  if (btn.dataset.fit === 'stretch') overlayImg.classList.add('fit-stretch');
});

/* ---------------- Capture (with optional countdown) ---------------- */
shutterBtn.addEventListener('click', () => {
  if (shutterBtn.classList.contains('counting')) {
    // tap again to cancel countdown
    countdownAbort = true;
    return;
  }
  runCaptureSequence();
});

async function runCaptureSequence() {
  if (!currentStream) {
    toast('Câmera indisponível');
    return;
  }
  if (timerSeconds > 0) {
    shutterBtn.classList.add('counting');
    countdownAbort = false;
    countdownEl.classList.remove('hidden');
    for (let n = timerSeconds; n > 0; n--) {
      if (countdownAbort) {
        countdownEl.classList.add('hidden');
        shutterBtn.classList.remove('counting');
        return;
      }
      countdownEl.textContent = n;
      await sleep(1000);
    }
    countdownEl.classList.add('hidden');
    shutterBtn.classList.remove('counting');
  }
  takePhoto();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function takePhoto() {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) {
    toast('Câmera ainda inicializando, tente de novo');
    return;
  }
  const elW = video.clientWidth;
  const elH = video.clientHeight;

  // Replicate CSS object-fit:cover cropping so the saved photo matches
  // exactly what is shown on screen (important for pose alignment).
  const scale = Math.max(elW / vw, elH / vh);
  const cropW = elW / scale;
  const cropH = elH / scale;
  const cropX = (vw - cropW) / 2;
  const cropY = (vh - cropH) / 2;

  captureCanvas.width = Math.round(cropW);
  captureCanvas.height = Math.round(cropH);
  const ctx = captureCanvas.getContext('2d');
  ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, captureCanvas.width, captureCanvas.height);

  // Flash effect
  flashEl.classList.add('active');
  setTimeout(() => flashEl.classList.remove('active'), 180);

  captureCanvas.toBlob(async (blob) => {
    if (!blob) {
      toast('Falha ao gerar a foto');
      return;
    }
    const id = await savePhotoToDb(blob);
    updateThumb(blob);
    autoDownload(blob, filenameFor(id));
    toast('Foto salva no dispositivo');
  }, 'image/jpeg', 0.92);
}

function filenameFor(id) {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `PhoPoCopy_${stamp}.jpg`;
}

function autoDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ---------------- IndexedDB photo storage ---------------- */
const DB_NAME = 'phopocopy-db';
const STORE_NAME = 'photos';
let dbPromise = null;

function getDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function savePhotoToDb(blob) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add({ blob, createdAt: Date.now() });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllPhotos() {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result.sort((a, b) => b.createdAt - a.createdAt));
    req.onerror = () => reject(req.error);
  });
}

async function getPhoto(id) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deletePhoto(id) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ---------------- Thumbnail ---------------- */
function updateThumb(blob) {
  const url = URL.createObjectURL(blob);
  thumbImg.src = url;
  thumbImg.classList.add('has-photo');
}

async function refreshThumbFromDb() {
  const photos = await getAllPhotos();
  if (photos.length) updateThumb(photos[0].blob);
}

/* ---------------- Gallery modal ---------------- */
async function openGallery() {
  const photos = await getAllPhotos();
  galleryGrid.innerHTML = '';
  galleryEmptyMsg.classList.toggle('hidden', photos.length > 0);
  for (const p of photos) {
    const url = URL.createObjectURL(p.blob);
    const img = document.createElement('img');
    img.src = url;
    img.dataset.id = p.id;
    galleryGrid.appendChild(img);
  }
  galleryModal.classList.remove('hidden');
}

galleryBtn.addEventListener('click', openGallery);
thumbBtn.addEventListener('click', openGallery);
closeGalleryBtn.addEventListener('click', () => galleryModal.classList.add('hidden'));

galleryGrid.addEventListener('click', (e) => {
  const img = e.target.closest('img');
  if (!img) return;
  openViewer(parseInt(img.dataset.id, 10));
});

/* ---------------- Photo viewer ---------------- */
async function openViewer(id) {
  const record = await getPhoto(id);
  if (!record) return;
  viewerCurrentId = id;
  viewerImg.src = URL.createObjectURL(record.blob);
  sharePhotoBtn.classList.toggle('hidden', !(navigator.canShare && navigator.share));
  photoViewer.classList.remove('hidden');
}

closeViewerBtn.addEventListener('click', () => photoViewer.classList.add('hidden'));

downloadPhotoBtn.addEventListener('click', async () => {
  const record = await getPhoto(viewerCurrentId);
  if (!record) return;
  autoDownload(record.blob, filenameFor(record.id));
  toast('Foto salva no dispositivo');
});

sharePhotoBtn.addEventListener('click', async () => {
  const record = await getPhoto(viewerCurrentId);
  if (!record) return;
  try {
    const file = new File([record.blob], filenameFor(record.id), { type: 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
    } else {
      toast('Compartilhamento não suportado neste navegador');
    }
  } catch (err) {
    if (err.name !== 'AbortError') toast('Falha ao compartilhar');
  }
});

deletePhotoBtn.addEventListener('click', async () => {
  if (viewerCurrentId == null) return;
  await deletePhoto(viewerCurrentId);
  photoViewer.classList.add('hidden');
  toast('Foto excluída');
  await refreshThumbFromDb();
  openGallery();
});

/* ---------------- PWA install prompt ---------------- */
let deferredInstallEvent = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallEvent = e;
  installBtn.classList.remove('hidden');
});

installBtn.addEventListener('click', async () => {
  if (!deferredInstallEvent) return;
  deferredInstallEvent.prompt();
  await deferredInstallEvent.userChoice;
  installBtn.classList.add('hidden');
  deferredInstallEvent = null;
});

window.addEventListener('appinstalled', () => {
  installBtn.classList.add('hidden');
});

/* ---------------- Service worker ---------------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW register failed', err));
  });
}

/* ---------------- Init ---------------- */
startCamera();
refreshThumbFromDb();

// speechSynthesis wrapper with th-TH voice detection and rate control.
let thaiVoice = null;
let voicesLoaded = false;
const listeners = [];

function pickThaiVoice() {
  const voices = speechSynthesis.getVoices();
  // Prefer exact th-TH, then any th, then a voice named Thai.
  thaiVoice =
    voices.find((v) => v.lang === 'th-TH') ||
    voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('th')) ||
    voices.find((v) => /thai/i.test(v.name)) ||
    null;
  voicesLoaded = true;
  listeners.forEach((fn) => fn(hasThaiVoice()));
}

export function initAudio() {
  if (!('speechSynthesis' in window)) { voicesLoaded = true; return; }
  pickThaiVoice();
  // Voices often load asynchronously.
  speechSynthesis.onvoiceschanged = pickThaiVoice;
  // Retry a few times for stubborn browsers.
  let tries = 0;
  const t = setInterval(() => {
    if (thaiVoice || tries++ > 10) { clearInterval(t); }
    else pickThaiVoice();
  }, 300);
}

export function hasThaiVoice() {
  return !!thaiVoice;
}

export function onVoiceStatus(fn) {
  listeners.push(fn);
  if (voicesLoaded) fn(hasThaiVoice());
}

// Speak a Thai string. rate 0.5-1. Cancels any in-flight utterance.
export function speak(thai, rate = 0.9) {
  if (!('speechSynthesis' in window) || !thai) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(thai);
    u.lang = 'th-TH';
    if (thaiVoice) u.voice = thaiVoice;
    u.rate = Math.max(0.5, Math.min(1, rate));
    u.pitch = 1;
    speechSynthesis.speak(u);
  } catch (e) { /* audio is best-effort */ }
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

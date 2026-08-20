const defaultState = {
  day: 1,
  level: 1,
  xp: 20,
  peso: 3.4,
  sleepUntil: 0,
  malattia: false,
  needs: { fame: 78, energia: 92, felicita: 88 },
  moments: [],
  streak: 1
};

const actions = [
  { id: 'nutri', icon: '✿', label: 'Nutri', detail: '+ fame · + peso', need: 'fame', amount: 18, message: 'Miso fa le fusa: era proprio ora di mangiare.' },
  { id: 'gioca', icon: '●', label: 'Gioca', detail: '- peso · lancia la pallina', need: 'felicita', amount: 12, message: 'Miso corre a prendere la pallina!' },
  { id: 'pausa', icon: 'Ⅱ', label: 'Pausa', detail: 'sonnellino · 2 ore', need: 'energia', amount: 24, message: 'Miso si è acciambellato. Il sonnellino durerà almeno 2 ore.' },
  { id: 'veterinario', icon: '+', label: 'Veterinario', detail: 'cura Miso · -10 xp', need: null, amount: 0, message: 'Il veterinario ha visitato Miso. Ora può riposare e stare meglio.' }
];

const labels = { fame: 'fame', energia: 'energia', felicita: 'felicità' };
const icons = { fame: '✿', energia: '☾', felicita: '♡' };
const state = loadState();
const needsList = document.querySelector('#needs-list');
const actionsList = document.querySelector('#actions-list');
const journal = document.querySelector('#journal');
const feedback = document.querySelector('#feedback');
const pet = document.querySelector('#pet');
const petScene = document.querySelector('#pet-scene');
const petStage = document.querySelector('.pet-stage');
let playMode = false;
let activeBall = null;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem('miso-state'));
    const loaded = { ...defaultState, ...saved, needs: { ...defaultState.needs, ...(saved?.needs || {}) } };
    loaded.peso = Math.max(1, Number(loaded.peso) || defaultState.peso);
    while (loaded.xp >= 100) { loaded.xp -= 100; loaded.level += 1; }
    return loaded;
  }
  catch { return structuredClone(defaultState); }
}

function saveState() { localStorage.setItem('miso-state', JSON.stringify(state)); }
function clamp(value) { return Math.max(0, Math.min(100, value)); }
function addXp(amount) {
  state.xp += amount;
  while (state.xp >= 100) {
    state.xp -= 100;
    state.level += 1;
  }
}
function averageNeeds() { return Math.round(Object.values(state.needs).reduce((sum, value) => sum + value, 0) / 3); }
function timeNow() { return new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(new Date()); }
function momentText(label) {
  const texts = { gioco: 'Miso ha giocato', coccola: 'Miso ha ricevuto una coccola', risveglio: 'Miso si è svegliato', veterinario: 'Miso è stato dal veterinario', nutri: 'Miso ha mangiato', pausa: 'Miso si è riposato' };
  return texts[label.toLowerCase()] || `Miso: ${label.toLowerCase()}`;
}

function renderNeeds() {
  needsList.innerHTML = Object.entries(state.needs).map(([key, value]) => `
    <div class="need-row">
      <span class="need-icon">${icons[key]}</span>
      <div class="need-info"><span class="need-label"><span>${labels[key]}</span><span>${value > 70 ? 'ottimo' : value > 40 ? 'così così' : 'ha bisogno di te'}</span></span><span class="need-bar"><i style="width: ${value}%"></i></span></div>
      <span class="need-value">${value}%</span>
    </div>`).join('');
}

function renderActions() {
  const sleeping = isSleeping();
  actionsList.innerHTML = actions.map(action => {
    const isGame = action.id === 'gioca';
    const disabled = sleeping || (!isGame && playMode);
    const detail = isGame ? (playMode ? 'ON · tocca il prato' : 'OFF · lancia palline') : action.detail;
    return `<button class="action${isGame && playMode ? ' is-on' : ''}" type="button" data-action="${action.id}"${disabled ? ' disabled' : ''}><span class="action-icon">${action.icon}</span><span class="action-label">${isGame && playMode ? 'Gioca ON' : action.label}</span><span class="action-detail">${detail}</span></button>`;
  }).join('');
  actionsList.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => performAction(button.dataset.action)));
}

function formatSleepTime() {
  const remaining = Math.max(0, state.sleepUntil - Date.now());
  const hours = Math.floor(remaining / 3600000).toString().padStart(2, '0');
  const minutes = Math.floor((remaining % 3600000) / 60000).toString().padStart(2, '0');
  const seconds = Math.floor((remaining % 60000) / 1000).toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function isSleeping() { return state.sleepUntil > Date.now(); }

function updateSleepButton() {
  const button = actionsList.querySelector('[data-action="pausa"]');
  if (!button) return;
  const sleeping = isSleeping();
  button.querySelector('.action-label').textContent = sleeping ? 'Sonnellino' : 'Pausa';
  button.querySelector('.action-detail').textContent = sleeping ? formatSleepTime() : 'sonnellino · 2 ore';
  pet.classList.toggle('sleeping', sleeping);
}

function syncGameMode() {
  document.body.classList.toggle('game-active', playMode);
  petStage.classList.toggle('game-fullscreen', playMode);
  document.querySelector('#game-mode-badge').hidden = !playMode;
  document.querySelector('#game-exit').hidden = !playMode;
}

function renderJournal() {
  document.querySelector('#moment-count').textContent = `${state.moments.length} ${state.moments.length === 1 ? 'momento' : 'momenti'}`;
  journal.innerHTML = state.moments.length ? state.moments.slice(0, 5).map(moment => `<div class="journal-item"><span class="journal-icon">${moment.icon}</span><span class="journal-time">${moment.time}</span><span class="journal-copy">${momentText(moment.label)}.</span></div>`).join('') : '<p class="empty-journal">Il diario è ancora vuoto. Il primo momento spetta a voi.</p>';
}

function render() {
  renderNeeds(); renderActions(); renderJournal();
  const score = averageNeeds();
  document.querySelector('#day-label').textContent = `giorno ${state.day}`;
  document.querySelector('#care-score').textContent = `${score}%`;
  document.querySelector('#level-number').textContent = state.level;
  document.querySelector('#xp-bar').style.width = `${state.xp}%`;
  document.querySelector('#xp-label').textContent = `${state.xp} / 100 XP`;
  state.peso = Math.max(1, state.peso);
  document.querySelector('#weight-value').textContent = `${state.peso.toFixed(1)} kg`;
  document.querySelector('#streak-number').textContent = state.streak;
  document.querySelector('#pet-mood').textContent = isSleeping() ? 'sta facendo un sonnellino' : score > 80 ? 'si sente amato' : score > 50 ? 'ti cerca un po’' : 'ha bisogno di te';
  document.querySelector('#play-hint').textContent = isSleeping() ? 'tocca Miso per svergliarlo' : 'tocca Miso per coccolarlo';
  document.querySelector('#illness-alarm').hidden = !state.malattia;
  pet.classList.toggle('sick', state.malattia);
  updateSleepButton();
  syncGameMode();
}

function performAction(id) {
  const action = actions.find(item => item.id === id);
  if (id === 'gioca') {
    if (isSleeping()) { feedback.textContent = 'Miso sta dormendo. La partita può aspettare.'; return; }
    playMode = !playMode;
    feedback.textContent = playMode ? 'Gioco attivo: tocca qualsiasi punto per lanciare una pallina.' : 'Gioco terminato. Miso torna alle sue cure.';
    saveState(); render();
    return;
  } else if (id === 'veterinario') {
    if (isSleeping() || playMode) { feedback.textContent = 'Miso deve essere sveglio e fuori dal gioco per andare dal veterinario.'; return; }
    if (!state.malattia) { feedback.textContent = 'Miso sta bene: per ora non serve il veterinario.'; return; }
    state.malattia = false;
    state.needs.energia = clamp(state.needs.energia + 20);
    state.needs.felicita = clamp(state.needs.felicita + 10);
    state.xp = Math.max(0, state.xp - 10);
    feedback.textContent = action.message;
  } else if (id === 'pausa') {
    if (isSleeping()) return;
    if (playMode) { feedback.textContent = 'Disattiva Gioca prima di mettere Miso a riposare.'; return; }
    state.sleepUntil = Date.now() + 2 * 60 * 60 * 1000;
    feedback.textContent = action.message;
  } else {
    if (isSleeping()) { feedback.textContent = 'Miso sta dormendo. Tornerà tra poco.'; return; }
    if (playMode) { feedback.textContent = 'Miso è concentrato sul gioco. Disattiva Gioca per continuare.'; return; }
    state.needs[action.need] = clamp(state.needs[action.need] + action.amount);
    state.peso = Math.max(1, state.peso + action.amount * 0.1);
    feedback.textContent = action.message;
  }
  const previousLevel = state.level;
  addXp(12);
  if (state.level > previousLevel) feedback.textContent = `Miso è cresciuto: livello ${state.level}!`;
  state.moments.unshift({ icon: action.icon, label: action.label, time: timeNow() });
  saveState(); render();
  document.querySelector('#pet').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.08) rotate(3deg)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'ease-out' });
}

function maybeGetSick() {
  if (state.malattia || isSleeping() || playMode) return;
  const vulnerable = state.needs.energia < 25 || state.needs.felicita < 25;
  if ((vulnerable && Math.random() < 0.08) || (!vulnerable && Math.random() < 0.001)) {
    state.malattia = true;
    feedback.textContent = 'Allarme: Miso non si sente bene. Serve il veterinario.';
    saveState();
  }
}

function cuddle() {
  if (isSleeping()) {
    state.sleepUntil = 0;
    state.needs.felicita = clamp(state.needs.felicita + 16);
    addXp(8);
    feedback.textContent = 'Miso si è svegliato con la tua coccola.';
    state.moments.unshift({ icon: '♡', label: 'risveglio', time: timeNow() });
    saveState(); render();
    pet.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 500, easing: 'ease-out' });
    return;
  }
  state.needs.felicita = clamp(state.needs.felicita + 16);
  addXp(8);
  feedback.textContent = 'Miso chiude gli occhi felice. Una coccola perfetta.';
  state.moments.unshift({ icon: '♡', label: 'coccola', time: timeNow() });
  saveState(); render();
  pet.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 500, easing: 'ease-out' });
}

function launchBall(clientX, clientY) {
  if (activeBall) return false;
  const ball = document.createElement('span');
  activeBall = ball;
  ball.className = 'ball';
  const sceneRect = petScene.getBoundingClientRect();
  const petRect = pet.getBoundingClientRect();
  const targetX = clientX - sceneRect.left;
  const targetY = clientY - sceneRect.top;
  const startX = petRect.left - sceneRect.left + petRect.width / 2;
  const startY = petRect.top - sceneRect.top + petRect.height / 2;
  ball.style.setProperty('--start-x', `${startX}px`);
  ball.style.setProperty('--start-y', `${startY}px`);
  ball.style.setProperty('--target-x', `${Math.max(30, Math.min(sceneRect.width - 30, targetX))}px`);
  ball.style.setProperty('--target-y', `${Math.max(30, Math.min(sceneRect.height - 30, targetY))}px`);
  petScene.appendChild(ball);
  pet.animate([{ transform: 'translate(0, 0)' }, { transform: `translate(${targetX - startX}px, ${targetY - startY}px)` }, { transform: 'translate(0, 0)' }], { duration: 1400, easing: 'ease-in-out' });
  state.needs.felicita = clamp(state.needs.felicita + 4);
  state.peso = Math.max(1, state.peso - 0.1);
  addXp(4);
  state.moments.unshift({ icon: '●', label: 'gioco', time: timeNow() });
  saveState();
  render();
  setTimeout(() => { ball.remove(); activeBall = null; }, 1400);
  return true;
}

document.querySelector('#reset-button').addEventListener('click', () => {
  if (confirm('Vuoi ricominciare da capo con Miso?')) { Object.assign(state, structuredClone(defaultState)); feedback.textContent = 'Un nuovo inizio, con tante cure da scoprire.'; saveState(); render(); }
});

petStage.addEventListener('click', event => {
  if (!playMode || event.target.closest('.game-exit')) return;
  if (launchBall(event.clientX, event.clientY)) feedback.textContent = 'Miso ha preso la pallina ed è tornato da te!';
});
pet.addEventListener('click', event => { if (!playMode) { cuddle(); event.stopPropagation(); } });
pet.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); cuddle(); } });
document.querySelector('#game-exit').addEventListener('click', () => { playMode = false; feedback.textContent = 'Gioco terminato. Miso torna alle sue cure.'; render(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && playMode) { playMode = false; feedback.textContent = 'Gioco terminato. Miso torna alle sue cure.'; render(); } });
setInterval(() => { if (!isSleeping() && state.sleepUntil) { state.sleepUntil = 0; feedback.textContent = 'Miso si è svegliato riposato!'; saveState(); } maybeGetSick(); render(); }, 1000);
render();

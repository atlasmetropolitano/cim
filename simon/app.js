/* ============================================================
 * Simón — HTML/CSS/JS puros
 * (Countdown SOLO al inicio + Niveles + Contador + Límite por paso
 *  + Barra de progreso + Tonos por dificultad + FIX overlay)
 * ============================================================
 */

const delay = (ms) => new Promise((res) => setTimeout(res, ms));
const formatDate = (iso) => {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};
const fmtMs = (ms) => {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const d = Math.floor((ms % 1000) / 100);
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}.${d}`;
};

/* --------------------- Storage --------------------- */
const Storage = (() => {
  const KEY = "simon:records";
  const getRecords = () => {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
  };
  const saveRecord = (name, score) => {
    const arr = getRecords();
    arr.push({ name, score, dateISO: new Date().toISOString() });
    arr.sort((a,b)=>b.score-a.score);
    const top10 = arr.slice(0,10);
    localStorage.setItem(KEY, JSON.stringify(top10));
    return top10;
  };
  const clear = () => localStorage.removeItem(KEY);
  const getBest = () => (getRecords()[0]?.score ?? 0);
  return { getRecords, saveRecord, clear, getBest, KEY };
})();

/* --------------------- Audio --------------------- */
const AudioEngine = (() => {
  let ctx, masterGain, muted = false, pitch = 1; // pitch por dificultad
  const FREQS = { green:329.63, red:261.63, yellow:220.00, blue:392.00, error:110.00 };

  const ensure = () => {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain(); masterGain.gain.value = muted ? 0 : 0.25;
      masterGain.connect(ctx.destination);
    }
  };

  const setMuted = (v)=>{ muted = !!v; if(masterGain) masterGain.gain.value = muted?0:0.25; };
  const getMuted = ()=>muted;
  const setPitch = (p)=>{ pitch = Math.max(0.5, Math.min(2, p || 1)); };

  const play = async (name, duration=300)=>{
    if (muted){ await delay(duration); return; }
    ensure();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const base = FREQS[name] ?? 300;
    osc.frequency.value = base * pitch;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(1.0, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration/1000);
    osc.connect(gain); gain.connect(masterGain);
    osc.start(now); osc.stop(now + duration/1000);
    await delay(duration);
  };

  // beep para el countdown (beep–beep–beep–BEEP)
  const beep = async (freq=660, duration=180, type="square", volume=0.28) => {
    if (muted){ await delay(duration); return; }
    ensure();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = type;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration/1000);
    osc.connect(gain); gain.connect(masterGain);
    osc.start(now); osc.stop(now + duration/1000);
    await delay(duration);
  };

  return { play, beep, setMuted, getMuted, setPitch };
})();

/* --------------------- UI --------------------- */
const UI = (() => {
  const roundEl = document.getElementById("roundValue");
  const levelEl = document.getElementById("levelValue");
  const scoreEl = document.getElementById("scoreValue");
  const bestEl  = document.getElementById("bestValue");
  const timeEl  = document.getElementById("timeValue");
  const remainEl= document.getElementById("remainValue"); // tiempo límite por paso

  const startBtn = document.getElementById("startBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const resetBtn = document.getElementById("resetBtn");
  const muteBtn = document.getElementById("muteBtn");
  const difficultySelect = document.getElementById("difficultySelect");
  const strictToggle = document.getElementById("strictToggle");

  const padEls = {
    green: document.getElementById("btn-green"),
    red: document.getElementById("btn-red"),
    yellow: document.getElementById("btn-yellow"),
    blue: document.getElementById("btn-blue"),
  };

  const tbody = document.getElementById("recordsBody");
  const clearBtn = document.getElementById("clearRecordsBtn");
  const toast = document.getElementById("toast");
  const modal = document.getElementById("recordModal");
  const recordForm = document.getElementById("recordForm");
  const recordName = document.getElementById("recordName");
  const saveRecordBtn = document.getElementById("saveRecordBtn");
  const board = document.querySelector(".board");
  const confettiContainer = document.getElementById("confettiContainer");
  const countdownOverlay = document.getElementById("countdownOverlay");

  // asegurar oculto al cargar
  if (countdownOverlay) countdownOverlay.hidden = true;

  const setRound = (n)=> roundEl.textContent = n;
  const setLevel = (n)=> levelEl.textContent = n;
  const setScore = (n)=> scoreEl.textContent = n;
  const setBest  = (n)=> bestEl.textContent  = n;
  const setTime  = (s)=> timeEl.textContent  = s;
  const setRemain= (s)=> remainEl.textContent= s ?? "—";

  // ---- Progreso visual dentro del cuadro "Restante" ----
  const remainTile = remainEl.closest(".score");
  if (remainTile) remainTile.classList.add("score--remain");
  const setRemainProgress = (pct)=>{
    if (!remainTile) return;
    const clamped = Math.max(0, Math.min(100, pct));
    remainTile.style.setProperty("--remain", clamped + "%");
  };
  const setRemainActive = (active)=>{
    if (!remainTile) return;
    remainTile.classList.toggle("is-active", !!active);
  };
  const setRemainPaused = (paused)=>{
    if (!remainTile) return;
    remainTile.classList.toggle("is-paused", !!paused);
  };

  const flashPad = async (color, onMs) => {
    const el = padEls[color]; if (!el) return;
    el.classList.add("is-flashing");
    el.setAttribute("aria-pressed","true");
    await delay(onMs);
    el.classList.remove("is-flashing");
    el.setAttribute("aria-pressed","false");
  };

  const showToast = (msg, ms=1500)=>{
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(()=> toast.hidden = true, ms);
  };

  const openModal = ()=>{ recordName.value=""; modal.showModal(); setTimeout(()=>recordName.focus(),0); };
  const closeModal = ()=> modal.close();

  const renderRecords = (records)=>{
    tbody.innerHTML = "";
    records.forEach((r,i)=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${i+1}</td><td>${escapeHtml(r.name)}</td><td>${r.score}</td><td>${formatDate(r.dateISO)}</td>`;
      tbody.appendChild(tr);
    });
  };

  const bindRecordForm = (onSave)=>{
    recordForm.addEventListener("submit", (e)=> e.preventDefault());
    saveRecordBtn.addEventListener("click", ()=>{
      const name = recordName.value.trim();
      if (name.length < 3 || name.length > 12){
        showToast("El nombre debe tener entre 3 y 12 caracteres."); recordName.focus(); return;
      }
      onSave(name); closeModal();
    });
  };

  const bindClear = (onClear)=>{
    clearBtn.addEventListener("click", ()=>{
      if (confirm("¿Borrar todos los récords?")) onClear();
    });
  };

  const setPauseButton = (isPaused)=>{
    pauseBtn.textContent = isPaused ? "▶ Continuar" : "⏸ Pausar";
    pauseBtn.title = isPaused ? "Continuar" : "Pausar";
  };

  const setMuteButton = (muted)=>{
    muteBtn.textContent = muted ? "🔇 Silencio" : "🔊 Sonido";
    muteBtn.setAttribute("aria-pressed", String(muted));
  };

  const setBoardError = (on)=> board.classList.toggle("is-error", !!on);

  const celebrate = ()=>{
    const count=60, colors=["#FFD166","#06D6A0","#EF476F","#118AB2","#8338EC","#FB5607"];
    const wrap = document.createElement("div"); wrap.className="confetti";
    for(let i=0;i<count;i++){
      const p=document.createElement("div"); p.className="confetti-piece";
      p.style.left = Math.random()*100+"vw";
      p.style.background = colors[Math.floor(Math.random()*colors.length)];
      p.style.animationDelay = (Math.random()*0.8)+"s";
      p.style.transform = `translateY(-110vh) rotate(${Math.random()*360}deg)`;
      wrap.appendChild(p);
    }
    confettiContainer.appendChild(wrap);
    setTimeout(()=>wrap.remove(), 2500);
  };

  // ===== Countdown con pitidos =====
  const countdown = async (tokenValidFn, isPausedFn) => {
    const steps = ["3","2","1","¡Ya!"];
    countdownOverlay.hidden = false;

    for (const s of steps){
      if (!tokenValidFn()) { countdownOverlay.hidden = true; return; }
      while (isPausedFn()) { await delay(100); if (!tokenValidFn()) { countdownOverlay.hidden = true; return; } }

      if (s === "¡Ya!") { AudioEngine.beep(880, 260, "square", 0.32); }
      else { AudioEngine.beep(660, 180, "square", 0.28); }

      countdownOverlay.textContent = s;
      countdownOverlay.style.animation = "none";
      void countdownOverlay.offsetWidth;
      countdownOverlay.style.animation = "count-pop .3s ease";

      await delay(700);
    }
    countdownOverlay.hidden = true;
  };

  const on = {
    start: (fn)=> startBtn.addEventListener("click", fn),
    pause: (fn)=> pauseBtn.addEventListener("click", fn),
    reset: (fn)=> resetBtn.addEventListener("click", fn),
    mute:  (fn)=> muteBtn.addEventListener("click", fn),
    difficulty: (fn)=> difficultySelect.addEventListener("change", e=>fn(e.target.value)),
    strict: (fn)=> strictToggle.addEventListener("change", e=>fn(e.target.checked)),
    padClick: (fn)=>{
      Object.entries(padEls).forEach(([color,el])=>{
        el.addEventListener("click", ()=>fn(color));
        el.addEventListener("keydown", (ev)=>{
          if (ev.key==="Enter" || ev.key===" "){ ev.preventDefault(); fn(color); }
        });
      });
    },
    keys: (fn)=>{
      const map = { a:"green", s:"red", k:"yellow", l:"blue" };
      document.addEventListener("keydown", (e)=>{
        const c = map[e.key.toLowerCase()];
        if (c){
          const el = padEls[c];
          el.classList.add("is-flashing"); el.setAttribute("aria-pressed","true");
          setTimeout(()=>{ el.classList.remove("is-flashing"); el.setAttribute("aria-pressed","false"); }, 120);
          fn(c);
        }
      });
    }
  };

  function escapeHtml(s){
    return s.replace(/[&<>"']/g, (c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  }

  return {
    setRound, setLevel, setScore, setBest, setTime, setRemain,
    setRemainProgress, setRemainActive, setRemainPaused,
    flashPad, showToast, openModal, closeModal, renderRecords, bindRecordForm, bindClear,
    setPauseButton, setMuteButton, setBoardError, celebrate, countdown, on,
    elements: { difficultySelect, startBtn, pauseBtn, resetBtn },
    countdownOverlay
  };
})();

/* --------------------- Timer (contador mm:ss.d) --------------------- */
const Timer = (() => {
  let startT = 0, acc = 0, running = false, rafId = 0;

  const tick = () => {
    if (!running) return;
    const now = performance.now();
    const elapsed = acc + (now - startT);
    UI.setTime(fmtMs(elapsed));
    rafId = requestAnimationFrame(tick);
  };

  const start = () => {
    acc = 0; startT = performance.now(); running = true;
    UI.setTime("00:00.0"); tick();
  };

  const pause = () => {
    if (!running) return;
    acc += performance.now() - startT; running = false;
    cancelAnimationFrame(rafId);
  };

  const resume = () => {
    if (running) return;
    startT = performance.now(); running = true; tick();
  };

  const reset = () => {
    running = false; cancelAnimationFrame(rafId);
    startT = 0; acc = 0; UI.setTime("00:00.0");
  };

  const stop = () => pause();
  const getElapsedMs = () => acc + (running ? (performance.now() - startT) : 0);

  return { start, pause, resume, reset, stop, getElapsedMs };
})();

/* --------------------- Controller --------------------- */
const Controller = (() => {
  const COLORS = ["green","red","yellow","blue"];

  const BASE_SPEED = {
    easy:   { on: 800, off: 300 },
    medium: { on: 600, off: 250 },
    hard:   { on: 420, off: 200 },
  };

  const RESPONSE_LIMIT = { baseMs: 6500, levelFactor: 0.93, minMs: 2800 };

  const GameState = {
    sequence: [],
    playerIndex: 0,
    round: 0,
    level: 1,
    score: 0,
    acceptingInput: false,
    isPlayingSequence: false,
    isPaused: false,
    isMuted: false,
    isStrict: false,
    difficulty: "medium", // easy | medium | hard | progressive
    playToken: 0,

    resp: { endAt: 0, remainMs: 0, intervalId: 0, active: false }
  };

  const resetState = ()=>{
    GameState.sequence = [];
    GameState.playerIndex = 0;
    GameState.round = 0;
    GameState.level = 1;
    GameState.score = 0;
    GameState.acceptingInput = false;
    GameState.isPlayingSequence = false;
    GameState.isPaused = false;
    stopResponseTimer();
    GameState.playToken++;
  };

  const init = ()=>{
    UI.setBest(Storage.getBest());
    UI.renderRecords(Storage.getRecords());
    UI.setScore(0); UI.setRound(0); UI.setLevel(1); UI.setTime("00:00.0"); UI.setRemain("—");
    UI.setRemainActive(false); UI.setRemainProgress(0);
    UI.setPauseButton(false); UI.setMuteButton(false);

    updatePitchByDifficulty();

    UI.on.start(()=> startGame());
    UI.on.pause(()=> togglePause());
    UI.on.reset(()=> resetGame());
    UI.on.mute(()=> {
      GameState.isMuted = !GameState.isMuted;
      AudioEngine.setMuted(GameState.isMuted);
      UI.setMuteButton(GameState.isMuted);
    });
    UI.on.difficulty((val)=>{
      GameState.difficulty = val;
      const txt = val==="easy"?"Fácil":val==="hard"?"Difícil":val==="progressive"?"Progresivo":"Medio";
      UI.showToast(`Dificultad: ${txt}`);
      updatePitchByDifficulty();
    });
    UI.on.strict((checked)=>{
      GameState.isStrict = checked;
      UI.showToast(checked ? "Modo Estricto: activo" : "Modo Estricto: desactivado");
    });

    UI.on.padClick((color)=>handleUserInput(color));
    UI.on.keys((color)=>handleUserInput(color));

    UI.bindRecordForm((name)=>{
      const list = Storage.saveRecord(name, GameState.score);
      UI.renderRecords(list);
      UI.setBest(list[0]?.score ?? 0);
      UI.showToast("Récord guardado ✅");
    });

    UI.bindClear(()=>{
      Storage.clear(); UI.renderRecords([]); UI.setBest(0); UI.showToast("Récords borrados.");
    });
  };

  function updatePitchByDifficulty(){
    const map = { easy:0.92, medium:1.00, hard:1.08, progressive:1.10 };
    AudioEngine.setPitch(map[GameState.difficulty] ?? 1.0);
  }

  function randomColor(){ return COLORS[Math.floor(Math.random()*COLORS.length)]; }
  function computeLevel(round){ return Math.floor((Math.max(1, round)-1)/3) + 1; }

  function getCurrentSpeed(){
    if (GameState.difficulty === "progressive"){
      const baseOn = 600, baseOff = 250;
      const factor = Math.pow(0.92, GameState.level - 1);
      const on  = Math.max(220, Math.round(baseOn  * factor));
      const off = Math.max(150, Math.round(baseOff * factor));
      return { on, off };
    }
    return BASE_SPEED[GameState.difficulty] || BASE_SPEED.medium;
  }

  function getResponseLimitMs(){
    const raw = RESPONSE_LIMIT.baseMs * Math.pow(RESPONSE_LIMIT.levelFactor, GameState.level - 1);
    return Math.max(RESPONSE_LIMIT.minMs, Math.round(raw));
  }

  async function startGame(){
    // Reanudar si estaba en pausa
    if (GameState.round > 0 && GameState.isPaused){
      GameState.isPaused = false; UI.setPauseButton(false);
      Timer.resume(); resumeResponseTimer();
      return;
    }
    // Nuevo juego
    resetState();
    UI.setScore(0); UI.setRound(0); UI.setLevel(1); UI.setTime("00:00.0"); UI.setRemain("—");
    UI.setBoardError(false);
    UI.elements.startBtn.disabled = true;

    Timer.reset(); Timer.start();

    GameState.sequence.push(randomColor());
    await nextRound();

    UI.elements.startBtn.disabled = false;
  }

  async function nextRound(){
    const prevLevel = GameState.level;

    GameState.round++;
    GameState.level = computeLevel(GameState.round);
    UI.setRound(GameState.round);
    UI.setLevel(GameState.level);

    if (GameState.difficulty === "progressive" && GameState.level > prevLevel){
      UI.showToast(`Nivel ${GameState.level} ↑ ¡Más rápido!`);
    }

    GameState.playerIndex = 0;
    if (GameState.round > 1){ GameState.sequence.push(randomColor()); }

    // >>> Countdown SOLO en la ronda 1 <<<
    if (GameState.round === 1){
      const tokenAtStart = GameState.playToken;
      await UI.countdown(
        () => tokenAtStart === GameState.playToken, // sigue válido
        () => GameState.isPaused
      );
    }

    await playSequence();
    GameState.acceptingInput = true;
    startResponseTimer(getResponseLimitMs()); // arranca límite por paso
  }

  function togglePause(){
    GameState.isPaused = !GameState.isPaused;
    UI.setPauseButton(GameState.isPaused);
    if (GameState.isPaused){
      Timer.pause(); pauseResponseTimer();
      UI.showToast("Pausa");
    } else {
      Timer.resume(); resumeResponseTimer();
      UI.showToast("Continuando…");
    }
  }

  async function resetGame(){
    resetState();
    UI.setRound(0); UI.setLevel(1); UI.setScore(0); UI.setBoardError(false);
    UI.setRemain("—"); UI.setRemainActive(false); UI.setRemainProgress(0); UI.setRemainPaused(false);
    Timer.reset();
    if (UI.countdownOverlay) UI.countdownOverlay.hidden = true;
    UI.showToast("Juego reiniciado.");
  }

  async function playSequence(){
    GameState.acceptingInput = false;
    GameState.isPlayingSequence = true;
    stopResponseTimer();
    const token = ++GameState.playToken;

    for (let i=0; i<GameState.sequence.length; i++){
      while (GameState.isPaused){ await delay(100); if (token !== GameState.playToken) return; }
      if (token !== GameState.playToken) return;

      const speed = getCurrentSpeed();
      const color = GameState.sequence[i];
      await highlight(color, speed.on);
      await delay(speed.off);
    }

    GameState.isPlayingSequence = false;
  }

  async function highlight(color, onMs){
    UI.setBoardError(false);
    UI.flashPad(color, onMs);
    await AudioEngine.play(color, onMs);
  }

  async function handleUserInput(color){
    if (!GameState.acceptingInput || GameState.isPlayingSequence) return;
    if (GameState.isPaused) return;

    UI.flashPad(color, 160);
    AudioEngine.play(color, 140);

    const expected = GameState.sequence[GameState.playerIndex];
    if (color !== expected){
      await onError();
      return;
    }

    GameState.playerIndex++;
    GameState.score += 1;
    UI.setScore(GameState.score);

    // Correcto: reseteo la ventana de tiempo para el siguiente paso
    startResponseTimer(getResponseLimitMs());

    if (GameState.playerIndex === GameState.sequence.length){
      stopResponseTimer();
      GameState.score += GameState.round; // bonus por ronda
      UI.setScore(GameState.score);
      GameState.acceptingInput = false;
      await delay(300);
      await nextRound();
    }
  }

  async function onError(){
    UI.setBoardError(true);
    GameState.acceptingInput = false;
    stopResponseTimer();
    await AudioEngine.play("error", 400);

    if (GameState.isStrict){
      await gameOver();
    } else {
      UI.showToast("¡Tiempo/entrada incorrecta! Repetimos como ayuda.");
      GameState.playerIndex = 0;
      await playSequence();
      GameState.acceptingInput = true;
      startResponseTimer(getResponseLimitMs());
    }
  }

  async function gameOver(){
    const prevBest = Storage.getBest();
    const finalScore = GameState.score;
    GameState.acceptingInput = false;

    Timer.pause();
    stopResponseTimer();

    if (finalScore > prevBest){
      UI.celebrate();
      UI.showToast("¡Nuevo mejor puntaje! 🎉");
    } else {
      UI.showToast("Fin de la partida 💥");
    }

    await delay(250);
    UI.openModal();
  }

  // --------- Lógica del límite por paso + barra ----------
  function startResponseTimer(ms){
    stopResponseTimer();
    GameState.resp.active = true;
    GameState.resp.endAt = performance.now() + ms;

    UI.setRemain(fmtMs(ms));
    UI.setRemainActive(true);
    UI.setRemainPaused(false);
    UI.setRemainProgress(100);

    GameState.resp.intervalId = setInterval(() => {
      if (GameState.isPaused || !GameState.resp.active) return;
      const left = GameState.resp.endAt - performance.now();
      if (left <= 0){
        UI.setRemain("00:00.0");
        UI.setRemainProgress(0);
        stopResponseTimer();
        onError();
      } else {
        UI.setRemain(fmtMs(left));
        UI.setRemainProgress((left / ms) * 100);
      }
    }, 80);
  }

  function stopResponseTimer(){
    if (GameState.resp.intervalId){
      clearInterval(GameState.resp.intervalId);
      GameState.resp.intervalId = 0;
    }
    GameState.resp.active = false;
    UI.setRemain("—");
    UI.setRemainActive(false);
    UI.setRemainPaused(false);
    UI.setRemainProgress(0);
  }

  function pauseResponseTimer(){
    if (!GameState.resp.active) return;
    GameState.resp.remainMs = Math.max(0, GameState.resp.endAt - performance.now());
    clearInterval(GameState.resp.intervalId);
    GameState.resp.intervalId = 0;
    UI.setRemainPaused(true);
  }

  function resumeResponseTimer(){
    if (!GameState.resp.active) return;
    UI.setRemainPaused(false);
    GameState.resp.endAt = performance.now() + (GameState.resp.remainMs || 0);
    const ms = GameState.resp.remainMs || 0;
    GameState.resp.intervalId = setInterval(() => {
      if (!GameState.resp.active) return;
      const left = GameState.resp.endAt - performance.now();
      if (left <= 0){
        UI.setRemain("00:00.0");
        UI.setRemainProgress(0);
        stopResponseTimer();
        onError();
      } else {
        UI.setRemain(fmtMs(left));
        UI.setRemainProgress((left / ms) * 100);
      }
    }, 80);
  }

  window._simonAfterSave = () => { UI.showToast("Podés reiniciar o iniciar una nueva partida."); };

  init();
  return { startGame, resetGame, togglePause };
})();

const { startGame, resetGame } = Controller;

/* Dialog hook */
(() => {
  const dialog = document.getElementById("recordModal");
  if (!HTMLDialogElement.prototype.showModal) return;
  dialog.addEventListener("close", () => { window._simonAfterSave?.(); });
})();


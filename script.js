(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayText = document.getElementById("overlay-text");
  const startBtn = document.getElementById("start-btn");
  const pauseBtn = document.getElementById("pause-btn");
  const restartBtn = document.getElementById("restart-btn");
  const soundBtn = document.getElementById("sound-btn");
  const status = document.getElementById("status");

  const cells = 20;
  const cellSize = canvas.width / cells;
  let snake, food, direction, nextDirection, score, timer;
  let running = false, paused = false, ended = false, soundOn = true, audioContext = null;
  let best = 0;
  try { best = Number(localStorage.getItem("tm-snake-best")) || 0; } catch (_) {}
  bestEl.textContent = formatScore(best);

  function formatScore(value) { return String(value).padStart(3, "0"); }

  // Small synthesized arcade sounds: no downloads or external audio files required.
  function playTone(frequency, duration = 0.09, type = "sine", volume = 0.045, slide = 0) {
    if (!soundOn) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioContext) audioContext = new AudioCtx();
      if (audioContext.state === "suspended") audioContext.resume();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const now = audioContext.currentTime;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);
      if (slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency + slide), now + duration);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + duration);
    } catch (_) {}
  }
  function playEat() {
    playTone(520, .07, "sine", .05, 340);
    setTimeout(() => playTone(820, .08, "sine", .035, 160), 45);
  }
  function playGameOver() {
    playTone(300, .16, "triangle", .05, -100);
    setTimeout(() => playTone(190, .22, "triangle", .045, -90), 130);
  }
  function updateSoundButton() {
    soundBtn.textContent = soundOn ? "♫ Sound on" : "♫ Sound off";
    soundBtn.setAttribute("aria-pressed", String(soundOn));
    soundBtn.classList.toggle("sound-muted", !soundOn);
  }
  function randomFood() {
    let candidate;
    do { candidate = { x: Math.floor(Math.random() * cells), y: Math.floor(Math.random() * cells) }; }
    while (snake.some(part => part.x === candidate.x && part.y === candidate.y));
    return candidate;
  }
  function reset() {
    clearInterval(timer);
    snake = [{x: 9, y: 10}, {x: 8, y: 10}, {x: 7, y: 10}];
    direction = {x: 1, y: 0}; nextDirection = {x: 1, y: 0};
    score = 0; running = false; paused = false; ended = false;
    food = randomFood();
    scoreEl.textContent = formatScore(score);
    pauseBtn.disabled = true; pauseBtn.textContent = "Pause";
    status.innerHTML = '<span class="status-dot"></span> Press Start when you\'re ready.';
    showOverlay("Ready to play?", "Use arrow keys or WASD to move.", "Start game");
    draw();
  }
  function showOverlay(title, message, buttonLabel) {
    overlayTitle.textContent = title;
    overlayText.textContent = message;
    startBtn.innerHTML = buttonLabel + ' <span>→</span>';
    overlay.classList.remove("hidden");
  }
  function hideOverlay() { overlay.classList.add("hidden"); }
  function start() {
    if (running && paused) {
      paused = false; running = true; pauseBtn.textContent = "Pause";
      hideOverlay(); status.innerHTML = '<span class="status-dot"></span> Game in progress';
      playTone(520, .07, "sine"); tickLoop(); return;
    }
    if (running) return;
    if (ended) reset();
    running = true; paused = false; ended = false;
    hideOverlay(); pauseBtn.disabled = false;
    status.innerHTML = '<span class="status-dot"></span> Game in progress';
    playTone(620, .08, "sine", .04, 180);
    tickLoop();
  }
  function tickLoop() { clearInterval(timer); timer = setInterval(tick, Math.max(68, 145 - score * 2)); }
  function pause() {
    if (!running) return;
    paused = true; running = false; clearInterval(timer);
    pauseBtn.textContent = "Resume";
    showOverlay("Game paused", "Take a breath. Your score is safe.", "Resume");
    status.innerHTML = '<span class="status-dot"></span> Game paused';
    playTone(380, .1, "sine", .035, -100);
  }
  function finish() {
    clearInterval(timer); running = false; ended = true; pauseBtn.disabled = true;
    showOverlay("Game over", "Final score: " + score + ". Ready for another run?", "Play again");
    status.innerHTML = '<span class="status-dot"></span> Run complete — try again!';
    playGameOver(); draw();
  }
  function tick() {
    direction = nextDirection;
    const head = {x: snake[0].x + direction.x, y: snake[0].y + direction.y};
    const eating = head.x === food.x && head.y === food.y;
    const body = eating ? snake : snake.slice(0, -1);
    if (head.x < 0 || head.y < 0 || head.x >= cells || head.y >= cells || body.some(p => p.x === head.x && p.y === head.y)) return finish();
    snake.unshift(head);
    if (eating) {
      score += 1; scoreEl.textContent = formatScore(score);
      if (score > best) {
        best = score; bestEl.textContent = formatScore(best);
        try { localStorage.setItem("tm-snake-best", String(best)); } catch (_) {}
      }
      food = randomFood(); playEat(); tickLoop();
    } else snake.pop();
    draw();
  }
  function roundedRect(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
  }
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    bg.addColorStop(0, "#0b1827"); bg.addColorStop(1, "#07111e");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(137,170,204,.075)"; ctx.lineWidth = 1;
    for (let i = 0; i <= cells; i++) {
      ctx.beginPath(); ctx.moveTo(i * cellSize, 0); ctx.lineTo(i * cellSize, canvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * cellSize); ctx.lineTo(canvas.width, i * cellSize); ctx.stroke();
    }

    const fx = (food.x + .5) * cellSize, fy = (food.y + .5) * cellSize;
    ctx.fillStyle = "#ff7799"; ctx.shadowColor = "#ff5e8a"; ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.arc(fx, fy, cellSize * .29, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffd5df"; ctx.beginPath();
    ctx.arc(fx - 2, fy - 2, cellSize * .09, 0, Math.PI * 2); ctx.fill();

    snake.forEach((part, index) => {
      const inset = index === 0 ? 1.5 : 2.2;
      const x = part.x * cellSize + inset, y = part.y * cellSize + inset;
      const size = cellSize - inset * 2;
      const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
      if (index === 0) {
        gradient.addColorStop(0, "#e0ffb9"); gradient.addColorStop(1, "#9af15e");
        ctx.shadowColor = "#9df56a"; ctx.shadowBlur = 12;
      } else {
        gradient.addColorStop(0, "#a7f56f"); gradient.addColorStop(1, "#56c967");
        ctx.shadowBlur = 0;
      }
      ctx.fillStyle = gradient; roundedRect(x, y, size, size, 5);
      ctx.shadowBlur = 0;
      if (index === 0) {
        ctx.fillStyle = "#17321c";
        const eyeRadius = 1.35;
        let eyes;
        if (direction.x === 1) eyes = [[x + size * .68, y + size * .31], [x + size * .68, y + size * .69]];
        else if (direction.x === -1) eyes = [[x + size * .32, y + size * .31], [x + size * .32, y + size * .69]];
        else if (direction.y === -1) eyes = [[x + size * .31, y + size * .32], [x + size * .69, y + size * .32]];
        else eyes = [[x + size * .31, y + size * .68], [x + size * .69, y + size * .68]];
        eyes.forEach(([ex, ey]) => { ctx.beginPath(); ctx.arc(ex, ey, eyeRadius, 0, Math.PI * 2); ctx.fill(); });
      }
    });
  }
  function changeDirection(name) {
    const vectors = {up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}};
    const candidate = vectors[name];
    if (!candidate || (candidate.x === -direction.x && candidate.y === -direction.y)) return;
    nextDirection = candidate;
  }
  document.addEventListener("keydown", event => {
    const keys = {ArrowUp:"up",w:"up",W:"up",ArrowDown:"down",s:"down",S:"down",ArrowLeft:"left",a:"left",A:"left",ArrowRight:"right",d:"right",D:"right"};
    if (keys[event.key]) { event.preventDefault(); changeDirection(keys[event.key]); }
    if (event.key === " " && !running) { event.preventDefault(); start(); }
    else if (event.key === " " && running) { event.preventDefault(); pause(); }
  });
  document.querySelectorAll("[data-dir]").forEach(button => {
    button.addEventListener("click", () => {
      changeDirection(button.dataset.dir);
      if (!running && !ended) start();
    });
  });
  startBtn.addEventListener("click", start);
  pauseBtn.addEventListener("click", () => running ? pause() : start());
  restartBtn.addEventListener("click", () => { reset(); playTone(440, .07, "sine", .025); });
  soundBtn.addEventListener("click", () => {
    soundOn = !soundOn; updateSoundButton();
    if (soundOn) playTone(700, .09, "sine", .035, 180);
  });
  updateSoundButton();
  reset();
})();
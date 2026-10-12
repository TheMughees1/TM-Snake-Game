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
  const status = document.getElementById("status");

  const cells = 20;
  const cellSize = canvas.width / cells;
  let snake, food, direction, nextDirection, score, timer, running = false, paused = false, ended = false;
  let best = 0;
  try { best = Number(localStorage.getItem("tm-snake-best")) || 0; } catch (_) {}
  bestEl.textContent = formatScore(best);

  function formatScore(value) { return String(value).padStart(3, "0"); }
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
    food = randomFood(); scoreEl.textContent = formatScore(score);
    pauseBtn.disabled = true; pauseBtn.textContent = "Pause";
    status.textContent = "Press Start when you're ready.";
    showOverlay("Ready to play?", "Use arrow keys or WASD to move.", "Start game");
    draw();
  }
  function showOverlay(title, message, buttonLabel) {
    overlayTitle.textContent = title; overlayText.textContent = message;
    startBtn.textContent = buttonLabel; overlay.classList.remove("hidden");
  }
  function hideOverlay() { overlay.classList.add("hidden"); }
  function start() {
    if (running && paused) { paused = false; running = true; pauseBtn.textContent = "Pause"; hideOverlay(); status.textContent = "Game in progress"; tickLoop(); return; }
    if (running) return;
    if (ended) reset();
    running = true; paused = false; ended = false; hideOverlay();
    pauseBtn.disabled = false; status.textContent = "Game in progress"; tickLoop();
  }
  function tickLoop() { clearInterval(timer); timer = setInterval(tick, Math.max(68, 145 - score * 2)); }
  function pause() {
    if (!running) return;
    paused = true; running = false; clearInterval(timer); pauseBtn.textContent = "Resume";
    showOverlay("Game paused", "Take a breath. Your score is saved.", "Resume"); status.textContent = "Paused";
  }
  function finish() {
    clearInterval(timer); running = false; ended = true; pauseBtn.disabled = true;
    showOverlay("Game over", "Final score: " + score + ". Try again and beat your best.", "Play again");
    status.textContent = "Game over"; draw();
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
      food = randomFood(); tickLoop();
    } else snake.pop();
    draw();
  }
  function draw() {
    ctx.fillStyle = "#0b1422"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(130,160,190,.075)"; ctx.lineWidth = 1;
    for (let i = 0; i <= cells; i++) {
      ctx.beginPath(); ctx.moveTo(i * cellSize, 0); ctx.lineTo(i * cellSize, canvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * cellSize); ctx.lineTo(canvas.width, i * cellSize); ctx.stroke();
    }
    ctx.fillStyle = "#ff7b8b"; ctx.shadowColor = "#ff617a"; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc((food.x + .5) * cellSize, (food.y + .5) * cellSize, cellSize * .29, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    snake.forEach((part, index) => {
      const inset = 2;
      ctx.fillStyle = index === 0 ? "#c7ff9f" : "#7bd957";
      ctx.beginPath(); ctx.roundRect(part.x * cellSize + inset, part.y * cellSize + inset, cellSize - inset * 2, cellSize - inset * 2, 5); ctx.fill();
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
    if (event.key === " " && running) { event.preventDefault(); pause(); }
  });
  document.querySelectorAll("[data-dir]").forEach(button => button.addEventListener("click", () => changeDirection(button.dataset.dir)));
  startBtn.addEventListener("click", start);
  pauseBtn.addEventListener("click", pause);
  restartBtn.addEventListener("click", reset);
  reset();
})();
(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const stageNameEl = document.getElementById("stage-name");
  const stageProgressEl = document.getElementById("stage-progress");
  const bannerNameEl = document.getElementById("banner-name");
  const bannerDescEl = document.getElementById("banner-desc");
  const stageEmojiEl = document.getElementById("stage-emoji");
  const stagePillEl = document.getElementById("stage-pill");
  const stageTrack = document.getElementById("stage-track");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayText = document.getElementById("overlay-text");
  const startBtn = document.getElementById("start-btn");
  const pauseBtn = document.getElementById("pause-btn");
  const restartBtn = document.getElementById("restart-btn");
  const soundBtn = document.getElementById("sound-btn");
  const status = document.getElementById("status");
  const toast = document.getElementById("stage-toast");
  const toastEmoji = document.getElementById("toast-emoji");
  const toastTitle = document.getElementById("toast-title");
  const toastSubtitle = document.getElementById("toast-subtitle");

  const cells = 20;
  const cellSize = canvas.width / cells;
  const applesPerStage = 5;
  const stages = [
    {name:"Meadow", emoji:"🌿", desc:"A calm green valley", bg1:"#163b32",bg2:"#0b211f",grid:"rgba(176,239,174,.09)",snake:"#9cf080",snake2:"#4abf73",head:"#d6ffad",food:"#ff5f73",obstacles:0,pace:145},
    {name:"Desert", emoji:"🌵", desc:"Dry sands and ancient rocks",bg1:"#624328",bg2:"#281b19",grid:"rgba(255,218,153,.10)",snake:"#ffd27b",snake2:"#d88945",head:"#fff0b3",food:"#ff6c62",obstacles:4,pace:132},
    {name:"Frost", emoji:"❄️", desc:"Frozen paths and icy stones",bg1:"#244b67",bg2:"#102332",grid:"rgba(196,236,255,.13)",snake:"#b8f0ff",snake2:"#5eb8dc",head:"#f0fcff",food:"#ff719f",obstacles:6,pace:119},
    {name:"Volcano", emoji:"🌋", desc:"Hot lava. Narrow escape routes.",bg1:"#552727",bg2:"#1d121a",grid:"rgba(255,153,94,.12)",snake:"#ffb16e",snake2:"#e45548",head:"#ffe0a3",food:"#c8ff74",obstacles:8,pace:106},
    {name:"Neon City", emoji:"🌃", desc:"The ultimate high-speed run",bg1:"#252052",bg2:"#0b1227",grid:"rgba(178,154,255,.15)",snake:"#d0a6ff",snake2:"#7b69ed",head:"#f4e6ff",food:"#ff6ac5",obstacles:10,pace:94}
  ];

  let snake, food, specialFood, specialTicks, slowTicks, obstacles, direction, nextDirection, score, timer;
  let running = false, paused = false, ended = false, soundOn = true, audioContext = null, currentStage = 0, toastTimer;
  let best = 0, totalApples = 0, gamesPlayed = 0, stagesCleared = 0;
  try { totalApples = Number(localStorage.getItem("tm-snake-apples")) || 0; gamesPlayed = Number(localStorage.getItem("tm-snake-games")) || 0; stagesCleared = Number(localStorage.getItem("tm-snake-stages")) || 0; } catch (_) {}
  try { best = Number(localStorage.getItem("tm-snake-best")) || 0; } catch (_) {}
  bestEl.textContent = formatScore(best);

  function formatScore(value) { return String(value).padStart(3, "0"); }

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
      oscillator.connect(gain); gain.connect(audioContext.destination);
      oscillator.start(now); oscillator.stop(now + duration);
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
  function playStageUp() {
    [520,660,790,1040].forEach((freq,i) => setTimeout(() => playTone(freq,.12,"sine",.04,80),i*85));
  }
  function updateSoundButton() {
    soundBtn.textContent = soundOn ? "♫ Sound on" : "♫ Sound off";
    soundBtn.setAttribute("aria-pressed", String(soundOn));
  }
  function randomFreeCell() {
    let candidate;
    do {
      candidate = {x:Math.floor(Math.random()*cells),y:Math.floor(Math.random()*cells)};
    } while (snake.some(p=>p.x===candidate.x&&p.y===candidate.y) || (obstacles||[]).some(p=>p.x===candidate.x&&p.y===candidate.y) || (specialFood&&specialFood.x===candidate.x&&specialFood.y===candidate.y));
    return candidate;
  }
  function spawnSpecialFood() {
    specialFood = {...randomFreeCell(), type: Math.random() < 0.65 ? "gold" : "slow"};
    specialTicks = 35;
    status.innerHTML = '<span class="status-dot"></span> A special item appeared — grab it!';
  }
  function saveStat(key, value) { try { localStorage.setItem(key, String(value)); } catch (_) {} }
  function buildObstacles() {
    obstacles = [];
    const desired = stages[currentStage].obstacles;
    let attempts = 0;
    while (obstacles.length < desired && attempts < 1200) {
      attempts++;
      const p = {x:2+Math.floor(Math.random()*(cells-4)),y:2+Math.floor(Math.random()*(cells-4))};
      const tooClose = snake.some(s=>Math.abs(s.x-p.x)+Math.abs(s.y-p.y)<4);
      const nearCenter = Math.abs(p.x-10)+Math.abs(p.y-10)<4;
      if (!tooClose && !nearCenter && !obstacles.some(o=>Math.abs(o.x-p.x)+Math.abs(o.y-p.y)<2)) obstacles.push(p);
    }
  }
  function setStageUI() {
    const stage = stages[currentStage];
    stageNameEl.textContent = stage.name;
    bannerNameEl.textContent = stage.name;
    bannerDescEl.textContent = stage.desc;
    stageEmojiEl.textContent = stage.emoji;
    stagePillEl.textContent = "STAGE " + String(currentStage+1).padStart(2,"0");
    stageProgressEl.textContent = currentStage === stages.length-1
      ? "Final stage · " + (score % applesPerStage) + "/" + applesPerStage + " apples"
      : "Stage " + (currentStage+1) + " · " + (score % applesPerStage) + "/" + applesPerStage + " apples";
    stageTrack.querySelectorAll(".track-dot").forEach((dot,i)=>{
      dot.classList.toggle("active",i===currentStage);
      dot.classList.toggle("complete",i<currentStage);
    });
    const s = stages[currentStage];
    document.documentElement.style.setProperty("--stage-accent",s.snake);
    document.documentElement.style.setProperty("--stage-glow",s.snake2);
    document.querySelector(".stage-banner").style.background = "linear-gradient(100deg,"+s.snake2+"20,#ffffff03)";
    stagePillEl.style.color = s.snake;
    stagePillEl.style.borderColor = s.snake+"55";
  }
  function showStageToast() {
    const stage = stages[currentStage];
    toastEmoji.textContent = stage.emoji;
    toastTitle.textContent = currentStage === stages.length-1 ? "Final stage reached!" : stage.name + " unlocked!";
    toastSubtitle.textContent = stage.desc;
    toast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>toast.classList.add("hidden"),2300);
  }
  function reset() {
    clearInterval(timer); clearTimeout(toastTimer); toast.classList.add("hidden");
    snake = [{x:9,y:10},{x:8,y:10},{x:7,y:10}];
    direction = {x:1,y:0}; nextDirection = {x:1,y:0};
    score = 0; currentStage = 0; running = false; paused = false; ended = false;
    specialFood = null; specialTicks = 0; slowTicks = 0;
    obstacles = []; buildObstacles(); food = randomFreeCell();
    scoreEl.textContent = formatScore(score);
    pauseBtn.disabled = true; pauseBtn.textContent = "Pause";
    status.innerHTML = '<span class="status-dot"></span> Press Start to begin your journey.';
    setStageUI();
    showOverlay("Ready to explore?","Collect 5 apples to unlock the next landscape. Use arrows or WASD.","Start adventure");
    draw();
  }
  function showOverlay(title,message,buttonLabel) {
    overlayTitle.textContent = title; overlayText.textContent = message;
    startBtn.innerHTML = buttonLabel + ' <span>→</span>';
    overlay.classList.remove("hidden");
  }
  function hideOverlay() { overlay.classList.add("hidden"); }
  function start() {
    if (running) return;
    if (ended) reset();
    if (!paused) { gamesPlayed++; saveStat("tm-snake-games", gamesPlayed); }
    running = true; paused = false; ended = false;
    hideOverlay(); pauseBtn.disabled = false; pauseBtn.textContent = "Pause";
    status.innerHTML = '<span class="status-dot"></span> Exploring ' + stages[currentStage].name;
    playTone(620,.08,"sine",.04,180);
    tickLoop();
  }
  function tickLoop() {
    clearInterval(timer);
    const pace = stages[currentStage].pace;
    timer = setInterval(tick, slowTicks > 0 ? Math.max(145, pace + 45) : Math.max(65,pace-Math.min(score%applesPerStage,4)*3));
  }
  function pause() {
    if (!running) return;
    paused = true; running = false; clearInterval(timer);
    pauseBtn.textContent = "Resume";
    showOverlay("Journey paused","Your progress is saved for this run. Ready when you are.","Resume");
    status.innerHTML = '<span class="status-dot"></span> Journey paused';
    playTone(380,.1,"sine",.035,-100);
  }
  function finish(won = false) {
    clearInterval(timer); running = false; ended = true; pauseBtn.disabled = true;
    showOverlay(won ? "World champion!" : "Adventure over",won ? "You conquered all five stages with a score of "+score+"!" : "Final score: "+score+". Ready for another run? ",won ? "Play again" : "Try again");
    status.innerHTML = '<span class="status-dot"></span> ' + (won ? "All stages conquered!" : "Run complete — try again!");
    if (won) playStageUp(); else playGameOver();
    draw();
  }
  function tick() {
    direction = nextDirection;
    const head = {x:snake[0].x+direction.x,y:snake[0].y+direction.y};
    const eating = head.x===food.x&&head.y===food.y;
    const eatingSpecial = !!specialFood && head.x===specialFood.x && head.y===specialFood.y;
    const body = eating ? snake : snake.slice(0,-1);
    const hitWall = head.x<0||head.y<0||head.x>=cells||head.y>=cells;
    const hitBody = body.some(p=>p.x===head.x&&p.y===head.y);
    const hitObstacle = obstacles.some(p=>p.x===head.x&&p.y===head.y);
    if (hitWall||hitBody||hitObstacle) return finish();
    snake.unshift(head);
    if (specialTicks > 0) { specialTicks--; if (specialTicks === 0) specialFood = null; }
    if (slowTicks > 0) { slowTicks--; if (slowTicks === 0) tickLoop(); }
    if (eatingSpecial) {
      const item = specialFood.type; specialFood = null; specialTicks = 0;
      if (item === "gold") {
        score += 5; scoreEl.textContent = formatScore(score);
        status.innerHTML = '<span class="status-dot"></span> Golden Apple collected: +5 bonus points!';
        playTone(980,.16,"sine",.05,420);
      } else {
        slowTicks = 30; status.innerHTML = '<span class="status-dot"></span> Slow Time active — easier steering for a short while!';
        playTone(430,.14,"triangle",.04, -180);
      }
      if (score > best) { best = score; bestEl.textContent = formatScore(best); saveStat("tm-snake-best", best); }
      tickLoop();
    }
    if (eating) {
      score++; totalApples++; saveStat("tm-snake-apples", totalApples); scoreEl.textContent = formatScore(score);
      if (score % 4 === 0 && !specialFood) spawnSpecialFood();
      if (score>best) {
        best=score; bestEl.textContent=formatScore(best);
        try { localStorage.setItem("tm-snake-best",String(best)); } catch (_) {}
      }
      playEat();
      if (score % applesPerStage === 0) {
        if (currentStage < stages.length-1) {
          stagesCleared++; saveStat("tm-snake-stages", stagesCleared);
          currentStage++;
          buildObstacles();
          food = randomFreeCell();
          setStageUI(); showStageToast(); playStageUp();
          status.innerHTML = '<span class="status-dot"></span> New world unlocked: '+stages[currentStage].name;
        } else {
          draw();
          finish(true);
          return;
        }
      } else food = randomFreeCell();
      setStageUI(); tickLoop();
    } else snake.pop();
    draw();
  }
  function roundedRect(x,y,width,height,radius) {
    ctx.beginPath(); ctx.roundRect(x,y,width,height,radius); ctx.fill();
  }
  function drawBackground(stage) {
    const bg = ctx.createLinearGradient(0,0,canvas.width,canvas.height);
    bg.addColorStop(0,stage.bg1); bg.addColorStop(1,stage.bg2);
    ctx.fillStyle=bg; ctx.fillRect(0,0,canvas.width,canvas.height);
    // Low-contrast ground texture gives each biome a distinct, less-flat feel.
    if (currentStage===0) {
      for(let i=0;i<42;i++){
        const x=(i*73+19)%400,y=(i*47+31)%400;
        ctx.fillStyle="rgba(183,255,158,.09)";ctx.beginPath();ctx.ellipse(x,y,2,5,(i%5)*.4,0,Math.PI*2);ctx.fill();
      }
    } else if(currentStage===1) {
      ctx.strokeStyle="rgba(255,222,163,.08)";ctx.lineWidth=1;
      for(let i=0;i<9;i++){ctx.beginPath();ctx.ellipse(40+i*43,70+(i%3)*95,18+i*2,7,0,0,Math.PI*2);ctx.stroke();}
    } else if(currentStage===2) {
      ctx.fillStyle="rgba(220,248,255,.22)";
      for(let i=0;i<24;i++){const x=(i*97+23)%400,y=(i*61+17)%400;ctx.beginPath();ctx.arc(x,y,1.2,0,Math.PI*2);ctx.fill();}
    } else if(currentStage===3) {
      ctx.strokeStyle="rgba(255,104,62,.16)";ctx.lineWidth=2;
      for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(i*91,400);ctx.lineTo(i*91+55,0);ctx.stroke();}
    } else {
      ctx.fillStyle="rgba(185,151,255,.10)";
      for(let i=0;i<8;i++){ctx.fillRect(i*54+5,18+(i%3)*8,20,3);ctx.fillRect(i*54+14,28+(i%3)*8,3,12);}
    }
    ctx.strokeStyle=stage.grid;ctx.lineWidth=1;
    for(let i=0;i<=cells;i++){
      ctx.beginPath();ctx.moveTo(i*cellSize,0);ctx.lineTo(i*cellSize,canvas.height);ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,i*cellSize);ctx.lineTo(canvas.width,i*cellSize);ctx.stroke();
    }
    // Subtle perimeter makes the playfield feel like a physical arena.
    ctx.strokeStyle="rgba(255,255,255,.15)";ctx.lineWidth=2;ctx.strokeRect(1,1,398,398);
  }
  function drawObstacle(p) {
    const x=p.x*cellSize,y=p.y*cellSize,s=cellSize;
    if(currentStage===1) {
      ctx.fillStyle="#8c6240";ctx.strokeStyle="#d5a46c";
      ctx.beginPath();ctx.moveTo(x+3,y+14);ctx.lineTo(x+7,y+4);ctx.lineTo(x+15,y+2);ctx.lineTo(x+18,y+10);ctx.lineTo(x+14,y+18);ctx.lineTo(x+5,y+18);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle="#e4ba7f";ctx.fillRect(x+8,y+6,4,2);
    } else if(currentStage===2) {
      ctx.fillStyle="#a4e6f4";ctx.strokeStyle="#e1fbff";ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(x+10,y+1);ctx.lineTo(x+18,y+8);ctx.lineTo(x+14,y+18);ctx.lineTo(x+5,y+17);ctx.lineTo(x+2,y+8);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle="rgba(255,255,255,.55)";ctx.beginPath();ctx.moveTo(x+10,y+3);ctx.lineTo(x+13,y+9);ctx.lineTo(x+7,y+8);ctx.closePath();ctx.fill();
    } else if(currentStage===3) {
      ctx.fillStyle="#4b2929";ctx.strokeStyle="#ff8557";ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(x+2,y+18);ctx.lineTo(x+4,y+7);ctx.lineTo(x+9,y+3);ctx.lineTo(x+13,y+8);ctx.lineTo(x+18,y+4);ctx.lineTo(x+18,y+18);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle="#ff642f";ctx.fillRect(x+8,y+12,5,3);
    } else {
      ctx.shadowColor="#ba8aff";ctx.shadowBlur=8;ctx.fillStyle="#3b326f";ctx.strokeStyle="#bca0ff";ctx.lineWidth=1;
      roundedRect(x+3,y+3,14,14,4);ctx.strokeRect(x+4,y+4,12,12);ctx.shadowBlur=0;
      ctx.fillStyle="#f6b4ff";ctx.fillRect(x+7,y+7,2,2);ctx.fillRect(x+12,y+12,2,2);
    }
  }
  function drawFood() {
    if (specialFood) {
      const sx=(specialFood.x+.5)*cellSize, sy=(specialFood.y+.5)*cellSize;
      ctx.save();
      const gold = specialFood.type === "gold";
      ctx.shadowColor = gold ? "#ffd166" : "#78dfff"; ctx.shadowBlur = 17;
      ctx.fillStyle = gold ? "#ffd166" : "#78dfff";
      ctx.beginPath(); ctx.arc(sx,sy,7+Math.sin(Date.now()/100)*1.2,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0; ctx.fillStyle="#152033"; ctx.font="bold 10px sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(gold?"★":"⌛",sx,sy+.5);
      ctx.restore();
    }
    const x=(food.x+.5)*cellSize,y=(food.y+.52)*cellSize;
    const stage=stages[currentStage];
    ctx.save();ctx.shadowColor=stage.food;ctx.shadowBlur=14;
    ctx.fillStyle=stage.food;
    ctx.beginPath();ctx.ellipse(x-3,y+1,5.2,6, -.3,0,Math.PI*2);ctx.ellipse(x+3,y+1,5.2,6,.3,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;
    ctx.strokeStyle="#6e4b2c";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y-5);ctx.lineTo(x+1,y-9);ctx.stroke();
    ctx.fillStyle="#a9f17b";ctx.beginPath();ctx.ellipse(x+4,y-7,3,1.5,-.5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="rgba(255,255,255,.75)";ctx.beginPath();ctx.arc(x-3,y-1,1.5,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
  function drawSnake() {
    const stage=stages[currentStage];
    snake.forEach((part,index)=>{
      const inset=index===0?1.4:2.1,x=part.x*cellSize+inset,y=part.y*cellSize+inset,size=cellSize-inset*2;
      const gradient=ctx.createLinearGradient(x,y,x+size,y+size);
      if(index===0){gradient.addColorStop(0,stage.head);gradient.addColorStop(1,stage.snake);ctx.shadowColor=stage.snake;ctx.shadowBlur=12;}
      else {gradient.addColorStop(0,stage.snake);gradient.addColorStop(1,stage.snake2);ctx.shadowBlur=0;}
      ctx.fillStyle=gradient;roundedRect(x,y,size,size,index===0?6:5);ctx.shadowBlur=0;
      // A narrow highlight adds a rounded, glossy body rather than flat blocks.
      if(index>0){ctx.fillStyle="rgba(255,255,255,.13)";roundedRect(x+2,y+2,size-4,2,1);}
      if(index===0){
        ctx.fillStyle="#17242a";let eyes;
        if(direction.x===1)eyes=[[x+size*.68,y+size*.31],[x+size*.68,y+size*.69]];
        else if(direction.x===-1)eyes=[[x+size*.32,y+size*.31],[x+size*.32,y+size*.69]];
        else if(direction.y===-1)eyes=[[x+size*.31,y+size*.32],[x+size*.69,y+size*.32]];
        else eyes=[[x+size*.31,y+size*.68],[x+size*.69,y+size*.68]];
        eyes.forEach(([ex,ey])=>{ctx.beginPath();ctx.arc(ex,ey,1.5,0,Math.PI*2);ctx.fill();});
      }
    });
  }
  function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    drawBackground(stages[currentStage]);
    obstacles.forEach(drawObstacle);
    drawFood();
    drawSnake();
  }
  function changeDirection(name) {
    const vectors={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}};
    const candidate=vectors[name];
    if(!candidate||(candidate.x===-direction.x&&candidate.y===-direction.y))return;
    nextDirection=candidate;
  }
  document.addEventListener("keydown",event=>{
    const keys={ArrowUp:"up",w:"up",W:"up",ArrowDown:"down",s:"down",S:"down",ArrowLeft:"left",a:"left",A:"left",ArrowRight:"right",d:"right",D:"right"};
    if(keys[event.key]){event.preventDefault();changeDirection(keys[event.key]);}
    if(event.key===" "){event.preventDefault();if(running)pause();else start();}
  });
  document.querySelectorAll("[data-dir]").forEach(button=>button.addEventListener("click",()=>{
    changeDirection(button.dataset.dir);
    if(!running&&!ended)start();
  }));
  startBtn.addEventListener("click",start);
  pauseBtn.addEventListener("click",()=>running?pause():start());
  restartBtn.addEventListener("click",()=>{reset();playTone(440,.07,"sine",.025);});
  soundBtn.addEventListener("click",()=>{soundOn=!soundOn;updateSoundButton();if(soundOn)playTone(700,.09,"sine",.035,180);});
  updateSoundButton();
  reset();
})();
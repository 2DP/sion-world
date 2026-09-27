const board = document.getElementById("gameBoard");
const scoreValueEl = document.getElementById("scoreValue");
const timerValueEl = document.getElementById("timerValue");
const dangerCountEl = document.getElementById("dangerCount");
const progressValueEl = document.getElementById("progressValue");
const statusText = document.getElementById("statusText");

const rows = 6;
const cols = 24;
const TIME_LIMIT = 90;
const maxDangerHits = 10;
const cellLookup = new Map();
const visitedSafe = new Set();
const collectableTiles = [];
let score = 0;
let dangerHits = 0;
let timeLeft = TIME_LIMIT;
let gameRunning = true;
let player = { x: 0, y: 5 };
let goldenCellKey = null;
let goldenBuffUntil = 0;
let goldenTimerId = null;
let goldenSpawnTimerId = null;
let dangerPatterns = [];
let dangerSet = new Set();
let timerId = null;
let lastDangerStep = 0;
let activePurpleKey = null;

const character = document.createElement("div");
character.className = "character";
character.setAttribute("aria-label", "주인공 캐릭터");
character.innerHTML = `
  <div class="character-inner hamster">
    <div class="face">
      <span class="ear left"></span>
      <span class="ear right"></span>
      <span class="eye left"></span>
      <span class="eye right"></span>
      <span class="smile"></span>
      <span class="nose"></span>
    </div>
  </div>
`;
board.appendChild(character);

function coordKey(x, y) {
  return `${x},${y}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function isGoldenBuffActive() {
  return goldenBuffUntil > Date.now();
}

function setStatus(message) {
  statusText.textContent = message;
}

function updateHud() {
  scoreValueEl.textContent = String(score);
  timerValueEl.textContent = String(Math.max(0, timeLeft));
  dangerCountEl.textContent = `${dangerHits}/${maxDangerHits}`;
  progressValueEl.textContent = `${visitedSafe.size}/${collectableTiles.length}`;
}

function playKeycapClick(frequency = 880, duration = 0.06) {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return;

  const audioContext = new AudioCtor();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.06, audioContext.currentTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
  oscillator.onended = () => audioContext.close();
}

function initializeCollectableTiles() {
  collectableTiles.length = 0;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (x === 0 || y === 0 || x === cols - 1 || y === rows - 1) continue;
      const key = coordKey(x, y);
      if (dangerSet.has(key)) continue;
      collectableTiles.push({ x, y });
    }
  }
}

function generateDangerPatterns() {
  dangerPatterns = [
    { x: 5, y: 2, dx: 1, dy: 0, shape: [[0, 0], [1, 0], [2, 0], [1, 1], [1, -1]] },
    { x: 18, y: 3, dx: -1, dy: 0, shape: [[0, 0], [1, 0], [2, 0], [2, 1], [2, -1]] },
    { x: 12, y: 1, dx: 0, dy: 1, shape: [[0, 0], [0, 1], [0, 2], [1, 0], [-1, 0]] },
  ];
}

function refreshDangerSet() {
  dangerSet = new Set();

  dangerPatterns.forEach((pattern) => {
    pattern.shape.forEach(([offsetX, offsetY]) => {
      const x = pattern.x + offsetX;
      const y = pattern.y + offsetY;
      if (x >= 0 && x < cols && y >= 0 && y < rows) {
        dangerSet.add(coordKey(x, y));
      }
    });
  });
}

function tickDangerPatterns() {
  dangerPatterns.forEach((pattern) => {
    const nextX = pattern.x + pattern.dx;
    const nextY = pattern.y + pattern.dy;

    if (nextX <= 1 || nextX >= cols - 2) {
      pattern.dx *= -1;
    }
    if (nextY <= 1 || nextY >= rows - 2) {
      pattern.dy *= -1;
    }

    pattern.x += pattern.dx;
    pattern.y += pattern.dy;
  });

  refreshDangerSet();
  initializeCollectableTiles();
  redrawBoard();
}

function drawCell(cell, x, y) {
  const key = coordKey(x, y);
  const isDanger = dangerSet.has(key);
  const isGolden = goldenCellKey === key && isGoldenBuffActive();
  const isDangerGold = isDanger && isGoldenBuffActive();
  const isVisited = visitedSafe.has(key);
  const isPurple = isVisited && !isDanger && key === activePurpleKey;

  cell.className = isDanger ? "keycap danger" : "keycap safe";
  cell.dataset.x = String(x);
  cell.dataset.y = String(y);
  cell.classList.toggle("gold", isGolden || isDangerGold);
  cell.classList.toggle("visited", isVisited && !isPurple && !isDanger);
  cell.classList.toggle("purple", isPurple);
  cell.classList.remove("pressed");

  if (isVisited && !isDanger) {
    cell.style.opacity = isPurple ? "0.8" : "0.56";
  } else {
    cell.style.opacity = "1";
  }

  if (isDangerGold) {
    cell.style.boxShadow = "inset 0 0 0 2px rgba(255,255,255,0.35), 0 0 18px rgba(255, 209, 77, 0.9)";
  } else {
    cell.style.boxShadow = "";
  }
}

function redrawBoard() {
  board.querySelectorAll(".keycap").forEach((cell) => {
    const x = Number(cell.dataset.x);
    const y = Number(cell.dataset.y);
    drawCell(cell, x, y);
  });
}

function createBoard() {
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const cell = document.createElement("div");
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);
      cell.dataset.seed = String((x + 1) * (y + 2) * 0.7);
      cell.className = "keycap";
      board.appendChild(cell);
      cellLookup.set(coordKey(x, y), cell);
    }
  }

  refreshDangerSet();
  initializeCollectableTiles();
  redrawBoard();
}

function setPlayerPosition() {
  const cell = cellLookup.get(coordKey(player.x, player.y));
  if (!cell) return;

  const width = cell.offsetWidth;
  const height = cell.offsetHeight;
  const charWidth = width * 0.7;
  const charHeight = height * 0.75;

  character.style.width = `${charWidth}px`;
  character.style.height = `${charHeight}px`;
  character.style.left = `${cell.offsetLeft + (width - charWidth) / 2}px`;
  character.style.top = `${cell.offsetTop + (height - charHeight) / 2}px`;
}

function pressCell(cell) {
  cell.classList.remove("pressed");
  void cell.offsetWidth;
  cell.classList.add("pressed");
  window.setTimeout(() => cell.classList.remove("pressed"), 180);
}

function triggerGoldenBuff() {
  if (goldenTimerId) {
    window.clearTimeout(goldenTimerId);
  }

  goldenBuffUntil = Date.now() + 20000;
  score += 50;
  setStatus("황금 버프! 20초 동안 검은 발판도 황금색이 되고 점수 두 배!");
  playKeycapClick(1220, 0.12);
  playKeycapClick(1560, 0.14);
  redrawBoard();

  goldenTimerId = window.setTimeout(() => {
    goldenBuffUntil = 0;
    setStatus("버프 종료. 다음 황금 발판을 노려보세요.");
    redrawBoard();
  }, 20000);
}

function scheduleGoldenSpawn() {
  if (goldenSpawnTimerId) {
    clearTimeout(goldenSpawnTimerId);
  }

  goldenSpawnTimerId = window.setTimeout(() => {
    goldenSpawnTimerId = null;
    if (!gameRunning || goldenCellKey) return;
    spawnGoldenCell();
    if (!goldenCellKey) {
      scheduleGoldenSpawn();
    }
  }, 3500);
}

function spawnGoldenCell() {
  if (goldenCellKey) return;

  const candidates = collectableTiles.filter(({ x, y }) => {
    const key = coordKey(x, y);
    return !visitedSafe.has(key) && key !== coordKey(player.x, player.y);
  });

  if (!candidates.length) return;

  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  goldenCellKey = coordKey(chosen.x, chosen.y);
  redrawBoard();
  setStatus("황금 발판 등장! 밟으면 버프!");
  playKeycapClick(960, 0.08);
}

function handleSafeStep(key) {
  if (visitedSafe.has(key)) {
    activePurpleKey = key;
    setStatus("이미 밟은 발판입니다. 점수는 더 올라가지 않습니다.");
    return;
  }

  visitedSafe.add(key);
  activePurpleKey = key;
  score += isGoldenBuffActive() ? 20 : 10;

  if (goldenCellKey === key) {
    goldenCellKey = null;
    triggerGoldenBuff();
  } else {
    playKeycapClick(540, 0.08);
    setStatus("발판을 밟았습니다.");
  }

  if (visitedSafe.size >= collectableTiles.length) {
    gameRunning = false;
    setStatus("성공! 검은 발판을 제외한 모든 발판을 밟았습니다!");
    playKeycapClick(700, 0.12);
    playKeycapClick(980, 0.12);
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }
}

function gameOver() {
  gameRunning = false;
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  setStatus("게임 오버! 다시 시작합니다.");
  playKeycapClick(140, 0.25);
  setTimeout(() => resetGame(), 1200);
}

function movePlayer(dx, dy) {
  if (!gameRunning) return;

  const currentX = player.x;
  const currentY = player.y;
  const nextX = clamp(player.x + dx, 0, cols - 1);
  const nextY = clamp(player.y + dy, 0, rows - 1);

  if (nextX === currentX && nextY === currentY) {
    return;
  }

  const nextKey = coordKey(nextX, nextY);
  const cell = cellLookup.get(nextKey);
  player.x = nextX;
  player.y = nextY;

  if (!cell) return;
  pressCell(cell);

  if (dangerSet.has(nextKey)) {
    dangerHits += 1;
    score = Math.max(0, score - 5);
    playKeycapClick(180, 0.12);
    setStatus(`검은 발판에 닿았습니다! (${dangerHits}/${maxDangerHits})`);

    if (dangerHits >= maxDangerHits) {
      gameOver();
    }
  } else {
    handleSafeStep(nextKey);
  }

  redrawBoard();
  setPlayerPosition();
  updateHud();
}

function resetGame() {
  score = 0;
  dangerHits = 0;
  timeLeft = TIME_LIMIT;
  player = { x: 0, y: 5 };
  visitedSafe.clear();
  activePurpleKey = null;
  goldenCellKey = null;
  goldenBuffUntil = 0;
  lastDangerStep = 0;
  if (goldenTimerId) {
    clearTimeout(goldenTimerId);
    goldenTimerId = null;
  }
  if (goldenSpawnTimerId) {
    clearTimeout(goldenSpawnTimerId);
    goldenSpawnTimerId = null;
  }
  generateDangerPatterns();
  refreshDangerSet();
  initializeCollectableTiles();
  redrawBoard();
  setStatus("게임 시작!");
  updateHud();
  setPlayerPosition();
  gameRunning = true;

  if (timerId) {
    clearInterval(timerId);
  }
  timerId = setInterval(() => {
    if (!gameRunning) return;
    timeLeft -= 1;
    updateHud();

    if (timeLeft <= 0) {
      timeLeft = 0;
      gameOver();
    }
  }, 1000);

  scheduleGoldenSpawn();
}

function handleKey(event) {
  const key = event.key.toLowerCase();
  const moves = {
    arrowup: [0, -1],
    w: [0, -1],
    arrowdown: [0, 1],
    s: [0, 1],
    arrowleft: [-1, 0],
    a: [-1, 0],
    arrowright: [1, 0],
    d: [1, 0],
  };

  if (!moves[key]) return;
  event.preventDefault();
  const [dx, dy] = moves[key];
  movePlayer(dx, dy);
}

function animateBoard(time) {
  const t = time * 0.001;

  if (time - lastDangerStep >= 5000) {
    tickDangerPatterns();
    lastDangerStep = time;
  }

  board.querySelectorAll(".keycap").forEach((cell) => {
    const x = Number(cell.dataset.x);
    const y = Number(cell.dataset.y);
    const waveX = Math.sin(t * (1.2 + x * 0.12) + Number(cell.dataset.seed)) * 2.2;
    const waveY = Math.cos(t * (1.5 + y * 0.18) + Number(cell.dataset.seed)) * 2;
    cell.style.transform = `translate(${waveX}px, ${waveY}px)`;
  });

  requestAnimationFrame(animateBoard);
}

function initializeGame() {
  generateDangerPatterns();
  refreshDangerSet();
  initializeCollectableTiles();
  createBoard();
  redrawBoard();
  updateHud();
  setPlayerPosition();
  requestAnimationFrame(animateBoard);
  window.addEventListener("resize", setPlayerPosition);
  document.addEventListener("keydown", handleKey);
  resetGame();
}

initializeGame();

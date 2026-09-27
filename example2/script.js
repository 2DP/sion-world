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
let dangerPatterns = [];
let dangerSet = new Set();
let timerId = null;
let lastDangerStep = 0;

const character = document.createElement("div");
character.className = "character";
character.setAttribute("aria-label", "주인공 캐릭터");
character.innerHTML = `
  <div class="character-inner">
    <div class="face">
      <span class="eye left"></span>
      <span class="eye right"></span>
      <span class="smile"></span>
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

function setStatus(message) {
  statusText.textContent = message;
}

function updateHud() {
  scoreValueEl.textContent = String(score);
  timerValueEl.textContent = String(Math.max(0, timeLeft));
  dangerCountEl.textContent = `${dangerHits}/${maxDangerHits}`;
  progressValueEl.textContent = `${visitedSafe.size}/${collectableTiles.length}`;
}

function playTone(frequency, duration, type = "triangle", volume = 0.06) {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return;

  const audioContext = new AudioCtor();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = type;
  oscillator.frequency.value = frequency;

  gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(volume, audioContext.currentTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);

  oscillator.onended = () => audioContext.close();
}

function initializeCollectableTiles() {
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (x === 0 || y === 0 || x === cols - 1 || y === rows - 1) continue;
      if ((x + y) % 3 !== 0) {
        collectableTiles.push({ x, y });
      }
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
  redrawBoard();
}

function drawCell(cell, x, y) {
  const key = coordKey(x, y);
  const isDanger = dangerSet.has(key);
  const isGolden = goldenCellKey === key && goldenBuffUntil > Date.now();
  const isVisited = visitedSafe.has(key);

  cell.className = isDanger ? "keycap danger" : "keycap safe";
  cell.dataset.x = String(x);
  cell.dataset.y = String(y);
  cell.classList.toggle("gold", isGolden);
  cell.classList.toggle("visited", isVisited);
  cell.classList.remove("pressed");

  if (isVisited && !isDanger) {
    cell.style.opacity = "0.5";
  } else {
    cell.style.opacity = "1";
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
  setStatus("황금 버프! 20초 동안 모든 안전 발판에서 점수 상승!");
  playTone(860, 0.12, "triangle", 0.09);
  playTone(1220, 0.14, "triangle", 0.07);
  redrawBoard();

  goldenTimerId = window.setTimeout(() => {
    goldenBuffUntil = 0;
    setStatus("버프 종료. 다음 황금 발판을 노려보세요.");
    redrawBoard();
  }, 20000);
}

function spawnGoldenCell() {
  const candidates = collectableTiles.filter(({ x, y }) => {
    const key = coordKey(x, y);
    return !visitedSafe.has(key) && key !== coordKey(player.x, player.y);
  });

  if (!candidates.length) return;

  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  goldenCellKey = coordKey(chosen.x, chosen.y);
  redrawBoard();
  setStatus("황금 발판 등장! 밟으면 버프!");
  playTone(960, 0.08, "triangle", 0.05);
}

function handleSafeStep(key) {
  if (visitedSafe.has(key)) {
    setStatus("이미 밟은 파스텔 발판입니다.");
    return;
  }

  visitedSafe.add(key);
  score += goldenBuffUntil > Date.now() ? 15 : 10;

  if (goldenCellKey === key) {
    goldenCellKey = null;
    triggerGoldenBuff();
  } else {
    playTone(540, 0.08, "triangle", 0.05);
    setStatus("파스텔 발판을 밟았습니다.");
  }

  if (visitedSafe.size >= collectableTiles.length) {
    gameRunning = false;
    setStatus("성공! 모든 파스텔 발판을 밟았습니다!");
    playTone(700, 0.12, "triangle", 0.08);
    playTone(980, 0.12, "triangle", 0.08);
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
  playTone(140, 0.25, "square", 0.12);
  setTimeout(() => resetGame(), 1200);
}

function movePlayer(dx, dy) {
  if (!gameRunning) return;

  const nextX = clamp(player.x + dx, 0, cols - 1);
  const nextY = clamp(player.y + dy, 0, rows - 1);

  const nextKey = coordKey(nextX, nextY);
  const cell = cellLookup.get(nextKey);
  player.x = nextX;
  player.y = nextY;

  if (!cell) return;
  pressCell(cell);

  if (dangerSet.has(nextKey)) {
    dangerHits += 1;
    score = Math.max(0, score - 5);
    playTone(180, 0.12, "sawtooth", 0.08);
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
  goldenCellKey = null;
  goldenBuffUntil = 0;
  if (goldenTimerId) {
    clearTimeout(goldenTimerId);
    goldenTimerId = null;
  }
  generateDangerPatterns();
  refreshDangerSet();
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

  window.setTimeout(() => spawnGoldenCell(), 800);
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

  if (time - lastDangerStep > 260) {
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
  initializeCollectableTiles();
  createBoard();
  generateDangerPatterns();
  refreshDangerSet();
  redrawBoard();
  updateHud();
  setPlayerPosition();
  requestAnimationFrame(animateBoard);
  window.addEventListener("resize", setPlayerPosition);
  document.addEventListener("keydown", handleKey);
  resetGame();
}

initializeGame();

const board = document.getElementById("gameBoard");
const scoreValueEl = document.getElementById("scoreValue");
const dangerCountEl = document.getElementById("dangerCount");
const statusText = document.getElementById("statusText");

const rows = 6;
const cols = 8;
const maxDangerHits = 10;

const safeCells = new Set([
  "0,0", "0,1", "0,3", "0,4", "0,5", "0,6",
  "1,0", "1,1", "1,2", "1,3", "1,4", "1,5", "1,6",
  "2,0", "2,1", "2,2", "2,3", "2,4", "2,5", "2,6", "2,7",
  "3,0", "3,1", "3,2", "3,3", "3,4", "3,5", "3,6", "3,7",
  "4,1", "4,2", "4,3", "4,4", "4,5", "4,6", "4,7",
  "5,0", "5,1", "5,2", "5,3", "5,4", "5,5", "5,6"
]);

const dangerSet = new Set([
  "0,2",
  "1,7",
  "4,0",
  "5,7"
]);

const cellLookup = new Map();
let score = 0;
let dangerHits = 0;
let player = { x: 0, y: 5 };
let goldenCellKey = null;
let goldenBuffUntil = 0;
let buffTimeoutId = null;

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
  dangerCountEl.textContent = `${dangerHits}/${maxDangerHits}`;
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

function refreshTileStyles() {
  board.querySelectorAll(".keycap").forEach((cell) => {
    const x = Number(cell.dataset.x);
    const y = Number(cell.dataset.y);
    const key = coordKey(x, y);
    const isDanger = dangerSet.has(key);
    const isGolden = goldenBuffUntil > Date.now() && !isDanger;
    const isGoldenCell = goldenCellKey === key && !isDanger;

    cell.classList.toggle("safe", !isDanger);
    cell.classList.toggle("danger", isDanger);
    cell.classList.toggle("gold", isGolden || isGoldenCell);
  });
}

function createBoard() {
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const cell = document.createElement("div");
      const key = coordKey(x, y);
      const isDanger = dangerSet.has(key);
      cell.className = isDanger ? "keycap danger" : "keycap safe";
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);
      cell.dataset.seed = String((x + 1) * (y + 2) * 0.7);
      cell.style.transform = "translate(0,0)";
      board.appendChild(cell);
      cellLookup.set(key, cell);
    }
  }
}

function setPlayerPosition() {
  const cell = cellLookup.get(coordKey(player.x, player.y));
  if (!cell) return;

  const width = cell.offsetWidth;
  const height = cell.offsetHeight;
  const charWidth = width * 0.72;
  const charHeight = height * 0.82;

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
  goldResetTimer();
  goldenBuffUntil = Date.now() + 20000;
  score += 50;
  setStatus("황금 버프! 20초 동안 안전 발판 점수 상승!");
  playTone(840, 0.12, "triangle", 0.08);
  playTone(1220, 0.13, "triangle", 0.07);
  refreshTileStyles();

  buffTimeoutId = window.setTimeout(() => {
    goldenBuffUntil = 0;
    goldenCellKey = null;
    if (dangerHits < maxDangerHits) {
      setStatus("버프 종료. 다음 황금 발판을 노려보세요.");
    }
    refreshTileStyles();
  }, 20000);
}

function goldResetTimer() {
  if (buffTimeoutId) {
    window.clearTimeout(buffTimeoutId);
    buffTimeoutId = null;
  }
}

function spawnGoldenCell() {
  const validKeys = Array.from(safeCells).filter((key) => key !== coordKey(player.x, player.y));
  if (!validKeys.length) return;

  const nextKey = validKeys[Math.floor(Math.random() * validKeys.length)];
  goldenCellKey = nextKey;
  refreshTileStyles();
  setStatus("황금 발판 등장! 밟으면 버프!");
  playTone(960, 0.08, "triangle", 0.05);
}

function movePlayer(dx, dy) {
  if (dangerHits >= maxDangerHits) return;

  const nextX = clamp(player.x + dx, 0, cols - 1);
  const nextY = clamp(player.y + dy, 0, rows - 1);

  player.x = nextX;
  player.y = nextY;

  const key = coordKey(player.x, player.y);
  const cell = cellLookup.get(key);
  const isDanger = dangerSet.has(key);

  if (cell) {
    pressCell(cell);
  }

  if (isDanger) {
    dangerHits += 1;
    score = Math.max(0, score - 5);
    playTone(160, 0.12, "sawtooth", 0.08);
    setStatus(`검은 발판을 밟았습니다! (${dangerHits}/${maxDangerHits})`);

    if (dangerHits >= maxDangerHits) {
      setStatus("게임 오버! 다시 시작합니다.");
      playTone(90, 0.22, "square", 0.12);
      setTimeout(() => resetGame(), 1100);
    }
  } else {
    const bonus = goldenBuffUntil > Date.now() ? 15 : 10;
    score += bonus;
    if (goldenCellKey === key) {
      triggerGoldenBuff();
      goldenCellKey = null;
    }

    if (goldenBuffUntil > Date.now()) {
      setStatus("황금 버프 중! 점수가 계속 올라갑니다.");
    } else {
      setStatus("안전한 발판! 계속 가세요.");
    }
    playTone(540, 0.08, "triangle", 0.05);
  }

  updateHud();
  refreshTileStyles();
  setPlayerPosition();
}

function resetGame() {
  score = 0;
  dangerHits = 0;
  goldenBuffUntil = 0;
  goldenCellKey = null;
  player = { x: 0, y: 5 };
  setStatus("시작!");
  goldResetTimer();
  refreshTileStyles();
  updateHud();
  setPlayerPosition();
  window.setTimeout(() => spawnGoldenCell(), 1200);
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

  board.querySelectorAll(".keycap").forEach((cell) => {
    const x = Number(cell.dataset.x);
    const y = Number(cell.dataset.y);
    const waveX = Math.sin(t * (1.2 + x * 0.15) + Number(cell.dataset.seed)) * 2.5;
    const waveY = Math.cos(t * (1.5 + y * 0.18) + Number(cell.dataset.seed)) * 2;
    cell.style.transform = `translate(${waveX}px, ${waveY}px)`;
  });

  requestAnimationFrame(animateBoard);
}

function initializeGame() {
  createBoard();
  refreshTileStyles();
  updateHud();
  setPlayerPosition();
  requestAnimationFrame(animateBoard);
  window.addEventListener("resize", setPlayerPosition);
  document.addEventListener("keydown", handleKey);
  window.setTimeout(() => spawnGoldenCell(), 1000);
}

initializeGame();

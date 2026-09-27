const board = document.getElementById("gameBoard");
const statusText = document.getElementById("statusText");

const rows = 5;
const cols = 7;
const gridGap = 10;

const validCells = new Set([
  "0,0", "0,1", "0,3", "0,4", "0,5",
  "1,1", "1,2", "1,3", "1,4", "1,5",
  "2,0", "2,2", "2,3", "2,4", "2,6",
  "3,1", "3,2", "3,4", "3,5", "3,6",
  "4,0", "4,2", "4,3", "4,4", "4,5"
]);

const player = {
  x: 0,
  y: 0,
};

const keyPalette = {
  safe: ["#ffd9e8", "#d9f7ff", "#dff7d9", "#fff0c7", "#e5ddff"],
  danger: "#101010",
};

const characterDiv = document.createElement("div");
characterDiv.className = "character";
characterDiv.setAttribute("aria-label", "주인공 캐릭터");
const characterInner = document.createElement("div");
characterInner.className = "character-inner";
const face = document.createElement("div");
face.className = "face";
face.innerHTML = '<span class="eye left"></span><span class="eye right"></span><span class="smile"></span>';
characterInner.appendChild(face);
characterDiv.appendChild(characterInner);
board.appendChild(characterDiv);

const cells = [];

function getKeyId(x, y) {
  return `${y},${x}`;
}

function createBoard() {
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const cell = document.createElement("div");
      cell.className = "keycap";
      const isSafe = validCells.has(getKeyId(x, y));
      cell.classList.add(isSafe ? "safe" : "danger");
      cell.dataset.x = x;
      cell.dataset.y = y;
      const tintIndex = (x + y) % keyPalette.safe.length;
      cell.style.background = isSafe
        ? `linear-gradient(135deg, ${keyPalette.safe[tintIndex]}, ${keyPalette.safe[(tintIndex + 2) % keyPalette.safe.length]})`
        : "linear-gradient(135deg, #070707, #1a1a1a)";
      board.appendChild(cell);
      cells.push(cell);
    }
  }
}

function updateStatus(message) {
  statusText.textContent = message;
}

function animatePress(cell, isSafe) {
  cell.classList.remove("pressed");
  void cell.offsetWidth;
  cell.classList.add("pressed");

  window.setTimeout(() => {
    cell.classList.remove("pressed");
  }, 160);

  if (isSafe) {
    playTone(540, 0.08, "triangle");
    updateStatus("좋은 키캡! 계속 이동해요.");
  } else {
    playTone(180, 0.08, "sawtooth");
    updateStatus("이 키캡은 위험해요! 조심하세요.");
  }
}

function playTone(frequency, duration, type = "triangle") {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  const audioCtx = new AudioCtx();
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.type = type;
  oscillator.frequency.value = frequency;

  gainNode.gain.setValueAtTime(0.0001, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.06, audioCtx.currentTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.start();
  oscillator.stop(audioCtx.currentTime + duration);

  oscillator.onended = () => audioCtx.close();
}

function movePlayer(dx, dy) {
  const nextX = Math.max(0, Math.min(cols - 1, player.x + dx));
  const nextY = Math.max(0, Math.min(rows - 1, player.y + dy));

  const prevCell = board.querySelector(`.keycap[data-x="${player.x}"][data-y="${player.y}"]`);
  if (prevCell) {
    prevCell.classList.remove("active");
  }

  player.x = nextX;
  player.y = nextY;

  const currentCell = board.querySelector(`.keycap[data-x="${player.x}"][data-y="${player.y}"]`);
  const isSafe = validCells.has(getKeyId(player.x, player.y));

  if (currentCell) {
    animatePress(currentCell, isSafe);
    currentCell.classList.add("active");
  }

  const boardWidth = board.clientWidth;
  const boardHeight = board.clientHeight;
  const cellWidth = (boardWidth - gridGap * (cols - 1)) / cols;
  const cellHeight = (boardHeight - gridGap * (rows - 1)) / rows;

  characterDiv.style.left = `${(player.x * cellWidth) + (player.x * gridGap)}px`;
  characterDiv.style.top = `${(player.y * cellHeight) + (player.y * gridGap)}px`;
  characterDiv.style.width = `${cellWidth}px`;
  characterDiv.style.height = `${cellHeight}px`;
}

function handleKey(event) {
  const key = event.key.toLowerCase();
  const movementMap = {
    arrowup: [0, -1],
    w: [0, -1],
    arrowdown: [0, 1],
    s: [0, 1],
    arrowleft: [-1, 0],
    a: [-1, 0],
    arrowright: [1, 0],
    d: [1, 0],
  };

  const direction = movementMap[key];
  if (!direction) return;

  event.preventDefault();
  movePlayer(direction[0], direction[1]);
}

function initializeBoard() {
  createBoard();
  const startCell = board.querySelector('.keycap[data-x="0"][data-y="0"]');
  if (startCell) {
    startCell.classList.add("active");
  }
  movePlayer(0, 0);
}

initializeBoard();
document.addEventListener("keydown", handleKey);

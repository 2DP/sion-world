(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const game = new PastelStep.Game();
  let endingPreview = new URLSearchParams(location.search).get("ending") === "preview";
  const endingCanvas = $("ending-scene"), endingCtx = endingCanvas.getContext("2d");
  const canvas = $("board"), ctx = canvas.getContext("2d");
  const mini = $("minimap"), mctx = mini.getContext("2d");
  const character = new Image();
  character.src = "character.svg";
  const palette = ["#e8c9d6", "#c4daca", "#d2cce3", "#c5dce4", "#e9dfb9", "#e6cebe"];
  const mobileQuery = matchMedia("(max-width: 760px)");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const keyMap = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right" };
  const held = new Map();
  let queued = null, viewPlayer = { ...game.player }, fx = [], toastUntil = 0;
  let previous = 0, accumulator = 0, uiStatus = "", audio = null, muted = false, best = 0;
  let displaySize = 0;
  try { best = Number(localStorage.getItem("pastel-step-best")) || 0; muted = localStorage.getItem("pastel-step-muted") === "true"; } catch {}
  $("best").textContent = best.toLocaleString("ko-KR");

  function setupAudio() {
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!audio && Audio) audio = new Audio();
      if (audio && audio.state === "suspended") audio.resume().catch(() => {});
    } catch {}
  }
  function tone(frequency, duration = .08, delay = 0, type = "sine", volume = .05) {
    if (!audio || muted || audio.state !== "running") return;
    try {
      const t = audio.currentTime + delay;
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(volume, t + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(t);
      oscillator.stop(t + duration + .02);
    } catch {}
  }
  let popStep = 0;
  function cutePop() {
    if (!audio || muted || audio.state !== "running") return;
    try {
      const t = audio.currentTime;
      const pitch = [1, 1.12, 1.06, 1.18][popStep++ % 4];
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      oscillator.type = "sine";
      // A rounded, quick upward squeak followed by a soft bubble-like drop.
      oscillator.frequency.setValueAtTime(460 * pitch, t);
      oscillator.frequency.exponentialRampToValueAtTime(1050 * pitch, t + .025);
      oscillator.frequency.exponentialRampToValueAtTime(330 * pitch, t + .115);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(.095, t + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, t + .13);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(t);
      oscillator.stop(t + .14);
    } catch {}
  }
  function updateSoundButton() {
    $("sound").textContent = muted ? "♪̸" : "♫";
    $("sound").setAttribute("aria-label", muted ? "소리 켜기" : "소리 끄기");
    $("sound").setAttribute("aria-pressed", String(muted));
  }
  $("sound").addEventListener("click", () => {
    muted = !muted; setupAudio(); updateSoundButton();
    try { localStorage.setItem("pastel-step-muted", String(muted)); } catch {}
    if (!muted) tone(523);
  });
  updateSoundButton();

  const timeText = time => Math.floor(time / 60).toString().padStart(2, "0") + ":" + Math.floor(time % 60).toString().padStart(2, "0");
  function clearInput() { held.clear(); queued = null; }
  function toast(message, duration = 2.5) {
    $("toast").textContent = message; toastUntil = game.time + duration;
    $("toast").classList.add("visible");
  }
  function restart() {
    endingPreview = false;
    setupAudio(); clearInput(); game.reset(); fx = []; viewPlayer = { ...game.player };
    toastUntil = 0; $("toast").classList.remove("visible"); accumulator = 0;
    uiStatus = ""; syncUI(); canvas.focus({ preventScroll: true });
    document.querySelector(".play-card").scrollIntoView({ block: "start", behavior: reducedMotion.matches ? "instant" : "smooth" });
    tone(392, .12); tone(523, .15, .1);
  }
  function togglePause() {
    if (game.status === "playing") { game.pause(); clearInput(); }
    else if (game.status === "paused") { game.resume(); setupAudio(); canvas.focus({ preventScroll: true }); }
    accumulator = 0; syncUI();
  }
  $("pause").addEventListener("click", togglePause);
  $("primary").addEventListener("click", () => {
    if (game.status === "stage-clear") {
      setupAudio(); clearInput(); game.nextStage(); fx = []; viewPlayer = { ...game.player };
      accumulator = 0; toastUntil = 0; $("toast").classList.remove("visible");
      syncUI(); canvas.focus({ preventScroll: true });
    } else if (game.status === "paused") togglePause();
    else restart();
  });
  $("secondary").addEventListener("click", () => {
    endingPreview = false; uiStatus = "";
    clearInput(); game.reset(false); viewPlayer = { ...game.player }; fx = [];
    toastUntil = 0; $("toast").classList.remove("visible"); syncUI(); $("primary").focus();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); togglePause(); return; }
    const dir = keyMap[event.key] || keyMap[event.key.toLowerCase()];
    if (dir && game.status === "playing") {
      event.preventDefault();
      if (!event.repeat) { held.delete(event.code); held.set(event.code, dir); queued = dir; }
    }
    if (event.key === "Tab" && game.status !== "playing") {
      const focusable = [$("primary"), ...(!$("secondary").hidden ? [$("secondary")] : [])];
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !focusable.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !focusable.includes(document.activeElement))) { event.preventDefault(); first.focus(); }
    }
  });
  document.addEventListener("keyup", event => { held.delete(event.code); });
  for (const button of document.querySelectorAll("[data-dir]")) {
    button.addEventListener("pointerdown", event => {
      event.preventDefault();
      if (game.status !== "playing") return;
      const id = "pointer-" + event.pointerId;
      held.delete(id); held.set(id, button.dataset.dir); queued = button.dataset.dir;
      button.setPointerCapture(event.pointerId);
    });
    const release = event => { held.delete("pointer-" + event.pointerId); };
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
    button.addEventListener("contextmenu", event => event.preventDefault());
  }
  function pauseOnLeave() {
    clearInput();
    if (game.status === "playing") { game.pause(); syncUI(); }
    accumulator = 0;
  }
  window.addEventListener("blur", pauseOnLeave);
  document.addEventListener("visibilitychange", () => { if (document.hidden) pauseOnLeave(); });

  function handleEvents() {
    const events = game.drainEvents();
    if (events.some(event => event.type === "move" || event.type === "visit")) cutePop();
    for (const event of events) {
      if (event.type === "visit") {
        fx.push({ x: event.x, y: event.y, at: game.time, gold: game.golden });

      } else if (event.type === "squirrelItem") {
        tone(740, .12); toast("🐿 다람쥐 아이템 등장! 직접 밟아 친구를 불러요.");
      } else if (event.type === "squirrel") {
        tone(660, .15); tone(880, .15, .1); toast("🐿 30초 동안 검은 발판에 도토리를 올려줘요!");
      } else if (event.type === "acorn") {
        tone(440, .09); toast("도토리! 검은 발판이 15초 동안 멈춰요.", 1.5);
      } else if (event.type === "squirrel-end") {
        toast("🐿 다람쥐가 쉬러 갔어요. 도토리는 남아 있어요.");
      } else if (event.type === "shieldItem") {
        tone(740, .15); toast("🛡 실드 등장! 직접 밟아 획득해요.");
      } else if (event.type === "shield") {
        tone(660, .18); tone(990, .2, .1); toast("🛡 10초 동안 무적! 검은 발판의 피해를 막아요.");
      } else if (event.type === "shield-end") {
        toast("실드가 끝났어요. 검은 발판을 조심해요!");
      } else if (event.type === "rabbitItem") {
        tone(880, .15); toast("🐰 토끼 아이템 등장! 직접 밟아 친구를 불러요.");
      } else if (event.type === "rabbit") {
        tone(660, .15); tone(880, .18, .12); toast("🐰 토끼가 30초 동안 발판을 대신 눌러줘요!");
      } else if (event.type === "rabbit-end") {
        toast("🐰 토끼가 쉬러 갔어요. 다음에 또 만나요!");
      } else if (event.type === "booster") {
        tone(980, .12); toast("⚡ 부스터 등장! 직접 밟아 획득해요.");
      } else if (event.type === "boost") {
        tone(660, .15); tone(990, .2, .1); toast("⚡ 10초 동안 상하좌우까지 한 번에!");
      } else if (event.type === "boost-end") {
        toast("부스터가 끝났어요.");
      } else if (event.type === "heal") {
        tone(784, .16); toast("♥ 회복 하트가 나타났어요! 10초 안에 찾아가요.");
      } else if (event.type === "healed") {
        tone(659, .14); tone(880, .18, .1);
        toast(event.recovered ? "♥ 라이프 +1 회복!" : "♥ 하트가 이미 가득해요!");
      } else if (event.type === "stage-clear") {
        clearInput(); [523, 659, 784].forEach((note, i) => tone(note, .2, i * .12));
      } else if (event.type === "hurt") {
        tone(150, .18, 0, "triangle", .06); toast("앗, 그림자! 하트 −1", 1.3);
      } else if (event.type === "gold") {
        [523, 659, 784, 1047].forEach((note, i) => tone(note, .17, i * .075));
        toast("황금 시간! 5초 동안 무적 · 방문 점수 2배", 2);
      } else if (event.type === "bonus") {
        tone(1047, .18); tone(1397, .2, .12); toast("✦ 황금 발판이 나타났어요! 3초 안에 찾아가요.", 2);
      } else if (event.type === "gold-warning") {
        tone(740, .12); tone(740, .12, .17);
      } else if (event.type === "gold-end") {
        toast("황금 시간이 끝났어요. 그림자를 조심해요!", 2);
      } else if (event.type === "won" || event.type === "lost") {
        clearInput();
        if (game.score > best) {
          best = game.score;
          try { localStorage.setItem("pastel-step-best", String(best)); } catch {}
          $("best").textContent = best.toLocaleString("ko-KR");
        }
        const notes = event.type === "won" ? [523, 659, 784, 1047] : [392, 330, 262];
        notes.forEach((note, i) => tone(note, .24, i * .16, "triangle"));
      }
    }
  }

  function showDialog() {
    const status = endingPreview ? "won" : game.status, paused = status === "paused", result = status === "won" || status === "lost";
    $("overlay").classList.toggle("ending-overlay", status === "won");
    $("ending-scene").hidden = status !== "won";
    $("portrait").hidden = status === "won";
    $("overlay").hidden = status === "playing";
    $("pause").disabled = !["playing", "paused"].includes(status);
    $("pause").textContent = paused ? "▷" : "Ⅱ";
    $("pause").setAttribute("aria-label", paused ? "게임 재개" : "일시정지");
    if (status === "playing") return;
    document.querySelector(".dialog").classList.toggle("has-results", result);
    $("dialog-kicker").textContent = paused ? "TAKE A LITTLE BREATH" : status === "won" ? "A GARDEN FULL OF FOOTPRINTS" : status === "lost" ? "EVERY STEP WAS AN ADVENTURE" : "HELLO, LITTLE EXPLORER";
    $("dialog-title").textContent = paused ? "잠깐, 쉬어가요." : status === "won" ? "정원 산책 완료!" : status === "lost" ? "다시 걸어볼까요?" : "우리, 산책할까요?";
    $("dialog-description").innerHTML = paused ? "정원도 함께 쉬고 있어요.<br>준비되면 다시 걸어볼까요?" : status === "won" ? "625칸 모두에 발자국을 남겼어요.<br>모모와 함께한 멋진 모험이었어요!" : status === "lost" ? "하트를 모두 사용했어요.<br>다음 산책은 조금 더 멀리 갈 수 있을 거예요." : "모모와 함께 625개의 파스텔 발판을<br>모두 밟아 꺼주세요.";
    $("primary").innerHTML = (paused ? "이어서 걷기" : result ? "다시 모험하기" : "모험 시작하기") + " <span>→</span>";
    $("secondary").hidden = !result;
    $("result-stats").hidden = !result;
    if (result) $("result-stats").innerHTML =
      "<div>최종 점수<b>" + game.score.toLocaleString("ko-KR") + "</b></div>" +
      "<div>산책 시간<b>" + timeText(game.time) + "</b></div>" +
      "<div>남은 하트<b>" + game.lives + "</b></div>" +
      "<div>남긴 발자국<b>" + game.visitedCount + " / " + game.visited.length + "</b></div>";
    $("dialog-hint").textContent = paused ? "ESC를 눌러도 이어서 걸을 수 있어요" : result ? "기록은 이 브라우저에 저장돼요" : "방향키 / WASD · 모바일은 방향 패드";
    if (status === "stage-clear") {
      $("dialog-kicker").textContent = "STAGE " + game.stage + " CLEAR";
      $("dialog-title").textContent = "스테이지 " + game.stage + " 완료!";
      $("dialog-description").textContent = "다음 정원에는 더 많고 빠른 그림자가 기다려요. 라이프는 10개로 회복되고 점수는 이어져요.";
      $("primary").textContent = "스테이지 " + (game.stage + 1) + " 시작 →";
      $("dialog-hint").textContent = "준비되면 다음 스테이지를 시작하세요.";
    } else if (status === "won") {
      $("dialog-title").textContent = "10개 스테이지 모두 완료!";
      $("dialog-kicker").textContent = endingPreview ? "ENDING PREVIEW" : "OUR LITTLE HAPPY ENDING";
      $("dialog-title").textContent = "우리의 정원, 함께라서 행복해!";
      $("dialog-description").textContent = "모험을 마친 모모와 토끼, 다람쥐. 이제 꽃이 가득한 정원에서 함께 놀아요.";
      $("dialog-hint").textContent = endingPreview ? "엔딩 미리보기 · 플레이 기록에는 반영되지 않아요" : "10개 스테이지 클리어! 함께해 주셔서 고마워요.";
      if (endingPreview) { $("result-stats").hidden = true; $("primary").textContent = "처음부터 모험하기 →"; }
    } else if (status === "ready") {
      $("dialog-description").textContent = "7×7부터 25×25까지 커지는 정원 10개에 도전해요. 회복 하트와 십자 부스터도 챙겨보세요!";
    }
    $("primary").focus({ preventScroll: true });
  }
  let lastLives = -1;
  function syncUI() {
    $("stage-label").textContent = "STAGE " + game.stage + " / " + game.config.stages + " · " + game.size + " × " + game.size;
    $("total-tiles").textContent = " / " + game.visited.length;
    $("progress").setAttribute("aria-valuemax", String(game.visited.length));
    canvas.setAttribute("aria-label", game.size + " 곱하기 " + game.size + " 파스텔 정원. 방향키 또는 WASD로 이동하세요.");
    $("squirrel-banner").hidden = !game.squirrel;
    $("squirrel-seconds").textContent = game.squirrel ? Math.max(0, game.squirrel.expires - game.time).toFixed(1) + "s" : "";
    $("shield-banner").hidden = !game.shielded;
    $("shield-seconds").textContent = Math.max(0, game.shieldUntil - game.time).toFixed(1) + "s";
    $("rabbit-banner").hidden = !game.rabbit;
    $("rabbit-seconds").textContent = game.rabbit ? Math.max(0, game.rabbit.expires - game.time).toFixed(1) + "s" : "";
    $("boost-banner").hidden = !game.boosted;
    $("boost-seconds").textContent = Math.max(0, game.boostUntil - game.time).toFixed(1) + "s";
    $("hazard-info").textContent = "검은 발판 " + game.hazards.length + "개 · " + game.hazardInterval.toFixed(2) + "초마다 이동";
    if (uiStatus !== game.status) { uiStatus = game.status; showDialog(); }
    if (lastLives !== game.lives) {
      lastLives = game.lives;
      $("hearts").innerHTML = Array.from({ length: game.config.lives }, (_, i) => '<span aria-hidden="true" class="' + (i < game.lives ? "" : "lost") + '">♥</span>').join("");
      $("hearts").setAttribute("aria-label", "라이프 " + game.lives + "개");
      $("life-count").textContent = game.lives + " / 10";
    }
    $("score").textContent = String(game.score).padStart(5, "0");
    $("time").textContent = timeText(game.time);
    $("visited").textContent = game.visitedCount;
    $("progress").setAttribute("aria-valuenow", String(game.visitedCount));
    $("progress-fill").style.width = game.visitedCount / game.visited.length * 100 + "%";
    const left = game.visited.length - game.visitedCount;
    $("progress-caption").textContent = !left ? "모든 칸에 발자국을 남겼어요. 정말 멋져요!" : left <= 10 ? "이제 " + left + "칸! 반짝이는 테두리를 찾아보세요." : game.visitedCount > 1 ? left + "개의 발판이 모모의 발걸음을 기다려요." : "서두르지 않아도 괜찮아요. 한 칸씩 시작해요.";
    $("board-wrap").classList.toggle("is-golden", game.golden);
    $("gold-banner").hidden = !game.golden;
    if (game.golden) {
      const remaining = Math.max(0, game.goldUntil - game.time);
      $("gold-seconds").textContent = remaining.toFixed(1) + "s";
      $("gold-meter").style.width = remaining / game.config.goldDuration * 100 + "%";
      $("gold-banner").classList.toggle("ending", remaining <= 1);
    }
    let remaining = Math.max(0, game.nextBonusAt - game.time), duration = game.config.bonusInterval;
    let message = "황금 발판은 15초마다 찾아와요.<br>보이면 놓치지 말고 달려가요!";
    if (game.golden) {
      remaining = game.goldUntil - game.time; duration = game.config.goldDuration;
      message = "지금은 모든 발판이 안전해요!<br>새 발판을 밟으면 +20점을 받아요.";
    } else if (game.bonus) {
      remaining = game.bonus.expires - game.time; duration = game.config.bonusDuration;
      message = "✦ 황금 발판이 나타났어요!<br>사라지기 전에 별을 찾아가요.";
    }
    $("bonus-countdown").textContent = Math.ceil(remaining) + "s";
    $("bonus-description").innerHTML = message;
    $("bonus-fill").style.width = (game.golden || game.bonus ? remaining / duration : 1 - remaining / duration) * 100 + "%";
    if (game.time >= toastUntil) $("toast").classList.remove("visible");
  }

  function rounded(context, x, y, w, h, radius, fill, stroke) {
    context.beginPath(); context.roundRect(x, y, w, h, radius);
    if (fill) { context.fillStyle = fill; context.fill(); }
    if (stroke) { context.strokeStyle = stroke; context.lineWidth = 1; context.stroke(); }
  }
  function shieldIcon(context, x, y, size) {
    context.save(); context.translate(x, y); context.scale(size, size);
    context.beginPath(); context.moveTo(0, -.4); context.lineTo(.34, -.25);
    context.lineTo(.28, .12); context.quadraticCurveTo(.2, .34, 0, .45);
    context.quadraticCurveTo(-.2, .34, -.28, .12); context.lineTo(-.34, -.25); context.closePath();
    context.fillStyle = "#4b9cba"; context.fill(); context.strokeStyle = "#ffffff"; context.lineWidth = .05; context.stroke();
    context.beginPath(); context.moveTo(-.13, .01); context.lineTo(-.02, .12); context.lineTo(.15, -.12); context.stroke(); context.restore();
  }
  function squirrelIcon(context, x, y, size) {
    context.save(); context.translate(x, y); context.scale(size, size);
    const oval = (cx, cy, rx, ry, color, outline = false) => {
      context.beginPath(); context.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      context.fillStyle = color; context.fill();
      if (outline) { context.strokeStyle = "#653c25"; context.lineWidth = .025; context.stroke(); }
    };
    // Large curled tail, cream belly, round ears and cheeks remain clear at small sizes.
    oval(.23, -.03, .25, .37, "#c97c3d", true);
    oval(.26, -.1, .14, .23, "#f3bd79");
    context.beginPath(); context.arc(.26, -.09, .105, -.7, Math.PI * 1.4);
    context.strokeStyle = "#a55d30"; context.lineWidth = .035; context.stroke();
    oval(-.1, .2, .22, .24, "#b96e36", true);
    oval(-.14, .22, .13, .17, "#ffe3b3");
    oval(-.29, -.27, .09, .11, "#c97c3d", true);
    oval(-.02, -.27, .085, .105, "#c97c3d", true);
    oval(-.29, -.27, .045, .065, "#efb69c");
    oval(-.02, -.27, .04, .06, "#efb69c");
    oval(-.16, -.08, .235, .21, "#dc9a58", true);
    oval(-.18, .005, .17, .1, "#ffe9c7");
    oval(-.26, -.11, .032, .044, "#322820"); oval(-.07, -.11, .032, .044, "#322820");
    oval(-.268, -.122, .01, .013, "#fff"); oval(-.078, -.122, .01, .013, "#fff");
    oval(-.165, -.01, .033, .023, "#583422");
    oval(-.32, -.015, .04, .022, "#f3b49d");
    oval(-.25, .41, .09, .04, "#754326"); oval(.03, .41, .09, .04, "#754326");
    context.restore();
  }
  function bunny(context, x, y, size) {
    context.save(); context.translate(x, y);
    const oval = (cx, cy, rx, ry, color) => {
      context.beginPath(); context.ellipse(cx * size, cy * size, rx * size, ry * size, 0, 0, Math.PI * 2);
      context.fillStyle = color; context.fill();
    };
    oval(-.16, -.28, .11, .28, "#fff9f1"); oval(.16, -.28, .11, .28, "#fff9f1");
    oval(-.16, -.30, .05, .18, "#f3b9ca"); oval(.16, -.30, .05, .18, "#f3b9ca");
    oval(0, .12, .36, .31, "#fff9f1");
    oval(-.13, .07, .035, .045, "#58424c"); oval(.13, .07, .035, .045, "#58424c");
    oval(-.23, .18, .065, .035, "#f3b9ca"); oval(.23, .18, .065, .035, "#f3b9ca");
    oval(0, .17, .035, .025, "#c77996"); context.restore();
  }
  function star(context, x, y, radius, color) {
    context.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4 - Math.PI / 2, r = i % 2 ? radius * .3 : radius;
      if (!i) context.moveTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
      else context.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
    }
    context.closePath(); context.fillStyle = color; context.fill();
  }
  function resize() {
    const width = canvas.getBoundingClientRect().width;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (width && (displaySize !== width || canvas.width !== Math.round(width * ratio))) {
      displaySize = width; canvas.width = Math.round(width * ratio); canvas.height = canvas.width;
    }
  }
  new ResizeObserver(resize).observe(canvas);
  function draw() {
    const width = canvas.width, mobile = mobileQuery.matches;
    const cells = mobile ? Math.min(11, game.size) : game.size, tile = width / cells;
    const cameraX = mobile ? Math.max(0, Math.min(game.size - cells, viewPlayer.x - (cells - 1) / 2)) : 0;
    const cameraY = mobile ? Math.max(0, Math.min(game.size - cells, viewPlayer.y - (cells - 1) / 2)) : 0;
    const sx = x => (x - cameraX) * tile, sy = y => (y - cameraY) * tile;
    ctx.clearRect(0, 0, width, width);
    ctx.fillStyle = game.golden ? "#e7d9aa" : "#e4e9dc";
    ctx.fillRect(0, 0, width, width);
    const gap = tile * .075, radius = tile * .17;
    const hazardKeys = new Set(game.hazards.map(h => h.y * game.size + h.x));
    const lastFew = game.visited.length - game.visitedCount <= 10;
    for (let y = Math.floor(cameraY); y < Math.min(game.size, Math.ceil(cameraY + cells)); y++) {
      for (let x = Math.floor(cameraX); x < Math.min(game.size, Math.ceil(cameraX + cells)); x++) {
        const visited = game.visited[y * game.size + x], hazard = hazardKeys.has(y * game.size + x);
        const px = sx(x) + gap, py = sy(y) + gap, size = tile - gap * 2;
        const color = game.golden ? (visited ? "#c7b678" : "#f1d77e") : hazard ? "#424550" : visited ? "#c5cebe" : palette[(x * 7 + y * 11 + Math.floor(x / 3) * 2 + Math.floor(y / 4)) % palette.length];
        rounded(ctx, px, py + tile * .055, size, size, radius, game.golden ? "#b9a25b" : hazard ? "#2e323c" : visited ? "#b9c4b0" : "#b4bfa9");
        rounded(ctx, px, py, size, size - tile * .035, radius, color);
        if (hazard) {
          if (game.golden) rounded(ctx, px + 1, py + 1, size - 2, size - tile * .035 - 2, radius, null, "#a48940");
          ctx.fillStyle = game.golden ? "#9b803b" : "#a6a3b7";
          ctx.font = "bold " + tile * .5 + "px Georgia"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText("!", sx(x) + tile / 2, sy(y) + tile * .48);
        } else if (visited) {
          ctx.strokeStyle = game.golden ? "#a29050" : "#a8b69d"; ctx.lineWidth = Math.max(1, tile * .045);
          ctx.beginPath(); ctx.moveTo(sx(x) + tile * .39, sy(y) + tile * .51); ctx.lineTo(sx(x) + tile * .47, sy(y) + tile * .59); ctx.lineTo(sx(x) + tile * .64, sy(y) + tile * .39); ctx.stroke();
        } else {
          ctx.fillStyle = "#ffffff40"; ctx.beginPath(); ctx.arc(px + size * .26, py + size * .25, tile * .035, 0, Math.PI * 2); ctx.fill();
          if (lastFew) {
            ctx.globalAlpha = reducedMotion.matches ? .8 : .5 + Math.sin(game.time * 4) * .3;
            rounded(ctx, px, py, size, size, radius, null, "#8d5ba2"); ctx.globalAlpha = 1;
          }
        }
      }
    }
    for (const h of game.hazards.filter(h => game.disabled(h))) {
      rounded(ctx, sx(h.x) + gap, sy(h.y) + gap, tile - gap * 2, tile - gap * 2, radius, "#89745b", "#e2c595");
      ctx.save(); ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = tile * .55 + "px sans-serif"; ctx.fillText("🌰", sx(h.x) + tile / 2, sy(h.y) + tile * .45);
      ctx.fillStyle = "#fff6dc"; ctx.font = "bold " + tile * .23 + "px sans-serif";
      ctx.fillText(Math.ceil(h.disabledUntil - game.time) + "s", sx(h.x) + tile / 2, sy(h.y) + tile * .8); ctx.restore();
    }
    if (game.plans) for (let i = 0; i < game.plans.length; i++) {
      const p = game.plans[i], h = game.hazards[i];
      if (p.x === h.x && p.y === h.y) continue;
      ctx.save(); ctx.setLineDash([tile * .13, tile * .08]);
      rounded(ctx, sx(p.x) + gap, sy(p.y) + gap, tile - gap * 2, tile - gap * 2, radius, "#55506112", game.golden ? "#aa883f" : "#827188");
      ctx.restore();
    }
    if (game.bonus) {
      const b = game.bonus, x = sx(b.x) + tile / 2, y = sy(b.y) + tile / 2;
      ctx.save(); ctx.shadowColor = "#e5b43a"; ctx.shadowBlur = tile * .7;
      rounded(ctx, sx(b.x) + gap, sy(b.y) + gap, tile - gap * 2, tile - gap * 2, radius, "#f6d475", "#b69442");
      ctx.shadowBlur = 0;
      star(ctx, x, y, tile * .32, "#fff9db");
      ctx.beginPath(); ctx.strokeStyle = "#a27a2f"; ctx.lineWidth = tile * .045;
      ctx.arc(x, y, tile * .4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, (b.expires - game.time) / game.config.bonusDuration)); ctx.stroke();
      ctx.restore();
      // When the mobile camera hides a bonus, a clamped marker points toward it.
      if (mobile && (b.x < cameraX || b.x >= cameraX + cells || b.y < cameraY || b.y >= cameraY + cells)) {
        const px = Math.max(tile * .65, Math.min(width - tile * .65, x));
        const py = Math.max(tile * .65, Math.min(width - tile * .65, y));
        ctx.beginPath(); ctx.arc(px, py, tile * .4, 0, Math.PI * 2); ctx.fillStyle = "#fff3c1"; ctx.fill(); star(ctx, px, py, tile * .25, "#bd9237");
      }
    }
    if (game.heal) {
      const h = game.heal, x = sx(h.x) + tile / 2, y = sy(h.y) + tile / 2;
      rounded(ctx, sx(h.x) + gap, sy(h.y) + gap, tile - gap * 2, tile - gap * 2, radius, "#ffe4ec", "#c3547e");
      ctx.save(); ctx.fillStyle = "#c3547e"; ctx.font = "bold " + tile * .7 + "px sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("♥", x, y);
      ctx.beginPath(); ctx.strokeStyle = "#c3547e"; ctx.lineWidth = tile * .045;
      ctx.arc(x, y, tile * .42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, (h.expires - game.time) / game.config.healDuration)); ctx.stroke();
      if (mobile && (h.x < cameraX || h.x >= cameraX + cells || h.y < cameraY || h.y >= cameraY + cells)) {
        ctx.fillText("♥", Math.max(tile * .65, Math.min(width - tile * .65, x)), Math.max(tile * .65, Math.min(width - tile * .65, y)));
      }
      ctx.restore();
    }
    if (game.booster) {
      const b = game.booster, x = sx(b.x) + tile / 2, y = sy(b.y) + tile / 2;
      rounded(ctx, sx(b.x) + gap, sy(b.y) + gap, tile - gap * 2, tile - gap * 2, radius, "#d5f4ff", "#287aaf");
      ctx.save(); ctx.fillStyle = "#287aaf"; ctx.font = "bold " + tile * .7 + "px sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("⚡", x, y);
      ctx.beginPath(); ctx.strokeStyle = "#287aaf"; ctx.lineWidth = tile * .045;
      ctx.arc(x, y, tile * .42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, (b.expires - game.time) / game.config.boosterDuration)); ctx.stroke();
      if (mobile && (b.x < cameraX || b.x >= cameraX + cells || b.y < cameraY || b.y >= cameraY + cells))
        ctx.fillText("⚡", Math.max(tile * .65, Math.min(width - tile * .65, x)), Math.max(tile * .65, Math.min(width - tile * .65, y)));
      ctx.restore();
    }
    if (game.squirrelItem) {
      const s = game.squirrelItem, x = sx(s.x) + tile / 2, y = sy(s.y) + tile / 2;
      rounded(ctx, sx(s.x) + gap, sy(s.y) + gap, tile - gap * 2, tile - gap * 2, radius, "#ffe7c5", "#ad7541");
      ctx.save(); squirrelIcon(ctx, x, y, tile * .88);
      ctx.beginPath(); ctx.strokeStyle = "#ad7541"; ctx.lineWidth = tile * .045;
      ctx.arc(x, y, tile * .42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, (s.expires - game.time) / game.config.squirrelItemDuration)); ctx.stroke();
      if (mobile && (s.x < cameraX || s.x >= cameraX + cells || s.y < cameraY || s.y >= cameraY + cells))
        squirrelIcon(ctx, Math.max(tile * .65, Math.min(width - tile * .65, x)), Math.max(tile * .65, Math.min(width - tile * .65, y)), tile * .95);
      ctx.restore();
    }
    if (game.shieldItem) {
      const s = game.shieldItem, x = sx(s.x) + tile / 2, y = sy(s.y) + tile / 2;
      rounded(ctx, sx(s.x) + gap, sy(s.y) + gap, tile - gap * 2, tile - gap * 2, radius, "#d4f5ef", "#37899d");
      shieldIcon(ctx, x, y, tile * .8);
      ctx.beginPath(); ctx.strokeStyle = "#37899d"; ctx.lineWidth = tile * .045;
      ctx.arc(x, y, tile * .42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, (s.expires - game.time) / game.config.shieldItemDuration)); ctx.stroke();
      if (mobile && (s.x < cameraX || s.x >= cameraX + cells || s.y < cameraY || s.y >= cameraY + cells))
        shieldIcon(ctx, Math.max(tile * .65, Math.min(width - tile * .65, x)), Math.max(tile * .65, Math.min(width - tile * .65, y)), tile * .7);
    }
    if (game.rabbitItem) {
      const r = game.rabbitItem, x = sx(r.x) + tile / 2, y = sy(r.y) + tile / 2;
      rounded(ctx, sx(r.x) + gap, sy(r.y) + gap, tile - gap * 2, tile - gap * 2, radius, "#eedfff", "#9466ae");
      bunny(ctx, x, y + tile * .05, tile * .8);
      ctx.beginPath(); ctx.strokeStyle = "#9466ae"; ctx.lineWidth = tile * .045;
      ctx.arc(x, y, tile * .42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, (r.expires - game.time) / game.config.rabbitItemDuration)); ctx.stroke();
      if (mobile && (r.x < cameraX || r.x >= cameraX + cells || r.y < cameraY || r.y >= cameraY + cells))
        bunny(ctx, Math.max(tile * .65, Math.min(width - tile * .65, x)), Math.max(tile * .65, Math.min(width - tile * .65, y)), tile * .7);
    }
    if (game.rabbit) {
      const r = game.rabbit;
      const bob = reducedMotion.matches || game.status !== "playing" ? 0 : Math.sin(game.time * 3) * tile * .03;
      bunny(ctx, sx(r.x) + tile / 2, sy(r.y) + tile * .55 + bob, tile * .9);
    }
    if (game.boosted) for (const p of game.pressTargets()) {
      rounded(ctx, sx(p.x) + gap, sy(p.y) + gap, tile - gap * 2, tile - gap * 2, radius, "#52bfff25", "#287aaf");
    }
    fx = fx.filter(f => game.time - f.at < .4);
    for (const f of fx) {
      const t = (game.time - f.at) / .4;
      ctx.globalAlpha = 1 - t;
      rounded(ctx, sx(f.x) + gap - t * tile * .15, sy(f.y) + gap - t * tile * .15, tile - gap * 2 + t * tile * .3, tile - gap * 2 + t * tile * .3, radius, null, f.gold ? "#fff3b0" : "#fffff4");
      ctx.globalAlpha = 1;
    }
    const px = sx(viewPlayer.x) + tile / 2, py = sy(viewPlayer.y) + tile / 2;
    ctx.fillStyle = "#40503932"; ctx.beginPath(); ctx.ellipse(px, py + tile * .24, tile * .45, tile * .17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    const hurt = game.invulnerableUntil > game.time && !game.golden && !game.shielded;
    if (game.shielded) {
      ctx.beginPath(); ctx.arc(px, py, tile * .65, 0, Math.PI * 2); ctx.fillStyle = "#77dce530"; ctx.fill(); ctx.strokeStyle = "#47b8cb"; ctx.lineWidth = tile * .065; ctx.stroke();
    }
    if (hurt) ctx.globalAlpha = reducedMotion.matches ? .7 : .65 + Math.sin(game.time * 22) * .2;
    ctx.beginPath(); ctx.arc(px, py, tile * .48, 0, Math.PI * 2); ctx.strokeStyle = game.golden ? "#fff5af" : "#ffffed"; ctx.lineWidth = tile * .08; ctx.stroke();
    const bob = reducedMotion.matches || game.status !== "playing" ? 0 : Math.sin(game.time * 5) * tile * .025;
    if (character.complete && character.naturalWidth) ctx.drawImage(character, px - tile * .78, py - tile * 1.2 + bob, tile * 1.56, tile * 1.755);
    else { ctx.fillStyle = "#db94aa"; ctx.beginPath(); ctx.arc(px, py, tile * .34, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    if (game.squirrel) {
      const s = game.squirrel;
      const sameCell = s.x === game.player.x && s.y === game.player.y;
      const size = tile * .8;
      // Draw after the player so the companion is visible immediately on pickup.
      const x = Math.max(size * .5, Math.min(width - size * .5, sx(s.x) + tile * (sameCell ? .85 : .5)));
      const y = Math.max(size * .5, Math.min(width - size * .5, sy(s.y) + tile * .45));
      const visible = s.x >= cameraX && s.x < cameraX + cells && s.y >= cameraY && s.y < cameraY + cells;
      if (visible) squirrelIcon(ctx, x, y, size);
    }
    if (mobile) drawMinimap(cameraX, cameraY, cells);
  }
  function drawMinimap(cx, cy, cells) {
    const step = mini.width / game.size;
    mctx.fillStyle = "#e9eedf"; mctx.fillRect(0, 0, mini.width, mini.height);
    for (let y = 0; y < game.size; y++) for (let x = 0; x < game.size; x++) {
      mctx.fillStyle = game.visited[y * game.size + x] ? "#b6c2a9" : "#e7d3d7"; mctx.fillRect(x * step, y * step, step - .6, step - .6);
    }
    mctx.fillStyle = "#4a4755";
    for (const h of game.hazards) { mctx.fillStyle = game.disabled(h) ? "#ad7541" : "#4a4755"; mctx.fillRect(h.x * step, h.y * step, step, step); }
    if (game.bonus) { mctx.fillStyle = "#d29d20"; mctx.fillRect(game.bonus.x * step - 1, game.bonus.y * step - 1, step + 2, step + 2); }
    if (game.heal) { mctx.fillStyle = "#d04c7c"; mctx.fillRect(game.heal.x * step - 1, game.heal.y * step - 1, step + 2, step + 2); }
    if (game.booster) { mctx.fillStyle = "#287aaf"; mctx.fillRect(game.booster.x * step - 1, game.booster.y * step - 1, step + 2, step + 2); }
    if (game.shieldItem) { mctx.fillStyle = "#37899d"; mctx.fillRect(game.shieldItem.x * step - 1, game.shieldItem.y * step - 1, step + 2, step + 2); }
    for (const s of [game.squirrelItem, game.squirrel].filter(Boolean)) { mctx.fillStyle = "#ad7541"; mctx.fillRect(s.x * step - 1, s.y * step - 1, step + 2, step + 2); }
    for (const r of [game.rabbitItem, game.rabbit].filter(Boolean)) { mctx.fillStyle = "#9466ae"; mctx.fillRect(r.x * step - 1, r.y * step - 1, step + 2, step + 2); }
    mctx.strokeStyle = "#758766"; mctx.lineWidth = 1.5; mctx.strokeRect(cx * step, cy * step, cells * step, cells * step);
    mctx.beginPath(); mctx.arc((game.player.x + .5) * step, (game.player.y + .5) * step, step * .85, 0, Math.PI * 2); mctx.fillStyle = "#b35178"; mctx.fill(); mctx.strokeStyle = "#fff"; mctx.stroke();
  }
  function drawEnding(seconds) {
    const c = endingCtx, w = endingCanvas.width, h = endingCanvas.height;
    const t = reducedMotion.matches ? 0 : seconds;
    c.clearRect(0, 0, w, h);
    const sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#dcf3f2"); sky.addColorStop(1, "#fff3d8"); c.fillStyle = sky; c.fillRect(0, 0, w, h);
    c.fillStyle = "#ffe4a0"; c.beginPath(); c.arc(780, 82, 45, 0, Math.PI * 2); c.fill();
    for (const [x, y] of [[130, 70], [430, 45], [640, 110]]) {
      c.fillStyle = "#ffffffb0"; c.beginPath(); c.ellipse(x + Math.sin(t * .18) * 10, y, 65, 18, 0, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = "#bfd8ad"; c.beginPath(); c.ellipse(480, 460, 650, 250, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#d6e5b6"; c.beginPath(); c.ellipse(350, 460, 520, 200, -.08, 0, Math.PI * 2); c.fill();
    // Picket fence and a flower-filled lawn frame the play area.
    for (let x = 25; x < w; x += 48) rounded(c, x, 218, 15, 65, 7, "#fff8e7");
    rounded(c, 0, 237, w, 9, 3, "#fff8e7"); rounded(c, 0, 261, w, 8, 3, "#fff8e7");
    for (let i = 0; i < 38; i++) {
      const x = (i * 137 + 24) % w, y = 300 + (i * 53 % 170);
      if (x > 270 && x < 700 && y < 400) continue;
      c.strokeStyle = "#81a16b"; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 16); c.stroke();
      for (let p = 0; p < 5; p++) {
        const a = p * Math.PI * 2 / 5; c.fillStyle = ["#efb7c7", "#fff9e6", "#c8b8e3"][i % 3];
        c.beginPath(); c.arc(x + Math.cos(a) * 6, y + Math.sin(a) * 6, 5, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = "#e8bf61"; c.beginPath(); c.arc(x, y, 3, 0, Math.PI * 2); c.fill();
    }
    const girlX = 475 + Math.sin(t * .9) * 16, rabbitX = 315 + Math.sin(t * 1.2) * 25, squirrelX = 640 + Math.sin(t * 1.1 + 2) * 24;
    for (const [x, rx] of [[girlX, 48], [rabbitX, 31], [squirrelX, 29]]) {
      c.fillStyle = "#75965c25"; c.beginPath(); c.ellipse(x, 380, rx, 9, 0, 0, Math.PI * 2); c.fill();
    }
    if (character.complete && character.naturalWidth) c.drawImage(character, girlX - 95, 166 - Math.abs(Math.sin(t * 2)) * 7, 190, 214);
    bunny(c, rabbitX, 329 - Math.abs(Math.sin(t * 2.4)) * 16, 99);
    squirrelIcon(c, squirrelX, 332 - Math.abs(Math.sin(t * 2.1 + 1)) * 10, 87);
    const ballX = 475 + Math.sin(t * 1.35) * 108, ballY = 381 - Math.abs(Math.cos(t * 1.35)) * 38;
    c.save(); c.translate(ballX, ballY); c.rotate(t * 1.6);
    c.fillStyle = "#f4c4a1"; c.beginPath(); c.arc(0, 0, 17, 0, Math.PI * 2); c.fill();
    star(c, 0, 0, 12, "#fff6dd"); c.restore();
    for (let i = 0; i < 3; i++) {
      const x = 240 + i * 210 + Math.sin(t + i) * 14, y = 147 + Math.cos(t * .8 + i) * 13;
      c.fillStyle = "#e2a5c0"; c.beginPath(); c.ellipse(x - 5, y, 7, 4 + Math.abs(Math.sin(t * 4)) * 3, -.5, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(x + 5, y, 7, 4 + Math.abs(Math.sin(t * 4)) * 3, .5, 0, Math.PI * 2); c.fill();
    }
  }
  function frame(timestamp) {
    const delta = previous ? Math.min(.1, (timestamp - previous) / 1000) : 0;
    previous = timestamp;
    if (game.status === "playing") {
      accumulator += delta;
      while (accumulator >= 1 / 60 && game.status === "playing") {
        const values = [...held.values()];
        const canMove = game.time + 1 / 60 + 1e-9 >= game.nextPlayerAt;
        game.update(1 / 60, queued || values[values.length - 1] || null);
        if (canMove) queued = null;
        handleEvents(); accumulator -= 1 / 60;
      }
      const blend = reducedMotion.matches ? 1 : 1 - Math.exp(-delta * 25);
      viewPlayer.x += (game.player.x - viewPlayer.x) * blend;
      viewPlayer.y += (game.player.y - viewPlayer.y) * blend;
    } else accumulator = 0;
    syncUI(); draw();
    if (game.status === "won" || endingPreview) drawEnding(timestamp / 1000);
    requestAnimationFrame(frame);
  }
  resize(); syncUI(); requestAnimationFrame(frame);
})();

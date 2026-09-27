(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const game = new PastelStep.Game();
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
  function tone(frequency, duration = .08, delay = 0, type = "sine", volume = .035) {
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
  $("primary").addEventListener("click", () => game.status === "paused" ? togglePause() : restart());
  $("secondary").addEventListener("click", () => {
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
    for (const event of game.drainEvents()) {
      if (event.type === "visit") {
        fx.push({ x: event.x, y: event.y, at: game.time, gold: game.golden });
        tone(game.golden ? 880 : 510 + (game.visitedCount % 6) * 42, .055, 0, "sine", .018);
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
    const status = game.status, paused = status === "paused", result = status === "won" || status === "lost";
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
      "<div>남긴 발자국<b>" + game.visitedCount + " / 625</b></div>";
    $("dialog-hint").textContent = paused ? "ESC를 눌러도 이어서 걸을 수 있어요" : result ? "기록은 이 브라우저에 저장돼요" : "방향키 / WASD · 모바일은 방향 패드";
    $("primary").focus({ preventScroll: true });
  }
  let lastLives = -1;
  function syncUI() {
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
    $("progress-fill").style.width = game.visitedCount / 625 * 100 + "%";
    const left = 625 - game.visitedCount;
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
    const cells = mobile ? 11 : 25, tile = width / cells;
    const cameraX = mobile ? Math.max(0, Math.min(25 - cells, viewPlayer.x - (cells - 1) / 2)) : 0;
    const cameraY = mobile ? Math.max(0, Math.min(25 - cells, viewPlayer.y - (cells - 1) / 2)) : 0;
    const sx = x => (x - cameraX) * tile, sy = y => (y - cameraY) * tile;
    ctx.clearRect(0, 0, width, width);
    ctx.fillStyle = game.golden ? "#e7d9aa" : "#e4e9dc";
    ctx.fillRect(0, 0, width, width);
    const gap = tile * .075, radius = tile * .17;
    const hazardKeys = new Set(game.hazards.map(h => h.y * 25 + h.x));
    const lastFew = 625 - game.visitedCount <= 10;
    for (let y = Math.floor(cameraY); y < Math.min(25, Math.ceil(cameraY + cells)); y++) {
      for (let x = Math.floor(cameraX); x < Math.min(25, Math.ceil(cameraX + cells)); x++) {
        const visited = game.visited[y * 25 + x], hazard = hazardKeys.has(y * 25 + x);
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
    const hurt = game.invulnerableUntil > game.time && !game.golden;
    if (hurt) ctx.globalAlpha = reducedMotion.matches ? .7 : .65 + Math.sin(game.time * 22) * .2;
    ctx.beginPath(); ctx.arc(px, py, tile * .48, 0, Math.PI * 2); ctx.strokeStyle = game.golden ? "#fff5af" : "#ffffed"; ctx.lineWidth = tile * .08; ctx.stroke();
    const bob = reducedMotion.matches || game.status !== "playing" ? 0 : Math.sin(game.time * 5) * tile * .025;
    if (character.complete && character.naturalWidth) ctx.drawImage(character, px - tile * .78, py - tile * 1.2 + bob, tile * 1.56, tile * 1.755);
    else { ctx.fillStyle = "#db94aa"; ctx.beginPath(); ctx.arc(px, py, tile * .34, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    if (mobile) drawMinimap(cameraX, cameraY, cells);
  }
  function drawMinimap(cx, cy, cells) {
    const step = mini.width / 25;
    mctx.fillStyle = "#e9eedf"; mctx.fillRect(0, 0, mini.width, mini.height);
    for (let y = 0; y < 25; y++) for (let x = 0; x < 25; x++) {
      mctx.fillStyle = game.visited[y * 25 + x] ? "#b6c2a9" : "#e7d3d7"; mctx.fillRect(x * step, y * step, step - .6, step - .6);
    }
    mctx.fillStyle = "#4a4755";
    for (const h of game.hazards) mctx.fillRect(h.x * step, h.y * step, step, step);
    if (game.bonus) { mctx.fillStyle = "#d29d20"; mctx.fillRect(game.bonus.x * step - 1, game.bonus.y * step - 1, step + 2, step + 2); }
    mctx.strokeStyle = "#758766"; mctx.lineWidth = 1.5; mctx.strokeRect(cx * step, cy * step, cells * step, cells * step);
    mctx.beginPath(); mctx.arc((game.player.x + .5) * step, (game.player.y + .5) * step, step * .85, 0, Math.PI * 2); mctx.fillStyle = "#b35178"; mctx.fill(); mctx.strokeStyle = "#fff"; mctx.stroke();
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
    syncUI(); draw(); requestAnimationFrame(frame);
  }
  resize(); syncUI(); requestAnimationFrame(frame);
})();

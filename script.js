(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const glowFillEl = document.getElementById("glowFill");

  const overlayEl = document.getElementById("overlay");
  const startBtn = document.getElementById("startBtn");
  const howBtn = document.getElementById("howBtn");
  const shareBtn = document.getElementById("shareBtn");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const statusPill = document.getElementById("statusPill");

  const chipsEl = document.getElementById("chips");

  const W = canvas.width;
  const H = canvas.height;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);

  const palette = {
    hot: "#ff4fd8",
    cyan: "#4fe8ff",
    mint: "#2cffd9",
    gold: "#ffd166",
    peach: "#ffb38a",
    white: "#f6f2ff",
    dim: "rgba(246,242,255,.14)",
    dim2: "rgba(246,242,255,.08)",
    danger: "#ff557d",
  };

  const ITEMS = {
    food: [
      { label: "🍔", name: "Burger", color: palette.peach },
      { label: "🍟", name: "Fries", color: palette.gold },
      { label: "🍩", name: "Donut", color: palette.hot },
      { label: "🍕", name: "Pizza", color: palette.peach },
      { label: "🍦", name: "Ice cream", color: palette.cyan },
    ],
    care: [
      { label: "💄", name: "Lip gloss", color: palette.hot },
      { label: "🧴", name: "Skincare", color: palette.mint },
      { label: "🪞", name: "Mirror", color: palette.cyan },
      { label: "🧘‍♀️", name: "Mindfulness", color: palette.gold },
      { label: "✨", name: "Sparkle", color: palette.white },
    ],
  };

  // UI chips legend
  const makeChip = (emoji, accentColor, text) => {
    const chip = document.createElement("div");
    chip.className = "chip";
    const icon = document.createElement("span");
    icon.className = "chipIcon";
    icon.textContent = emoji;
    const accent = document.createElement("span");
    accent.className = "chipAccent";
    accent.style.background = accentColor;
    const t = document.createElement("span");
    t.textContent = text;
    chip.append(icon, accent, t);
    return chip;
  };
  chipsEl.append(
    makeChip("🍔", palette.danger, "الأكل = خصم قلوب"),
    makeChip("💄", palette.mint, "Glow = يزيد"),
    makeChip("✨", palette.cyan, "Shield = ثواني")
  );

  const state = {
    running: false,
    paused: false,
    lastT: 0,
    score: 0,
    lives: 3,
    glow: 0, // 0..100
    shieldMs: 0,
    msg: "",
    difficulty: 0, // increases with score
    rank: "",
  };

  const player = {
    x: W * 0.5,
    y: H - 80,
    w: 54,
    h: 54,
    vx: 0,
    speed: 720,
  };

  const input = {
    left: false,
    right: false,
    pointerDown: false,
    pointerX: W * 0.5,
  };

  /** @type {Array<{x:number,y:number,r:number,vy:number,type:"food"|"care",kind:number,rot:number,spin:number}>} */
  const drops = [];

  /** @type {Array<{x:number,y:number,life:number,ttl:number,color:string,txt:string,vy:number}>} */
  const floaters = [];

  /** @type {Array<{x:number,y:number,life:number,ttl:number,color:string,r:number,vx:number,vy:number}>} */
  const sparks = [];

  const reset = () => {
    state.running = false;
    state.paused = false;
    state.lastT = 0;
    state.score = 0;
    state.lives = 3;
    state.glow = 0;
    state.shieldMs = 0;
    state.msg = "";
    state.difficulty = 0;
    state.rank = "";
    player.x = W * 0.5;
    player.vx = 0;
    drops.length = 0;
    floaters.length = 0;
    sparks.length = 0;
    syncHud();
  };

  const syncHud = () => {
    scoreEl.textContent = String(Math.floor(state.score));
    livesEl.textContent = String(state.lives);
    glowFillEl.style.width = `${clamp(state.glow, 0, 100)}%`;
    glowFillEl.style.filter = state.shieldMs > 0 ? "brightness(1.2) saturate(1.2)" : "";
  };

  const showOverlay = (title, text, pill, startLabel = "ابدأ اللعبة") => {
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    statusPill.textContent = pill;
    startBtn.textContent = startLabel;
    shareBtn.style.display = "none";
    shareBtn.disabled = true;
    overlayEl.classList.remove("hidden");
  };

  const hideOverlay = () => overlayEl.classList.add("hidden");

  const start = () => {
    if (!state.running) {
      state.running = true;
      state.paused = false;
      state.lastT = performance.now();
      hideOverlay();
      requestAnimationFrame(tick);
      return;
    }
    // if already running, just unpause
    state.paused = false;
    hideOverlay();
    state.lastT = performance.now();
    requestAnimationFrame(tick);
  };

  const pause = () => {
    if (!state.running) return;
    state.paused = true;
    showOverlay(
      "متوقف مؤقتًا",
      "اضغطي Space عشان تكملي. إذا تبغي تعيدي: R.",
      "PAUSED",
      "تابعي"
    );
  };

  const gameOver = () => {
    state.running = false;
    state.paused = false;
    // Restart from scratch: you must collect the Glow again
    const lastScore = Math.floor(state.score);
    reset();
    showOverlay(
      "خلصت القلوب!",
      `لااا 😭\nبس ولا يهمك… نعيد من جديد.\nآخر نتيجة لك: ${lastScore}\n(الـGlow رجع 0% ولازم تجمعينه مرة ثانية)`,
      "RESET",
      "ابدأ من جديد"
    );
  };

  const win = () => {
    state.running = false;
    state.paused = false;
    state.rank = "Pageant Queen";
    burst(player.x + player.w / 2, player.y + player.h / 2, palette.hot, 70);
    burst(player.x + player.w / 2, player.y + player.h / 2, palette.cyan, 70);
    burst(player.x + player.w / 2, player.y + player.h / 2, palette.gold, 55);
    floater(W * 0.5, H * 0.35, "💄 ✨ 🪞", "rgba(255,79,216,.95)");
    floater(W * 0.5, H * 0.40, "YOU DID IT!", "rgba(79,232,255,.90)");
    showOverlay(
      "فزتييي! Glow Up كامل!",
      `ملكة المسابقة رسميًا 👑\nرتبتك: Pageant Queen\n\n💄 روج؟ جاهز.\n✨ لمعان؟ حاضر.\n🪞 ثقة؟ 100%.\n\nاضغطي “حفظ صورة الفوز” وارْسليها بالدسكورد عشان تجيك رتبة بلدس.`,
      "PAGEANT QUEEN",
      "العب مرّة ثانية"
    );
    shareBtn.style.display = "inline-flex";
    shareBtn.disabled = false;
  };

  const drawFinishTrack = (t) => {
    const x0 = 56;
    const x1 = W - 56;
    const y = H - 36;
    const w = x1 - x0;
    const p = clamp(state.glow / 100, 0, 1);
    const mx = x0 + w * p;

    // base track
    ctx.save();
    ctx.globalAlpha = 1;
    drawRoundRect(x0, y - 9, w, 18, 999);
    ctx.fillStyle = "rgba(246,242,255,.08)";
    ctx.fill();
    ctx.strokeStyle = "rgba(246,242,255,.18)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // glow progress
    const g = ctx.createLinearGradient(x0, y, x1, y);
    g.addColorStop(0, "rgba(44,255,217,.95)");
    g.addColorStop(0.5, "rgba(79,232,255,.92)");
    g.addColorStop(0.8, "rgba(255,79,216,.92)");
    g.addColorStop(1, "rgba(255,209,102,.95)");
    drawRoundRect(x0, y - 7, w * p, 14, 999);
    ctx.fillStyle = g;
    ctx.shadowColor = "rgba(79,232,255,.30)";
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;

    // finish line (checkered)
    const fx = x1 - 16;
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i % 2 === 0 ? "rgba(246,242,255,.75)" : "rgba(10,6,21,.85)";
      ctx.fillRect(fx, y - 8 + i * 1.6, 12, 1.6);
    }
    ctx.fillStyle = "rgba(246,242,255,.75)";
    ctx.font = "12px 'Cairo', system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText("FINISH", x1 - 6, y - 12);

    // moving marker
    const pulse = 0.55 + 0.45 * Math.sin(t * 0.008);
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(mx, y, 9 + pulse * 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(246,242,255,.10)";
    ctx.fill();
    ctx.strokeStyle = "rgba(246,242,255,.40)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.font = "16px 'Cairo', system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(10,6,21,.85)";
    ctx.fillText("👑", mx, y + 0.5);

    // label above marker
    const remaining = Math.max(0, 100 - Math.floor(state.glow));
    ctx.font = "12px 'Cairo', system-ui";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(246,242,255,.72)";
    ctx.fillText(`${remaining}%`, mx, y - 14);

    ctx.restore();
  };

  const exportWinCard = async () => {
    const out = document.createElement("canvas");
    out.width = 1200;
    out.height = 675;
    const o = out.getContext("2d");

    // background
    const bg = o.createLinearGradient(0, 0, 0, out.height);
    bg.addColorStop(0, "#120a2b");
    bg.addColorStop(1, "#070717");
    o.fillStyle = bg;
    o.fillRect(0, 0, out.width, out.height);

    const flare = o.createRadialGradient(260, 140, 20, 260, 140, 520);
    flare.addColorStop(0, "rgba(255,79,216,.22)");
    flare.addColorStop(0.45, "rgba(79,232,255,.14)");
    flare.addColorStop(1, "rgba(0,0,0,0)");
    o.fillStyle = flare;
    o.fillRect(0, 0, out.width, out.height);

    // frame
    o.fillStyle = "rgba(255,255,255,.06)";
    o.strokeStyle = "rgba(246,242,255,.18)";
    o.lineWidth = 2;
    o.beginPath();
    o.roundRect(32, 28, out.width - 64, out.height - 56, 22);
    o.fill();
    o.stroke();

    // title + rank
    o.fillStyle = "rgba(246,242,255,.92)";
    o.font = "800 44px Cairo, system-ui";
    o.textAlign = "center";
    o.textBaseline = "top";
    o.fillText("Glow Up Run", out.width / 2, 54);

    o.font = "800 34px Cairo, system-ui";
    o.fillStyle = "rgba(255,209,102,.92)";
    o.fillText(`Rank: ${state.rank || "Pageant Queen"} 👑`, out.width / 2, 110);

    o.font = "600 20px Cairo, system-ui";
    o.fillStyle = "rgba(246,242,255,.78)";
    o.fillText(`Score: ${Math.floor(state.score)}   •   Glow: ${Math.floor(state.glow)}%`, out.width / 2, 162);

    o.font = "600 18px Cairo, system-ui";
    o.fillStyle = "rgba(44,255,217,.85)";
    o.fillText("Send this screenshot on Discord to claim رتبة بلدس", out.width / 2, 196);

    // snapshot of gameplay
    const pad = 46;
    const snapX = 78;
    const snapY = 238;
    const snapW = out.width - 156;
    const snapH = out.height - snapY - 66;
    o.save();
    o.shadowColor = "rgba(0,0,0,.45)";
    o.shadowBlur = 28;
    o.fillStyle = "rgba(0,0,0,.18)";
    o.beginPath();
    o.roundRect(snapX, snapY, snapW, snapH, 18);
    o.fill();
    o.shadowBlur = 0;
    o.clip();
    o.drawImage(canvas, 0, 0, W, H, snapX + pad, snapY + pad, snapW - pad * 2, snapH - pad * 2);
    o.restore();

    // download
    const a = document.createElement("a");
    a.download = "glow-up-run_pageant-queen.png";
    a.href = out.toDataURL("image/png");
    a.click();
  };

  const burst = (x, y, color, n) => {
    for (let i = 0; i < n; i++) {
      sparks.push({
        x,
        y,
        r: rand(1.5, 3.2),
        vx: rand(-260, 260),
        vy: rand(-320, 220),
        life: 0,
        ttl: rand(420, 900),
        color,
      });
    }
  };

  const floater = (x, y, txt, color) => {
    floaters.push({ x, y, txt, color, vy: rand(-34, -60), life: 0, ttl: 850 });
  };

  const spawnDrop = () => {
    const difficulty = state.difficulty;
    const careChance = clamp(0.22 + Math.sin(state.score / 180) * 0.06, 0.16, 0.32);
    const isCare = Math.random() < careChance;

    const type = isCare ? "care" : "food";
    const list = isCare ? ITEMS.care : ITEMS.food;
    const kind = Math.floor(rand(0, list.length));

    const r = isCare ? rand(18, 22) : rand(18, 24);
    const vy = rand(180, 280) + difficulty * 14;
    drops.push({
      x: rand(r + 14, W - r - 14),
      y: -r - 10,
      r,
      vy,
      type,
      kind,
      rot: rand(0, Math.PI * 2),
      spin: rand(-2.6, 2.6),
    });
  };

  const aabbCircleHit = (cx, cy, cr, rx, ry, rw, rh) => {
    const closestX = clamp(cx, rx, rx + rw);
    const closestY = clamp(cy, ry, ry + rh);
    const dx = cx - closestX;
    const dy = cy - closestY;
    return dx * dx + dy * dy <= cr * cr;
  };

  const drawRoundRect = (x, y, w, h, r) => {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  };

  const drawBackground = (t) => {
    // stage glow stripes
    ctx.fillStyle = "#070717";
    ctx.fillRect(0, 0, W, H);

    const grd = ctx.createRadialGradient(W * 0.5, H * 0.2, 10, W * 0.5, H * 0.2, 520);
    grd.addColorStop(0, "rgba(255,79,216,.16)");
    grd.addColorStop(0.45, "rgba(79,232,255,.12)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "rgba(246,242,255,.18)";
    ctx.lineWidth = 1;
    const offset = (t * 0.03) % 18;
    for (let x = -20; x < W + 40; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x + offset, 0);
      ctx.lineTo(x - 140 + offset, H);
      ctx.stroke();
    }
    ctx.restore();

    // floor spotlight
    const floor = ctx.createRadialGradient(W * 0.5, H * 0.92, 20, W * 0.5, H * 0.92, 380);
    floor.addColorStop(0, "rgba(255,209,102,.10)");
    floor.addColorStop(0.5, "rgba(44,255,217,.08)");
    floor.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = floor;
    ctx.fillRect(0, 0, W, H);
  };

  const drawPlayer = () => {
    // shadow
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "black";
    ctx.beginPath();
    ctx.ellipse(player.x + player.w / 2, player.y + player.h + 10, 34, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // body
    const x = player.x;
    const y = player.y;
    const w = player.w;
    const h = player.h;

    const grad = ctx.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, "rgba(79,232,255,.95)");
    grad.addColorStop(0.5, "rgba(255,79,216,.95)");
    grad.addColorStop(1, "rgba(255,209,102,.92)");

    ctx.save();
    ctx.shadowColor = state.shieldMs > 0 ? "rgba(44,255,217,.55)" : "rgba(79,232,255,.35)";
    ctx.shadowBlur = state.shieldMs > 0 ? 22 : 14;

    drawRoundRect(x, y, w, h, 16);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(246,242,255,.35)";
    ctx.stroke();

    // face icon
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(10,6,21,.75)";
    ctx.font = "28px 'Cairo', system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("👑", x + w / 2, y + h / 2 + 1);

    // shield ring
    if (state.shieldMs > 0) {
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = "rgba(44,255,217,.65)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, 38, 30, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  };

  const drawDrop = (d) => {
    const list = d.type === "care" ? ITEMS.care : ITEMS.food;
    const item = list[d.kind];

    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rot);

    // glow halo
    const halo = ctx.createRadialGradient(0, 0, 1, 0, 0, d.r * 2.4);
    halo.addColorStop(0, `${item.color}55`);
    halo.addColorStop(0.35, `${item.color}24`);
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, d.r * 2.1, 0, Math.PI * 2);
    ctx.fill();

    // orb
    ctx.fillStyle = "rgba(255,255,255,.09)";
    ctx.beginPath();
    ctx.arc(0, 0, d.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = d.type === "food" ? "rgba(255,85,125,.45)" : "rgba(44,255,217,.45)";
    ctx.stroke();

    // emoji
    ctx.font = `${Math.floor(d.r * 1.25)}px 'Cairo', system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = palette.white;
    ctx.fillText(item.label, 0, 2);

    ctx.restore();
  };

  const drawFloaters = () => {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "18px 'Cairo', system-ui";
    for (const f of floaters) {
      const a = 1 - f.life / f.ttl;
      ctx.globalAlpha = clamp(a, 0, 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.txt, f.x, f.y);
    }
    ctx.restore();
  };

  const drawSparks = () => {
    ctx.save();
    for (const s of sparks) {
      const a = 1 - s.life / s.ttl;
      ctx.globalAlpha = clamp(a, 0, 1);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  const tick = (t) => {
    if (!state.running || state.paused) return;
    const dt = Math.min(0.032, Math.max(0.001, (t - state.lastT) / 1000));
    state.lastT = t;

    // difficulty curve
    state.difficulty = Math.min(14, state.score / 160);

    // input -> velocity
    const axis = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let targetV = axis * player.speed;
    if (input.pointerDown) {
      const dx = input.pointerX - (player.x + player.w / 2);
      targetV = clamp(dx * 6.2, -player.speed, player.speed);
    }
    player.vx += (targetV - player.vx) * (1 - Math.pow(0.0001, dt));
    player.x += player.vx * dt;
    player.x = clamp(player.x, 14, W - player.w - 14);

    // spawn rate grows with score
    const spawnsPerSec = 1.6 + state.difficulty * 0.28;
    const p = spawnsPerSec * dt;
    if (Math.random() < p) spawnDrop();
    if (Math.random() < p * 0.22) spawnDrop();

    // update drops
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.y += d.vy * dt;
      d.rot += d.spin * dt;

      const hit = aabbCircleHit(d.x, d.y, d.r, player.x, player.y, player.w, player.h);
      if (hit) {
        if (d.type === "care") {
          const base = 9 + Math.floor(state.difficulty * 0.5);
          const add = d.kind === 4 ? base + 3 : base; // ✨ gives more
          state.glow = clamp(state.glow + add, 0, 100);
          state.score += 18;
          floater(d.x, d.y - 8, `+${add} Glow`, palette.mint);
          burst(d.x, d.y, palette.mint, 18);
          if (d.kind === 4) {
            state.shieldMs = Math.min(4200, state.shieldMs + 2600);
            floater(d.x, d.y + 14, "Shield!", palette.cyan);
          }
        } else {
          if (state.shieldMs > 0) {
            state.score += 6;
            floater(d.x, d.y - 8, "BLOCKED", palette.cyan);
            burst(d.x, d.y, palette.cyan, 14);
          } else {
            state.lives -= 1;
            state.score = Math.max(0, state.score - 12);
            floater(d.x, d.y - 8, "-♥", palette.danger);
            burst(d.x, d.y, palette.danger, 18);
            if (state.lives <= 0) {
              drops.splice(i, 1);
              syncHud();
              render(t);
              gameOver();
              return;
            }
          }
        }
        drops.splice(i, 1);
      } else if (d.y - d.r > H + 20) {
        drops.splice(i, 1);
      }
    }

    // update shield
    if (state.shieldMs > 0) {
      state.shieldMs = Math.max(0, state.shieldMs - dt * 1000);
    }

    // update floaters/sparks
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.life += dt * 1000;
      f.y += f.vy * dt;
      if (f.life > f.ttl) floaters.splice(i, 1);
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life += dt * 1000;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 420 * dt;
      if (s.life > s.ttl) sparks.splice(i, 1);
    }

    // score slowly increases with time survived
    state.score += 10 * dt;
    syncHud();

    render(t);

    if (state.glow >= 100) {
      win();
      return;
    }

    requestAnimationFrame(tick);
  };

  const render = (t) => {
    drawBackground(t);

    // frame border
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(246,242,255,.14)";
    ctx.lineWidth = 2;
    drawRoundRect(10, 10, W - 20, H - 20, 18);
    ctx.stroke();
    ctx.restore();

    for (const d of drops) drawDrop(d);
    drawPlayer();
    drawSparks();
    drawFloaters();

    // finish line / end indicator
    drawFinishTrack(t);

    // bottom vignette
    const v = ctx.createLinearGradient(0, H - 180, 0, H);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,.38)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);

    // mini hint
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = palette.white;
    ctx.font = "12px 'Cairo', system-ui";
    ctx.textAlign = "right";
    ctx.fillText("Space: pause • R: restart", W - 18, 26);
    ctx.restore();
  };

  // Input
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") input.left = true;
    if (e.key === "ArrowRight") input.right = true;

    if (e.key === " " || e.code === "Space") {
      e.preventDefault();
      if (!state.running) start();
      else if (state.paused) start();
      else pause();
    }

    if (e.key.toLowerCase() === "r") {
      reset();
      showOverlay(
        "جاهزة؟",
        "تحركي يمين/يسار، تجنبي الأكل، واجمعي self‑care عشان تعبي Glow.",
        "READY",
        "ابدأ اللعبة"
      );
      render(performance.now());
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft") input.left = false;
    if (e.key === "ArrowRight") input.right = false;
  });

  const onPointer = (ev) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * W;
    input.pointerX = clamp(x, 0, W);
  };

  canvas.addEventListener("pointerdown", (ev) => {
    canvas.setPointerCapture(ev.pointerId);
    input.pointerDown = true;
    onPointer(ev);
    if (!state.running) start();
  });
  canvas.addEventListener("pointermove", (ev) => {
    if (!input.pointerDown) return;
    onPointer(ev);
  });
  canvas.addEventListener("pointerup", (ev) => {
    try {
      canvas.releasePointerCapture(ev.pointerId);
    } catch {}
    input.pointerDown = false;
  });
  canvas.addEventListener("pointercancel", () => {
    input.pointerDown = false;
  });

  // Overlay buttons
  startBtn.addEventListener("click", () => start());
  howBtn.addEventListener("click", () => {
    showOverlay(
      "كيف تلعبين؟",
      "- تحركي ← → (أو اسحبي على الجوال).\n- تجنبي الأكل (يخصم قلوب).\n- اجمعي self‑care عشان يزيد Glow.\n- ✨ يعطيك Shield لمدة قصيرة.\n- Space يوقف/يكمل، و R يعيد.",
      "HOW TO",
      state.running ? "تابعي" : "ابدأ اللعبة"
    );
  });

  shareBtn.addEventListener("click", async () => {
    await exportWinCard();
  });

  // Initial paint
  reset();
  render(performance.now());
})();


(() => {
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    tg.setHeaderColor('#111827');
    tg.setBackgroundColor('#0b1020');
  }

  const SIZE = 8;
  const DRAG_LIFT_PX = 112; // Keep the dragged block above the finger on phones.
  const COLORS = ['#38bdf8', '#a78bfa', '#f472b6', '#34d399', '#fbbf24', '#fb7185', '#60a5fa'];
  const SHAPES = [
    [[1]],
    [[1,1]], [[1],[1]],
    [[1,1,1]], [[1],[1],[1]],
    [[1,1],[1,1]],
    [[1,1,1],[0,1,0]],
    [[1,0],[1,0],[1,1]], [[0,1],[0,1],[1,1]],
    [[1,1,1],[1,0,0]], [[1,1,1],[0,0,1]],
    [[1,1,0],[0,1,1]], [[0,1,1],[1,1,0]],
    [[1,1,1,1]], [[1],[1],[1],[1]],
    [[1,1,1],[1,1,1]],
    [[1,1],[1,0]], [[1,1],[0,1]], [[1,0],[1,1]], [[0,1],[1,1]],
    [[1,1,1],[1,1,1],[1,1,1]],
  ];

  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const piecesEl = document.getElementById('pieces');
  const scoreEl = document.getElementById('score');
  const bestScoreEl = document.getElementById('bestScore');
  const comboEl = document.getElementById('combo');
  const tipEl = document.getElementById('floatingTip');
  const toastEl = document.getElementById('toast');
  const gameOverModal = document.getElementById('gameOverModal');
  const gameOverText = document.getElementById('gameOverText');

  let board, pieces, score, combo, best, dragState, reviveUsed;
  let lastAdScoreMilestone = 0;
  best = Number(localStorage.getItem('block_pop_best') || 0);
  bestScoreEl.textContent = best;

  const ADSGRAM_REWARD_BLOCK_ID = '34365';
  const ADSGRAM_INTERSTITIAL_BLOCK_ID = '34366';
  const adsgramControllers = new Map();

  function isAdsgramConfigured(blockId) {
    return blockId && !String(blockId).startsWith('YOUR_');
  }

  function getAdsgramController(blockId, debug = false) {
    if (!isAdsgramConfigured(blockId)) return null;
    if (!window.Adsgram?.init) return null;
    if (!adsgramControllers.has(blockId)) {
      adsgramControllers.set(blockId, window.Adsgram.init({
        blockId,
        debug,
      }));
    }
    return adsgramControllers.get(blockId);
  }

  const adBridge = {
    async showBanner() {
      // AdsGram reward/interstitial SDK is full-screen. Keep this banner slot
      // for direct sponsorships, cross-promotion, or another banner provider.
      return true;
    },
    async showInterstitial(reason = 'milestone') {
      const controller = getAdsgramController(ADSGRAM_INTERSTITIAL_BLOCK_ID, false);
      if (!controller) {
        console.info('[ad] interstitial placeholder:', reason);
        showToast('插屏广告位：拿到 AdsGram blockId 后自动启用');
        await wait(650);
        return true;
      }
      try {
        await controller.show();
        return true;
      } catch (result) {
        console.warn('[ad] interstitial failed:', result);
        return false;
      }
    },
    async showRewarded(reason = 'reward') {
      const controller = getAdsgramController(ADSGRAM_REWARD_BLOCK_ID, false);
      if (!controller) {
        console.info('[ad] rewarded placeholder:', reason);
        showToast('激励广告模拟完成：配置 blockId 后展示真实广告');
        await wait(800);
        return true;
      }
      try {
        await controller.show();
        return true;
      } catch (result) {
        console.warn('[ad] rewarded failed:', result);
        showToast('广告暂时不可用，请稍后再试');
        return false;
      }
    }
  };

  function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
  function emptyBoard() { return Array.from({ length: SIZE }, () => Array(SIZE).fill(null)); }
  function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function cloneShape(shape) { return shape.map(row => [...row]); }
  function makePiece() { return { id: crypto.randomUUID(), shape: cloneShape(rand(SHAPES)), color: rand(COLORS), used: false }; }
  function generatePieces() { return [makePiece(), makePiece(), makePiece()]; }

  function startGame() {
    board = emptyBoard();
    pieces = generatePieces();
    score = 0;
    combo = 0;
    reviveUsed = false;
    lastAdScoreMilestone = 0;
    gameOverModal.classList.add('hidden');
    tipEl.classList.remove('fade');
    updateUI();
    renderPieces();
    drawBoard();
    adBridge.showBanner();
  }

  function updateUI() {
    scoreEl.textContent = score;
    comboEl.textContent = combo;
    if (score > best) {
      best = score;
      localStorage.setItem('block_pop_best', String(best));
      bestScoreEl.textContent = best;
    }
  }

  function renderPieces() {
    piecesEl.innerHTML = '';
    for (const piece of pieces) {
      const card = document.createElement('button');
      card.className = `piece-card${piece.used ? ' used' : ''}`;
      card.type = 'button';
      card.dataset.pieceId = piece.id;
      card.appendChild(piecePreview(piece));
      card.addEventListener('pointerdown', onPiecePointerDown);
      piecesEl.appendChild(card);
    }
  }

  function piecePreview(piece, ghost = false) {
    const wrap = document.createElement('div');
    wrap.className = ghost ? 'piece-preview drag-ghost-preview' : 'piece-preview';
    for (const row of piece.shape) {
      const rowEl = document.createElement('div');
      rowEl.className = 'piece-row';
      for (const cell of row) {
        const c = document.createElement('div');
        c.className = 'preview-cell';
        c.style.opacity = cell ? '1' : '0';
        c.style.background = piece.color;
        rowEl.appendChild(c);
      }
      wrap.appendChild(rowEl);
    }
    return wrap;
  }

  function onPiecePointerDown(event) {
    const id = event.currentTarget.dataset.pieceId;
    const piece = pieces.find(p => p.id === id && !p.used);
    if (!piece) return;
    event.preventDefault();
    try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch (_) { /* Some WebViews reject capture for synthetic/touch pointers. */ }
    tipEl.classList.add('fade');
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.appendChild(piecePreview(piece, true));
    document.body.appendChild(ghost);
    dragState = { piece, ghost, pointerId: event.pointerId, x: event.clientX, y: event.clientY, valid: false, cell: null };
    updateDrag(event.clientX, event.clientY);
    window.addEventListener('pointermove', onDragMove, { passive: false });
    window.addEventListener('pointerup', onDragEnd, { once: true });
    window.addEventListener('pointercancel', onDragCancel, { once: true });
  }

  function onDragMove(event) {
    if (!dragState) return;
    event.preventDefault();
    updateDrag(event.clientX, event.clientY);
  }

  function updateDrag(x, y) {
    dragState.x = x;
    dragState.y = y;
    moveGhost(x, y);
    const cell = placementFromPointer(dragState.piece.shape, x, y);
    dragState.cell = cell;
    dragState.valid = cell ? canPlace(dragState.piece.shape, cell.r, cell.c) : false;
    drawBoard(dragState);
  }

  function onDragEnd(event) {
    if (!dragState) return;
    const { piece, cell, valid } = dragState;
    cleanupDrag();
    if (valid && cell) {
      placePiece(piece, cell.r, cell.c);
    } else {
      drawBoard();
      showToast('这里放不下，换个位置试试');
    }
  }

  function onDragCancel() { cleanupDrag(); drawBoard(); }
  function cleanupDrag() {
    if (dragState?.ghost) dragState.ghost.remove();
    window.removeEventListener('pointermove', onDragMove);
    dragState = null;
  }

  function moveGhost(x, y) {
    if (!dragState?.ghost) return;
    dragState.ghost.style.left = `${x}px`;
    dragState.ghost.style.top = `${y - DRAG_LIFT_PX}px`;
  }

  function boardMetrics() {
    const rect = canvas.getBoundingClientRect();
    const gap = 8;
    const pad = 18;
    const cell = (rect.width - pad * 2 - gap * (SIZE - 1)) / SIZE;
    const pitch = cell + gap;
    return { rect, gap, pad, cell, pitch };
  }

  function shapeBounds(shape) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (!shape[y][x]) continue;
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
    }
    return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
  }

  function placementFromPointer(shape, x, y) {
    const { rect, pad, pitch } = boardMetrics();
    const liftedY = y - DRAG_LIFT_PX;
    const b = shapeBounds(shape);
    const localX = x - rect.left - pad;
    const localY = liftedY - rect.top - pad;
    const centerOffsetX = (b.minX + b.width / 2 - 0.5) * pitch;
    const centerOffsetY = (b.minY + b.height / 2 - 0.5) * pitch;
    let c = Math.round((localX - centerOffsetX) / pitch);
    let r = Math.round((localY - centerOffsetY) / pitch);
    c = Math.max(-b.minX, Math.min(SIZE - 1 - b.maxX, c));
    r = Math.max(-b.minY, Math.min(SIZE - 1 - b.maxY, r));
    const boardX = rect.left + pad + (c + b.minX) * pitch;
    const boardY = rect.top + pad + (r + b.minY) * pitch;
    const maxX = rect.left + rect.width - pad;
    const maxY = rect.top + rect.height - pad;
    const nearBoard = x >= rect.left - 36 && x <= rect.right + 36 && liftedY >= rect.top - 56 && liftedY <= rect.bottom + 56;
    const insidePlayable = boardX < maxX && boardY < maxY;
    return nearBoard && insidePlayable ? { r, c } : null;
  }

  function canPlace(shape, r, c) {
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (!shape[y][x]) continue;
        const br = r + y, bc = c + x;
        if (br < 0 || br >= SIZE || bc < 0 || bc >= SIZE || board[br][bc]) return false;
      }
    }
    return true;
  }

  function placePiece(piece, r, c) {
    let blocks = 0;
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (!piece.shape[y][x]) continue;
        board[r + y][c + x] = piece.color;
        blocks++;
      }
    }
    piece.used = true;
    score += blocks;
    const cleared = clearLines();
    if (cleared > 0) {
      combo += 1;
      score += cleared * cleared * 12 + combo * 6;
      tg?.HapticFeedback?.impactOccurred?.('medium');
      showToast(`消除 ${cleared} 条！连击 x${combo}`);
    } else {
      combo = 0;
      tg?.HapticFeedback?.selectionChanged?.();
    }
    if (pieces.every(p => p.used)) pieces = generatePieces();
    updateUI();
    renderPieces();
    drawBoard();
    maybeShowMilestoneAd();
    setTimeout(checkGameOver, 180);
  }

  function clearLines() {
    const fullRows = [];
    const fullCols = [];
    for (let r = 0; r < SIZE; r++) if (board[r].every(Boolean)) fullRows.push(r);
    for (let c = 0; c < SIZE; c++) {
      let full = true;
      for (let r = 0; r < SIZE; r++) if (!board[r][c]) { full = false; break; }
      if (full) fullCols.push(c);
    }
    for (const r of fullRows) for (let c = 0; c < SIZE; c++) board[r][c] = null;
    for (const c of fullCols) for (let r = 0; r < SIZE; r++) board[r][c] = null;
    return fullRows.length + fullCols.length;
  }

  async function maybeShowMilestoneAd() {
    const milestone = Math.floor(score / 220);
    if (milestone > lastAdScoreMilestone && milestone > 0) {
      lastAdScoreMilestone = milestone;
      await adBridge.showInterstitial('score_milestone');
    }
  }

  function hasAnyMove() {
    return pieces.some(p => !p.used && canPlaceAnywhere(p.shape));
  }
  function canPlaceAnywhere(shape) {
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (canPlace(shape, r, c)) return true;
    return false;
  }
  function checkGameOver() {
    if (hasAnyMove()) return;
    gameOverText.textContent = `本局得分 ${score}，最高分 ${best}`;
    gameOverModal.classList.remove('hidden');
    tg?.HapticFeedback?.notificationOccurred?.('warning');
  }

  function drawBoard(preview = null) {
    const W = canvas.width;
    const gap = 8;
    const pad = 18;
    const cell = (W - pad * 2 - gap * (SIZE - 1)) / SIZE;
    ctx.clearRect(0, 0, W, W);
    ctx.save();
    ctx.fillStyle = '#0f172a';
    roundRect(ctx, 0, 0, W, W, 28); ctx.fill();
    const previewCells = new Set();
    if (preview?.cell && preview.valid) {
      const { r, c } = preview.cell;
      preview.piece.shape.forEach((row, y) => row.forEach((v, x) => { if (v) previewCells.add(`${r+y},${c+x}`); }));
    }
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const x = pad + c * (cell + gap), y = pad + r * (cell + gap);
        const color = board[r][c];
        const isPreview = previewCells.has(`${r},${c}`);
        ctx.fillStyle = color || (isPreview ? preview.piece.color : '#1e293b');
        ctx.globalAlpha = color ? 1 : isPreview ? 0.58 : 0.62;
        roundRect(ctx, x, y, cell, cell, 12); ctx.fill();
        ctx.globalAlpha = 1;
        if (color || isPreview) {
          const grad = ctx.createLinearGradient(x, y, x + cell, y + cell);
          grad.addColorStop(0, 'rgba(255,255,255,.24)');
          grad.addColorStop(1, 'rgba(0,0,0,.14)');
          ctx.fillStyle = grad;
          roundRect(ctx, x, y, cell, cell, 12); ctx.fill();
        }
      }
    }
    if (preview?.cell && !preview.valid) {
      const { r, c } = preview.cell;
      ctx.strokeStyle = 'rgba(251, 113, 133, .9)';
      ctx.lineWidth = 6;
      const x = pad + c * (cell + gap), y = pad + r * (cell + gap);
      roundRect(ctx, x, y, cell, cell, 12); ctx.stroke();
    }
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  async function rewardShuffle() {
    const ok = await adBridge.showRewarded('shuffle_pieces');
    if (!ok) return;
    pieces = generatePieces();
    combo = 0;
    updateUI();
    renderPieces();
    drawBoard();
    gameOverModal.classList.add('hidden');
  }

  async function rewardedRevive() {
    if (reviveUsed) { showToast('每局只能复活一次'); return; }
    const ok = await adBridge.showRewarded('revive');
    if (!ok) return;
    reviveUsed = true;
    removeRandomBlocks(8);
    pieces = generatePieces();
    combo = 0;
    gameOverModal.classList.add('hidden');
    updateUI();
    renderPieces();
    drawBoard();
    showToast('复活成功：清除了 8 个格子');
  }

  function removeRandomBlocks(count) {
    const filled = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (board[r][c]) filled.push([r, c]);
    for (let i = filled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [filled[i], filled[j]] = [filled[j], filled[i]];
    }
    filled.slice(0, count).forEach(([r, c]) => board[r][c] = null);
  }

  function shareScore() {
    const text = encodeURIComponent(`我在 Block Pop 得了 ${score} 分！来挑战我：`);
    const url = encodeURIComponent(location.href);
    if (tg) {
      tg.openTelegramLink(`https://t.me/share/url?url=${url}&text=${text}`);
    } else {
      navigator.clipboard?.writeText(`${decodeURIComponent(text)} ${location.href}`);
      showToast('分享文案已复制');
    }
  }

  let toastTimer;
  function showToast(message) {
    clearTimeout(toastTimer);
    toastEl.textContent = message;
    toastEl.classList.remove('hidden');
    toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 1700);
  }

  document.getElementById('newGameBtn').addEventListener('click', startGame);
  document.getElementById('restartBtn').addEventListener('click', startGame);
  document.getElementById('rewardBtn').addEventListener('click', rewardShuffle);
  document.getElementById('rewardReviveBtn').addEventListener('click', rewardedRevive);
  document.getElementById('shareBtn').addEventListener('click', shareScore);
  window.addEventListener('resize', () => drawBoard(dragState));

  startGame();
})();

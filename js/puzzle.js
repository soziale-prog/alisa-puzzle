window.PuzzleGame = class PuzzleGame {
  constructor(options) {
    this.canvas = options.canvas;
    this.ctx = this.canvas.getContext("2d");
    this.onProgress = options.onProgress;
    this.onWin = options.onWin;
    this.soundEnabled = options.soundEnabled ?? true;
    this.victorySound = options.victorySoundSrc ? new Audio(options.victorySoundSrc) : null;
    this.level = null;
    this.image = null;
    this.pieces = [];
    this.dragPiece = null;
    this.activePointerId = null;
    this.dragOffset = { x: 0, y: 0 };
    this.hintVisible = false;
    this.animationFrame = 0;
    this.winStartedAt = 0;
    this.winFireworks = [];
    this.hasWon = false;

    this.handlePointerDown = this.onPointerDown.bind(this);
    this.handlePointerMove = this.onPointerMove.bind(this);
    this.handlePointerUp = this.onPointerUp.bind(this);
    this.handleResize = this.draw.bind(this);

    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.canvas.addEventListener("pointermove", this.handlePointerMove);
    this.canvas.addEventListener("pointerup", this.handlePointerUp);
    this.canvas.addEventListener("pointercancel", this.handlePointerUp);
    window.addEventListener("resize", this.handleResize);
  }

  async loadLevel(level) {
    this.level = level;
    this.image = await this.loadImage(level.image);
    this.setupBoard();
    this.generatePieces();
    this.shufflePieces();
    this.reportProgress();
    this.draw();
  }

  loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  setupBoard() {
    const imageRatio = this.image.naturalWidth / this.image.naturalHeight;
    this.canvas.width = 2500;
    this.canvas.height = 1240;
    this.boardW = 1080;
    this.boardH = this.boardW / imageRatio;

    if (this.boardH > 780) {
      this.boardH = 780;
      this.boardW = this.boardH * imageRatio;
    }

    this.cellW = this.boardW / this.level.cols;
    this.cellH = this.boardH / this.level.rows;
    this.tab = Math.min(this.cellW, this.cellH) * 0.22;
    this.boardX = 55;
    this.boardY = 120;
    this.trayX = this.boardX + this.boardW + 52;
    this.trayY = 48;
    this.snapRadius = Math.max(25, Math.min(this.cellW, this.cellH) * 0.28);
  }

  generatePieces() {
    const edges = this.generateEdges();

    this.pieces = [];
    for (let row = 0; row < this.level.rows; row += 1) {
      for (let col = 0; col < this.level.cols; col += 1) {
        this.pieces.push({
          id: `${row}-${col}`,
          row,
          col,
          edges: edges[row][col],
          correctX: this.boardX + col * this.cellW,
          correctY: this.boardY + row * this.cellH,
          x: 0,
          y: 0,
          placed: false
        });
      }
    }
  }

  generateEdges() {
    const rows = this.level.rows;
    const cols = this.level.cols;
    const grid = Array.from({ length: rows }, () => Array(cols));

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const top = row === 0 ? 0 : -grid[row - 1][col].bottom;
        const left = col === 0 ? 0 : -grid[row][col - 1].right;
        const right = col === cols - 1 ? 0 : this.randomEdge();
        const bottom = row === rows - 1 ? 0 : this.randomEdge();
        grid[row][col] = { top, right, bottom, left };
      }
    }

    return grid;
  }

  randomEdge() {
    return Math.random() > 0.5 ? 1 : -1;
  }

  draw() {
    cancelAnimationFrame(this.animationFrame);
    this.animationFrame = requestAnimationFrame(() => {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.drawBackground();
      this.drawBoard();
      if (this.hasWon) {
        this.drawCompletedImage();
      } else {
        this.pieces.forEach((piece) => this.drawPiece(piece));
      }

      const now = performance.now();

      if (this.winStartedAt) {
        this.drawWinCelebration(now);
      }

      if (this.hintVisible) {
        this.drawHintOverlay();
      }

      if (this.winStartedAt) {
        this.draw();
      }
    });
  }

  drawBackground() {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = "#d8f5ff";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.roundRect(30, 28, this.boardX + this.boardW + 40, this.boardY + this.boardH + 40, 28);
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.roundRect(this.trayX - 36, 28, this.canvas.width - this.trayX + 6, this.canvas.height - 56, 28);
    ctx.fill();
    ctx.restore();
  }

  drawBoard() {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = "#f5fdff";
    ctx.strokeStyle = "#8bcce8";
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.roundRect(this.boardX, this.boardY, this.boardW, this.boardH, 18);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  drawHintOverlay() {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.drawImage(this.image, this.boardX, this.boardY, this.boardW, this.boardH);
    ctx.restore();
  }

  drawCompletedImage() {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = "rgba(37, 64, 80, 0.16)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 5;
    ctx.beginPath();
    ctx.roundRect(this.boardX, this.boardY, this.boardW, this.boardH, 18);
    ctx.clip();
    ctx.drawImage(this.image, this.boardX, this.boardY, this.boardW, this.boardH);
    ctx.restore();
  }

  drawWinCelebration(now) {
    const ctx = this.ctx;
    const elapsed = now - this.winStartedAt;
    const pulse = 0.5 + Math.sin(elapsed / 130) * 0.5;

    this.drawRainbowFrame(elapsed, pulse);

    ctx.save();
    ctx.shadowColor = "#18f7ff";
    ctx.shadowBlur = 24 + pulse * 18;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.roundRect(this.boardX - 8, this.boardY - 8, this.boardW + 16, this.boardH + 16, 24);
    ctx.stroke();
    ctx.shadowColor = "#ff3df2";
    ctx.shadowBlur = 28 + pulse * 22;
    ctx.strokeStyle = "#ffec6e";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();

    this.drawVictorySign(elapsed, pulse);
    this.drawFireworks(elapsed);

    if (elapsed > 3300) {
      this.winStartedAt = 0;
    }
  }

  drawRainbowFrame(elapsed, pulse) {
    const ctx = this.ctx;
    const frame = 12;
    const glow = 20 + pulse * 16;
    const hueShift = (elapsed / 18) % 360;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (let index = 0; index < 7; index += 1) {
      ctx.strokeStyle = `hsl(${(hueShift + index * 48) % 360}, 96%, 62%)`;
      ctx.lineWidth = frame - index;
      ctx.globalAlpha = 0.92 - index * 0.08;
      ctx.shadowColor = `hsl(${(hueShift + index * 48) % 360}, 96%, 62%)`;
      ctx.shadowBlur = glow;
      ctx.beginPath();
      ctx.roundRect(
        this.boardX - 16 - index,
        this.boardY - 16 - index,
        this.boardW + 32 + index * 2,
        this.boardH + 32 + index * 2,
        26
      );
      ctx.stroke();
    }

    ctx.restore();
  }

  drawVictorySign(elapsed, pulse) {
    const ctx = this.ctx;
    const signW = Math.min(520, this.boardW * 0.84);
    const signH = 84;
    const signX = this.boardX + (this.boardW - signW) / 2;
    const signCenterX = signX + signW / 2;
    const signY = Math.max(14, this.boardY - signH - 16);
    const flicker = elapsed < 700 ? Math.sin(elapsed / 45) > -0.35 : true;

    ctx.save();
    ctx.fillStyle = "rgba(12, 31, 47, 0.84)";
    ctx.strokeStyle = "#2ee9ff";
    ctx.lineWidth = 4;
    ctx.shadowColor = "#2ee9ff";
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.roundRect(signX, signY, signW, signH, 18);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 58px Arial, sans-serif";
    ctx.lineWidth = 7;
    ctx.strokeStyle = "#ff38d6";
    ctx.shadowColor = "#ff38d6";
    ctx.shadowBlur = flicker ? 28 + pulse * 20 : 5;
    ctx.strokeText("ПОБЕДА", signCenterX, signY + signH / 2 + 2);
    ctx.fillStyle = flicker ? "#fff8b8" : "rgba(255, 248, 184, 0.5)";
    ctx.fillText("ПОБЕДА", signCenterX, signY + signH / 2 + 2);
    ctx.restore();
  }

  drawFireworks(elapsed) {
    const ctx = this.ctx;

    this.winFireworks.forEach((burst) => {
      const age = elapsed - burst.delay;
      if (age < 0 || age > 1500) {
        return;
      }

      const progress = age / 1500;
      const fade = 1 - progress;

      burst.particles.forEach((particle) => {
        const distance = particle.speed * progress;
        const x = burst.x + Math.cos(particle.angle) * distance;
        const y = burst.y + Math.sin(particle.angle) * distance + progress * progress * 70;
        const size = 5 * fade + 1;

        ctx.save();
        ctx.globalAlpha = fade;
        ctx.fillStyle = particle.color;
        ctx.shadowColor = particle.color;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    });
  }

  drawPiece(piece) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(piece.x, piece.y);

    this.makePiecePath(piece);
    ctx.shadowColor = "rgba(37, 64, 80, 0.22)";
    ctx.shadowBlur = piece === this.dragPiece ? 18 : 10;
    ctx.shadowOffsetY = piece === this.dragPiece ? 9 : 5;
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    this.makePiecePath(piece);
    ctx.clip();
    ctx.drawImage(
      this.image,
      -piece.col * this.cellW,
      -piece.row * this.cellH,
      this.boardW,
      this.boardH
    );
    ctx.restore();

    ctx.save();
    ctx.translate(piece.x, piece.y);
    this.makePiecePath(piece);
    ctx.strokeStyle = piece.placed ? "#62c985" : "#ffffff";
    ctx.lineWidth = piece.placed ? 5 : 4;
    ctx.stroke();
    ctx.restore();
  }

  makePiecePath(piece) {
    const ctx = this.ctx;
    const w = this.cellW;
    const h = this.cellH;
    const tab = this.tab;
    const e = piece.edges;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    this.drawHorizontalEdge(0, 0, w, e.top, -1);
    this.drawVerticalEdge(w, 0, h, e.right, 1);
    this.drawHorizontalEdge(w, h, -w, e.bottom, 1);
    this.drawVerticalEdge(0, h, -h, e.left, -1);
    ctx.closePath();

    // Tabs are Bezier curves so the pieces feel like soft children's puzzle pieces.
    function noop() {}
    return noop;
  }

  drawHorizontalEdge(x, y, length, type, direction) {
    const ctx = this.ctx;
    const sign = Math.sign(length);
    const abs = Math.abs(length);
    const tab = this.tab * type * direction;
    const startX = x;
    const q1 = startX + sign * abs * 0.32;
    const q2 = startX + sign * abs * 0.42;
    const q3 = startX + sign * abs * 0.5;
    const q4 = startX + sign * abs * 0.58;
    const q5 = startX + sign * abs * 0.68;
    const endX = startX + length;

    if (type === 0) {
      ctx.lineTo(endX, y);
      return;
    }

    ctx.lineTo(q1, y);
    ctx.bezierCurveTo(q2, y, q2, y + tab, q3, y + tab);
    ctx.bezierCurveTo(q4, y + tab, q4, y, q5, y);
    ctx.lineTo(endX, y);
  }

  drawVerticalEdge(x, y, length, type, direction) {
    const ctx = this.ctx;
    const sign = Math.sign(length);
    const abs = Math.abs(length);
    const tab = this.tab * type * direction;
    const startY = y;
    const q1 = startY + sign * abs * 0.32;
    const q2 = startY + sign * abs * 0.42;
    const q3 = startY + sign * abs * 0.5;
    const q4 = startY + sign * abs * 0.58;
    const q5 = startY + sign * abs * 0.68;
    const endY = startY + length;

    if (type === 0) {
      ctx.lineTo(x, endY);
      return;
    }

    ctx.lineTo(x, q1);
    ctx.bezierCurveTo(x + tab, q2, x + tab, q2, x + tab, q3);
    ctx.bezierCurveTo(x + tab, q4, x, q4, x, q5);
    ctx.lineTo(x, endY);
  }

  getPieceAt(x, y) {
    for (let index = this.pieces.length - 1; index >= 0; index -= 1) {
      const piece = this.pieces[index];
      if (piece.placed) {
        continue;
      }

      this.ctx.save();
      this.ctx.translate(piece.x, piece.y);
      this.makePiecePath(piece);
      const hit = this.ctx.isPointInPath(x, y);
      this.ctx.restore();

      if (hit) {
        return piece;
      }
    }

    return null;
  }

  onPointerDown(event) {
    if (this.activePointerId !== null) {
      return;
    }

    const point = this.getCanvasPoint(event);
    const piece = this.getPieceAt(point.x, point.y);
    if (!piece) {
      return;
    }

    event.preventDefault();

    if (this.canvas.setPointerCapture) {
      this.canvas.setPointerCapture(event.pointerId);
    }

    this.activePointerId = event.pointerId;
    this.dragPiece = piece;
    this.dragOffset.x = point.x - piece.x;
    this.dragOffset.y = point.y - piece.y;
    this.pieces = this.pieces.filter((item) => item !== piece);
    this.pieces.push(piece);
    this.draw();
  }

  onPointerMove(event) {
    if (!this.dragPiece || event.pointerId !== this.activePointerId) {
      return;
    }

    event.preventDefault();

    const point = this.getCanvasPoint(event);
    this.dragPiece.x = point.x - this.dragOffset.x;
    this.dragPiece.y = point.y - this.dragOffset.y;
    this.keepPieceInsideCanvas(this.dragPiece);
    this.draw();
  }

  onPointerUp(event) {
    if (!this.dragPiece || event.pointerId !== this.activePointerId) {
      return;
    }

    event.preventDefault();

    const piece = this.dragPiece;
    const distance = Math.hypot(piece.x - piece.correctX, piece.y - piece.correctY);

    if (distance <= this.snapRadius) {
      piece.x = piece.correctX;
      piece.y = piece.correctY;
      piece.placed = true;
      this.reportProgress();
      this.checkWin();
    }

    if (this.canvas.hasPointerCapture?.(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }

    this.dragPiece = null;
    this.activePointerId = null;
    this.draw();
  }

  getCanvasPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (this.canvas.width / rect.width),
      y: (event.clientY - rect.top) * (this.canvas.height / rect.height)
    };
  }

  shufflePieces() {
    if (this.hasWon) {
      return;
    }

    const freePieces = this.pieces.filter((piece) => !piece.placed);
    const pieceW = this.cellW + this.tab * 2;
    const pieceH = this.cellH + this.tab * 2;
    const columns = Math.max(1, Math.min(freePieces.length, this.level.cols || 4));
    const maxPieceX = this.canvas.width - this.cellW - this.tab - 8;
    const maxGapX = columns > 1 ? (maxPieceX - this.trayX - this.tab) / (columns - 1) : 0;
    const gapX = columns > 1 ? Math.min(pieceW + 8, maxGapX) : 0;
    const gapY = pieceH + 8;
    const startX = this.trayX + this.tab;
    const startY = this.trayY + this.tab;

    freePieces
      .sort(() => Math.random() - 0.5)
      .forEach((piece, index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);
        piece.x = startX + col * gapX + (Math.random() - 0.5) * 18;
        piece.y = startY + row * gapY + (Math.random() - 0.5) * 12;
        this.keepPieceInsideCanvas(piece);
      });

    this.draw();
  }

  keepPieceInsideCanvas(piece) {
    const padding = this.tab + 8;
    const minX = padding;
    const minY = padding;
    const maxX = this.canvas.width - this.cellW - padding;
    const maxY = this.canvas.height - this.cellH - padding;

    piece.x = Math.min(maxX, Math.max(minX, piece.x));
    piece.y = Math.min(maxY, Math.max(minY, piece.y));
  }

  showHint() {
    if (this.hasWon) {
      return false;
    }

    this.hintVisible = !this.hintVisible;
    this.draw();
    return this.hintVisible;
  }

  checkWin() {
    if (!this.hasWon && this.pieces.every((piece) => piece.placed)) {
      this.startWinCelebration();
      this.onWin();
    }
  }

  startWinCelebration() {
    this.hasWon = true;
    this.hintVisible = false;
    this.winStartedAt = performance.now();
    this.winFireworks = this.createFireworks();
    this.playVictorySound();
    this.draw();
  }

  playVictorySound() {
    if (!this.soundEnabled || !this.victorySound) {
      return;
    }

    this.victorySound.currentTime = 0;
    this.victorySound.volume = 0.8;
    this.victorySound.play().catch(() => {});
  }

  setSoundEnabled(enabled) {
    this.soundEnabled = enabled;

    if (!enabled && this.victorySound) {
      this.victorySound.pause();
    }
  }

  createFireworks() {
    const colors = ["#ff3df2", "#2ee9ff", "#fff36a", "#79ff9b", "#ff8a4c"];
    const bursts = [
      { x: this.boardX + this.boardW * 0.18, y: this.boardY + this.boardH * 0.18, delay: 150 },
      { x: this.boardX + this.boardW * 0.82, y: this.boardY + this.boardH * 0.22, delay: 520 },
      { x: this.boardX + this.boardW * 0.5, y: this.boardY + this.boardH * 0.1, delay: 900 }
    ];

    return bursts.map((burst, burstIndex) => ({
      ...burst,
      particles: Array.from({ length: 24 }, (_, index) => ({
        angle: (Math.PI * 2 * index) / 24 + burstIndex * 0.18,
        speed: 78 + Math.random() * 88,
        color: colors[(index + burstIndex) % colors.length]
      }))
    }));
  }

  reportProgress() {
    const placed = this.pieces.filter((piece) => piece.placed).length;
    this.onProgress(placed, this.pieces.length);
  }

  destroy() {
    cancelAnimationFrame(this.animationFrame);
    if (this.victorySound) {
      this.victorySound.pause();
      this.victorySound.currentTime = 0;
    }
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.canvas.removeEventListener("pointermove", this.handlePointerMove);
    this.canvas.removeEventListener("pointerup", this.handlePointerUp);
    this.canvas.removeEventListener("pointercancel", this.handlePointerUp);
    window.removeEventListener("resize", this.handleResize);
  }
};

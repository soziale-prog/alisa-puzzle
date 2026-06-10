const levels = window.PUZZLE_LEVELS;
const PuzzleGame = window.PuzzleGame;

const STORAGE_KEY = "magicPuzzlesProgress";
const REWARD_STARS = 20;

const screens = {
  menu: document.getElementById("menuScreen"),
  game: document.getElementById("gameScreen"),
  success: document.getElementById("successScreen")
};

const levelGrid = document.getElementById("levelGrid");
const menuStartButton = document.getElementById("menuStartButton");
const canvas = document.getElementById("puzzleCanvas");
const levelTitle = document.getElementById("levelTitle");
const progressText = document.getElementById("progressText");
const starLabels = document.querySelectorAll("[data-stars-total]");
const homeButton = document.getElementById("homeButton");
const successHomeButton = document.getElementById("successHomeButton");
const againButton = document.getElementById("againButton");
const nextButton = document.getElementById("nextButton");
const hintButton = document.getElementById("hintButton");
const shuffleButton = document.getElementById("shuffleButton");
const soundButton = document.getElementById("soundButton");

let currentLevel = levels[0];
let selectedLevel = levels[0];
let game = null;
let progress = loadProgress();
let soundEnabled = true;

renderMenu();
updateStars();
showScreen("menu");

homeButton.addEventListener("click", goHome);
successHomeButton.addEventListener("click", goHome);
againButton.addEventListener("click", () => startLevel(currentLevel));
nextButton.addEventListener("click", startNextLevel);
hintButton.addEventListener("click", toggleHint);
shuffleButton.addEventListener("click", () => game?.shufflePieces());
soundButton.addEventListener("click", toggleSound);
menuStartButton.addEventListener("click", () => startLevel(selectedLevel));

function renderMenu() {
  levelGrid.innerHTML = "";

  levels.forEach((level) => {
    const levelState = progress.levels[level.id] || {};
    const isSelected = level.id === selectedLevel.id;
    const card = document.createElement("article");
    card.className = `level-card${isSelected ? " is-selected" : ""}`;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-pressed", String(isSelected));
    card.innerHTML = `
      <img src="${level.thumb}" alt="${level.title}">
      <div class="level-card__body">
        <div>
          <div class="level-card__title">${level.title}</div>
          <div class="level-card__meta">${level.rows} × ${level.cols} кусочков${levelState.completed ? " · собрано" : ""}</div>
        </div>
      </div>
    `;

    card.addEventListener("click", () => selectLevel(level));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectLevel(level);
      }
    });
    levelGrid.appendChild(card);
  });
}

function selectLevel(level) {
  selectedLevel = level;
  levelGrid.querySelectorAll(".level-card").forEach((card, index) => {
    const isSelected = levels[index].id === selectedLevel.id;
    card.classList.toggle("is-selected", isSelected);
    card.setAttribute("aria-pressed", String(isSelected));
  });
}

async function startLevel(level) {
  currentLevel = level;
  selectedLevel = level;
  levelTitle.textContent = level.title;
  progressText.textContent = `0 / ${level.rows * level.cols}`;
  setHintButtonState(false);
  showScreen("game");

  if (game) {
    game.destroy();
  }

  game = new PuzzleGame({
    canvas,
    soundEnabled,
    victorySoundSrc: "assets/sound-of-transformation.mp3",
    onProgress: (placed, total) => {
      progressText.textContent = `${placed} / ${total}`;
    },
    onWin: handleWin
  });

  try {
    await game.loadLevel(level);
  } catch (error) {
    drawImageError();
    console.error(error);
  }
}

function handleWin() {
  const levelState = progress.levels[currentLevel.id] || {};
  if (!levelState.completed) {
    progress.totalStars += REWARD_STARS;
  }

  progress.levels[currentLevel.id] = {
    completed: true,
    stars: Math.max(levelState.stars || 0, REWARD_STARS),
    completedAt: new Date().toISOString()
  };

  saveProgress();
  updateStars();
  renderMenu();
  setTimeout(() => showScreen("success"), 3600);
}

function startNextLevel() {
  const currentIndex = levels.findIndex((level) => level.id === currentLevel.id);
  const nextLevel = levels[(currentIndex + 1) % levels.length];
  startLevel(nextLevel);
}

function goHome() {
  showScreen("menu");
}

function showScreen(name) {
  Object.entries(screens).forEach(([screenName, element]) => {
    element.classList.toggle("is-active", screenName === name);
  });
}

function updateStars() {
  starLabels.forEach((label) => {
    label.textContent = progress.totalStars;
  });
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  soundButton.classList.toggle("is-muted", !soundEnabled);
  game?.setSoundEnabled(soundEnabled);
}

function toggleHint() {
  const hintVisible = game?.showHint();
  if (typeof hintVisible === "boolean") {
    setHintButtonState(hintVisible);
  }
}

function setHintButtonState(isActive) {
  hintButton.classList.toggle("is-active", isActive);
  hintButton.setAttribute("aria-pressed", String(isActive));
}

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && typeof saved.totalStars === "number" && saved.levels) {
      return saved;
    }
  } catch (error) {
    console.warn("Не удалось прочитать сохранение пазлов.", error);
  }

  return {
    totalStars: 0,
    levels: {}
  };
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function drawImageError() {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#dff5ff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#214050";
  ctx.font = "700 28px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Картинка уровня не загрузилась", canvas.width / 2, canvas.height / 2);
}

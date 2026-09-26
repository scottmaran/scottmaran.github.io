const dialog = document.querySelector('#lake-game-dialog');
const openButton = document.querySelector('#open-lake-game');
const closeButton = document.querySelector('#close-lake-game');
const canvas = document.querySelector('#rink-canvas');

let enginePromise;

async function loadGame() {
  if (!enginePromise) {
    enginePromise = import('../shared/nhl93-game.js');
  }
  await enginePromise;
}

async function openGame() {
  if (!dialog.open) {
    dialog.showModal();
  }
  document.body.classList.add('lake-game-open');
  await loadGame();
  requestAnimationFrame(() => canvas.focus({ preventScroll: true }));
}

async function closeGame() {
  canvas.blur();
  if (document.fullscreenElement) {
    await document.exitFullscreen();
  }
  if (dialog.open) dialog.close();
}

openButton.addEventListener('click', openGame);
closeButton.addEventListener('click', closeGame);

dialog.addEventListener('click', (event) => {
  if (event.target === dialog) closeGame();
});

dialog.addEventListener('close', () => {
  document.body.classList.remove('lake-game-open');
});

// Film Room project and reel controls.
const projectButtons = document.querySelectorAll('[data-project-select]');
const projectTriggers = document.querySelectorAll('[data-project-trigger]');
const projectPanels = document.querySelectorAll('[data-project-panel]');
const projectRail = document.querySelector('.project-index');
const motionButtons = document.querySelectorAll('[data-motion-toggle]');
const reduceMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

let activeProject = 'lux';

function updateMotionButton(video) {
  const button = video
    ?.closest('[data-reel-panel]')
    ?.querySelector('[data-motion-toggle]');
  if (!button) return;
  button.textContent = video.paused ? 'Play' : 'Pause';
}

function syncMotion(panel) {
  document.querySelectorAll('[data-motion-media]').forEach((video) => {
    const shouldPlay =
      !reduceMotion &&
      panel?.contains(video) &&
      !video.closest('[data-reel-panel]')?.hidden;

    if (shouldPlay) {
      video
        .play()
        .then(() => updateMotionButton(video))
        .catch(() => updateMotionButton(video));
    } else {
      video.pause();
      updateMotionButton(video);
    }
  });
}

function setProject(projectId) {
  if (!projectId) return;
  activeProject = projectId;

  projectButtons.forEach((button) => {
    const isActive = button.dataset.projectSelect === projectId;
    button.setAttribute('aria-pressed', String(isActive));
  });

  projectTriggers.forEach((trigger) => {
    trigger.classList.toggle(
      'is-active',
      trigger.dataset.projectTrigger === projectId
    );
  });

  let visiblePanel;
  projectPanels.forEach((panel) => {
    const isActive = panel.dataset.projectPanel === projectId;
    panel.hidden = !isActive;
    if (isActive) visiblePanel = panel;
  });

  if (projectRail) {
    projectRail.style.setProperty(
      '--project-progress',
      projectId === 'lux' ? '15%' : '78%'
    );
  }

  syncMotion(visiblePanel);
}

function setReel(panel, reelId) {
  if (!panel || !reelId) return;

  panel.querySelectorAll('[data-reel-panel]').forEach((reel) => {
    reel.hidden = reel.dataset.reelPanel !== reelId;
  });

  panel.querySelectorAll('[data-reel-target]').forEach((button) => {
    button.setAttribute(
      'aria-pressed',
      String(button.dataset.reelTarget === reelId)
    );
  });

  syncMotion(panel);
}

projectButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setProject(button.dataset.projectSelect);
  });
});

projectPanels.forEach((panel) => {
  panel.querySelectorAll('[data-reel-target]').forEach((button) => {
    button.addEventListener('click', () => {
      setReel(panel, button.dataset.reelTarget);
    });
  });
});

motionButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const video = button
      .closest('[data-reel-panel]')
      ?.querySelector('[data-motion-media]');
    if (!video) return;

    if (video.paused) {
      video
        .play()
        .then(() => updateMotionButton(video))
        .catch(() => updateMotionButton(video));
    } else {
      video.pause();
      updateMotionButton(video);
    }
  });
});

document.addEventListener('visibilitychange', () => {
  const activePanel = document.querySelector(
    `[data-project-panel="${activeProject}"]`
  );

  if (document.hidden) {
    document
      .querySelectorAll('[data-motion-media]')
      .forEach((video) => video.pause());
  } else {
    syncMotion(activePanel);
  }
});

setProject(activeProject);

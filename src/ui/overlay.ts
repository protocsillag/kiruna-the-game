import type { Mode } from '../story/state';

export interface Overlay {
  /** Show the pause card (Esc on desktop does this via pointer lock; phones use a button). */
  pause(): void;
  /** While held (the story's end screen), losing the mouse doesn't bring up the pause card. */
  hold(on: boolean): void;
}

/**
 * Title / pause card. The first time it offers Story or Free roam (and "start over" when a story
 * is saved); after that, clicking (tapping) it resumes the game.
 */
export function setupOverlay(
  onStart: () => void,
  onPause: () => void,
  touch: boolean,
  choose: { savedStep: number; auto: Mode | null; pick(mode: Mode, fresh: boolean): void; inStory(): boolean },
): Overlay {
  const overlay = document.getElementById('overlay')!;
  const status = document.getElementById('status')!;
  const storyButton = document.querySelector<HTMLButtonElement>('#modes [data-mode="story"]')!;
  const freeButton = document.querySelector<HTMLButtonElement>('#modes [data-mode="free"]')!;
  const newStory = document.getElementById('new-story') as HTMLButtonElement;
  const exitStory = document.getElementById('exit-story') as HTMLButtonElement;
  exitStory.addEventListener('click', (e) => {
    // Leave the story any time (progress is kept from the last finished chapter).
    e.stopPropagation();
    location.href = `${location.pathname}?free`;
  });
  const verb = touch ? 'Tap' : 'Click';
  let chosen = false;
  let held = false;
  status.textContent = 'Choose how to play';
  if (choose.auto) {
    // Straight from the story's end screen: one click starts free roam.
    status.textContent = `${verb} to begin free roam`;
    overlay.classList.add('started');
    history.replaceState(null, '', location.pathname);
  }
  if (choose.savedStep > 0) {
    storyButton.textContent = 'Continue story';
    newStory.hidden = false;
  }
  overlay.classList.add('ready');

  const begin = (mode: Mode, fresh: boolean) => (e: Event) => {
    e.stopPropagation();
    chosen = true;
    overlay.classList.add('started');
    choose.pick(mode, fresh);
    overlay.classList.add('hidden');
    onStart();
  };
  storyButton.addEventListener('click', begin('story', false));
  newStory.addEventListener('click', begin('story', true));
  freeButton.addEventListener('click', begin('free', false));

  const pause = () => {
    status.textContent = `Paused · ${verb.toLowerCase()} to continue`;
    exitStory.hidden = !choose.inStory();
    overlay.classList.remove('hidden');
    onPause();
  };
  overlay.addEventListener('click', (e) => {
    if (!chosen && choose.auto) return begin(choose.auto, false)(e);
    if (!chosen) return;
    overlay.classList.add('hidden');
    onStart();
  });
  document.addEventListener('pointerlockchange', () => {
    if (chosen && !held && !document.pointerLockElement) pause();
  });
  return {
    pause,
    hold: (on) => (held = on),
  };
}

export function showError(message: string): void {
  document.getElementById('status')!.textContent = message;
}

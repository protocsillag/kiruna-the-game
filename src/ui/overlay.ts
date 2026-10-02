export interface Overlay {
  /** Show the pause card (Esc on desktop does this via pointer lock; phones use a button). */
  pause(): void;
}

/** Title / pause card. Clicking (tapping) it starts or resumes the game. */
export function setupOverlay(onStart: () => void, onPause: () => void, touch: boolean): Overlay {
  const overlay = document.getElementById('overlay')!;
  const status = document.getElementById('status')!;
  const verb = touch ? 'Tap' : 'Click';
  status.textContent = `${verb} to begin`;
  overlay.classList.add('ready');

  const pause = () => {
    status.textContent = `Paused · ${verb.toLowerCase()} to continue`;
    overlay.classList.remove('hidden');
    onPause();
  };
  overlay.addEventListener('click', () => {
    overlay.classList.add('hidden');
    onStart();
  });
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement) pause();
  });
  return { pause };
}

export function showError(message: string): void {
  document.getElementById('status')!.textContent = message;
}

/** Title / pause card. Clicking it starts (or resumes) and grabs the mouse. */
export function setupOverlay(onStart: () => void, onPause: () => void): void {
  const overlay = document.getElementById('overlay')!;
  const status = document.getElementById('status')!;
  status.textContent = 'Click to begin';
  overlay.classList.add('ready');

  overlay.addEventListener('click', () => {
    overlay.classList.add('hidden');
    onStart();
  });
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement) return;
    status.textContent = 'Paused · click to continue';
    overlay.classList.remove('hidden');
    onPause();
  });
}

export function showError(message: string): void {
  document.getElementById('status')!.textContent = message;
}

const el = document.createElement('div');
el.id = 'fade';
document.body.append(el);

/** Fade to black, do `midway` (teleport, rearrange the world), then fade back in. */
export function fadeThrough(midway: () => void, holdMs = 400): void {
  el.classList.add('on');
  window.setTimeout(() => {
    midway();
    window.setTimeout(() => el.classList.remove('on'), holdMs);
  }, 900);
}

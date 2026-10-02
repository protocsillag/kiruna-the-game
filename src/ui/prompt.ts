/** "E · add wood" prompt and a status line (sauna temperature) above it. */
export class Prompt {
  private box = document.createElement('div');
  private label = document.createElement('span');
  private statusEl = document.createElement('div');
  private shown = '';
  private statusText = '';

  /** On touch devices the prompt itself is the button: tapping it acts like pressing E. */
  constructor(touch = false, onTap?: () => void) {
    this.box.id = 'prompt';
    const key = document.createElement('b');
    key.textContent = touch ? 'Tap' : 'E';
    if (touch && onTap) {
      this.box.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onTap();
      });
    }
    this.box.append(key, this.label);
    this.statusEl.id = 'status-line';
    document.body.append(this.statusEl, this.box);
  }

  show(label: string | null): void {
    const text = label ?? '';
    if (text === this.shown) return;
    this.shown = text;
    this.label.textContent = text;
    this.box.classList.toggle('visible', !!label);
  }

  status(text: string | null): void {
    const t = text ?? '';
    if (t === this.statusText) return;
    this.statusText = t;
    this.statusEl.textContent = t;
    this.statusEl.classList.toggle('visible', !!text);
  }
}

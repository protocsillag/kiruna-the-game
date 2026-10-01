const KEY = 'kiruna.quality';

/** Low/High quality toggle (Q, or the button on the title card). Remembered per browser. */
export class Quality {
  high = true;
  private button = document.getElementById('quality') as HTMLButtonElement;

  constructor(private apply: (high: boolean) => void) {
    try {
      this.high = localStorage.getItem(KEY) !== 'low';
    } catch {
      // storage unavailable (private window etc.): keep the default
    }
    this.button.addEventListener('click', (e) => {
      e.stopPropagation(); // don't also start the game
      this.toggle();
    });
    this.refresh();
  }

  toggle(): void {
    this.high = !this.high;
    try {
      localStorage.setItem(KEY, this.high ? 'high' : 'low');
    } catch {
      // ignore
    }
    this.refresh();
  }

  get label(): string {
    return `Quality: ${this.high ? 'High' : 'Low'}`;
  }

  private refresh(): void {
    this.apply(this.high);
    this.button.textContent = `${this.label}  (Q)`;
  }
}

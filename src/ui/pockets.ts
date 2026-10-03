/** Story items, shown as a few icons in the corner. No inventory screen. */
const ITEMS: Record<string, { icon: string; name: string }> = {
  flask: { icon: '🥃', name: "Balazs's whiskey flask" },
  key: { icon: '🗝️', name: 'The ICEHOTEL key' },
  'sym-cat': { icon: '🐱', name: 'II' },
  'sym-bird': { icon: '🐦', name: 'IV' },
  'sym-train': { icon: '🚋', name: 'VII' },
  'sym-lotus': { icon: '🪷', name: 'VI' },
};

export class Pockets {
  private el = document.createElement('div');
  private shown = '';

  constructor() {
    this.el.id = 'pockets';
    document.body.append(this.el);
  }

  show(items: Iterable<string>): void {
    const list = [...items].filter((i) => ITEMS[i]);
    const key = list.join(',');
    if (key === this.shown) return;
    this.shown = key;
    this.el.innerHTML = '';
    for (const id of list) {
      const item = document.createElement('span');
      item.textContent = ITEMS[id].icon;
      item.title = ITEMS[id].name;
      const label = document.createElement('small');
      label.textContent = ITEMS[id].name;
      item.append(label);
      this.el.append(item);
    }
    this.el.classList.toggle('visible', list.length > 0);
  }
}

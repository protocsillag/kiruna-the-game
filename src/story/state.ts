import { CHAPTERS, STEPS, type Step } from './steps';

const KEY = 'kiruna.story';

export type Mode = 'story' | 'free';

interface Save {
  step: string;
  flags: string[];
  items: string[];
}

function readSave(): Save | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Save) : null;
  } catch {
    return null; // storage unavailable or corrupt: start fresh
  }
}

/**
 * The single place that knows where the player is in the story: the current step, a set of
 * flags and the items in their pockets. Saved to localStorage at the end of each chapter.
 * In free roam every gate is open: `reached()` is always true.
 */
export class Story {
  mode: Mode = 'free';
  step = 0;
  flags = new Set<string>();
  items = new Set<string>();
  private listeners: ((chapterChanged: boolean) => void)[] = [];

  get active(): boolean {
    return this.mode === 'story';
  }

  get current(): Step | null {
    return this.active ? (STEPS[this.step] ?? null) : null;
  }

  get chapter(): number {
    return this.current?.chapter ?? 0;
  }

  get chapterTitle(): string {
    return CHAPTERS[this.chapter - 1] ?? '';
  }

  /** Free roam, or the story has got as far as step `id`. */
  reached(id: string): boolean {
    return !this.active || this.step >= indexOf(id);
  }

  /** The story is exactly at step `id` right now. */
  at(id: string): boolean {
    return this.active && this.step === indexOf(id);
  }

  /** Finish step `id` and move to the next one (ignored unless that is the current step). */
  advance(id: string): void {
    if (!this.at(id)) return;
    const before = this.chapter;
    this.step++;
    const changed = this.chapter !== before;
    if (changed) this.save();
    this.listeners.forEach((fn) => fn(changed));
  }

  set(flag: string): void {
    this.flags.add(flag);
  }

  give(item: string): void {
    this.items.add(item);
  }

  onChange(fn: (chapterChanged: boolean) => void): void {
    this.listeners.push(fn);
  }

  /** How far a saved story got (0 = nothing worth continuing). */
  static savedStep(): number {
    const s = readSave();
    return s ? Math.max(0, indexOf(s.step)) : 0;
  }

  /** Enter story mode, from the save or from the very beginning. */
  begin(fresh: boolean): void {
    this.mode = 'story';
    const saved = fresh ? null : readSave();
    const s = saved?.step === 'end' ? null : saved; // a finished story starts again
    this.step = s ? Math.max(0, indexOf(s.step)) : 0;
    this.flags = new Set(s?.flags ?? []);
    this.items = new Set(s?.items ?? []);
    if (fresh) this.save();
  }

  save(): void {
    const data: Save = { step: STEPS[this.step]?.id ?? 'end', flags: [...this.flags], items: [...this.items] };
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      // ignore (private window etc.)
    }
  }
}

function indexOf(id: string): number {
  if (id === 'end') return STEPS.length;
  const i = STEPS.findIndex((s) => s.id === id);
  if (i < 0) console.warn(`Unknown story step: ${id}`);
  return i;
}

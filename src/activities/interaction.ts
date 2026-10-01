/** Something the player can do right now by pressing E. */
export interface Interaction {
  label: string;
  run(): void;
}

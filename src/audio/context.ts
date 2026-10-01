let ctx: AudioContext | undefined;

/** One shared AudioContext for all game sound (created lazily, resumed from a user gesture). */
export function audio(): AudioContext {
  return (ctx ??= new AudioContext());
}

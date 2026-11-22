/** A tiny "something changed locally" signal so the sync engine knows when to upload. */
type Listener = () => void;
const listeners = new Set<Listener>();

export function onLocalChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitLocalChange() {
  listeners.forEach((fn) => fn());
}

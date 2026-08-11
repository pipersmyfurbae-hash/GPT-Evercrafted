/**
 * Minimal observable store.
 *
 * The app state is { blueprint, selectedId, dirty, status } — nothing derived
 * is kept here. Everything the panels display (presence, gravity, rest zones,
 * validation) is recomputed from the blueprint on render, so no two panels can
 * hold different ideas of the same number.
 */

export function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();

  function emit(previous) {
    for (const listener of listeners) listener(state, previous);
  }

  return {
    get() {
      return state;
    },

    /** Replace state with a patch object or a function of the current state. */
    set(patch) {
      const previous = state;
      const next = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...next };
      emit(previous);
      return state;
    },

    /**
     * Apply a pure blueprint transform. Marks the state dirty only when the
     * transform actually changed something, so an out-of-range edit that the
     * action rejected does not light up the unsaved indicator.
     */
    edit(transform, { dirty = true } = {}) {
      const previous = state;
      const blueprint = transform(state.blueprint);
      if (blueprint === state.blueprint) return state;
      state = { ...state, blueprint, dirty: dirty ? true : state.dirty };
      emit(previous);
      return state;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

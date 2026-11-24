// Woodhouse Lifts — shared per-user state (moved out of app.js in 1.20.3).
// ES module imports are read-only, so screens read these directly (live bindings) and change them only through the
// setters below. The signed-in session lives in net.js (setSession) for the same reason.
export let profile = null;   // the signed-in user's profile row (unit, equipment, avoid_tags, …)
export let exCache = null;   // the exercise library, loaded once per session (loadExercises)
export let builder = null;   // the meso builder's in-progress state, kept while you move between its steps
export const setProfile = v => { profile = v; };
export const setExCache = v => { exCache = v; };
export const setBuilder = v => { builder = v; };

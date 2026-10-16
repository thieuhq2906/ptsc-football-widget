(() => {
  "use strict";
  // Key layouts: built-in A/B sets plus the player's own, kept in this browser's localStorage.
  const STORAGE_KEY = "ptsc-football.key-layouts.v1";
  const ACTIONS = ["up", "down", "left", "right", "switch", "sprint", "pass", "shoot", "press", "challenge", "special", "pause"];
  const LABELS = { up: "Lên", down: "Xuống · giữa (pen)", left: "Trái", right: "Phải", switch: "Đổi người", sprint: "Chạy nhanh", pass: "Chuyền", shoot: "Sút / xoạc", press: "Áp sát", challenge: "Tranh bóng", special: "Skill", pause: "Tạm dừng / menu" };
  const BUILT_IN = {
    "default-a": { name: "Mặc định A · WASD", keys: { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD", switch: "KeyR", sprint: "KeyT", pass: "KeyF", shoot: "KeyG", press: "KeyV", challenge: "KeyB", special: "KeyE", pause: "KeyQ" } },
    "default-b": { name: "Mặc định B · mũi tên", keys: { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", switch: "KeyU", sprint: "KeyI", pass: "KeyJ", shoot: "KeyK", press: "KeyN", challenge: "KeyM", special: "KeyO", pause: "KeyP" } },
  };
  const DEFAULT_ASSIGN = { cpu: { A: "default-a" }, local: { A: "default-a", B: "default-b" } };
  const NAMES = { ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", ShiftLeft: "⇧ trái", ShiftRight: "⇧ phải", Enter: "Enter", Backspace: "⌫", Semicolon: ";", Quote: "'", Comma: ",",
    Period: ".", Slash: "/", Backslash: "\\", IntlBackslash: "\\", BracketLeft: "[", BracketRight: "]", Minus: "-", Equal: "=", Backquote: "`", Insert: "Ins", Delete: "Del", PageUp: "PgUp", PageDown: "PgDn",
    NumpadAdd: "Num +", NumpadSubtract: "Num −", NumpadMultiply: "Num *", NumpadDivide: "Num /", NumpadDecimal: "Num .", NumpadEnter: "Num Enter" };
  // Space pauses, Escape leaves fullscreen, Tab moves focus; modifiers and F-keys trigger browser shortcuts.
  const RESERVED = /^(Space|Escape|Tab|CapsLock|NumLock|ScrollLock|Pause|PrintScreen|ContextMenu|Meta\w*|OS\w*|Control\w*|Alt\w*|F\d+|Fn\w*|Unidentified)?$/;
  const label = code => NAMES[code] ?? String(code).replace(/^Key/, "").replace(/^Digit/, "").replace(/^Numpad/, "Num ");
  const reserved = code => RESERVED.test(code ?? "");
  const listeners = new Set();

  function validKeys(keys) {
    if (!keys || typeof keys !== "object") return false;
    const codes = ACTIONS.map(action => keys[action]);
    return codes.every(code => typeof code === "string" && !reserved(code)) && new Set(codes).size === codes.length;
  }
  function read() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch { saved = null; }
    const layouts = new Map(Object.entries(BUILT_IN).map(([id, layout]) => [id, { id, name: layout.name, keys: { ...layout.keys }, builtIn: true, edited: false }]));
    for (const item of Array.isArray(saved?.layouts) ? saved.layouts : []) {
      if (typeof item?.id === "string" && item.keys && typeof item.keys === "object" && !item.keys.pause) {
        const used = new Set(Object.values(item.keys)), fallback = BUILT_IN[item.id]?.keys.pause ?? "KeyQ";
        item.keys = { ...item.keys, pause: !used.has(fallback) ? fallback : ["KeyQ", "KeyP", "KeyZ", "KeyX", "KeyC", "KeyL", "Semicolon", "Quote"].find(code => !used.has(code)) };
      }
      if (typeof item?.id !== "string" || !validKeys(item.keys)) continue;
      const name = String(item.name || "").trim().slice(0, 40) || "Layout";
      layouts.set(item.id, { id: item.id, name, keys: Object.fromEntries(ACTIONS.map(action => [action, item.keys[action]])), builtIn: item.id in BUILT_IN, edited: item.id in BUILT_IN });
    }
    const assign = { cpu: { ...DEFAULT_ASSIGN.cpu }, local: { ...DEFAULT_ASSIGN.local } };
    for (const mode of Object.keys(assign)) for (const slot of Object.keys(assign[mode])) {
      const id = saved?.assign?.[mode]?.[slot];
      if (layouts.has(id)) assign[mode][slot] = id;
    }
    if (conflicts(layouts.get(assign.local.A).keys, layouts.get(assign.local.B).keys).length) assign.local = { ...DEFAULT_ASSIGN.local };
    return { layouts, assign };
  }
  let state = read();
  function write() {
    const layouts = [...state.layouts.values()].filter(layout => !layout.builtIn || layout.edited).map(({ id, name, keys }) => ({ id, name, keys }));
    let stored = true;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, layouts, assign: state.assign })); } catch { stored = false; }
    for (const listener of listeners) listener();
    return stored;
  }
  /** Codes two key sets share. */
  function conflicts(a, b) {
    const used = new Set(Object.values(a));
    return [...new Set(Object.values(b).filter(code => used.has(code)))];
  }
  /** Keys the other player of a two-player match uses, when `slot` would switch to `keys`. */
  function clashFor(mode, slot, keys) {
    if (mode !== "local") return [];
    const other = state.layouts.get(state.assign.local[slot === "A" ? "B" : "A"]);
    return conflicts(keys, other.keys);
  }
  const api = {
    ACTIONS, LABELS, label, reserved, conflicts,
    list: () => [...state.layouts.values()],
    get: id => state.layouts.get(id) ?? null,
    assigned: (mode, slot) => state.layouts.get(state.assign[mode]?.[slot]) ?? null,
    bindings: mode => Object.fromEntries(Object.keys(state.assign[mode] ?? {}).map(slot => [slot, { ...state.layouts.get(state.assign[mode][slot]).keys }])),
    onChange: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    /** Uses a layout for one player of a mode. Returns the clashing codes instead when two players would share keys. */
    assign(mode, slot, id) {
      const layout = state.layouts.get(id);
      if (!layout || !state.assign[mode] || !(slot in state.assign[mode])) return { ok: false, clash: [] };
      const clash = clashFor(mode, slot, layout.keys);
      if (clash.length) return { ok: false, clash };
      state.assign[mode][slot] = id; return { ok: true, stored: write() };
    },
    /** Overwrites a layout, or creates one when `id` is null. Refuses keys that clash with a two-player partner. */
    save(id, name, keys) {
      if (!validKeys(keys)) return { ok: false, error: "invalid" };
      const target = id ? state.layouts.get(id) : null;
      if (id && !target) return { ok: false, error: "missing" };
      if (target) for (const [mode, slots] of Object.entries(state.assign)) for (const [slot, assigned] of Object.entries(slots)) {
        if (assigned !== id || mode !== "local") continue;
        const otherId = slots[slot === "A" ? "B" : "A"];
        if (otherId === id) continue;
        const clash = conflicts(keys, state.layouts.get(otherId).keys);
        if (clash.length) return { ok: false, error: "clash", clash, slot };
      }
      const newId = id ?? `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const cleanName = String(name || "").trim().slice(0, 40) || (target?.name ?? "Layout của tôi");
      state.layouts.set(newId, { id: newId, name: cleanName, keys: { ...keys }, builtIn: newId in BUILT_IN, edited: newId in BUILT_IN });
      return { ok: true, id: newId, stored: write() };
    },
    remove(id) {
      const layout = state.layouts.get(id);
      if (!layout || layout.builtIn) return false;
      state.layouts.delete(id);
      for (const [mode, slots] of Object.entries(state.assign)) for (const slot of Object.keys(slots)) if (slots[slot] === id) slots[slot] = DEFAULT_ASSIGN[mode][slot];
      if (conflicts(state.layouts.get(state.assign.local.A).keys, state.layouts.get(state.assign.local.B).keys).length) state.assign.local = { ...DEFAULT_ASSIGN.local };
      write(); return true;
    },
    /** Restores a built-in layout's original keys. */
    restore(id) {
      if (!(id in BUILT_IN)) return { ok: false };
      return this.save(id, BUILT_IN[id].name, BUILT_IN[id].keys);
    },
    isOriginal: id => id in BUILT_IN && ACTIONS.every(action => state.layouts.get(id)?.keys[action] === BUILT_IN[id].keys[action]) && state.layouts.get(id)?.name === BUILT_IN[id].name,
    reload() { state = read(); for (const listener of listeners) listener(); },
  };
  window.PTSCKeymap = api;
})();

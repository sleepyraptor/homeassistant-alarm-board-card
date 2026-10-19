import { Window } from "happy-dom";

/** Boots a DOM, loads the card module once and returns its exports. */
let loaded = null;

export async function boot() {
  if (!loaded) {
    const win = new Window({ url: "http://localhost:8123" });
    for (const k of ["window", "document", "HTMLElement", "customElements", "CustomEvent", "Event"]) {
      globalThis[k] = k === "window" ? win : win[k];
    }
    loaded = await import("../dist/alarm-board-card.js");
  }
  return loaded;
}

/**
 * A fake Home Assistant media library: { "<folder>": { "<alarm folder>": ["bedroom.jpg", ...] } }.
 * Every websocket call is recorded in `calls`.
 */
export function fakeHass(tree, { states = {}, language = "en" } = {}) {
  const calls = [];
  const ROOT = "media-source://media_source/local/";
  return {
    states,
    calls,
    locale: { language },
    language,
    hassUrl: (p) => `http://ha${p}`,
    callWS: async (msg) => {
      calls.push(msg);
      const path = msg.media_content_id.slice(ROOT.length);
      if (msg.type === "media_source/resolve_media") return { url: `/media/local/${path}?authSig=x` };
      const [top, dir] = path.split("/");
      if (!(top in tree)) throw Object.assign(new Error("Path does not exist."), { code: "browse_media_failed" });
      if (!dir) {
        return { children: Object.keys(tree[top]).map((t) => ({ title: t, media_class: "directory", can_expand: true, media_content_id: `${ROOT}${top}/${t}` })) };
      }
      return { children: tree[top][dir].map((f) => ({ title: f, media_class: /\.txt$/.test(f) ? "app" : "image", media_content_id: `${ROOT}${top}/${dir}/${f}` })) };
    }
  };
}

export async function makeCard(config, hass) {
  await boot();
  const el = globalThis.document.createElement("alarm-board-card");
  el.setConfig(config);
  el.hass = hass;
  await settle();
  return el;
}

export const settle = () => new Promise((r) => setTimeout(r, 20));
export const all = (el, sel) => Array.from(el.shadowRoot.querySelectorAll(sel));

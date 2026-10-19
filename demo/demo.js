/**
 * The card running outside Home Assistant, on a fake media library of drawn camera frames.
 * Used to take the README screenshots; open it with `npm run demo`.
 *
 * Query string: theme=dark|light, layout=hero|grid, lang=en|it, width=<px>, page=<alarms per page>.
 */
import { mdiAlarmLight, mdiAlertCircleOutline, mdiCctv, mdiShieldCheckOutline } from "/node_modules/@mdi/js/mdi.js";
import { dataUri, scene } from "./scenes.js";

const q = new URLSearchParams(location.search);
const theme = q.get("theme") || "dark";
const lang = q.get("lang") || "en";
document.documentElement.dataset.theme = theme;
document.getElementById("stage").style.maxWidth = `${q.get("width") || 1040}px`;

/** Stand-ins for the two Home Assistant elements the card uses. */
const ICONS = {
  "mdi:cctv": mdiCctv,
  "mdi:alarm-light": mdiAlarmLight,
  "mdi:shield-check-outline": mdiShieldCheckOutline,
  "mdi:alert-circle-outline": mdiAlertCircleOutline
};
customElements.define("ha-icon", class extends HTMLElement {
  connectedCallback() {
    const size = "var(--mdc-icon-size, 24px)";
    this.style.cssText += `display:inline-flex;width:${size};height:${size}`;
    this.innerHTML = `<svg viewBox="0 0 24 24" width="100%" height="100%"><path fill="currentColor" d="${ICONS[this.getAttribute("icon")] || ""}"/></svg>`;
  }
});
customElements.define("ha-card", class extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" }).innerHTML = `<style>:host{display:block;background:var(--ha-card-background);
      border-radius:12px;border:1px solid var(--divider-color);box-sizing:border-box}</style><slot></slot>`;
  }
});

await import("../dist/alarm-board-card.js");

/** Alarms relative to now, so the day headers read Today / Yesterday. */
const ago = (days, h, m, s) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(h, m, s, 0);
  return d;
};
const pad = (n) => String(n).padStart(2, "0");
const folder = (d, room, sensor) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}__${room}__${sensor}`;

const CAMS = { "Living room": "living_room", Hallway: "living_room", Bedroom: "bedroom", Office: "office" };
const ALARMS = [
  { date: ago(0, 15, 9, 58), room: "Bedroom", sensor: "Window sensor" },
  { date: ago(0, 3, 6, 59), room: "Living room", sensor: "Front door", night: true },
  { date: ago(1, 21, 42, 13), room: "Hallway", sensor: "Hallway motion", night: true },
  { date: ago(3, 11, 20, 5), room: "Office", sensor: "Office motion" },
  { date: ago(5, 2, 14, 40), room: "Bedroom", sensor: "Bedroom motion", night: true }
];

const tree = new Map();
for (const a of ALARMS) {
  const photos = new Map();
  for (const cam of ["living_room", "bedroom", "office"]) {
    photos.set(`${cam}.jpg`, dataUri(scene(cam, a.date, { night: a.night, intruder: CAMS[a.room] === cam })));
  }
  tree.set(folder(a.date, a.room, a.sensor), photos);
}

const ROOT = "media-source://media_source/local/alarms";
const hass = {
  states: {},
  language: lang,
  locale: { language: lang },
  hassUrl: (p) => p,
  callWS: async (msg) => {
    const id = msg.media_content_id;
    if (msg.type === "media_source/resolve_media") {
      const [dir, file] = id.slice(ROOT.length + 1).split("/");
      return { url: tree.get(dir).get(file), mime_type: "image/svg+xml" };
    }
    if (id === ROOT) {
      return { children: [...tree.keys()].map((t) => ({ title: t, media_class: "directory", can_expand: true, media_content_id: `${ROOT}/${t}` })) };
    }
    const dir = id.slice(ROOT.length + 1);
    return { children: [...tree.get(dir).keys()].map((f) => ({ title: f, media_class: "image", media_content_id: `${ROOT}/${dir}/${f}` })) };
  }
};

const card = document.createElement("alarm-board-card");
card.setConfig({
  layout: q.get("layout") || "hero",
  page_size: Number(q.get("page") || 3),
  cameras: [
    { file: "living_room", name: lang === "it" ? "Soggiorno" : "Living room", rooms: ["Living room", "Hallway"] },
    { file: "bedroom", name: lang === "it" ? "Camera" : "Bedroom", rooms: ["Bedroom"] },
    { file: "office", name: lang === "it" ? "Studio" : "Office", rooms: ["Office"] }
  ]
});
card.hass = hass;
document.getElementById("stage").appendChild(card);
window.__card = card;

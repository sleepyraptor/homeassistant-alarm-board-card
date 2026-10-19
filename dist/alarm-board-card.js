/**
 * Alarm Board Card
 * A board of the snapshots taken when the alarm goes off: one Home Assistant media folder per alarm
 * (`YYYY-MM-DD_HH-MM-SS[__<room>__<trigger>]/<camera>.jpg`), newest first, grouped by day.
 * Photos are served through signed URLs (media_source/resolve_media), so they stay behind the login.
 * https://github.com/sleepyraptor/homeassistant-alarm-board-card
 */
const VERSION = "0.2.0";

const LOCAL = "media-source://media_source/local";
const NAME = /^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})(?:__(.*?)__(.*))?$/;
const IMAGE = /\.(jpe?g|png|webp)$/i;
const EXPIRES = 3600;
const MAX_ZOOM = 5;
const DOUBLE_TAP_ZOOM = 2.5;
const STALE_MS = 30000;

const I18N = {
  en: {
    title: "Alarm snapshots",
    today: "Today",
    yesterday: "Yesterday",
    empty: "No alarms recorded",
    loading: "Loading…",
    loading_photos: "Loading photos…",
    more: "Show more ({n})",
    count_one: "{n} alarm",
    count_other: "{n} alarms",
    trigger: "trigger",
    unknown_event: "Event not recorded",
    unavailable: "{name}: photo unavailable",
    close: "Close",
    previous: "Previous",
    next: "Next",
    hint: "Pinch or double tap to zoom",
    bad_layout: "layout must be 'hero' or 'grid'",
    bad_cameras: "cameras must be a list of { file, name, rooms }",
    f_title: "Title",
    f_folder: "Media folder",
    h_folder: "Folder name inside My media (e.g. alarms) or a full media-source:// id",
    f_layout: "Layout",
    l_hero: "Hero: the triggering camera large",
    l_grid: "Grid: all photos the same size",
    f_page_size: "Alarms per page",
    f_watch_entity: "Refresh when this entity changes",
    h_watch_entity: "Usually the script that takes the snapshots",
    f_cameras: "Cameras",
    h_cameras: "List of { file, name, rooms }: image name without extension, label, rooms it covers"
  },
  it: {
    title: "Foto degli allarmi",
    today: "Oggi",
    yesterday: "Ieri",
    empty: "Nessun allarme registrato",
    loading: "Carico…",
    loading_photos: "Carico le foto…",
    more: "Mostra altri ({n})",
    count_one: "{n} allarme",
    count_other: "{n} allarmi",
    trigger: "scatenante",
    unknown_event: "Evento non registrato",
    unavailable: "{name}: foto non disponibile",
    close: "Chiudi",
    previous: "Precedente",
    next: "Successiva",
    hint: "Pizzica o doppio tap per ingrandire",
    bad_layout: "layout deve essere 'hero' oppure 'grid'",
    bad_cameras: "cameras deve essere una lista di { file, name, rooms }",
    f_title: "Titolo",
    f_folder: "Cartella media",
    h_folder: "Nome della cartella dentro I miei media (es. allarmi) oppure un id media-source:// completo",
    f_layout: "Disposizione",
    l_hero: "Hero: la camera scatenante grande",
    l_grid: "Griglia: tutte le foto uguali",
    f_page_size: "Allarmi per pagina",
    f_watch_entity: "Aggiorna quando cambia questa entità",
    h_watch_entity: "Di solito lo script che scatta le foto",
    f_cameras: "Camere",
    h_cameras: "Lista di { file, name, rooms }: nome dell'immagine senza estensione, etichetta, stanze inquadrate"
  }
};

/** The language Home Assistant uses for this user; anything that is not Italian falls back to English. */
export const langOf = (hass) => {
  const l = String((hass && ((hass.locale && hass.locale.language) || hass.language)) || "en").toLowerCase();
  return l.startsWith("it") ? "it" : "en";
};

export const t = (lang, key, vars = {}) =>
  String((I18N[lang] || I18N.en)[key] ?? I18N.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

/** The folder name is the only source of metadata: date, room and triggering sensor. */
export const parseEvent = (title) => {
  const m = NAME.exec(String(title ?? ""));
  if (!m) return null;
  const [, y, mo, d, h, mi, s, room, sensor] = m;
  return {
    date: new Date(+y, +mo - 1, +d, +h, +mi, +s),
    room: room || "",
    sensor: sensor || ""
  };
};

/** `alarms`, `/alarms/` or a full media-source id all point to the same place. */
export const folderId = (folder) => {
  const f = String(folder ?? "").trim();
  if (f.startsWith("media-source://")) return f.replace(/\/+$/, "");
  return `${LOCAL}/${f.replace(/^\/+|\/+$/g, "")}`;
};

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const dayLabel = (date, now = new Date(), lang = "en", locale = lang) => {
  if (sameDay(date, now)) return t(lang, "today");
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay(date, y)) return t(lang, "yesterday");
  const opts = { weekday: "short", day: "numeric", month: "short" };
  if (date.getFullYear() !== now.getFullYear()) opts.year = "numeric";
  return date.toLocaleDateString(locale, opts);
};

export const ago = (date, now = new Date(), locale = "en") => {
  const s = Math.round((date - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const a = Math.abs(s);
  if (a < 60) return rtf.format(s, "second");
  if (a < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (a < 86400) return rtf.format(Math.round(s / 3600), "hour");
  return rtf.format(Math.round(s / 86400), "day");
};

const time = (d, locale) => d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

const pretty = (file) => {
  const s = String(file).replace(/[_-]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const same = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

/**
 * Photos in display order with their label and whether they show the triggering room.
 * Configured cameras come first, in the configured order; the rest follow alphabetically.
 */
export const arrange = (photos, room, cameras = []) => {
  const known = new Map(cameras.map((c, i) => [String(c.file).toLowerCase(), { ...c, i }]));
  const hero = room
    ? cameras.find((c) => (c.rooms || []).some((r) => same(r, room))) || cameras.find((c) => c.name && same(c.name, room))
    : null;
  const out = photos.map((p) => {
    const c = known.get(p.cam.toLowerCase());
    return {
      ...p,
      label: (c && c.name) || pretty(p.cam),
      trigger: !!hero && same(hero.file, p.cam),
      rank: c ? c.i : cameras.length
    };
  });
  out.sort((a, b) => (b.trigger - a.trigger) || (a.rank - b.rank) || a.cam.localeCompare(b.cam));
  return out.map(({ rank, ...p }) => p);
};

/**
 * New translation that keeps point q still while moving to scale s
 * (coordinates relative to the centre of the untransformed photo).
 */
export const zoomAt = (z, s, q) => {
  const k = s / z.s;
  return { s, x: q.x - (q.x - z.x) * k, y: q.y - (q.y - z.y) * k };
};

/**
 * A zoomed photo cannot leave the frame: its edge stops at the frame's edge.
 * dw×dh is the drawn photo, w×h the frame (the same by default).
 */
export const clampPan = (z, dw, dh, w = dw, h = dh) => {
  const mx = Math.max(0, (z.s * dw - w) / 2);
  const my = Math.max(0, (z.s * dh - h) / 2);
  return { s: z.s, x: Math.min(mx, Math.max(-mx, z.x)), y: Math.min(my, Math.max(-my, z.y)) };
};

/** Rectangle covered by a w0×h0 photo inside a w×h box with object-fit:contain. */
export const containRect = (w, h, w0, h0) => {
  if (!w0 || !h0) return { x: 0, y: 0, w, h };
  const k = Math.min(w / w0, h / h0);
  const dw = w0 * k;
  const dh = h0 * k;
  return { x: (w - dw) / 2, y: (h - dh) / 2, w: dw, h: dh };
};

const CSS = `
:host{display:block}
ha-card{padding:12px 12px 4px;container-type:inline-size;overflow:hidden}
.title{display:flex;align-items:center;gap:8px;font-size:18px;font-weight:600;margin:2px 4px 6px;color:var(--primary-text-color)}
.title ha-icon{color:var(--red-color,#db4437);--mdc-icon-size:22px}
.count{margin-left:auto;font-size:12px;font-weight:500;color:var(--secondary-text-color)}
.day{display:flex;align-items:center;gap:10px;margin:14px 0 8px;padding:4px 4px;
  font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--secondary-text-color)}
.day::after{content:"";flex:1;height:1px;background:var(--divider-color)}
.ev{margin:0 0 14px;padding:10px;border-radius:14px;background:var(--secondary-background-color);
  border:1px solid var(--divider-color)}
.head{display:flex;align-items:flex-start;gap:10px;margin:0 2px 10px}
.badge{flex:0 0 auto;display:grid;place-items:center;width:36px;height:36px;border-radius:50%;
  background:rgba(var(--rgb-red-color,219,68,55),.15);color:var(--red-color,#db4437)}
.badge ha-icon{--mdc-icon-size:20px}
.txt{min-width:0;flex:1}
.when{display:flex;align-items:baseline;flex-wrap:wrap;gap:0 8px}
.hour{font-size:20px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--primary-text-color)}
.rel{font-size:12px;color:var(--secondary-text-color)}
.what{margin-top:2px;font-size:14px;color:var(--primary-text-color);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.what .sep{color:var(--secondary-text-color);padding:0 4px}
.what.none{color:var(--secondary-text-color);font-style:italic}
.ph{position:relative;margin:0;padding:0;border:0;border-radius:10px;overflow:hidden;cursor:zoom-in;
  background:var(--card-background-color);aspect-ratio:16/9;display:block;width:100%}
.ph img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .3s ease}
.ph:hover img{transform:scale(1.03)}
.ph .cap{position:absolute;left:6px;bottom:6px;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;
  color:#fff;background:rgba(0,0,0,.55);backdrop-filter:blur(4px)}
.ph.trigger{outline:3px solid var(--red-color,#db4437);outline-offset:-3px}
.ph.trigger .cap{background:var(--red-color,#db4437)}
.ph.broken{cursor:default;display:grid;place-items:center;color:var(--secondary-text-color);font-size:12px}
.grid{display:grid;gap:8px}
/* hero: the triggering camera large, the others stacked beside it. */
.hero{grid-template-columns:2fr 1fr}
.hero .ph:first-child{grid-row:span 2;aspect-ratio:auto;min-height:100%}
.hero.n1{grid-template-columns:1fr}
.hero.n1 .ph:first-child{aspect-ratio:16/9}
.hero.n2 .ph:first-child{grid-row:auto;aspect-ratio:16/9}
.hero.n4 .ph:first-child{grid-row:span 3}
/* grid: every photo the same size. */
.even{grid-template-columns:repeat(3,1fr)}
.even.n1{grid-template-columns:1fr}
.even.n2,.even.n4{grid-template-columns:repeat(2,1fr)}
/* 16:9 like the cameras themselves: a narrower tile would crop the date and time burnt into the frame. */
.even .ph{aspect-ratio:16/9}
@container (max-width:520px){
  .hero,.hero.n4{grid-template-columns:1fr 1fr}
  .hero .ph:first-child,.hero.n4 .ph:first-child{grid-column:1/-1;grid-row:auto;aspect-ratio:16/9;min-height:0}
  .hero.n2 .ph:first-child{grid-column:auto}
  .hero.n2{grid-template-columns:1fr}
  .hour{font-size:18px}
}
.more{display:block;width:100%;margin:4px 0 10px;padding:10px;border:1px solid var(--divider-color);border-radius:12px;
  background:none;color:var(--primary-color);font:inherit;font-weight:600;cursor:pointer}
.msg{padding:28px 8px;text-align:center;color:var(--secondary-text-color)}
.msg ha-icon{display:block;margin:0 auto 8px;--mdc-icon-size:40px;opacity:.6}
`;

/** The lightbox lives in <body>: an ancestor with a transform would break position:fixed. */
const BOX_CSS = `
.box{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;background:rgba(0,0,0,.95);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
  color:#fff;font-family:var(--paper-font-body1_-_font-family,system-ui,sans-serif)}
.bar{display:flex;align-items:center;gap:12px;padding:calc(env(safe-area-inset-top) + 10px) 14px 10px}
.bar .t{flex:1;min-width:0;font-size:14px;line-height:1.3}
.bar .t b{font-size:16px}
.bar .t span{opacity:.75}
.x,.nav{border:0;background:rgba(255,255,255,.12);color:#fff;border-radius:50%;width:40px;height:40px;
  font-size:22px;line-height:40px;text-align:center;cursor:pointer;flex:0 0 auto}
.stage{position:relative;flex:1;min-height:0;overflow:hidden;touch-action:none}
/* The photo fills the stage exactly and contain keeps all of it in view: a percentage max-height
   inside an auto-height grid does not resolve, and overflow:hidden would crop the edges. */
.stage img{position:absolute;top:0;left:8px;width:calc(100% - 16px);height:100%;object-fit:contain;
  user-select:none;-webkit-user-drag:none;transform-origin:center center;will-change:transform}
.stage img.anim{transition:transform .2s ease}
.hint{position:absolute;z-index:2;left:50%;bottom:8px;transform:translateX(-50%);font-size:11px;opacity:.55;pointer-events:none;white-space:nowrap}
.nav{position:absolute;z-index:2;top:50%;transform:translateY(-50%)}
.prev{left:10px}.next{right:10px}
.dots{display:flex;justify-content:center;gap:8px;padding:12px 0 calc(env(safe-area-inset-bottom) + 14px)}
.dots i{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.35)}
.dots i.on{background:#fff}
@media (hover:none){.nav{display:none}}
`;

export const normalise = (config) => {
  const c = config || {};
  const layout = c.layout ?? "hero";
  if (!["hero", "grid"].includes(layout)) throw new Error(t("en", "bad_layout"));
  const cams = c.cameras ?? [];
  if (!Array.isArray(cams) || cams.some((x) => !x || typeof x !== "object" || !x.file)) {
    throw new Error(t("en", "bad_cameras"));
  }
  const size = parseInt(c.page_size, 10);
  return {
    ...c,
    folder: c.folder || "alarms",
    layout,
    page_size: size > 0 ? size : 10,
    cameras: cams.map((x) => ({
      file: String(x.file),
      name: x.name ? String(x.name) : "",
      rooms: Array.isArray(x.rooms) ? x.rooms.map(String) : x.rooms ? [String(x.rooms)] : []
    }))
  };
};

class AlarmBoardCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._events = [];
    this._shown = 0;
    this._loading = false;
    this._loadedAt = 0;
    this._error = "";
    this._lastRun = undefined;
    this._timer = null;
  }

  static getConfigElement() {
    return document.createElement("alarm-board-card-editor");
  }

  static getStubConfig() {
    return { folder: "alarms", layout: "hero" };
  }

  setConfig(config) {
    this._config = normalise(config);
    this._shown = this._config.page_size;
    this._events = [];
    if (this._hass) this._load();
  }

  get _lang() {
    return langOf(this._hass);
  }

  get _locale() {
    return (this._hass && this._hass.locale && this._hass.locale.language) || this._lang;
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) {
      this._load();
      return;
    }
    // Reload only when the watched script has just finished, not on every state change in the house.
    const id = this._config.watch_entity;
    const st = id && hass.states[id];
    const run = st ? `${st.attributes.last_triggered ?? st.last_changed}|${st.state}` : "";
    if (this._lastRun !== undefined && run !== this._lastRun && st && st.state !== "on") {
      clearTimeout(this._timer);
      this._timer = setTimeout(() => this._load(), 1500);
    }
    this._lastRun = run;
  }

  getCardSize() {
    return 10;
  }

  getGridOptions() {
    return { columns: "full" };
  }

  connectedCallback() {
    if (!this.shadowRoot.innerHTML) this._render();
    // Coming back to the view after a while: the board may be out of date.
    else if (this._hass && Date.now() - this._loadedAt > STALE_MS) this._load();
  }

  async _browse(id) {
    return this._hass.callWS({ type: "media_source/browse_media", media_content_id: id });
  }

  async _resolve(id) {
    const r = await this._hass.callWS({ type: "media_source/resolve_media", media_content_id: id, expires: EXPIRES });
    return this._hass.hassUrl ? this._hass.hassUrl(r.url) : r.url;
  }

  async _load() {
    if (!this._hass || !this._config || this._loading) return;
    this._loading = true;
    this._error = "";
    this._render();
    try {
      const root = await this._browse(folderId(this._config.folder));
      const dirs = (root.children || [])
        .filter((c) => c.media_class === "directory" || c.can_expand)
        .map((c) => ({ id: c.media_content_id, title: c.title, info: parseEvent(c.title) }))
        .filter((c) => c.info)
        .sort((a, b) => b.info.date - a.info.date);
      const known = new Map(this._events.map((e) => [e.id, e]));
      this._events = dirs.map((d) => known.get(d.id) || { ...d, photos: null });
      await this._fill();
    } catch (err) {
      // A folder that does not exist yet just means no alarm so far.
      if (`${err && err.code} ${err && err.message}`.match(/not.?exist|not_found/i)) this._events = [];
      else this._error = (err && err.message) || String(err);
    }
    this._loadedAt = Date.now();
    this._loading = false;
    this._render();
  }

  /**
   * Resolves the photos of the visible alarms only, not the whole history.
   * Empty folders disappear: Home Assistant can delete files but not folders, so an empty
   * folder is what is left after its photos were removed.
   */
  async _fill() {
    for (;;) {
      const todo = this._events.slice(0, this._shown).filter((e) => !e.photos);
      if (!todo.length) return;
      await this._fillSome(todo);
      this._events = this._events.filter((e) => !e.photos || e.photos.length);
    }
  }

  async _fillSome(todo) {
    await Promise.all(todo.map(async (e) => {
      try {
        const dir = await this._browse(e.id);
        const imgs = (dir.children || []).filter((c) => c.media_class === "image" || IMAGE.test(c.title));
        const photos = await Promise.all(imgs.map(async (c) => ({
          id: c.media_content_id,
          cam: c.title.replace(/\.[^.]+$/, ""),
          url: await this._resolve(c.media_content_id).catch(() => "")
        })));
        e.photos = arrange(photos, e.info.room, this._config.cameras);
      } catch {
        e.photos = [];
      }
    }));
  }

  async _more() {
    this._shown += this._config.page_size;
    this._render();
    await this._fill();
    this._render();
  }

  _photo(p, ei, pi) {
    const L = this._lang;
    if (!p.url) return `<div class="ph broken">${esc(t(L, "unavailable", { name: p.label }))}</div>`;
    return `<button class="ph${p.trigger ? " trigger" : ""}" data-e="${ei}" data-p="${pi}" aria-label="${esc(p.label)}">
      <img src="${esc(p.url)}" alt="${esc(p.label)}" loading="lazy" decoding="async">
      <span class="cap">${esc(p.label)}${p.trigger ? ` · ${esc(t(L, "trigger"))}` : ""}</span></button>`;
  }

  _event(e, ei) {
    const L = this._lang;
    const { date, room, sensor } = e.info;
    const what = room
      ? `<div class="what">${esc(room)}${sensor ? `<span class="sep">·</span>${esc(sensor)}` : ""}</div>`
      : `<div class="what none">${esc(t(L, "unknown_event"))}</div>`;
    let body;
    if (!e.photos) body = `<div class="msg">${esc(t(L, "loading_photos"))}</div>`;
    else {
      const kind = this._config.layout === "grid" ? "even" : "hero";
      body = `<div class="grid ${kind} n${Math.min(e.photos.length, 4)}">${e.photos.map((p, pi) => this._photo(p, ei, pi)).join("")}</div>`;
    }
    return `<article class="ev">
      <div class="head"><div class="badge"><ha-icon icon="mdi:alarm-light"></ha-icon></div>
        <div class="txt"><div class="when"><span class="hour">${time(date, this._locale)}</span><span class="rel">${esc(ago(date, new Date(), this._locale))}</span></div>${what}</div>
      </div>${body}</article>`;
  }

  _render() {
    if (!this._config) return;
    const L = this._lang;
    const c = this._config;
    const title = c.title === undefined ? t(L, "title") : c.title;
    const list = this._events.slice(0, this._shown);
    let html = "";
    let day = "";
    list.forEach((e, ei) => {
      const d = dayLabel(e.info.date, new Date(), L, this._locale);
      if (d !== day) {
        html += `<div class="day">${esc(d)}</div>`;
        day = d;
      }
      html += this._event(e, ei);
    });
    let tail = "";
    if (this._error) tail = `<div class="msg"><ha-icon icon="mdi:alert-circle-outline"></ha-icon>${esc(this._error)}</div>`;
    else if (!this._events.length) {
      tail = this._loading
        ? `<div class="msg">${esc(t(L, "loading"))}</div>`
        : `<div class="msg"><ha-icon icon="mdi:shield-check-outline"></ha-icon>${esc(t(L, "empty"))}</div>`;
    } else if (this._events.length > this._shown) {
      tail = `<button class="more" id="more">${esc(t(L, "more", { n: this._events.length - this._shown }))}</button>`;
    }
    const n = this._events.length;
    const count = n ? `<span class="count">${esc(t(L, n === 1 ? "count_one" : "count_other", { n }))}</span>` : "";
    this.shadowRoot.innerHTML = `<style>${CSS}</style><ha-card>
      ${title ? `<div class="title"><ha-icon icon="mdi:cctv"></ha-icon>${esc(title)}${count}</div>` : ""}
      ${html}${tail}</ha-card>`;
    this.shadowRoot.querySelectorAll("button.ph").forEach((b) =>
      b.addEventListener("click", () => this._open(+b.dataset.e, +b.dataset.p)));
    this.shadowRoot.querySelectorAll("img").forEach((img) =>
      img.addEventListener("error", () => this._retry(img), { once: true }));
    const more = this.shadowRoot.getElementById("more");
    if (more) more.addEventListener("click", () => this._more());
  }

  /** A signed URL expires: on the first error it is signed again, then left alone. */
  async _retry(img) {
    const b = img.closest("button.ph");
    if (!b) return;
    const p = this._events[+b.dataset.e]?.photos?.[+b.dataset.p];
    if (!p) return;
    try {
      p.url = await this._resolve(p.id);
      img.src = p.url;
    } catch {
      /* the photo stays broken: an empty frame is shown */
    }
  }

  _open(ei, pi) {
    const e = this._events[ei];
    if (!e || !e.photos) return;
    const L = this._lang;
    const locale = this._locale;
    const photos = e.photos.filter((p) => p.url);
    let i = Math.max(0, photos.indexOf(e.photos[pi]));
    const host = document.createElement("div");
    host.className = "alarm-board-lightbox";
    const root = host.attachShadow({ mode: "open" });
    const { date, room, sensor } = e.info;
    const sub = room ? `${esc(room)}${sensor ? ` · ${esc(sensor)}` : ""}` : esc(t(L, "unknown_event"));
    // Home-made zoom: the Home Assistant app disables page pinch-zoom, so the lightbox handles it.
    let z = { s: 1, x: 0, y: 0 };
    let img = null;
    let stage = null;
    const apply = (anim) => {
      if (!img) return;
      img.classList.toggle("anim", !!anim);
      img.style.transform = `translate(${z.x}px,${z.y}px) scale(${z.s})`;
    };
    const centre = (ev) => {
      const r = stage.getBoundingClientRect();
      return { x: ev.clientX - (r.left + r.width / 2), y: ev.clientY - (r.top + r.height / 2) };
    };
    /** With object-fit:contain the element covers the stage but the drawn photo does not: only the photo counts. */
    const outside = (ev) => {
      const r = img.getBoundingClientRect();
      const box = containRect(r.width, r.height, img.naturalWidth, img.naturalHeight);
      const x = ev.clientX - r.left;
      const y = ev.clientY - r.top;
      return x < box.x || x > box.x + box.w || y < box.y || y > box.y + box.h;
    };
    const lim = (v) => {
      const r = containRect(img.offsetWidth, img.offsetHeight, img.naturalWidth, img.naturalHeight);
      return clampPan(v, r.w, r.h, img.offsetWidth, img.offsetHeight);
    };
    const set = (s, q, base = z) => {
      z = lim(zoomAt(base, s, q));
    };

    const draw = () => {
      const p = photos[i];
      z = { s: 1, x: 0, y: 0 };
      root.innerHTML = `<style>${BOX_CSS}</style><div class="box" role="dialog" aria-modal="true">
        <div class="bar"><div class="t"><b>${esc(p.label)}</b>${p.trigger ? ` · ${esc(t(L, "trigger"))}` : ""}<br>
          <span>${esc(dayLabel(date, new Date(), L, locale))} ${time(date, locale)} · ${sub}</span></div>
          <button class="x" aria-label="${esc(t(L, "close"))}">×</button></div>
        <div class="stage">${photos.length > 1 ? `<button class="nav prev" aria-label="${esc(t(L, "previous"))}">‹</button>` : ""}
          <img src="${esc(p.url)}" alt="${esc(p.label)}" draggable="false">
          ${photos.length > 1 ? `<button class="nav next" aria-label="${esc(t(L, "next"))}">›</button>` : ""}
          <span class="hint">${esc(t(L, "hint"))}</span></div>
        <div class="dots">${photos.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("")}</div></div>`;
      img = root.querySelector(".stage img");
      stage = root.querySelector(".stage");
      root.querySelector(".x").addEventListener("click", close);
      root.querySelector(".prev")?.addEventListener("click", (ev) => { ev.stopPropagation(); step(-1); });
      root.querySelector(".next")?.addEventListener("click", (ev) => { ev.stopPropagation(); step(1); });
      wire();
    };
    const step = (d) => { i = (i + d + photos.length) % photos.length; draw(); };

    const wire = () => {
      const pts = new Map();
      let g = null;
      let moved = false;
      let lastTap = 0;
      const two = () => {
        const [a, b] = [...pts.values()];
        return { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
          m: { clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 } };
      };
      stage.addEventListener("pointerdown", (ev) => {
        if (ev.target.closest("button")) return;
        stage.setPointerCapture(ev.pointerId);
        pts.set(ev.pointerId, ev);
        if (pts.size === 1) {
          moved = false;
          g = { kind: "one", x0: ev.clientX, y0: ev.clientY, start: { ...z } };
        } else if (pts.size === 2) {
          const { d, m } = two();
          g = { kind: "pinch", d0: d, m0: centre(m), start: { ...z } };
        }
      });
      stage.addEventListener("pointermove", (ev) => {
        if (!pts.has(ev.pointerId) || !g) return;
        pts.set(ev.pointerId, ev);
        if (g.kind === "pinch" && pts.size >= 2) {
          const { d, m } = two();
          const s = Math.min(MAX_ZOOM, Math.max(1, g.start.s * (d / g.d0)));
          const q = centre(m);
          // Zoom around where the fingers started, plus how far their midpoint has moved.
          const v = zoomAt(g.start, s, g.m0);
          z = lim({ s, x: v.x + (q.x - g.m0.x), y: v.y + (q.y - g.m0.y) });
          moved = true;
          apply(false);
        } else if (g.kind === "one") {
          const dx = ev.clientX - g.x0;
          const dy = ev.clientY - g.y0;
          if (Math.hypot(dx, dy) > 8) moved = true;
          if (z.s > 1) {
            z = lim({ s: z.s, x: g.start.x + dx, y: g.start.y + dy });
            apply(false);
          }
        }
      });
      const end = (ev) => {
        if (!pts.has(ev.pointerId)) return;
        pts.delete(ev.pointerId);
        if (g && g.kind === "pinch") {
          // One finger left: carry on as a drag from where the photo is now.
          const rest = [...pts.values()][0];
          g = rest ? { kind: "one", x0: rest.clientX, y0: rest.clientY, start: { ...z } } : null;
          if (z.s < 1.05) { z = { s: 1, x: 0, y: 0 }; apply(true); }
          return;
        }
        if (!g || pts.size) return;
        const dx = ev.clientX - g.x0;
        g = null;
        if (z.s === 1 && Math.abs(dx) > 50 && photos.length > 1) { step(dx < 0 ? 1 : -1); return; }
        if (moved) return;
        const now = Date.now();
        if (now - lastTap < 300) {
          lastTap = 0;
          if (z.s > 1) z = { s: 1, x: 0, y: 0 };
          else set(DOUBLE_TAP_ZOOM, centre(ev));
          apply(true);
          return;
        }
        lastTap = now;
        // Single tap outside the photo, not zoomed: close (once a double tap is ruled out).
        if (z.s === 1 && outside(ev)) {
          setTimeout(() => { if (lastTap === now) close(); }, 300);
        }
      };
      stage.addEventListener("pointerup", end);
      stage.addEventListener("pointercancel", end);
      stage.addEventListener("wheel", (ev) => {
        ev.preventDefault();
        const s = Math.min(MAX_ZOOM, Math.max(1, z.s * (ev.deltaY < 0 ? 1.15 : 1 / 1.15)));
        if (s === 1) z = { s: 1, x: 0, y: 0 };
        else set(s, centre(ev));
        apply(false);
      }, { passive: false });
    };

    const key = (ev) => {
      if (ev.key === "Escape") close();
      else if (ev.key === "ArrowLeft") step(-1);
      else if (ev.key === "ArrowRight") step(1);
    };
    function close() {
      document.removeEventListener("keydown", key);
      host.remove();
    }
    document.addEventListener("keydown", key);
    draw();
    document.body.appendChild(host);
    return { zoom: (s, q = { x: 0, y: 0 }) => { set(s, q); apply(false); }, close };
  }
}

/** Visual editor: every option has a field; cameras are edited as YAML inside the form. */
class AlarmBoardCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._form) this._form.hass = hass;
    else this._render();
  }

  _schema(L) {
    return [
      { name: "title", selector: { text: {} } },
      { name: "folder", selector: { text: {} } },
      {
        type: "grid",
        name: "",
        schema: [
          {
            name: "layout",
            selector: {
              select: {
                mode: "dropdown",
                options: [
                  { value: "hero", label: t(L, "l_hero") },
                  { value: "grid", label: t(L, "l_grid") }
                ]
              }
            }
          },
          { name: "page_size", selector: { number: { min: 1, max: 50, mode: "box" } } }
        ]
      },
      { name: "watch_entity", selector: { entity: { domain: ["script", "automation", "input_button", "button"] } } },
      { name: "cameras", selector: { object: {} } }
    ];
  }

  _render() {
    if (!this._config) return;
    const L = langOf(this._hass);
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) => t(L, `f_${s.name}`);
      this._form.computeHelper = (s) => {
        const h = t(L, `h_${s.name}`);
        return h === `h_${s.name}` ? undefined : h;
      };
      this._form.addEventListener("value-changed", (ev) => {
        const value = { ...ev.detail.value };
        for (const k of Object.keys(value)) {
          if (value[k] === "" || value[k] === undefined || value[k] === null) delete value[k];
        }
        this._config = value;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: value }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.schema = this._schema(L);
    this._form.data = { layout: "hero", page_size: 10, ...this._config };
  }
}

if (!customElements.get("alarm-board-card")) {
  customElements.define("alarm-board-card", AlarmBoardCard);
  customElements.define("alarm-board-card-editor", AlarmBoardCardEditor);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "alarm-board-card",
    name: "Alarm Board Card",
    description: "A board of the snapshots taken when the alarm goes off, grouped by day and event",
    preview: false,
    documentationURL: "https://github.com/sleepyraptor/homeassistant-alarm-board-card"
  });
  console.info(`%c ALARM-BOARD-CARD %c ${VERSION} `, "color:#fff;background:#db4437;font-weight:700", "color:#db4437");
}

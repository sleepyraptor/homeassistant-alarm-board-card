/**
 * Alarm Board Card
 * A board of the snapshots taken when the alarm goes off: one Home Assistant media folder per alarm
 * (`YYYY-MM-DD_HH-MM-SS[__<room>__<trigger>]/<camera>.jpg`), newest first, grouped by day.
 * Photos are served through signed URLs (media_source/resolve_media), so they stay behind the login.
 * https://github.com/sleepyraptor/homeassistant-alarm-board-card
 */
const VERSION = "0.3.0";

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
    where: "Looking in {folder}",
    my_media: "My media",
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
    h_cameras: "Optional. Without cameras every photo is shown, labelled after its file name, and none is put in front.",
    f_file: "Image name",
    h_file: "File name without extension, e.g. living_room",
    f_name: "Label",
    f_rooms: "Rooms it covers",
    h_rooms: "When an alarm comes from one of these rooms, this camera goes in front",
    camera_n: "Camera {n}",
    add_camera: "Add camera",
    detect: "Find cameras",
    detect_found: "{n} cameras in the latest alarm, {added} added",
    detect_none: "No alarm found in {folder}",
    up: "Move up",
    down: "Move down",
    remove: "Remove"
  },
  it: {
    title: "Foto degli allarmi",
    today: "Oggi",
    yesterday: "Ieri",
    empty: "Nessun allarme registrato",
    where: "Cerco in {folder}",
    my_media: "I miei media",
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
    h_cameras: "Facoltativo. Senza camere si vedono tutte le foto, con il nome del file, e nessuna messa in evidenza.",
    f_file: "Nome dell'immagine",
    h_file: "Nome del file senza estensione, es. soggiorno",
    f_name: "Etichetta",
    f_rooms: "Stanze inquadrate",
    h_rooms: "Se l'allarme arriva da una di queste stanze, questa camera va in evidenza",
    camera_n: "Camera {n}",
    add_camera: "Aggiungi camera",
    detect: "Trova camere",
    detect_found: "{n} camere nell'ultimo allarme, {added} aggiunte",
    detect_none: "Nessun allarme trovato in {folder}",
    up: "Sposta su",
    down: "Sposta giù",
    remove: "Rimuovi"
  }
};

/** The language Home Assistant uses for this user; anything that is not Italian falls back to English. */
export const langOf = (hass) => {
  const l = String((hass && ((hass.locale && hass.locale.language) || hass.language)) || "en").toLowerCase();
  return l.startsWith("it") ? "it" : "en";
};

export const t = (lang, key, vars = {}) =>
  String((I18N[lang] || I18N.en)[key] ?? I18N.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

/** Wall-clock fields of an instant in a time zone (the browser's when tz is empty). */
const fields = (date, tz) => {
  if (!tz) {
    return { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate(), h: date.getHours(), mi: date.getMinutes(), s: date.getSeconds() };
  }
  const o = {};
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric"
  });
  for (const p of f.formatToParts(date)) o[p.type] = +p.value;
  return { y: o.year, m: o.month, d: o.day, h: o.hour % 24, mi: o.minute, s: o.second };
};

/**
 * The instant at which the clock in time zone tz reads the given wall-clock time.
 * The folder name is written by Home Assistant in its own time zone, which is not
 * necessarily the browser's (a phone abroad, a laptop set to UTC).
 */
export const zoned = (y, mo, d, h, mi, s, tz) => {
  if (!tz) return new Date(y, mo - 1, d, h, mi, s);
  const want = Date.UTC(y, mo - 1, d, h, mi, s);
  let at = want;
  // Two rounds settle the offset, daylight-saving changes included.
  for (let i = 0; i < 2; i++) {
    const f = fields(new Date(at), tz);
    at += want - Date.UTC(f.y, f.m - 1, f.d, f.h, f.mi, f.s);
  }
  return new Date(at);
};

/** The folder name is the only source of metadata: date, room and triggering sensor. */
export const parseEvent = (title, tz) => {
  const m = NAME.exec(String(title ?? ""));
  if (!m) return null;
  const [, y, mo, d, h, mi, s, room, sensor] = m;
  return {
    date: zoned(+y, +mo, +d, +h, +mi, +s, tz),
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

/** The folder as a person finds it in the media browser. */
export const where = (folder, lang = "en") => {
  const id = folderId(folder);
  if (!id.startsWith(`${LOCAL}/`)) return id;
  return [t(lang, "my_media"), ...id.slice(LOCAL.length + 1).split("/")].join(" › ");
};

/** Calendar day of an instant in a time zone, as a comparable number. */
const dayNo = (date, tz) => {
  const f = fields(date, tz);
  return Date.UTC(f.y, f.m - 1, f.d) / 86400000;
};

/** Today, Yesterday, or the date — counted in the time zone the times are shown in. */
export const dayLabel = (date, now = new Date(), lang = "en", locale = lang, tz) => {
  const diff = dayNo(now, tz) - dayNo(date, tz);
  if (diff === 0) return t(lang, "today");
  if (diff === 1) return t(lang, "yesterday");
  const opts = { weekday: "short", day: "numeric", month: "short" };
  if (fields(date, tz).y !== fields(now, tz).y) opts.year = "numeric";
  if (tz) opts.timeZone = tz;
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

export const time = (d, locale, tz) =>
  d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit", ...(tz ? { timeZone: tz } : {}) });

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
.msg .where{margin-top:6px;font-size:12px;opacity:.75}
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
  const all = c.cameras ?? [];
  if (!Array.isArray(all) || all.some((x) => !x || typeof x !== "object")) {
    throw new Error(t("en", "bad_cameras"));
  }
  // A row just added in the editor has no file yet: it is skipped, not an error.
  const cams = all.filter((x) => String(x.file ?? "").trim());
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

  /** Home Assistant's own time zone: the one the folder names are written in. */
  get _serverTz() {
    return (this._hass && this._hass.config && this._hass.config.time_zone) || undefined;
  }

  /** The time zone the user chose in their profile: the browser's (default) or the server's. */
  get _tz() {
    const pref = this._hass && this._hass.locale && this._hass.locale.time_zone;
    return pref === "server" ? this._serverTz : undefined;
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
        .map((c) => ({ id: c.media_content_id, title: c.title, info: parseEvent(c.title, this._serverTz) }))
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
    const parts = [room, sensor].filter(Boolean).map(esc);
    const what = parts.length
      ? `<div class="what">${parts.join(`<span class="sep">·</span>`)}</div>`
      : `<div class="what none">${esc(t(L, "unknown_event"))}</div>`;
    let body;
    if (!e.photos) body = `<div class="msg">${esc(t(L, "loading_photos"))}</div>`;
    else {
      const kind = this._config.layout === "grid" ? "even" : "hero";
      body = `<div class="grid ${kind} n${Math.min(e.photos.length, 4)}">${e.photos.map((p, pi) => this._photo(p, ei, pi)).join("")}</div>`;
    }
    return `<article class="ev">
      <div class="head"><div class="badge"><ha-icon icon="mdi:alarm-light"></ha-icon></div>
        <div class="txt"><div class="when"><span class="hour">${time(date, this._locale, this._tz)}</span><span class="rel">${esc(ago(date, new Date(), this._locale))}</span></div>${what}</div>
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
      const d = dayLabel(e.info.date, new Date(), L, this._locale, this._tz);
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
        : `<div class="msg"><ha-icon icon="mdi:shield-check-outline"></ha-icon>${esc(t(L, "empty"))}
          <div class="where">${esc(t(L, "where", { folder: where(c.folder, L) }))}</div></div>`;
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
    const tz = this._tz;
    const photos = e.photos.filter((p) => p.url);
    let i = Math.max(0, photos.indexOf(e.photos[pi]));
    const host = document.createElement("div");
    host.className = "alarm-board-lightbox";
    const root = host.attachShadow({ mode: "open" });
    const { date, room, sensor } = e.info;
    const sub = [room, sensor].filter(Boolean).map(esc).join(" · ") || esc(t(L, "unknown_event"));
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
          <span>${esc(dayLabel(date, new Date(), L, locale, tz))} ${time(date, locale, tz)} · ${sub}</span></div>
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

/**
 * Visual editor: every option has a field. Cameras get rows of their own, with add, remove,
 * reorder, and a button that reads them from the latest alarm folder.
 */
const EDITOR_CSS = `
.cams{margin-top:20px}
.cams .head{font-weight:500;margin:0 0 4px}
.cams .help{font-size:12px;color:var(--secondary-text-color);margin:0 0 10px}
.cam{border:1px solid var(--divider-color);border-radius:12px;padding:10px 10px 4px;margin:0 0 10px}
.cam .bar{display:flex;align-items:center;gap:4px;margin:0 0 6px;font-size:13px;color:var(--secondary-text-color)}
.cam .bar span{flex:1}
.tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.ed-btn{border:1px solid var(--divider-color);background:none;color:var(--primary-color);border-radius:18px;
  padding:6px 14px;font:inherit;font-weight:500;cursor:pointer}
.ed-btn:disabled{opacity:.4;cursor:default}
.icon-btn{border:0;background:none;color:var(--secondary-text-color);width:32px;height:32px;border-radius:50%;
  font-size:16px;cursor:pointer}
.icon-btn:hover{background:var(--secondary-background-color)}
.icon-btn:disabled{opacity:.3;cursor:default}
.note{font-size:12px;color:var(--secondary-text-color)}
`;

class AlarmBoardCardEditor extends HTMLElement {
  setConfig(config) {
    // Home Assistant hands back the config this editor just emitted: nothing to redraw.
    if (this._built && JSON.stringify(config) === this._sent) {
      this._config = { ...config };
      return;
    }
    const before = this._config;
    this._config = { ...config };
    // Rows are rebuilt only when the list itself changed, not on every keystroke.
    const shape = (c) => JSON.stringify(((c && c.cameras) || []).map((x) => x.file));
    if (!this._built || shape(before) !== shape(this._config)) this._render();
    else this._refresh();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) this._render();
    else for (const f of this.querySelectorAll("ha-form")) f.hass = hass;
  }

  get _L() {
    return langOf(this._hass);
  }

  get _cameras() {
    return Array.isArray(this._config.cameras) ? this._config.cameras : [];
  }

  _mainSchema(L) {
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
      { name: "watch_entity", selector: { entity: { domain: ["script", "automation", "input_button", "button"] } } }
    ];
  }

  _camSchema() {
    return [
      {
        type: "grid",
        name: "",
        schema: [
          { name: "file", required: true, selector: { text: {} } },
          { name: "name", selector: { text: {} } }
        ]
      },
      { name: "rooms", selector: { text: { multiple: true } } }
    ];
  }

  _form(schema, data, onChange) {
    const L = this._L;
    const f = document.createElement("ha-form");
    f.hass = this._hass;
    f.schema = schema;
    f.data = data;
    f.computeLabel = (s) => t(L, `f_${s.name}`);
    f.computeHelper = (s) => {
      const h = t(L, `h_${s.name}`);
      return h === `h_${s.name}` ? undefined : h;
    };
    f.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      onChange(ev.detail.value);
    });
    return f;
  }

  _emit(config) {
    const out = { ...config };
    for (const k of Object.keys(out)) {
      if (out[k] === "" || out[k] === undefined || out[k] === null) delete out[k];
    }
    if (Array.isArray(out.cameras)) {
      out.cameras = out.cameras.map((c) => {
        const x = { file: c.file || "" };
        if (c.name) x.name = c.name;
        const rooms = (c.rooms || []).filter((r) => String(r).trim());
        if (rooms.length) x.rooms = rooms;
        return x;
      });
      if (!out.cameras.length) delete out.cameras;
    }
    this._config = out;
    this._sent = JSON.stringify(out);
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: out }, bubbles: true, composed: true }));
  }

  _setCameras(cams, rebuild = true) {
    this._emit({ ...this._config, cameras: cams });
    if (rebuild) this._render();
  }

  _render() {
    if (!this._config) return;
    this._built = true;
    const L = this._L;
    const cams = this._cameras;
    this.innerHTML = `<style>${EDITOR_CSS}</style><div class="main"></div>
      <div class="cams"><div class="head">${esc(t(L, "f_cameras"))}</div>
        <div class="help">${esc(t(L, "h_cameras"))}</div><div class="list"></div>
        <div class="tools"><button class="ed-btn add" type="button">${esc(t(L, "add_camera"))}</button>
          <button class="ed-btn detect" type="button">${esc(t(L, "detect"))}</button>
          <span class="note"></span></div></div>`;
    this._main = this._form(this._mainSchema(L), { layout: "hero", page_size: 10, ...this._config }, (v) => {
      this._emit({ ...v, cameras: this._config.cameras });
    });
    this.querySelector(".main").appendChild(this._main);

    const list = this.querySelector(".list");
    cams.forEach((cam, i) => {
      const row = document.createElement("div");
      row.className = "cam";
      row.innerHTML = `<div class="bar"><span>${esc(t(L, "camera_n", { n: i + 1 }))}</span>
        <button class="icon-btn up" type="button" aria-label="${esc(t(L, "up"))}" ${i === 0 ? "disabled" : ""}>↑</button>
        <button class="icon-btn down" type="button" aria-label="${esc(t(L, "down"))}" ${i === cams.length - 1 ? "disabled" : ""}>↓</button>
        <button class="icon-btn remove" type="button" aria-label="${esc(t(L, "remove"))}">✕</button></div>`;
      row.appendChild(this._form(this._camSchema(), { rooms: [], ...cam }, (v) => {
        const next = this._cameras.slice();
        next[i] = v;
        // A new file name changes the list's shape, but the row must keep its focus.
        this._setCameras(next, false);
      }));
      const move = (d) => {
        const next = this._cameras.slice();
        [next[i], next[i + d]] = [next[i + d], next[i]];
        this._setCameras(next);
      };
      row.querySelector(".up").addEventListener("click", () => move(-1));
      row.querySelector(".down").addEventListener("click", () => move(1));
      row.querySelector(".remove").addEventListener("click", () => this._setCameras(this._cameras.filter((_, k) => k !== i)));
      list.appendChild(row);
    });
    this.querySelector(".add").addEventListener("click", () => this._setCameras([...this._cameras, { file: "" }]));
    const detect = this.querySelector(".detect");
    detect.disabled = !this._hass || !this._hass.callWS;
    detect.addEventListener("click", () => this._detect());
  }

  _refresh() {
    if (this._main) this._main.data = { layout: "hero", page_size: 10, ...this._config };
  }

  /** Reads the camera names from the most recent alarm folder and adds the missing ones. */
  async _detect() {
    const L = this._L;
    const note = this.querySelector(".note");
    const folder = this._config.folder || "alarms";
    try {
      const root = await this._hass.callWS({ type: "media_source/browse_media", media_content_id: folderId(folder) });
      const latest = (root.children || [])
        .map((c) => ({ c, info: parseEvent(c.title) }))
        .filter((x) => x.info)
        .sort((a, b) => b.info.date - a.info.date)[0];
      if (!latest) throw new Error("empty");
      const dir = await this._hass.callWS({ type: "media_source/browse_media", media_content_id: latest.c.media_content_id });
      const files = (dir.children || []).filter((c) => IMAGE.test(c.title)).map((c) => c.title.replace(/\.[^.]+$/, ""));
      const have = new Set(this._cameras.map((c) => String(c.file).toLowerCase()));
      const added = files.filter((f) => !have.has(f.toLowerCase())).map((f) => ({ file: f, name: pretty(f) }));
      this._setCameras([...this._cameras, ...added]);
      this.querySelector(".note").textContent = t(L, "detect_found", { n: files.length, added: added.length });
    } catch {
      note.textContent = t(L, "detect_none", { folder: where(folder, L) });
    }
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

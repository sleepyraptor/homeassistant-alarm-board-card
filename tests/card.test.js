import test from "node:test";
import assert from "node:assert/strict";
import { boot, fakeHass, makeCard, settle, all } from "./helpers.js";

const NEW = "2026-10-19_15-09-58__Bedroom__Window sensor";
const OLD = "2026-10-17_03-06-59__Living room__Front door";
const BARE = "2026-10-19_14-00-00";
const CAMS = ["bedroom.jpg", "desk.jpg", "living_room.jpg"];
const CAMERAS = [
  { file: "living_room", name: "Living room", rooms: ["Living room", "Hallway"] },
  { file: "bedroom", name: "Bedroom", rooms: ["Bedroom"] },
  { file: "desk", name: "Office" }
];

test("the folder name gives date, room and trigger", async () => {
  const { parseEvent } = await boot();
  const e = parseEvent(NEW);
  assert.equal(e.date.getHours(), 15);
  assert.equal(e.date.getSeconds(), 58);
  assert.equal(e.room, "Bedroom");
  assert.equal(e.sensor, "Window sensor");
});

test("date-only folders are valid, unrelated folders are not", async () => {
  const { parseEvent } = await boot();
  assert.deepEqual([parseEvent(BARE).room, parseEvent(BARE).sensor], ["", ""]);
  assert.equal(parseEvent("holiday-photos"), null);
});

test("folder: short name, slashes and full media-source ids", async () => {
  const { folderId } = await boot();
  assert.equal(folderId("alarms"), "media-source://media_source/local/alarms");
  assert.equal(folderId("/alarms/"), "media-source://media_source/local/alarms");
  assert.equal(folderId("media-source://media_source/nas/cctv/"), "media-source://media_source/nas/cctv");
});

test("today, yesterday, then the date, in the user's language", async () => {
  const { dayLabel } = await boot();
  const now = new Date(2026, 9, 19, 16, 0);
  assert.equal(dayLabel(new Date(2026, 9, 19, 1, 0), now, "en"), "Today");
  assert.equal(dayLabel(new Date(2026, 9, 18, 23, 0), now, "it"), "Ieri");
  assert.match(dayLabel(new Date(2026, 9, 17, 3, 0), now, "en"), /17/);
});

test("the language follows Home Assistant, unknown languages fall back to English", async () => {
  const { langOf, t } = await boot();
  assert.equal(langOf({ locale: { language: "it-IT" } }), "it");
  assert.equal(langOf({ language: "de" }), "en");
  assert.equal(t("it", "more", { n: 3 }), "Mostra altri (3)");
});

test("the camera covering the triggering room comes first and is marked", async () => {
  const { arrange } = await boot();
  const out = arrange([{ cam: "desk" }, { cam: "living_room" }, { cam: "bedroom" }], "Bedroom", CAMERAS);
  assert.deepEqual(out.map((p) => p.cam), ["bedroom", "living_room", "desk"]);
  assert.deepEqual(out.map((p) => p.trigger), [true, false, false]);
  assert.deepEqual(out.map((p) => p.label), ["Bedroom", "Living room", "Office"]);
});

test("a room can be covered by a camera in another room", async () => {
  const { arrange } = await boot();
  assert.equal(arrange([{ cam: "desk" }, { cam: "living_room" }], "hallway", CAMERAS)[0].cam, "living_room");
});

test("without cameras: alphabetical order, labels from the file name, nothing marked", async () => {
  const { arrange } = await boot();
  const out = arrange([{ cam: "garden_east" }, { cam: "attic" }], "Garden", []);
  assert.deepEqual(out.map((p) => p.label), ["Attic", "Garden east"]);
  assert.ok(out.every((p) => !p.trigger));
});

test("alarms newest first, grouped by day, photos already loaded", async () => {
  const hass = fakeHass({ alarms: { [OLD]: CAMS, [NEW]: CAMS, [BARE]: ["desk.jpg"] } });
  const el = await makeCard({ cameras: CAMERAS }, hass);
  const hours = all(el, ".hour").map((n) => n.textContent);
  assert.equal(hours.length, 3);
  assert.equal(all(el, ".day").length, 2);
  assert.equal(all(el, "article")[0].querySelectorAll("img").length, 3);
  assert.match(all(el, "img")[0].getAttribute("src"), /^http:\/\/ha\/media\/local\/.*bedroom\.jpg\?authSig=/);
  assert.equal(all(el, ".what.none").length, 1);
  assert.match(el.shadowRoot.textContent, /Event not recorded/);
});

test("other files in an alarm folder are ignored; png and webp are fine", async () => {
  const hass = fakeHass({ alarms: { [NEW]: ["bedroom.png", "desk.webp", "notes.txt"] } });
  const el = await makeCard({}, hass);
  assert.equal(all(el, "img").length, 2);
});

test("Italian interface when Home Assistant is in Italian", async () => {
  const el = await makeCard({}, fakeHass({ alarms: { [BARE]: CAMS } }, { language: "it" }));
  assert.match(el.shadowRoot.textContent, /Foto degli allarmi/);
  assert.match(el.shadowRoot.textContent, /Evento non registrato/);
});

test("a custom folder is read instead of the default one", async () => {
  const hass = fakeHass({ cctv: { [NEW]: CAMS } });
  const el = await makeCard({ folder: "cctv" }, hass);
  assert.equal(all(el, "article").length, 1);
});

test("grid uses the even grid, hero the large photo", async () => {
  const tree = { alarms: { [NEW]: CAMS } };
  const hero = await makeCard({ layout: "hero" }, fakeHass(tree));
  const grid = await makeCard({ layout: "grid" }, fakeHass(tree));
  assert.ok(hero.shadowRoot.querySelector(".grid.hero.n3"));
  assert.ok(grid.shadowRoot.querySelector(".grid.even.n3"));
});

test("a missing folder means no alarms, not an error", async () => {
  const el = await makeCard({}, fakeHass({}));
  assert.match(el.shadowRoot.textContent, /No alarms recorded/);
});

test("only the first page is loaded, the rest on demand", async () => {
  const tree = { alarms: {} };
  for (let d = 1; d <= 5; d++) tree.alarms[`2026-10-0${d}_10-00-00__Hall__S`] = ["desk.jpg"];
  const hass = fakeHass(tree);
  const el = await makeCard({ page_size: 2 }, hass);
  assert.equal(all(el, "article").length, 2);
  const browsedDirs = () => hass.calls.filter((c) => c.type === "media_source/browse_media").length - 1;
  assert.equal(browsedDirs(), 2);
  el.shadowRoot.getElementById("more").click();
  await settle();
  assert.equal(all(el, "article").length, 4);
});

test("empty folders are hidden and the page fills up with the next ones", async () => {
  const tree = { alarms: {
    "2026-10-19_17-00-00__Hall__A": [],
    "2026-10-19_16-00-00__Hall__B": [],
    "2026-10-18_10-00-00__Hall__C": ["desk.jpg"],
    "2026-10-17_10-00-00__Hall__D": ["desk.jpg"],
    "2026-10-16_10-00-00__Hall__E": ["desk.jpg"]
  } };
  const el = await makeCard({ page_size: 2 }, fakeHass(tree));
  assert.deepEqual(all(el, ".what").map((n) => n.textContent.slice(-1)), ["C", "D"]);
  assert.match(el.shadowRoot.getElementById("more").textContent, /\(1\)/);
});

test("reloads when the watched script finishes, not on every state change", async () => {
  const tree = { alarms: { [OLD]: CAMS } };
  const idle = { "script.snap": { state: "off", attributes: { last_triggered: "t1" } } };
  const hass = fakeHass(tree, { states: idle });
  const el = await makeCard({ watch_entity: "script.snap" }, hass);
  el.hass = { ...hass, states: { ...idle } };
  el.hass = { ...hass, states: { ...idle, "sensor.x": { state: "1", attributes: {} } } };
  const before = hass.calls.length;
  tree.alarms[NEW] = CAMS;
  el.hass = { ...hass, states: { "script.snap": { state: "off", attributes: { last_triggered: "t2" } } } };
  await new Promise((r) => setTimeout(r, 1700));
  assert.ok(hass.calls.length > before);
  assert.equal(all(el, "article").length, 2);
});

test("bad configs are rejected with a clear message", async () => {
  await boot();
  const el = globalThis.document.createElement("alarm-board-card");
  assert.throws(() => el.setConfig({ layout: "wall" }), /hero.*grid/);
  assert.throws(() => el.setConfig({ cameras: { file: "x" } }), /list/);
  assert.throws(() => el.setConfig({ cameras: [{ name: "no file" }] }), /list/);
});

test("rooms can be a single string", async () => {
  const { normalise } = await boot();
  assert.deepEqual(normalise({ cameras: [{ file: "a", rooms: "Hall" }] }).cameras[0].rooms, ["Hall"]);
});

test("zoom keeps the point under the fingers still", async () => {
  const { zoomAt } = await boot();
  const z = zoomAt({ s: 1, x: 0, y: 0 }, 2, { x: 100, y: 50 });
  assert.deepEqual(z, { s: 2, x: -100, y: -50 });
  assert.equal(100 * z.s + z.x, 100);
  assert.equal(50 * z.s + z.y, 50);
});

test("a zoomed photo cannot leave the frame", async () => {
  const { clampPan } = await boot();
  assert.deepEqual(clampPan({ s: 2, x: 999, y: -999 }, 400, 300), { s: 2, x: 200, y: -150 });
  const flat = clampPan({ s: 1, x: 30, y: 30 }, 400, 300);
  assert.equal(Math.abs(flat.x) + Math.abs(flat.y), 0);
});

test("contain: a 16:9 photo on a portrait phone fits, with bands above and below", async () => {
  const { containRect } = await boot();
  const r = containRect(390, 700, 1920, 1080);
  assert.equal(r.w, 390);
  assert.ok(Math.abs(r.h - 219.375) < 1e-9);
  assert.ok(Math.abs(r.y - (700 - 219.375) / 2) < 1e-9);
});

test("dragging stops at the edge of the drawn photo, not of the frame", async () => {
  const { clampPan } = await boot();
  const z = clampPan({ s: 2, x: 999, y: 999 }, 390, 219, 390, 700);
  assert.equal(z.x, 195);
  assert.equal(z.y, 0);
});

test("tap opens the lightbox and double tap zooms in and out", async () => {
  const el = await makeCard({ cameras: CAMERAS }, fakeHass({ alarms: { [NEW]: CAMS } }));
  all(el, "button.ph")[0].click();
  const host = globalThis.document.body.lastElementChild;
  const stage = host.shadowRoot.querySelector(".stage");
  const img = host.shadowRoot.querySelector(".stage img");
  assert.match(img.getAttribute("src"), /bedroom\.jpg/);
  stage.setPointerCapture = () => {};
  const tap = () => {
    for (const type of ["pointerdown", "pointerup"]) {
      stage.dispatchEvent(new globalThis.window.PointerEvent(type, { pointerId: 1, clientX: 10, clientY: 10, bubbles: true }));
    }
  };
  tap();
  tap();
  assert.match(img.style.transform, /scale\(2\.5\)/);
  tap();
  tap();
  assert.match(img.style.transform, /scale\(1\)/);
  host.shadowRoot.querySelector(".x").click();
  assert.ok(!host.isConnected);
});

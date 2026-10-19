import test from "node:test";
import assert from "node:assert/strict";
import { boot, fakeHass, settle } from "./helpers.js";

async function makeEditor(config, { language = "en", tree = {} } = {}) {
  await boot();
  const ed = globalThis.document.createElement("alarm-board-card-editor");
  ed.hass = { ...fakeHass(tree), locale: { language }, language };
  ed.setConfig({ type: "custom:alarm-board-card", ...config });
  ed.addEventListener("config-changed", (e) => { ed.last = e.detail.config; });
  return ed;
}

const forms = (ed) => Array.from(ed.querySelectorAll("ha-form"));
const rows = (ed) => Array.from(ed.querySelectorAll(".cam"));
const change = (form, value) => form.dispatchEvent(new globalThis.CustomEvent("value-changed", { detail: { value } }));
const CAMS = [{ file: "living_room", name: "Living room", rooms: ["Hall"] }, { file: "desk" }];

test("the card offers its editor", async () => {
  await boot();
  const Card = globalThis.customElements.get("alarm-board-card");
  assert.equal(Card.getConfigElement().tagName.toLowerCase(), "alarm-board-card-editor");
});

test("every option has a field, with defaults filled in", async () => {
  const ed = await makeEditor({ folder: "cctv" });
  const names = JSON.stringify(forms(ed)[0].schema);
  for (const k of ["title", "folder", "layout", "page_size", "watch_entity"]) assert.match(names, new RegExp(`"${k}"`));
  assert.equal(forms(ed)[0].data.folder, "cctv");
  assert.equal(forms(ed)[0].data.layout, "hero");
});

test("each camera has its own row with file, label and rooms", async () => {
  const ed = await makeEditor({ cameras: CAMS });
  assert.equal(rows(ed).length, 2);
  const f = rows(ed)[0].querySelector("ha-form");
  assert.match(JSON.stringify(f.schema), /"file".*"name".*"rooms"/);
  assert.deepEqual(f.data.rooms, ["Hall"]);
  assert.deepEqual(rows(ed)[1].querySelector("ha-form").data.rooms, []);
});

test("labels follow the language", async () => {
  const it = await makeEditor({}, { language: "it" });
  assert.equal(forms(it)[0].computeLabel({ name: "folder" }), "Cartella media");
  assert.match(it.textContent, /Aggiungi camera/);
});

test("main fields are handed back without empty values, cameras untouched", async () => {
  const ed = await makeEditor({ title: "x", cameras: CAMS });
  change(forms(ed)[0], { type: "custom:alarm-board-card", title: "", layout: "grid" });
  assert.equal(ed.last.title, undefined);
  assert.equal(ed.last.layout, "grid");
  assert.deepEqual(ed.last.cameras.map((c) => c.file), ["living_room", "desk"]);
});

test("add, move and remove cameras", async () => {
  const ed = await makeEditor({ cameras: CAMS });
  ed.querySelector(".add").click();
  assert.equal(rows(ed).length, 3);
  rows(ed)[1].querySelector(".up").click();
  assert.deepEqual(ed.last.cameras.map((c) => c.file), ["desk", "living_room", ""]);
  rows(ed)[2].querySelector(".remove").click();
  assert.deepEqual(ed.last.cameras.map((c) => c.file), ["desk", "living_room"]);
  assert.equal(rows(ed)[0].querySelector(".up").disabled, true);
});

test("typing in a camera row keeps the row (and its focus) instead of redrawing", async () => {
  const ed = await makeEditor({ cameras: CAMS });
  const form = rows(ed)[1].querySelector("ha-form");
  change(form, { file: "office", rooms: ["", "Office"] });
  assert.deepEqual(ed.last.cameras[1], { file: "office", rooms: ["Office"] });
  // Home Assistant hands the same config back: the very same form element must still be there.
  ed.setConfig(ed.last);
  assert.equal(rows(ed)[1].querySelector("ha-form"), form);
});

test("find cameras reads the latest alarm and adds only the missing ones", async () => {
  const tree = { alarms: {
    "2026-10-18_10-00-00": ["old_cam.jpg"],
    "2026-10-19_15-09-58__Hall__Door": ["living_room.jpg", "garden_east.png", "notes.txt"]
  } };
  const ed = await makeEditor({ cameras: [{ file: "living_room" }] }, { tree });
  ed.querySelector(".detect").click();
  await settle();
  assert.deepEqual(ed.last.cameras, [{ file: "living_room" }, { file: "garden_east", name: "Garden east" }]);
  assert.match(ed.querySelector(".note").textContent, /2 cameras in the latest alarm, 1 added/);
});

test("find cameras says where it looked when there is nothing", async () => {
  const ed = await makeEditor({ folder: "nope" });
  ed.querySelector(".detect").click();
  await settle();
  assert.match(ed.querySelector(".note").textContent, /No alarm found in My media › nope/);
});

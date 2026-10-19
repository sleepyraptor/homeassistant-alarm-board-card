import test from "node:test";
import assert from "node:assert/strict";
import { boot } from "./helpers.js";

async function makeEditor(config, language = "en") {
  await boot();
  const ed = globalThis.document.createElement("alarm-board-card-editor");
  ed.hass = { locale: { language }, language };
  ed.setConfig({ type: "custom:alarm-board-card", ...config });
  return ed;
}

const form = (ed) => ed.querySelector("ha-form");

test("the card offers its editor", async () => {
  await boot();
  const Card = globalThis.customElements.get("alarm-board-card");
  assert.equal(Card.getConfigElement().tagName.toLowerCase(), "alarm-board-card-editor");
});

test("every option has a field, with defaults filled in", async () => {
  const ed = await makeEditor({ folder: "cctv" });
  const names = JSON.stringify(form(ed).schema);
  for (const k of ["title", "folder", "layout", "page_size", "watch_entity", "cameras"]) assert.match(names, new RegExp(`"${k}"`));
  assert.equal(form(ed).data.folder, "cctv");
  assert.equal(form(ed).data.layout, "hero");
});

test("labels follow the language", async () => {
  const it = await makeEditor({}, "it");
  assert.equal(form(it).computeLabel({ name: "folder" }), "Cartella media");
  const en = await makeEditor({});
  assert.equal(en.querySelector("ha-form").computeLabel({ name: "layout" }), "Layout");
});

test("changes are handed back without empty values", async () => {
  const ed = await makeEditor({ title: "x" });
  let out = null;
  ed.addEventListener("config-changed", (e) => { out = e.detail.config; });
  form(ed).dispatchEvent(new globalThis.CustomEvent("value-changed", { detail: { value: { type: "custom:alarm-board-card", title: "", layout: "grid" } } }));
  assert.deepEqual(out, { type: "custom:alarm-board-card", layout: "grid" });
});

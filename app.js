/* Student Progress Tracker (local-only; stores per-day in localStorage) */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const VERSION = "v1";
const LS_PREFIX = `spt.${VERSION}.day.`;

const el = {
  date: $("#date"),
  saveState: $("#saveState"),
  lastSaved: $("#lastSaved"),
  btnSave: $("#btnSave"),
  btnPrint: $("#btnPrint"),
  btnExport: $("#btnExport"),
  importFile: $("#importFile"),
  btnClearAll: $("#btnClearAll"),
  btnReset: $("#btnReset"),
  // summary
  overallPct: $("#overallPct"),
  overallBar: $("#overallBar"),
  miniSkills: $("#miniSkills"),
  miniCoding: $("#miniCoding"),
  miniHealth: $("#miniHealth"),
  miniErrands: $("#miniErrands"),
  miniSpiritual: $("#miniSpiritual"),
  // errands
  errandNew: $("#errandNew"),
  btnAddErrand: $("#btnAddErrand"),
  errandsList: $("#errandsList"),
};

const DEFAULT_ERRANDS = [
  "Email/DM one important person",
  "Tidy desk for 5 minutes",
  "Prep tomorrow’s essentials",
];

const FORM_FIELDS = [
  "win",
  "challenge",
  "focus",
  // skills (ratings are handled separately)
  "skills_notes",
  // coding
  "coding_minutes",
  "coding_problems",
  "coding_topic",
  "coding_conf",
  "c_commit",
  "c_notes",
  "c_review",
  "c_learn",
  "coding_notes",
  // health
  "sleep",
  "water",
  "exercise",
  "mood",
  "screen",
  "h_meals",
  "h_breaks",
  "h_outside",
  "h_limit",
  "health_notes",
  // errands notes
  "errands_notes",
  // spiritual
  "sp_minutes",
  "sp_peace",
  "sp_grat",
  "sp_read",
  "sp_kind",
  "sp_reflect",
  "sp_gratitude",
  "sp_reflection",
];

const RATING_FIELDS = [
  { id: "r_focus", out: "r_focus_v" },
  { id: "r_comm", out: "r_comm_v" },
  { id: "r_prob", out: "r_prob_v" },
  { id: "r_time", out: "r_time_v" },
];

function fmtTime(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function todayISO() {
  const d = new Date();
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
}

function dayKey(dateISO) {
  return `${LS_PREFIX}${dateISO}`;
}

function setSaveState(kind, text) {
  el.saveState.textContent = text;
  el.saveState.classList.remove("pill--ok", "pill--warn", "pill--bad");
  if (kind === "ok") el.saveState.classList.add("pill--ok");
  if (kind === "warn") el.saveState.classList.add("pill--warn");
  if (kind === "bad") el.saveState.classList.add("pill--bad");
}

function readControlValue(id) {
  const node = document.getElementById(id);
  if (!node) return undefined;
  if (node.type === "checkbox") return !!node.checked;
  if (node.type === "number") return node.value === "" ? "" : Number(node.value);
  return node.value ?? "";
}

function writeControlValue(id, value) {
  const node = document.getElementById(id);
  if (!node) return;
  if (node.type === "checkbox") node.checked = !!value;
  else node.value = value ?? "";
}

function getErrandsFromUI() {
  const items = $$("#errandsList .list-item").map((row) => {
    const cb = row.querySelector('input[type="checkbox"]');
    const text = row.querySelector(".list-item__text")?.textContent ?? "";
    const id = row.getAttribute("data-id") || crypto.randomUUID();
    return { id, text, done: !!cb?.checked };
  });
  return items;
}

function renderErrands(items) {
  el.errandsList.innerHTML = "";

  const safeItems = (items?.length ? items : DEFAULT_ERRANDS.map((t) => ({ id: crypto.randomUUID(), text: t, done: false })))
    .filter((x) => x && String(x.text || "").trim().length);

  for (const item of safeItems) {
    const row = document.createElement("div");
    row.className = "list-item";
    row.setAttribute("data-id", item.id);

    const left = document.createElement("div");
    left.className = "list-item__left";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!item.done;
    cb.addEventListener("change", markDirty);

    const text = document.createElement("div");
    text.className = "list-item__text";
    text.textContent = item.text;

    left.appendChild(cb);
    left.appendChild(text);

    const del = document.createElement("button");
    del.className = "iconbtn";
    del.type = "button";
    del.title = "Remove";
    del.textContent = "✕";
    del.addEventListener("click", () => {
      row.remove();
      markDirty();
      updateStats();
    });

    row.appendChild(left);
    row.appendChild(del);
    el.errandsList.appendChild(row);
  }
}

function collectDayData() {
  const data = {
    meta: {
      version: VERSION,
      date: el.date.value,
      savedAt: new Date().toISOString(),
    },
    ratings: {},
    fields: {},
    errands: getErrandsFromUI(),
  };

  for (const r of RATING_FIELDS) {
    data.ratings[r.id] = Number(readControlValue(r.id) || 3);
  }

  for (const id of FORM_FIELDS) {
    data.fields[id] = readControlValue(id);
  }

  return data;
}

function applyDayData(data) {
  // defaults
  for (const r of RATING_FIELDS) {
    writeControlValue(r.id, 3);
    const out = document.getElementById(r.out);
    if (out) out.textContent = "3";
  }

  for (const id of FORM_FIELDS) writeControlValue(id, "");

  // apply actual
  if (data?.ratings) {
    for (const r of RATING_FIELDS) {
      const v = Number(data.ratings[r.id] ?? 3);
      writeControlValue(r.id, v);
      const out = document.getElementById(r.out);
      if (out) out.textContent = String(v);
    }
  }

  if (data?.fields) {
    for (const id of FORM_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(data.fields, id)) {
        writeControlValue(id, data.fields[id]);
      }
    }
  }

  renderErrands(Array.isArray(data?.errands) ? data.errands : null);
  updateStats();
  setSaveState("ok", "Loaded");
  el.lastSaved.textContent = data?.meta?.savedAt ? `Last saved: ${fmtTime(new Date(data.meta.savedAt))}` : "";
}

function loadDay(dateISO) {
  const raw = localStorage.getItem(dayKey(dateISO));
  if (!raw) {
    applyDayData(null);
    setSaveState("ok", "New day");
    el.lastSaved.textContent = "";
    return;
  }
  try {
    const data = JSON.parse(raw);
    applyDayData(data);
  } catch {
    applyDayData(null);
    setSaveState("bad", "Corrupt data");
  }
}

function saveDay() {
  const data = collectDayData();
  localStorage.setItem(dayKey(el.date.value), JSON.stringify(data));
  setSaveState("ok", "Saved");
  el.lastSaved.textContent = `Last saved: ${fmtTime(new Date())}`;
  dirty = false;
}

function resetDay() {
  if (!confirm("Reset all entries for this date? This cannot be undone.")) return;
  localStorage.removeItem(dayKey(el.date.value));
  loadDay(el.date.value);
  setSaveState("warn", "Reset");
}

function clearAllSavedData() {
  const msg =
    "Clear ALL saved days (localStorage) for this tracker on this browser? This cannot be undone.";
  if (!confirm(msg)) return;

  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(LS_PREFIX)) keys.push(k);
  }
  for (const k of keys) localStorage.removeItem(k);

  loadDay(el.date.value);
  setSaveState("warn", "Cleared");
  el.lastSaved.textContent = "";
}

function exportDay() {
  const data = collectDayData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `student-progress-${el.date.value}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setSaveState("ok", "Exported");
}

async function importDay(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  // force to current date (so you can import any file into current day)
  data.meta = data.meta || {};
  data.meta.date = el.date.value;
  data.meta.version = VERSION;
  data.meta.savedAt = new Date().toISOString();
  localStorage.setItem(dayKey(el.date.value), JSON.stringify(data));
  applyDayData(data);
  setSaveState("ok", "Imported");
}

function clamp01(n) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function avg(nums) {
  const xs = nums.filter((x) => typeof x === "number" && !Number.isNaN(x));
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function statsForSkills() {
  const vals = RATING_FIELDS.map((r) => Number(readControlValue(r.id)));
  const a = avg(vals);
  if (a == null) return { score01: 0, label: "—" };
  const score01 = clamp01((a - 1) / 4);
  return { score01, label: `${a.toFixed(1)}/5` };
}

function statsForCoding() {
  const minutes = Number(readControlValue("coding_minutes") || 0);
  const probs = Number(readControlValue("coding_problems") || 0);
  const conf = Number(readControlValue("coding_conf") || 3);
  const checks = ["c_commit", "c_notes", "c_review", "c_learn"].map((id) => !!readControlValue(id));

  // Heuristic: minutes up to 120 = full credit; problems up to 3 = full credit; confidence 1-5
  const minutes01 = clamp01(minutes / 120);
  const probs01 = clamp01(probs / 3);
  const conf01 = clamp01((conf - 1) / 4);
  const checks01 = clamp01(checks.filter(Boolean).length / checks.length);
  const score01 = (minutes01 * 0.35 + probs01 * 0.25 + conf01 * 0.20 + checks01 * 0.20);

  const labelParts = [];
  if (minutes) labelParts.push(`${minutes}m`);
  if (probs) labelParts.push(`${probs} solved`);
  return { score01, label: labelParts.length ? labelParts.join(" • ") : "—" };
}

function statsForHealth() {
  const sleep = Number(readControlValue("sleep") || 0);
  const water = Number(readControlValue("water") || 0);
  const exercise = Number(readControlValue("exercise") || 0);
  const mood = Number(readControlValue("mood") || 3);
  const checks = ["h_meals", "h_breaks", "h_outside", "h_limit"].map((id) => !!readControlValue(id));

  const sleep01 = clamp01(sleep / 8);
  const water01 = clamp01(water / 8);
  const ex01 = clamp01(exercise / 30);
  const mood01 = clamp01((mood - 1) / 4);
  const checks01 = clamp01(checks.filter(Boolean).length / checks.length);
  const score01 = (sleep01 * 0.30 + water01 * 0.20 + ex01 * 0.20 + mood01 * 0.15 + checks01 * 0.15);

  const labelParts = [];
  if (sleep) labelParts.push(`${sleep}h sleep`);
  if (exercise) labelParts.push(`${exercise}m ex`);
  return { score01, label: labelParts.length ? labelParts.join(" • ") : "—" };
}

function statsForErrands() {
  const items = getErrandsFromUI();
  if (!items.length) return { score01: 0, label: "—" };
  const done = items.filter((x) => x.done).length;
  const score01 = clamp01(done / items.length);
  return { score01, label: `${done}/${items.length} done` };
}

function statsForSpiritual() {
  const minutes = Number(readControlValue("sp_minutes") || 0);
  const peace = Number(readControlValue("sp_peace") || 3);
  const checks = ["sp_grat", "sp_read", "sp_kind", "sp_reflect"].map((id) => !!readControlValue(id));

  const minutes01 = clamp01(minutes / 20);
  const peace01 = clamp01((peace - 1) / 4);
  const checks01 = clamp01(checks.filter(Boolean).length / checks.length);
  const score01 = (minutes01 * 0.35 + peace01 * 0.40 + checks01 * 0.25);

  const labelParts = [];
  if (minutes) labelParts.push(`${minutes}m`);
  if (checks01 > 0) labelParts.push(`${checks.filter(Boolean).length}/4`);
  return { score01, label: labelParts.length ? labelParts.join(" • ") : "—" };
}

function updateStats() {
  const s = statsForSkills();
  const c = statsForCoding();
  const h = statsForHealth();
  const e = statsForErrands();
  const sp = statsForSpiritual();

  el.miniSkills.textContent = s.label;
  el.miniCoding.textContent = c.label;
  el.miniHealth.textContent = h.label;
  el.miniErrands.textContent = e.label;
  el.miniSpiritual.textContent = sp.label;

  const overall01 = (s.score01 * 0.25 + c.score01 * 0.25 + h.score01 * 0.20 + e.score01 * 0.15 + sp.score01 * 0.15);
  const pct = Math.round(overall01 * 100);
  el.overallPct.textContent = String(pct);
  el.overallBar.style.width = `${pct}%`;
}

let dirty = false;
let autosaveTimer = null;

function markDirty() {
  dirty = true;
  setSaveState("warn", "Unsaved");
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    // lightweight autosave so you never lose work
    saveDay();
  }, 700);
  updateStats();
}

function hookInputs() {
  // ratings
  for (const r of RATING_FIELDS) {
    const node = document.getElementById(r.id);
    const out = document.getElementById(r.out);
    if (!node || !out) continue;
    node.addEventListener("input", () => {
      out.textContent = String(node.value);
      markDirty();
    });
  }

  // general inputs
  for (const id of FORM_FIELDS) {
    const node = document.getElementById(id);
    if (!node) continue;
    node.addEventListener(node.type === "checkbox" ? "change" : "input", markDirty);
  }

  // date
  el.date.addEventListener("change", () => {
    if (dirty && !confirm("You have unsaved changes. Switch dates anyway? (Autosave usually prevents loss.)")) {
      el.date.value = lastDateISO;
      return;
    }
    lastDateISO = el.date.value;
    loadDay(el.date.value);
    dirty = false;
  });

  // buttons
  el.btnSave.addEventListener("click", saveDay);
  el.btnPrint.addEventListener("click", () => window.print());
  el.btnExport.addEventListener("click", exportDay);
  el.btnReset.addEventListener("click", resetDay);
  el.btnClearAll.addEventListener("click", clearAllSavedData);

  el.importFile.addEventListener("change", async () => {
    const file = el.importFile.files?.[0];
    if (!file) return;
    try {
      await importDay(file);
    } catch (err) {
      console.error(err);
      setSaveState("bad", "Import failed");
      alert("Import failed. Make sure you chose a valid export JSON file.");
    } finally {
      el.importFile.value = "";
    }
  });

  // errands add
  el.btnAddErrand.addEventListener("click", () => {
    const text = (el.errandNew.value || "").trim();
    if (!text) return;
    const items = getErrandsFromUI();
    items.push({ id: crypto.randomUUID(), text, done: false });
    renderErrands(items);
    el.errandNew.value = "";
    markDirty();
    updateStats();
  });
  el.errandNew.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      el.btnAddErrand.click();
    }
  });

  // before unload warning
  window.addEventListener("beforeunload", (e) => {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = "";
  });
}

let lastDateISO = todayISO();

function init() {
  el.date.value = todayISO();
  lastDateISO = el.date.value;
  hookInputs();
  loadDay(el.date.value);
  updateStats();
}

document.addEventListener("DOMContentLoaded", init);

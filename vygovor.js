(() => {
  // Приказ о дисциплинарном взыскании: форма слева, живой предпросмотр справа (как у рапортов).
  const D = window.VPDOC, C = window.VP_CONFIG || {};
  const UNITS = (window.VYG && window.VYG.units) || [];
  const $ = id => document.getElementById(id), v = id => $(id).value.trim();
  const esc = D.esc;
  const RANK_DAT = {
    "рядовой":"рядовому","ефрейтор":"ефрейтору","младший сержант":"младшему сержанту",
    "сержант":"сержанту","старший сержант":"старшему сержанту","старшина":"старшине",
    "прапорщик":"прапорщику","старший прапорщик":"старшему прапорщику",
    "младший лейтенант":"младшему лейтенанту","лейтенант":"лейтенанту",
    "старший лейтенант":"старшему лейтенанту","капитан":"капитану","майор":"майору",
    "подполковник":"подполковнику","полковник":"полковнику","генерал-майор":"генерал-майору",
    "генерал-лейтенант":"генерал-лейтенанту","генерал-полковник":"генерал-полковнику",
    "генерал армии":"генералу армии"
  };
  const state = { kind: "vyg", custom: null };

  UNITS.forEach(u => { const o = document.createElement("option"); o.value = u.id; o.textContent = u.name; $("unit").appendChild(o); });
  try {
    const saved = JSON.parse(localStorage.getItem("vp_vyg") || "{}");
    if (saved.kind === "pred" || saved.kind === "vyg") state.kind = saved.kind;
    if (UNITS.some(u => u.id === saved.unit)) $("unit").value = saved.unit;
  } catch (e) {}
  // подписант запоминается (те же ключи, что и раньше: vp_fromPos …)
  ["fromPos", "fromRank", "fromName"].forEach(id => {
    const s = localStorage.getItem("vp_" + id); if (s) $(id).value = s;
    $(id).addEventListener("input", () => localStorage.setItem("vp_" + id, v(id)));
  });
  $("date").value = D.iso(new Date());
  const numBox = D.counter("order", $("num"));
  $("numNext").addEventListener("click", () => { numBox.next(); page.refresh(); });

  const unit = () => UNITS.find(u => u.id === $("unit").value) || UNITS[0];
  function charterItems() {
    const u = unit(); if (!u) return [];
    if (u.id === "va" && /^рядов/i.test(v("tRank"))) return u[state.kind + "Private"] || [];
    return u[state.kind] || [];
  }
  // отработка: по умолчанию все пункты устава; после правки руководителя — его свободный текст
  const items = () => state.custom ? state.custom.map(t => t.trim()).filter(Boolean) : charterItems();
  function dutyOptions() {
    const all = new Set();
    UNITS.forEach(u => Object.keys(u).forEach(k => Array.isArray(u[k]) && u[k].forEach(t => all.add(t))));
    $("dutyOpts").innerHTML = [...all].map(t => `<option value="${esc(t)}"></option>`).join("");
  }
  function drawDuty(force) {
    const box = $("dutyEdit");
    if (!force && box.contains(document.activeElement) && document.activeElement.tagName === "INPUT") return;
    const rows = state.custom || charterItems();
    box.innerHTML = rows.map((t, i) => `<div class="duty-row"><span>${i + 1}.</span><input list="dutyOpts" data-i="${i}" value="${esc(t)}" placeholder="своя отработка или выбери из устава"><button type="button" class="x" data-del="${i}" title="Убрать">×</button></div>`).join("");
    $("dutyHint").textContent = state.custom
      ? "Отработка своя. «По уставу» вернёт пункты из дисциплинарного устава."
      : "Пункты подставлены по уставу. Любой можно переписать своими словами, удалить или добавить новый — подсказки из устава появятся при вводе.";
  }
  const customize = () => { if (!state.custom) state.custom = charterItems().slice(); };
  $("dutyEdit").addEventListener("input", e => { if (!e.target.dataset.i) return; customize(); state.custom[+e.target.dataset.i] = e.target.value; });
  $("dutyEdit").addEventListener("focusout", () => setTimeout(drawDuty, 0));
  $("dutyEdit").addEventListener("click", e => { const d = e.target.dataset.del; if (d === undefined) return; customize(); state.custom.splice(+d, 1); refill(true); });
  $("dutyAdd").addEventListener("click", () => { customize(); state.custom.push(""); refill(true); const ins = $("dutyEdit").querySelectorAll("input"); ins[ins.length - 1].focus(); });
  $("dutyReset").addEventListener("click", () => { state.custom = null; refill(true); });
  $("kind").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; state.kind = b.dataset.kind; persist(); refill(); loadHistory(); });
  $("unit").addEventListener("change", () => { persist(); refill(); });
  $("tRank").addEventListener("input", () => refill());
  $("tPass").addEventListener("input", () => { clearTimeout(histTimer); histTimer = setTimeout(loadHistory, 300); });
  function persist() { localStorage.setItem("vp_vyg", JSON.stringify({ kind: state.kind, unit: $("unit").value })); }
  function refill(force) {
    document.querySelectorAll("#kind button").forEach(b => b.classList.toggle("on", b.dataset.kind === state.kind));
    drawDuty(force);
    if (page) page.refresh();
  }

  // реестр выгруженных приказов — только в этом браузере (localStorage vp_orders)
  const digits = s => String(s || "").replace(/\D/g, "");
  let histTimer = 0;
  function orders() { try { return JSON.parse(localStorage.getItem("vp_orders") || "[]"); } catch (e) { return []; } }
  function loadHistory() {
    const box = $("hist"), passport = digits(v("tPass"));
    if (passport.length < 3) { box.className = "hist"; box.innerHTML = ""; return; }
    const list = orders().filter(o => o.passport === passport);
    if (!list.length) { box.className = "hist"; box.innerHTML = "По этому паспорту в этом браузере приказов нет."; return; }
    box.className = "hist repeat";
    box.innerHTML = "<b>Повторное.</b> По паспорту уже выгружались:<ol>" + list.map(o =>
      `<li><b>${esc(o.num)}</b> ${o.kind === "pred" ? "Предупреждение" : "Выговор"}${o.issued ? ", " + esc(o.issued) : ""}${o.reason ? " · ст. " + esc(o.reason) : ""}</li>`).join("") + "</ol>";
  }
  function remember() {
    const passport = digits(v("tPass")), num = v("num"), u = unit();
    const list = orders().filter(o => !(o.num === num && o.passport === passport && o.kind === state.kind));
    list.push({ num, kind: state.kind, passport, name: v("tName"), rank: v("tRank"), unit: u ? u.name : "", issued: D.longDate(v("date")), reason: points().join(", ") });
    localStorage.setItem("vp_orders", JSON.stringify(list.slice(-500)));
    loadHistory();
  }
  function rankDat(raw) {
    const t = raw.trim(); if (!t) return "";
    const s = RANK_DAT[t.toLowerCase()] || t.toLowerCase();
    return s.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }
  const points = () => $("nPoint").value.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
  function pointPhrase() {
    const ps = points();
    if (!ps.length) return ["статьёй ", { ph: "___" }];
    if (ps.length === 1) return "статьёй " + ps[0];
    return "статьями " + ps.slice(0, -1).join(", ") + " и " + ps[ps.length - 1];
  }
  const ph = (x, p) => x ? x : { ph: p };

  function validate() {
    const ok = D.check(["num", "date", "nPoint", "tRank", "tName", "tPass", "fromPos", "fromRank", "fromName"]);
    if (!unit()) { page.status("Выбери подразделение.", "err"); return false; }
    return ok;
  }

  // ---------- документ (общий стиль, см. docs.js) ----------
  async function spec() {
    const n = D.parseName(v("fromName"));
    const work = items();
    return {
      docTitle: `Приказ № ${v("num")} о вынесении дисциплинарного взыскания`, author: n ? n.short : "",
      title: "ПРИКАЗ", subtitle: "О вынесении дисциплинарного взыскания",
      metaLine: ["№ ", ph(v("num"), "___")],
      placeDate: ["г. " + (C.city || "Москва"), ph(D.longDate(v("date")), "«__» ________ 20__ г.")],
      blocks: [
        { p: ["В связи с совершением дисциплинарного проступка, предусмотренного "].concat(pointPhrase(), [" Дисциплинарного устава,"]) },
        { formula: "ПРИКАЗЫВАЮ:" },
        { item: 1, value: ["Выдать дисциплинарное взыскание в виде ", state.kind === "pred" ? "предупреждения" : "выговора", " ", ph(rankDat(v("tRank")), "звание"), " ", ph(v("tName"), "Имя Фамилия"), " с номером паспорта ", ph(v("tPass"), "______"), "."], dot: false },
        Object.assign({ item: 2, value: ["Назначить военнослужащему отработку дисциплинарного взыскания в виде", work.length ? ":" : " — не назначена."], dot: false }, work.length ? { list: work.map((t, i, a) => /[.;]$/.test(t) ? t : t + (i === a.length - 1 ? "." : ";")) } : {}),
        { item: 3, value: ["Настоящий Приказ вступает в законную силу с момента его официального опубликования и утверждения командующим составом батальона военной полиции Воинской части №12132."], dot: false },
        { sign: {
          label: ph(v("fromPos"), "Должность"),
          rank: ph(D.cap(v("fromRank")), "звание"), name: n ? n.short : { ph: "Фамилия И.О." },
          image: n ? await D.signImage({ name: v("fromName"), stamp: $("stampOn").checked }) : null } }
      ]
    };
  }
  let page = null;
  dutyOptions(); drawDuty(true);
  page = D.wire({ preview: $("preview"), spec, validate, counter: numBox, base: () => "prikaz_" + (v("num") || "x"), onExport: () => remember() });
  $("form").addEventListener("input", () => page.refresh());
  $("form").addEventListener("change", () => page.refresh());
  $("clear").addEventListener("click", () => {
    ["tRank", "tName", "tPass"].forEach(id => { $(id).value = ""; $(id).classList.remove("bad"); });
    numBox.next(); $("hist").className = "hist"; $("hist").innerHTML = "";
    refill(true); page.status("");
  });
  loadHistory();
  window.__vp = { spec, state, items };
})();

(() => {
  const C = window.VP_CONFIG || {};
  let UNITS = (window.VYG && window.VYG.units) || [];
  const $ = id => document.getElementById(id);
  const MONTHS = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
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
  const SAVED = ["fromPos","fromRank","fromName"];
  const state = { kind: "vyg" };

  $("city").textContent = C.city || "Москва";
  const now = new Date();
  $("date").value = `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()} г.`;
  UNITS.forEach(u => {
    const o = document.createElement("option");
    o.value = u.id; o.textContent = u.name;
    $("unit").appendChild(o);
  });
  try {
    const saved = JSON.parse(localStorage.getItem("vp_vyg") || "{}");
    if (saved.kind === "pred" || saved.kind === "vyg") state.kind = saved.kind;
    if (UNITS.some(u => u.id === saved.unit)) $("unit").value = saved.unit;
  } catch (e) {}
  SAVED.forEach(id => { const v = localStorage.getItem("vp_"+id); if (v) $(id).value = v; });

  const meas = document.createElement("canvas").getContext("2d");
  function fit(el){
    const cs = getComputedStyle(el);
    meas.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const w = Math.max(meas.measureText(el.value || el.placeholder || "").width, 40);
    el.style.width = Math.ceil(w + 12) + "px";
  }
  document.querySelectorAll("input[data-fit]").forEach(el => { fit(el); el.addEventListener("input", () => fit(el)); });
  // Номер: локальный счётчик этого браузера, поле можно править.
  const numBox = window.VPDOC.counter("order", $("num"));
  fit($("num"));
  document.fonts && document.fonts.ready.then(() => {
    document.querySelectorAll("input[data-fit]").forEach(fit);
    updateSignature();
  });

  function growPos(){
    const el = $("fromPos");
    el.style.height = "auto";
    el.style.height = Math.max(el.scrollHeight, 24) + "px";
  }
  growPos();
  document.querySelectorAll(".sign .f").forEach(el => el.addEventListener("input", () => {
    if (el.id === "fromPos") growPos();
    el.classList.remove("bad");
    if (SAVED.includes(el.id)) localStorage.setItem("vp_"+el.id, el.value.trim());
    if (["fromRank","fromName"].includes(el.id)) updateSignature();
  }));

  const posOptions = [...document.querySelectorAll("#positions option")].map(o => o.value || o.textContent);
  const posList = document.createElement("div");
  posList.className = "pos-suggest";
  posList.hidden = true;
  document.body.appendChild(posList);
  let posIndex = -1;
  function placePos(){
    const r = $("fromPos").getBoundingClientRect();
    posList.style.left = Math.max(8, r.left) + "px";
    posList.style.top = (r.bottom + 4) + "px";
    posList.style.width = Math.max(r.width, 280) + "px";
  }
  function showPos(){
    const q = $("fromPos").value.trim().toLowerCase();
    const exact = posOptions.some(p => p.toLowerCase() === q);
    const hits = (!q || exact) ? posOptions : posOptions.filter(p => p.toLowerCase().includes(q));
    posIndex = -1;
    if (!hits.length) { posList.hidden = true; return; }
    posList.innerHTML = hits.map(p => "<button type=\"button\">" + p.replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])) + "</button>").join("");
    placePos();
    posList.hidden = false;
  }
  function pickPos(text){
    const el = $("fromPos");
    el.value = text;
    el.classList.remove("bad");
    localStorage.setItem("vp_fromPos", text.trim());
    growPos();
    posList.hidden = true;
    el.focus();
  }
  $("fromPos").addEventListener("focus", showPos);
  $("fromPos").addEventListener("input", showPos);
  $("fromPos").addEventListener("keydown", e => {
    const buttons = [...posList.querySelectorAll("button")];
    if (posList.hidden || !buttons.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      posIndex = e.key === "ArrowDown" ? Math.min(posIndex + 1, buttons.length - 1) : Math.max(posIndex - 1, 0);
      buttons.forEach((b, i) => b.classList.toggle("on", i === posIndex));
      buttons[posIndex].scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && posIndex >= 0) {
      e.preventDefault();
      pickPos(buttons[posIndex].textContent);
    } else if (e.key === "Escape") posList.hidden = true;
  });
  posList.addEventListener("mousedown", e => {
    const b = e.target.closest("button");
    if (!b) return;
    e.preventDefault();
    pickPos(b.textContent);
  });
  document.addEventListener("click", e => {
    if (e.target === $("fromPos") || posList.contains(e.target)) return;
    posList.hidden = true;
  });
  window.addEventListener("resize", () => { if (!posList.hidden) placePos(); });
  window.addEventListener("scroll", () => { if (!posList.hidden) placePos(); }, true);
  ["tRank","tName","tPass"].forEach(id => $(id).addEventListener("input", () => {
    $(id).classList.remove("bad");
    if (id === "tPass") { dropNumber(); scheduleHistory(); }
    refill();
  }));
  $("unit").addEventListener("change", () => { persist(); refill(); });
  $("nPoint").addEventListener("input", () => { $("nPoint").classList.remove("bad"); refill(); });
  $("kind").addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    state.kind = b.dataset.kind;
    persist();
    refill();
    loadHistory();
  });

  function unit(){ return UNITS.find(u => u.id === $("unit").value) || UNITS[0]; }
  // Отработка: по умолчанию все пункты устава; после правки руководителя — его свободный текст (state.custom).
  function items(){
    if (state.custom) return state.custom.map(t => t.trim()).filter(Boolean);
    return charterItems();
  }
  function charterItems(){
    const u = unit();
    if (!u) return [];
    if (u.id === "va" && /^рядов/i.test($("tRank").value.trim())) return u[state.kind + "Private"] || [];
    return u[state.kind] || [];
  }
  function dutyOptions(){
    const all = new Set();
    UNITS.forEach(u => Object.keys(u).forEach(k => Array.isArray(u[k]) && u[k].forEach(t => all.add(t))));
    $("dutyOpts").innerHTML = [...all].map(t => `<option value="${esc(t)}"></option>`).join("");
  }
  function drawDuty(force){
    const box = $("dutyEdit");
    if (!force && box.contains(document.activeElement) && document.activeElement.tagName === "INPUT") return; // не мешаем печатать
    const rows = state.custom || charterItems();
    box.innerHTML = rows.map((t, i) => `<div class="duty-row"><span>${i + 1}.</span><input list="dutyOpts" data-i="${i}" value="${esc(t)}" placeholder="своя отработка или выбери из устава"><button type="button" class="x" data-del="${i}" title="Убрать">×</button></div>`).join("");
    $("dutyHint").textContent = state.custom
      ? "Отработка своя. «По уставу» вернёт пункты из дисциплинарного устава."
      : "Пункты подставлены по уставу. Любой можно переписать своими словами, удалить или добавить новый — подсказки из устава появятся при вводе.";
  }
  function customize(){ if (!state.custom) state.custom = charterItems().slice(); }
  $("dutyEdit").addEventListener("input", e => {
    if (!e.target.dataset.i) return;
    customize(); state.custom[+e.target.dataset.i] = e.target.value;
    $("workList").innerHTML = items().map(esc).map(t => `<li>${t}</li>`).join("");
  });
  $("dutyEdit").addEventListener("focusout", () => setTimeout(drawDuty, 0));
  $("dutyEdit").addEventListener("click", e => {
    const d = e.target.dataset.del; if (d === undefined) return;
    customize(); state.custom.splice(+d, 1); refill(); drawDuty(true);
  });
  $("dutyAdd").addEventListener("click", () => {
    customize(); state.custom.push(""); refill(); drawDuty(true);
    const ins = $("dutyEdit").querySelectorAll("input"); ins[ins.length - 1].focus();
  });
  $("dutyReset").addEventListener("click", () => { state.custom = null; refill(); drawDuty(true); });
  function persist(){ localStorage.setItem("vp_vyg", JSON.stringify({ kind: state.kind, unit: $("unit").value })); }
  function digits(s){ return String(s || "").replace(/\D/g, ""); }
  function dropNumber(){}
  let histTimer = 0;
  function scheduleHistory(){ clearTimeout(histTimer); histTimer = setTimeout(loadHistory, 300); }
  // Реестр выгруженных приказов — только в этом браузере (localStorage vp_orders).
  function orders(){ try { return JSON.parse(localStorage.getItem("vp_orders") || "[]"); } catch (e) { return []; } }
  function loadHistory(){
    const box = $("hist");
    const passport = digits($("tPass").value);
    if (passport.length < 3) { box.className = "hist"; box.innerHTML = ""; return; }
    const list = orders().filter(o => o.passport === passport);
    if (!list.length) { box.className = "hist"; box.innerHTML = "По этому паспорту в этом браузере приказов нет."; return; }
    const lines = list.map(o => {
      const kind = o.kind === "pred" ? "Предупреждение" : "Выговор";
      const why = o.reason ? " · ст. " + esc(o.reason) : "";
      return `<li><b>${esc(o.num)}</b> ${esc(kind)}${o.issued ? ", " + esc(o.issued) : ""}${why}</li>`;
    }).join("");
    box.className = "hist repeat";
    box.innerHTML = `<b>Повторное.</b> По паспорту уже выгружались:<ol>${lines}</ol>`;
  }
  function remember(){
    const passport = digits($("tPass").value), num = $("num").value.trim();
    const list = orders().filter(o => !(o.num === num && o.passport === passport && o.kind === state.kind));
    const u = unit();
    list.push({ num, kind: state.kind, passport, name: $("tName").value.trim(), rank: $("tRank").value.trim(), unit: u ? u.name : "", issued: $("date").value.trim(), reason: points().join(", ") });
    localStorage.setItem("vp_orders", JSON.stringify(list.slice(-500)));
    loadHistory();
  }
  function rankDat(raw){
    const t = raw.trim();
    if (!t) return "";
    const d = RANK_DAT[t.toLowerCase()];
    const s = d || t.toLowerCase();
    return s.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }
  function points(){
    return $("nPoint").value.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
  }
  function pointPhrase(){
    const ps = points();
    if (!ps.length) return "статьёй ___";
    if (ps.length === 1) return "статьёй " + ps[0];
    if (ps.length === 2) return "статьями " + ps[0] + " и " + ps[1];
    return "статьями " + ps.slice(0, -1).join(", ") + " и " + ps[ps.length - 1];
  }
  function refill(){
    document.querySelectorAll("#kind button").forEach(b => b.classList.toggle("on", b.dataset.kind === state.kind));
    $("kindWord").textContent = state.kind === "pred" ? "предупреждения" : "выговора";
    $("rankShow").textContent = rankDat($("tRank").value) || "________";
    $("nameShow").textContent = $("tName").value.trim() || "________";
    $("passShow").textContent = $("tPass").value.trim() || "______";
    $("normPoints").textContent = pointPhrase();
    const list = items();
    $("workList").innerHTML = list.map(esc).map(t => `<li>${t}</li>`).join("");
    drawDuty();
  }

  function parseName(full){
    const p = full.trim().split(/\s+/).filter(Boolean).map(cap);
    if (p.length >= 3) return {surname:p[0], short:`${p[0]} ${p[1][0]}. ${p[2][0]}.`, initial:p[1][0]};
    if (p.length === 2) return {surname:p[1], short:`${p[1]} ${p[0][0]}.`, initial:p[0][0]};
    if (p.length === 1) return {surname:p[0], short:p[0], initial:""};
    return null;
  }
  function rng(seedStr){
    let h = 2166136261;
    for (const ch of seedStr) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; };
  }
  function updateSignature(){
    const n = parseName($("fromName").value);
    const t = $("autoText"), path = $("autoPath");
    const hint = document.querySelector(".sign-hint");
    if (!n){ t.textContent = ""; path.setAttribute("d",""); hint.textContent = "подпись появится сама"; drawStamp("x"); return; }
    hint.textContent = "в документе: " + n.short;
    const r = rng(n.surname + n.initial);
    const len = 3 + Math.floor(r()*3);
    t.textContent = (n.initial || "") + n.surname[0] + n.surname.slice(1, len).toLowerCase();
    const fs = 34 + Math.round(r()*8);
    t.style.fontSize = fs + "px";
    t.style.transform = `rotate(${-(4 + r()*8)}deg) skewX(${-(6 + r()*10)}deg)`;
    meas.font = `${fs}px "Marck Script"`;
    const tw = Math.min(150, meas.measureText(t.textContent).width);
    const ex = 14 + tw, ey = 38 + r()*8;
    path.setAttribute("d", `M ${ex} ${ey}
      C ${ex + 18} ${ey + 22}, ${ex - 40} ${ey + 34}, ${18 + r()*10} ${70 + r()*8}
      C ${4} ${84}, ${60 + r()*20} ${78 + r()*6}, ${120 + r()*20} ${64 + r()*6}
      S ${200 + r()*15} ${44 + r()*10}, ${226 + r()*8} ${40 + r()*8}`);
    drawStamp(n.surname);
  }
  function drawStamp(seed){
    // оттиск — готовая картинка stamp.png, повёрнутая на случайный (но постоянный для фамилии) угол
    if (!stampSrc.complete || !stampSrc.naturalWidth) return;
    const S = 440, cx = S/2, d = S*0.97, r = rng("stamp" + seed);
    const out = document.createElement("canvas"); out.width = out.height = S;
    const og = out.getContext("2d"); og.translate(cx,cx); og.rotate((r()*40-20)*Math.PI/180); og.drawImage(stampSrc,-d/2,-d/2,d,d);
    $("stamp").src = out.toDataURL("image/png");
  }
  const stampSrc = new Image(); stampSrc.src = (window.VP_ASSETS && window.VP_ASSETS.stamp) || "stamp.png";
  const stampReady = stampSrc.decode().catch(() => {}).then(() => updateSignature());
  async function stampLoaded(){
    await stampReady;
    const s = $("stamp"); if (s.getAttribute("src")) await s.decode().catch(() => {});
  }
  $("stampOn").addEventListener("change", e => $("stamp").style.visibility = e.target.checked ? "visible" : "hidden");
  updateSignature();
  dutyOptions();
  refill();

  function validate(){
    let ok = true, first = null;
    ["tRank","tName","tPass","fromPos","fromRank","fromName"].forEach(id => {
      const el = $(id);
      if (!el.value.trim()){ el.classList.add("bad"); ok = false; first = first || el; }
    });
    if (!points().length){ $("nPoint").classList.add("bad"); ok = false; first = first || $("nPoint"); }
    if (!unit()) { ok = false; status("Выбери подразделение.", "err"); }
    else if (!ok) status("Заполни подсвеченные красным поля.", "err");
    if (first) first.focus();
    return ok && !!unit();
  }

  // ---------- PDF / PNG ----------
  async function spec(){
    const D = window.VPDOC;
    const n = parseName($("fromName").value);
    const p = $("paper");
    const html = p.querySelector(".para").outerHTML + p.querySelector("ol.items").outerHTML;
    const posLines = $("fromPos").value.trim().split(/\n+/).filter(Boolean);
    return {
      docTitle: `Приказ № ${$("num").value.trim()} о вынесении дисциплинарного взыскания`,
      header: ["МИНИСТЕРСТВО ОБОРОНЫ РОССИЙСКОЙ ФЕДЕРАЦИИ", "МОСКОВСКИЙ ВОЕННЫЙ ОКРУГ ВООРУЖЁННЫХ СИЛ", "РОССИЙСКОЙ ФЕДЕРАЦИИ"], unitLine: false, motto: false,
      title: "ПРИКАЗ", subtitle: "О вынесении дисциплинарного взыскания",
      metaLine: [$("date").value.trim(), C.city || "Москва", "№ " + $("num").value.trim()],
      blocks: [
        { html },
        { sign: {
          left: (posLines.length ? posLines : [{ ph: "должность" }]).concat([$("fromRank").value.trim() || { ph: "звание" }]),
          right: [n ? n.short : { ph: "И. Фамилия" }], rightTop: 50, leftTop: 30, rightWidth: 120,
          image: await D.signImage({ name: $("fromName").value, stamp: $("stampOn").checked }) } }
      ]
    };
  }
  const page = window.VPDOC.wire({
    spec, validate, counter: numBox,
    base: () => "prikaz_" + ($("num").value.trim() || "x"),
    onExport: () => remember()
  });
  function status(t, cls){ page.status(t, cls); }

  $("clear").addEventListener("click", () => {
    ["tRank","tName","tPass"].forEach(id => { $(id).value = ""; $(id).classList.remove("bad"); });
    numBox.next(); fit($("num"));
    $("hist").className = "hist";
    $("hist").innerHTML = "";
    refill(); status("");
  });

  window.__vp = { spec, state, items };
  function pad(n){ return String(n).padStart(2,"0"); }
  function cap(s){ return s.charAt(0).toUpperCase() + s.slice(1); }
  function esc(s){ return String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
})();

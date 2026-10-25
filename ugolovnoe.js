// Уголовные дела: бланки дознавателя ВП по УПК RMRP. Дела и бланки хранятся в localStorage (vp_ud),
// номер дела вписывается руками. Выгрузка — PDF (с кликабельными ссылками) и PNG (без ссылок).
(() => {
  const C = window.VP_CONFIG || {};
  const U = window.UD;
  const $ = id => document.getElementById(id);
  const MONTHS = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
  const OFF = ["fromPos","fromRank","fromName","staticId"];
  const CASE_F = ["num","article","suspName","suspInfo","applicant","victim","chiefPos","chiefRank","chiefName"];
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const pad = n => String(n).padStart(2, "0");
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const human = v => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v||""); return m ? `${+m[3]} ${MONTHS[+m[2]-1]} ${m[1]} г.` : "«__» ______ 20__ г."; };
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  // ---------- хранилище ----------
  let S;
  try { S = JSON.parse(localStorage.getItem("vp_ud") || "null"); } catch (e) { S = null; }
  if (!S || typeof S !== "object" || !S.cases) S = { cur: "", cases: {} };
  const save = () => localStorage.setItem("vp_ud", JSON.stringify(S));
  function newCase() {
    const id = "c" + Date.now().toString(36);
    S.cases[id] = { num: "", article: "", suspName: "", suspInfo: "", applicant: "", victim: "", chiefPos: "", chiefRank: "", chiefName: "", docs: {}, created: Date.now() };
    S.cur = id; save(); return id;
  }
  if (!S.cur || !S.cases[S.cur]) { const ids = Object.keys(S.cases); if (ids.length) S.cur = ids[ids.length - 1]; else newCase(); }
  const cs = () => S.cases[S.cur];
  let docKey = new URLSearchParams(location.search).get("doc") || localStorage.getItem("vp_ud_doc") || "raport";
  if (!U.DOCS.find(d => d.key === docKey)) docKey = "raport";
  const def = () => U.DOCS.find(d => d.key === docKey);
  function dd() {
    const c = cs(); c.docs = c.docs || {};
    const d = c.docs[docKey] = c.docs[docKey] || { ev: [], date: iso(new Date()) };
    def().fields.forEach(f => { if (f.fromCase && d[f.id] == null && c[f.fromCase]) d[f.id] = c[f.fromCase]; });
    if (!Array.isArray(d.ev)) d.ev = [];
    return d;
  }

  // ---------- панель ----------
  OFF.forEach(id => { const v = localStorage.getItem("vp_" + id); if (v) $(id).value = v; });
  OFF.forEach(id => $(id).addEventListener("input", () => { localStorage.setItem("vp_" + id, $(id).value.trim()); $(id).classList.remove("bad"); paint(); }));

  function fillCases() {
    $("caseSel").innerHTML = Object.entries(S.cases).map(([id, c]) =>
      `<option value="${id}" ${id === S.cur ? "selected" : ""}>${c.num ? "УД № " + esc(c.num) : "новое дело"}${c.suspName ? " · " + esc(c.suspName) : ""}</option>`).join("");
    const c0 = cs();
    // старое поле «Начальник» одной строкой: переносим в «звание и имя», должность вводится отдельно
    if (c0.chief && !c0.chiefName && !c0.chiefPos) { c0.chiefName = c0.chief; delete c0.chief; save(); }
    CASE_F.forEach(k => { $("c_" + k).value = cs()[k] || ""; $("c_" + k).classList.remove("bad"); });
  }
  $("caseSel").addEventListener("change", () => { S.cur = $("caseSel").value; save(); fillCases(); fillDoc(); });
  $("caseNew").addEventListener("click", () => { newCase(); fillCases(); fillDoc(); $("c_num").focus(); });
  $("caseDel").addEventListener("click", () => {
    if (!confirm("Удалить это дело и все его черновики из браузера? Уже скачанные PDF/PNG останутся у тебя.")) return;
    delete S.cases[S.cur]; S.cur = ""; const ids = Object.keys(S.cases);
    if (ids.length) S.cur = ids[ids.length - 1]; else newCase();
    save(); fillCases(); fillDoc();
  });
  CASE_F.forEach(k => $("c_" + k).addEventListener("input", () => {
    cs()[k] = $("c_" + k).value; $("c_" + k).classList.remove("bad"); save();
    if (["suspName","suspInfo","victim","applicant"].includes(k)) { const D = def(); if (D.fields.some(f => f.id === "people")) fillDoc(); }
    if (k === "num" || k === "suspName") { const o = $("caseSel").selectedOptions[0]; if (o) o.textContent = (cs().num ? "УД № " + cs().num : "новое дело") + (cs().suspName ? " · " + cs().suspName : ""); }
    paint();
  }));

  // список бланков по стадиям
  $("docSel").innerHTML = Object.entries(U.STAGES).map(([n, name]) =>
    `<optgroup label="${n}. ${esc(name)}">${U.DOCS.filter(d => d.stage == n).map(d => `<option value="${d.key}">${esc(d.short)}</option>`).join("")}</optgroup>`).join("");
  $("docSel").addEventListener("change", () => { docKey = $("docSel").value; localStorage.setItem("vp_ud_doc", docKey); fillDoc(); });

  function fillDoc() {
    $("docSel").value = docKey;
    const D = def(), d = dd();
    $("docArts").textContent = D.arts;
    $("docRoute").textContent = D.route || "";
    $("d_date").value = d.date || iso(new Date());
    $("docFields").innerHTML = D.fields.map(f => {
      const val = esc(d[f.id] || "");
      let inp;
      if (f.type === "area") inp = `<textarea data-k="${f.id}" rows="3" placeholder="${esc(f.ph || "")}">${val}</textarea>`;
      else if (f.type === "select") inp = `<select data-k="${f.id}"><option value="">— выбери —</option>${f.options.map(o => `<option ${o === d[f.id] ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
      else inp = `<input data-k="${f.id}" ${f.type === "time" ? 'type="time"' : ""} value="${val}" placeholder="${esc(f.ph || "")}">`;
      let add = "";
      if (f.id === "people") {
        const opts = ["подозреваемый", "потерпевший", "заявитель"].filter(r => fromRole(r));
        if (opts.length) add = `<div class="ud-addp">${opts.map(r => `<button type="button" class="mini" data-addp="${r}">+ ${r}</button>`).join(" ")}</div>`;
      }
      return `<label class="plab">${esc(f.label)}${inp}</label>${add}`;
    }).join("");
    fillEv(); paint();
  }
  $("docFields").addEventListener("input", e => { const k = e.target.dataset.k; if (!k) return; dd()[k] = e.target.value; e.target.classList.remove("bad"); save(); paint(); });
  // ФИО по процессуальному положению из карточки дела
  function fromRole(role) {
    const c = cs(), t = s => (s || "").trim();
    if (role === "подозреваемый") return t(c.suspName) ? t(c.suspName) + (t(c.suspInfo) ? ", " + t(c.suspInfo) : "") : "";
    if (role === "потерпевший") return t(c.victim);
    if (role === "заявитель") return t(c.applicant);
    return "";
  }
  $("docFields").addEventListener("change", e => {
    const k = e.target.dataset.k; if (!k) return; const d = dd(); d[k] = e.target.value;
    const f = def().fields.find(x => x.id === k);
    if (f && f.fills) {
      const tgt = d[f.fills] || "", nv = fromRole(e.target.value);
      // перезаписываем только пустое поле или ранее подставленное автоматически
      if (!tgt.trim() || tgt === d["_auto_" + f.fills]) {
        d[f.fills] = nv; d["_auto_" + f.fills] = nv;
        const inp = $("docFields").querySelector(`[data-k="${f.fills}"]`); if (inp) inp.value = nv;
      }
    }
    save(); paint();
  });
  // кнопки «+ из дела» для списка участвующих лиц в протоколах
  $("docFields").addEventListener("click", e => {
    const b = e.target.closest("[data-addp]"); if (!b) return;
    const d = dd(), line = fromRole(b.dataset.addp); if (!line) return;
    const row = `${line.split(",")[0]} — ${b.dataset.addp}`;
    const cur = (d.people || "").split("\n").map(s => s.trim()).filter(Boolean);
    if (!cur.some(x => x.startsWith(line.split(",")[0]))) cur.push(row);
    d.people = cur.join("\n"); save();
    const ta = $("docFields").querySelector('[data-k="people"]'); if (ta) ta.value = d.people;
    paint();
  });
  $("d_date").addEventListener("change", () => { dd().date = $("d_date").value; save(); paint(); });

  // ---------- доказательства (без ограничения количества) ----------
  function fillEv() {
    const ev = dd().ev;
    $("evList").innerHTML = ev.map((x, i) => `<div class="ev-row" data-i="${i}">
      <span class="ev-n">${i + 1}.</span><input data-ev="t" list="evTypes" placeholder="что это" value="${esc(x.t)}">
      <input data-ev="u" placeholder="ссылка" value="${esc(x.u)}"><button type="button" data-del title="Убрать">×</button></div>`).join("");
  }
  $("evAdd").addEventListener("click", () => { dd().ev.push({ t: "", u: "" }); save(); fillEv(); paint(); const r = $("evList").lastElementChild; r && r.querySelector("input").focus(); });
  $("evList").addEventListener("input", e => { const r = e.target.closest(".ev-row"); if (!r) return; dd().ev[+r.dataset.i][e.target.dataset.ev] = e.target.value; save(); paint(); });
  $("evList").addEventListener("click", e => { if (!e.target.matches("[data-del]")) return; dd().ev.splice(+e.target.closest(".ev-row").dataset.i, 1); save(); fillEv(); paint(); });
  const evOk = () => dd().ev.filter(x => (x.t || "").trim() || (x.u || "").trim());

  // ---------- состояние бланка: проверки по УПК и предпросмотр ----------
  function ctx() {
    const c = Object.assign({}, cs());
    c.offPos = $("fromPos").value.trim(); c.offName = $("fromName").value.trim();
    c.offRank = $("fromRank").value.trim().toLowerCase();
    return c;
  }
  const numText = (D, d, c) => D.noCase ? (d.regNo && d.regNo.trim() ? "Рег. № " + d.regNo.trim() : "") : "УД № " + (c.num || "____");
  let page = null;
  function paint() {
    const D = def(), probs = D.check ? D.check(ctx(), dd()) : [];
    $("checks").innerHTML = probs.map(p => `<li>${esc(p)}</li>`).join("");
    $("checksBox").style.display = probs.length ? "" : "none";
    if (page) page.refresh();
  }

  function validate() {
    let first = null;
    const mark = el => { el.classList.add("bad"); first = first || el; };
    OFF.forEach(id => { if (!$(id).value.trim()) mark($(id)); });
    if (!def().noCase && !String(cs().num || "").trim()) mark($("c_num"));
    if (first) { status(def().noCase ? "Заполни подсвеченные поля: дознаватель." : "Заполни подсвеченные поля: дознаватель и номер дела.", "err"); first.focus(); return false; }
    const D = def(), probs = D.check ? D.check(ctx(), dd()) : [];
    if (probs.length && !confirm("По требованиям УПК не хватает:\n• " + probs.join("\n• ") + "\n\nВсё равно продолжить?")) return false;
    return true;
  }

  // ---------- документ (общий стиль, см. docs.js) ----------
  // Текст бланков — ud-docs.js (по УПК RMRP), без изменений. Здесь только раскладка в общий вид:
  // шапка ГУ ВП, заголовок вразрядку, № дела, город и дата; у протоколов — разделы I–III; подпись как у рапортов.
  const SIGN_LABEL = D => D.proto ? "Протокол составил:" : /^П ?О ?С/.test(D.title) ? "Постановление вынес:" : /^Р ?А ?П/.test(D.title) ? "Рапорт составил:" : /^П ?О ?В/.test(D.title) ? "Повестку выписал:" : "Документ составил:";
  async function spec() {
    const VD = window.VPDOC;
    const D = def(), d = dd(), c = ctx();
    const ev = evOk();
    const blocks = [{ html: D.body(c, d), protocol: !!D.proto }];
    if (ev.length) {
      blocks.push({ formula: "Приложение:", margin: [0, 6, 0, 3] });
      blocks.push({ olist: ev.map(x => x.u ? { r: [(x.t || "Материал").trim(), { pdf: [":"], png: [] }], links: [{ url: x.u }], single: true } : [(x.t || "Материал").trim()]) });
    }
    const n = VD.parseName(c.offName);
    blocks.push({ sign: {
      label: SIGN_LABEL(D), pos: [c.offPos || { ph: "должность" }],
      right: [$("fromRank").value.trim() ? VD.cap($("fromRank").value.trim()) : { ph: "звание" }, n ? n.short : { ph: "Фамилия И.О." }, "удостоверение № " + ($("staticId").value.trim() || "____")],
      image: n ? await VD.signImage({ name: c.offName, stamp: $("stampOn").checked }) : null } });
    const ppl = (d.people || "").split("\n").map(s => s.trim()).filter(Boolean);
    if (D.applicantSign) blocks.push({ signLine: ["Заявитель", d.appName || ""] });
    if (D.proto) ppl.forEach(pp => blocks.push({ signLine: [pp.split(/[—,-]/)[0].trim(), "(подпись)"] }));
    const to = D.to ? VD.htmlLines(D.to(c, d)) : null;
    if (to && to.length) to[0] = [{ t: "Кому: ", b: true }].concat(to[0]);
    const num = numText(D, d, c);
    return {
      docTitle: D.short + (c.num && !D.noCase ? " · УД № " + c.num : ""), author: c.offName,
      motto: false, // процессуальный документ: только то, что требует УПК, без девиза ведомства
      approve: D.approve ? [[{ t: "УТВЕРЖДАЮ", b: true }], ["Прокурор ______________________"], ["«___» ____________ 20__ г."], ["подпись ____________"]] : null,
      to, title: D.title, subtitle: D.sub,
      metaLine: num ? (D.noCase ? [num] : ["УД № ", c.num ? c.num : { ph: "____" }]) : null,
      placeDate: ["г. " + (C.city || "Москва"), d.date ? VD.longDate(d.date) : { ph: "«__» ______ 20__ г." }],
      blocks
    };
  }
  function fileBase() { return "ud_" + (String(cs().num).replace(/[^\w-]/g, "") || "x").slice(0, 16) + "_" + docKey; }
  page = window.VPDOC.wire({ preview: $("preview"), spec, validate, base: () => fileBase() });
  function status(t, cls) { page.status(t, cls); }
  $("stampOn").addEventListener("change", () => page.refresh());
  $("clearDoc").addEventListener("click", () => {
    if (!confirm("Очистить поля этого бланка в текущем деле?")) return;
    delete cs().docs[docKey]; save(); fillDoc();
  });

  fillCases(); fillDoc();
  window.__ud = { spec, setDoc: k => { docKey = k; fillDoc(); }, S, save, fillCases, fillDoc, paint };
})();

// Рапорт на взыскание (автономная версия): форма → документ → PDF/PNG.
(() => {
  const D = window.VPDOC, C = window.VP_CONFIG || {};
  const $ = id => document.getElementById(id);
  const me = D.persist("vp_me", ["fromRank", "fromStatic", "fromName", "fromPos"]);
  const DRAFT = ["detSelf", "detRank", "detName", "detStatic", "tRank", "tStatic", "tName", "tUnit", "vDate", "vTime", "vPlace", "dDate", "dTime", "circ", "mitig", "aggr", "measure", "stampOn", "date"];
  const draft = D.persist("vp_raport_draft", DRAFT);
  const num = D.counter("raport", $("num"));
  $("numNext").addEventListener("click", () => { num.next(); refresh(); });
  if (!$("date").value) $("date").value = D.iso(new Date());

  // подразделения: из таблицы отработок + основные
  const units = new Set(["Батальон военной полиции", "Военная комендатура"]);
  ((window.VYG && window.VYG.units) || []).forEach(u => u.name.split(/,\s*/).forEach(x => units.add(x.trim())));
  $("units").innerHTML = [...units].map(u => `<option>${D.esc(u)}</option>`).join("");

  // ---------- 1. выявил сам ----------
  function detSync() {
    const self = $("detSelf").checked;
    $("detBox").classList.toggle("off", self);
    ["detRank", "detName", "detStatic"].forEach(id => { $(id).disabled = self; });
  }
  $("detSelf").addEventListener("change", () => { detSync(); refresh(); });
  detSync();
  $("dSame").addEventListener("click", () => { $("dDate").value = $("vDate").value; $("dTime").value = $("vTime").value; ["dDate", "dTime"].forEach(id => $(id).dispatchEvent(new Event("input", { bubbles: true }))); });

  // ---------- 5. нормы (справочник в этом браузере) ----------
  let dict = {}; try { dict = JSON.parse(localStorage.getItem("vp_norm_dict") || "{}"); } catch (e) {}
  const normKey = s => String(s || "").toLowerCase().replace(/^(п\.|пункт|ст\.|статья)\s*/, "").trim();
  function fillNormPts() { $("normPts").innerHTML = Object.keys(dict).map(k => `<option value="${D.esc(dict[k].vu)}">${D.esc(dict[k].text.slice(0, 80))}</option>`).join(""); }
  fillNormPts();
  function normRow(n) {
    const row = document.createElement("div"); row.className = "norm-card";
    row.innerHTML = `<div class="row2"><label class="plab">Пункт Внутреннего устава<input data-f="vu" list="normPts" placeholder="3.4"></label><label class="plab">Пункт Дисциплинарного устава<input data-f="du" placeholder="6.1"></label></div>
      <label class="plab">Полная расшифровка пункта ВУ<textarea data-f="text" rows="2" placeholder="текст пункта устава"></textarea></label><button type="button" class="ev-x" title="Убрать норму">×</button>`;
    ["vu", "du", "text"].forEach(f => row.querySelector(`[data-f=${f}]`).value = (n && n[f]) || "");
    $("normList").appendChild(row);
  }
  function norms() { return [...$("normList").children].map(r => ({ vu: r.querySelector("[data-f=vu]").value.trim(), du: r.querySelector("[data-f=du]").value.trim(), text: r.querySelector("[data-f=text]").value.trim() })); }
  function saveNorms() { localStorage.setItem("vp_raport_norms", JSON.stringify(norms())); }
  let saved = []; try { saved = JSON.parse(localStorage.getItem("vp_raport_norms") || "[]"); } catch (e) {}
  (saved.length ? saved : [{}]).forEach(normRow);
  $("normAdd").addEventListener("click", () => { normRow({}); saveNorms(); refresh(); });
  $("normList").addEventListener("click", e => { if (!e.target.classList.contains("ev-x")) return; e.target.closest(".norm-card").remove(); if (!$("normList").children.length) normRow({}); saveNorms(); refresh(); });
  $("normList").addEventListener("input", e => {
    const row = e.target.closest(".norm-card");
    if (e.target.dataset.f === "vu") {
      const k = dict[normKey(e.target.value)], t = row.querySelector("[data-f=text]"), du = row.querySelector("[data-f=du]");
      if (k && !t.value.trim()) t.value = k.text;
      if (k && !du.value.trim()) du.value = k.du || "";
    }
    saveNorms(); refresh();
  });
  function rememberNorms() {
    norms().forEach(n => { if (n.vu && n.text) dict[normKey(n.vu)] = n; });
    localStorage.setItem("vp_norm_dict", JSON.stringify(dict)); fillNormPts();
  }
  const pt = s => /^\d/.test(s) ? "п. " + s : s;

  // ---------- 7. доказательства ----------
  function evRow(e) {
    const row = document.createElement("div"); row.className = "ev-card";
    row.innerHTML = `<span class="ev-n"></span><input data-f="desc" list="evTypes" placeholder="что это: боди-камера, скриншот…"><input data-f="url" class="link" placeholder="ссылка https://…"><button type="button" class="ev-x" title="Убрать">×</button>`;
    row.querySelector("[data-f=desc]").value = (e && e.desc) || "";
    row.querySelector("[data-f=url]").value = (e && e.url) || "";
    $("evList").appendChild(row); renum();
  }
  function renum() { [...$("evList").children].forEach((r, i) => r.querySelector(".ev-n").textContent = (i + 1) + "."); }
  function evs() { return [...$("evList").children].map(r => ({ desc: r.querySelector("[data-f=desc]").value.trim(), url: r.querySelector("[data-f=url]").value.trim(), row: r })).filter(e => e.desc || e.url); }
  function saveEv() { localStorage.setItem("vp_raport_ev", JSON.stringify(evs().map(e => ({ desc: e.desc, url: e.url })))); }
  let savedEv = []; try { savedEv = JSON.parse(localStorage.getItem("vp_raport_ev") || "[]"); } catch (e) {}
  (savedEv.length ? savedEv : [{ desc: "Видеозапись с нагрудной камеры (боди-камера)" }]).forEach(evRow);
  $("evAdd").addEventListener("click", () => { evRow({}); const r = $("evList").lastChild; r.querySelector("input").focus(); });
  $("evList").addEventListener("click", e => { if (!e.target.classList.contains("ev-x")) return; e.target.closest(".ev-card").remove(); if (!$("evList").children.length) evRow({}); renum(); saveEv(); refresh(); });
  $("evList").addEventListener("input", () => { saveEv(); refresh(); });

  // ---------- документ ----------
  const v = id => $(id).value.trim();
  const ph = (x, p) => x ? x : { ph: p };
  const cap = D.cap;
  function person(rank, name, stat, unit, opt) {
    const n = D.parseName(name);
    const out = [];
    out.push(rank ? cap(rank) : { ph: "звание" }, " ", n ? (opt && opt.short ? n.short : n.fi) : { ph: "Фамилия Имя" });
    if (!opt || !opt.noStatic) out.push(", статик ", ph(stat, "____"));
    if (unit !== undefined) out.push(", ", ph(unit, "подразделение"));
    if (opt && opt.pos !== undefined) out.push(", ", ph(D.lcFirst(opt.pos), "должность"));
    return out;
  }
  const human = x => D.human(x);
  async function spec() {
    const self = $("detSelf").checked;
    const att = { n: 0 };
    const nn = norms().filter(n => n.vu || n.du || n.text);
    const normRuns = n => [n.vu ? pt(n.vu) : { ph: "п. __" }, " Внутреннего устава", n.text ? ` — «${n.text.replace(/^[«"]+|[.\s»"]+$/g, "")}»` : "", "; ", n.du ? pt(n.du) : { ph: "п. __" }, " Дисциплинарного устава."];
    const ev = evs();
    const evList = ev.map(e => {
      att.n++;
      return [cap(e.desc || "Материал")].concat(e.url ? [{ pdf: [": ", { url: e.url }], png: ` — Приложение №${att.n}` }] : []).concat(["."]);
    });
    const blocks = [
      { p: "Докладываю Вам, что в ходе исполнения служебных обязанностей было выявлено нарушение воинской дисциплины со стороны военнослужащего В/Ч №12132." },
      { section: "I. СВЕДЕНИЯ О ПРАВОНАРУШЕНИИ" },
      { item: 1, label: "Сотрудник, выявивший нарушение", value: self ? person(v("fromRank"), v("fromName"), v("fromStatic")) : person(v("detRank"), v("detName"), v("detStatic")) },
      { item: 2, label: "Военнослужащий, допустивший нарушение", value: person(v("tRank"), v("tName"), v("tStatic"), v("tUnit")) },
      { item: 3, label: "Дата, время и место правонарушения", value: [ph(human(v("vDate")), "ДД.ММ.ГГГГ"), " | ", ph(v("vTime"), "ЧЧ:ММ"), " | ", ph(v("vPlace"), "место")] },
      { item: 4, label: "Дата и время обнаружения", value: [ph(human(v("dDate")), "ДД.ММ.ГГГГ"), " | ", ph(v("dTime"), "ЧЧ:ММ")] },
      nn.length > 1 ? { item: 5, label: "Нарушенная норма и её содержание", list: nn.map(normRuns) }
        : { item: 5, label: "Нарушенная норма и её содержание", value: normRuns(nn[0] || {}) },
      { item: 6, label: "Обстоятельства правонарушения", value: [ph(v("circ"), "изложить обстоятельства")] },
      { section: "II. МАТЕРИАЛЫ И ОБСТОЯТЕЛЬСТВА" },
      evList.length ? { item: 7, label: "Доказательства", list: evList } : { item: 7, label: "Доказательства", value: "не приложены." },
      { item: 8, label: "Смягчающие обстоятельства", value: v("mitig") || "не выявлены." },
      { item: 9, label: "Отягчающие обстоятельства", value: v("aggr") || "не выявлены." },
      { item: 10, label: "Предлагаемая мера взыскания", value: [ph(v("measure"), "мера взыскания")] },
      { section: "III. ХОДАТАЙСТВО" },
      { p: "На основании изложенного и руководствуясь положениями Внутреннего и Дисциплинарного уставов В/Ч №12132," },
      { formula: "ПРОШУ:", margin: [0, 2, 0, 4] },
      { p: "Рассмотреть представленные материалы, дать оценку обстоятельствам совершённого правонарушения и, при наличии достаточных оснований, одобрить применение предложенного дисциплинарного взыскания в отношении указанного военнослужащего." },
      { sign: await signBlock() }
    ];
    return {
      docTitle: `Рапорт № ${v("num")} о выдаче дисциплинарного взыскания`,
      author: v("fromName"),
      to: [[{ t: "Кому: ", b: true }, C.to || "Военному коменданту гарнизона, начальнику ГУ ВП"],
           [{ t: "От: ", b: true }].concat(person(v("fromRank"), v("fromName"), "", undefined, { short: true, noStatic: true, pos: v("fromPos") }))],
      title: "РАПОРТ", subtitle: "О выдаче дисциплинарного взыскания",
      metaLine: ["№ ", ph(v("num"), "___")],
      blocks
    };
  }
  async function signBlock() {
    const n = D.parseName(v("fromName"));
    return {
      date: ph(human(v("date")), "ДД.ММ.ГГГГ"), dateLabel: "Дата",
      label: "Рапорт составил:", pos: v("fromPos"),
      rank: v("fromRank") ? cap(v("fromRank")) : { ph: "звание" }, name: n ? n.short : { ph: "Фамилия И.О." },
      image: n ? await D.signImage({ name: v("fromName"), stamp: $("stampOn").checked }) : null
    };
  }
  function validate() {
    const req = ["num", "date", "fromRank", "fromName", "fromPos", "tRank", "tStatic", "tName", "tUnit", "vDate", "vTime", "vPlace", "dDate", "dTime", "circ", "measure"];
    if (!$("detSelf").checked) req.push("detRank", "detName");
    let ok = D.check(req);
    const nr = [...$("normList").children][0];
    if (ok && nr && !D.check([nr.querySelector("[data-f=vu]"), nr.querySelector("[data-f=text]")])) ok = false;
    for (const e of evs()) {
      const u = e.row.querySelector("[data-f=url]");
      if (e.url && !D.isLink(e.url)) { u.classList.add("bad"); u.focus(); page.status("Это не похоже на ссылку — вставь адрес целиком.", "err"); return false; }
      if (!e.desc) { const d = e.row.querySelector("[data-f=desc]"); d.classList.add("bad"); if (ok) d.focus(); ok = false; }
    }
    return ok;
  }
  const page = D.wire({
    preview: $("preview"), spec, validate, counter: num,
    base: () => "raport_vzysk_" + (v("num") || "x"),
    onExport: () => rememberNorms()
  });
  function refresh() { page.refresh(); }
  $("form").addEventListener("input", refresh);
  $("form").addEventListener("change", refresh);
  $("clear").addEventListener("click", () => {
    if (!confirm("Очистить данные о нарушении? Твои данные и счётчик номеров останутся.")) return;
    draft.clear(DRAFT.filter(x => !["stampOn", "date"].includes(x)));
    ["detRank", "detName", "detStatic", "tRank", "tStatic", "tName", "tUnit", "vDate", "vTime", "vPlace", "dDate", "dTime", "circ", "mitig", "aggr", "measure"].forEach(id => { $(id).value = ""; $(id).classList.remove("bad"); });
    $("normList").innerHTML = ""; normRow({}); saveNorms();
    $("evList").innerHTML = ""; evRow({ desc: "Видеозапись с нагрудной камеры (боди-камера)" }); saveEv();
    num.next(); page.status(""); refresh();
  });
  window.__vp = { spec, validate, num, evRow, normRow };
})();

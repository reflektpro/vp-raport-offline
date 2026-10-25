// Еженедельный отчёт (автономная версия): критерии → документ → PDF/PNG.
(() => {
  const D = window.VPDOC, C = window.VP_CONFIG || {}, P = window.PROMO;
  const $ = id => document.getElementById(id);
  const v = id => $(id).value.trim();
  const ph = (x, p) => x ? x : { ph: p };
  D.persist("vp_me", ["fromRank", "fromStatic", "fromName", "fromPos", "fromUnit"]);
  const DRAFT = ["date", "fromDate", "toDate", "result", "extra", "stampOn", "showPts"];
  const draft = D.persist("vp_week_draft", DRAFT);
  const num = D.counter("week", $("num"));
  $("numNext").addEventListener("click", () => { num.next(); page.refresh(); });
  const now = new Date();
  if (!$("date").value) $("date").value = D.iso(now);
  if (!$("toDate").value) $("toDate").value = D.iso(now);
  if (!$("fromDate").value) { const w = new Date(now); w.setDate(now.getDate() - 6); $("fromDate").value = D.iso(w); }

  const crit = window.VP_CRIT({ box: $("acts"), acts: P.acts, storeKey: "vp_week_crit", weekly: true, onChange: () => { paint(); page.refresh(); } });
  function paint() {
    const pts = crit.total();
    $("barText").textContent = pts ? `${pts} ${window.VP_BALLOV(pts)} за неделю (только основная отчётность)` : "0 баллов (считается только основная отчётность)";
    $("barFill").style.width = pts ? "100%" : "0"; $("barFill").classList.toggle("full", pts > 0);
    $("vygNote").classList.toggle("ok", !(crit.n("vzysk") > 0 && crit.n("vygovor") > 0));
    $("result").placeholder = autoResult();
  }
  function autoResult() {
    return `выполнено мероприятий и служебных действий: ${crit.count()}.`;
  }
  // Общий результат по умолчанию — одна строка; баллы — отдельной строкой перед датой.
  const summaryLine = () => ["выполнено мероприятий и служебных действий: ", { t: String(crit.count()), b: true }, "."];
  const pointsLine = () => [{ t: "Общее количество баллов: ", b: true }, { t: String(crit.total()), b: true }];

  async function spec() {
    const n = D.parseName(v("fromName"));
    const att = { n: 0 };
    const showPts = $("showPts").checked;
    const main = crit.docList("main", att, showPts), extra = crit.docList("extra", att, showPts), gu = crit.docList("gu", att, showPts);
    const listItem = (no, label, list, none) => list.length ? { item: no, label, list } : { item: no, label, value: none };
    const rank = v("fromRank") ? D.cap(v("fromRank")) : { ph: "звание" };
    return {
      docTitle: `Еженедельный отчёт № ${v("num")}`, author: v("fromName"),
      to: [[{ t: "Кому: ", b: true }, C.to || "Военному коменданту гарнизона, начальнику ГУ ВП"],
           [{ t: "От: ", b: true }, rank, " ", n ? n.short : { ph: "Фамилия И.О." }, ", ", ph(D.lcFirst(v("fromPos")), "должность")]],
      title: "РАПОРТ", subtitle: "О результатах служебной деятельности за отчётную неделю",
      metaLine: ["№ ", ph(v("num"), "___")],
      blocks: [
        { p: "Докладываю Вам о результатах выполнения служебных обязанностей и проведённых мероприятиях за установленный отчётный период." },
        { section: "I. ОБЩИЕ СВЕДЕНИЯ" },
        { item: 1, label: "Военнослужащий", value: [rank, " ", n ? n.fi : { ph: "Фамилия Имя" }, ", номер удостоверения ", ph(v("fromStatic"), "____")] },
        { item: 2, label: "Подразделение и должность", value: [ph(v("fromUnit"), "подразделение"), ", ", ph(D.lcFirst(v("fromPos")), "должность")] },
        { item: 3, label: "Отчётный период", value: [ph(D.human(v("fromDate")), "ДД.ММ.ГГГГ"), " — ", ph(D.human(v("toDate")), "ДД.ММ.ГГГГ")] },
        { section: "II. РЕЗУЛЬТАТЫ СЛУЖЕБНОЙ ДЕЯТЕЛЬНОСТИ" },
        listItem(4, "Основная отчётность", main, "не выполнялась."),
        listItem(5, "Дополнительная отчётность", extra, "не выполнялась."),
        listItem(6, "Работа ГУ ВП", gu, "не выполнялась."),
        { section: "III. ИТОГОВАЯ ИНФОРМАЦИЯ" },
        v("result") ? { item: 7, label: "Общий результат работы за неделю", value: v("result") } : { item: 7, label: "Общий результат работы за неделю", list: [summaryLine()], bullet: "dash" },
        { item: 8, label: "Дополнительные сведения", value: v("extra") || "отсутствуют." },
        { space: 4 },
        { p: ["На основании изложенного ", { t: "ПРОШУ", b: true }, " принять настоящий еженедельный отчёт, рассмотреть представленные результаты служебной деятельности и учесть их при оценке моей работы, выдать еженедельную премию."] },
        { sign: {
          before: [pointsLine()], date: ph(D.human(v("date")), "ДД.ММ.ГГГГ"), dateLabel: "Дата подачи", label: "Рапорт составил:", pos: v("fromPos"),
          rank, name: n ? n.short : { ph: "Фамилия И.О." },
          image: n ? await D.signImage({ name: v("fromName"), stamp: $("stampOn").checked }) : null } }
      ]
    };
  }
  function validate() {
    if (!D.check(["num", "date", "fromRank", "fromStatic", "fromName", "fromUnit", "fromPos", "fromDate", "toDate"])) return false;
    if (!crit.items().length) { page.status("Отметь, что сделано за неделю.", "err"); return false; }
    if (crit.n("vzysk") > 0 && crit.n("vygovor") > 0 && !confirm("И рапорты на взыскание, и выговоры заполнены. Выговор, выданный этим же рапортом, второй раз считать нельзя. Всё равно выгрузить?")) return false;
    return true;
  }
  const page = D.wire({ preview: $("preview"), spec, validate, counter: num, base: () => "otchet_" + (v("num") || "x") });
  $("form").addEventListener("input", () => page.refresh());
  $("form").addEventListener("change", () => page.refresh());
  $("clear").addEventListener("click", () => {
    if (!confirm("Обнулить всё, что отмечено за эту неделю?")) return;
    crit.reset(); draft.clear(["result", "extra"]); $("result").value = ""; $("extra").value = "";
    num.next(); paint(); page.refresh();
  });
  paint();
  window.__vp = { spec, crit, validate };
})();

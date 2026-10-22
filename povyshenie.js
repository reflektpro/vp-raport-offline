// Рапорт на повышение (автономная версия): калькулятор по promo-rules.js → документ → PDF/PNG.
(() => {
  const D = window.VPDOC, C = window.VP_CONFIG || {}, P = window.PROMO;
  const $ = id => document.getElementById(id);
  const v = id => $(id).value.trim();
  const ph = (x, p) => x ? x : { ph: p };
  const esc = D.esc;
  const RANK_GEN = {"рядовой":"рядового","ефрейтор":"ефрейтора","младший сержант":"младшего сержанта","сержант":"сержанта","старший сержант":"старшего сержанта","старшина":"старшины","прапорщик":"прапорщика","старший прапорщик":"старшего прапорщика","младший лейтенант":"младшего лейтенанта","лейтенант":"лейтенанта","старший лейтенант":"старшего лейтенанта","капитан":"капитана","майор":"майора","подполковник":"подполковника","полковник":"полковника","генерал-майор":"генерал-майора"};
  D.persist("vp_me", ["fromRank", "fromStatic", "fromName", "fromPos", "fromUnit"]);
  const DRAFT = ["date", "fromDate", "toDate", "target", "result", "extra", "stampOn", "showPts"];
  const draft = D.persist("vp_promo_draft", DRAFT);
  const num = D.counter("promo", $("num"));
  $("numNext").addEventListener("click", () => { num.next(); page.refresh(); });
  const now = new Date();
  if (!$("date").value) $("date").value = D.iso(now);
  if (!$("toDate").value) $("toDate").value = D.iso(now);

  const acts = P.acts.filter(a => !a.week);
  const crit = window.VP_CRIT({ box: $("acts"), acts, storeKey: "vp_promo_crit", onChange: () => { recalc(); page.refresh(); } });
  const findRank = r => Object.keys(P.ladder).find(k => k.toLowerCase() === String(r || "").trim().toLowerCase());

  function compute() {
    const rank = findRank(v("fromRank")), step = rank ? P.ladder[rank] : null;
    const total = crit.total();
    const res = { rank, step, total, items: [], met: false, covered: 0 };
    if (step) {
      Object.entries(step.need).forEach(([k, need]) => {
        const a = P.acts.find(x => x.key === k), have = crit.n(k);
        res.items.push({ a, need, have, lack: Math.max(0, need - have) });
      });
      const lack = res.items.reduce((s, i) => s + i.lack, 0);
      const canCover = Math.floor(Math.max(0, total - step.points) / P.pointsPerItem);
      res.covered = Math.min(lack, canCover);
      res.met = total >= step.points && lack <= canCover;
      res.left = { pts: Math.max(0, step.points - total), swap: Math.max(0, lack - canCover) };
    }
    return res;
  }
  function autoResult(r) {
    if (!r.step) return `набрано баллов: ${r.total}.`;
    let s = `набрано баллов: ${r.total} при необходимых ${r.step.points}; `;
    if (r.met) s += r.covered ? `критерии повышения выполнены, недостающие пункты (${r.covered}) закрыты баллами из расчёта ${P.pointsPerItem} баллов за пункт.` : "критерии повышения выполнены в полном объёме.";
    else {
      const miss = r.items.filter(i => i.lack).map(i => `${i.a.doc.toLowerCase()} — ${i.have} из ${i.need}`);
      s += "критерии повышения выполнены не полностью" + (miss.length ? ` (${miss.join("; ")})` : "") + ".";
    }
    return s;
  }
  function recalc() {
    const r = compute();
    const tg = $("target");
    if (r.step && (!tg.value.trim() || tg.dataset.auto === "1")) { tg.value = r.step.to; tg.dataset.auto = "1"; }
    if (r.step) {
      $("route").innerHTML = `${esc(r.rank)} <span>→</span> ${esc(r.step.to)}`;
      const pct = Math.min(100, Math.round(r.total / r.step.points * 100));
      $("barFill").style.width = pct + "%"; $("barFill").classList.toggle("full", r.total >= r.step.points);
      $("barText").textContent = `${r.total} / ${r.step.points} баллов`;
      $("crit").innerHTML = r.items.map(i => `<li class="${i.lack ? "no" : "ok"}">${i.lack ? "✗" : "✓"} ${esc(i.a.name.replace(/\s*\(.*\)$/, ""))} <b>${Math.min(i.have, i.need)}/${i.need}</b></li>`).join("")
        + `<li class="${r.total >= r.step.points ? "ok" : "no"}">${r.total >= r.step.points ? "✓" : "✗"} Набрать ${r.step.points} баллов <b>${r.total}</b></li>`;
      let note;
      if (r.met) note = r.covered ? `Готово к подаче. Недостающие пункты (${r.covered}) закрыты лишними баллами: ${P.pointsPerItem} баллов за пункт.` : "Все критерии выполнены, можно подавать.";
      else {
        const parts = [];
        if (r.left.pts) parts.push(`${r.left.pts} баллов`);
        if (r.left.swap) parts.push(`${r.left.swap} пункт(ов) критерия, каждый можно заменить ${P.pointsPerItem} баллами сверх нормы`);
        note = "Не хватает: " + parts.join("; ") + ".";
      }
      $("critNote").textContent = note; $("critNote").className = "crit-note " + (r.met ? "ok" : "no");
    } else {
      $("route").textContent = v("fromRank") ? `Для звания «${v("fromRank")}» система повышений не описана. Баллы считаются, критерии не проверяются.` : "Укажи текущее звание.";
      $("barFill").style.width = "0"; $("barText").textContent = `${r.total} баллов`;
      $("crit").innerHTML = ""; $("critNote").textContent = ""; $("critNote").className = "crit-note";
    }
    $("result").placeholder = autoResult(r);
    return r;
  }
  $("target").addEventListener("input", () => { $("target").dataset.auto = $("target").value.trim() ? "0" : "1"; });
  ["fromRank"].forEach(id => $(id).addEventListener("input", recalc));

  async function spec() {
    const r = compute();
    const n = D.parseName(v("fromName"));
    const att = { n: 0 };
    const showPts = $("showPts").checked;
    const main = crit.docList("main", att, showPts), extra = crit.docList("extra", att, showPts);
    const listItem = (no, label, list, none) => list.length ? { item: no, label, list } : { item: no, label, value: none };
    const rank = v("fromRank") ? D.cap(v("fromRank")) : { ph: "звание" };
    const target = v("target");
    const period = v("fromDate") ? ["с ", D.human(v("fromDate")), " по ", ph(D.human(v("toDate")), "ДД.ММ.ГГГГ")] : ["по ", ph(D.human(v("toDate")), "ДД.ММ.ГГГГ")];
    return {
      docTitle: `Рапорт № ${v("num")} о присвоении очередного воинского звания`, author: v("fromName"),
      to: [[{ t: "Кому: ", b: true }, C.to || "Военному коменданту гарнизона, начальнику ГУ ВП"],
           [{ t: "От: ", b: true }, rank, " ", n ? n.short : { ph: "Фамилия И.О." }, ", ", ph(D.lcFirst(v("fromPos")), "должность")]],
      title: "РАПОРТ", subtitle: "О присвоении очередного воинского звания",
      metaLine: ["№ ", ph(v("num"), "___")],
      blocks: [
        { p: "Докладываю Вам о результатах служебной деятельности за период службы в текущем воинском звании и прошу рассмотреть вопрос о присвоении мне очередного воинского звания." },
        { section: "I. ОБЩИЕ СВЕДЕНИЯ" },
        { item: 1, label: "Военнослужащий", value: [rank, " ", n ? n.fi : { ph: "Фамилия Имя" }, ", игровой статик ", ph(v("fromStatic"), "____")] },
        { item: 2, label: "Подразделение и должность", value: [ph(v("fromUnit"), "подразделение"), ", ", ph(D.lcFirst(v("fromPos")), "должность")] },
        { item: 3, label: "Воинское звание и период службы в текущем звании", list: [
          ["текущее звание — ", v("fromRank") ? v("fromRank").toLowerCase() : { ph: "звание" }, ", в звании "].concat(period).concat(["."]),
          ["испрашиваемое звание — ", target ? target.toLowerCase() : { ph: "звание" }, "."]
        ], bullet: "dash" },
        { section: "II. РЕЗУЛЬТАТЫ СЛУЖЕБНОЙ ДЕЯТЕЛЬНОСТИ" },
        listItem(4, "Основные критерии", main, "не выполнялись."),
        listItem(5, "Дополнительные критерии", extra, "не выполнялись."),
        { section: "III. ИТОГОВАЯ ИНФОРМАЦИЯ" },
        { item: 6, label: "Выполнение критериев повышения", value: v("result") || autoResult(r) },
        { item: 7, label: "Дополнительные сведения", value: v("extra") || "отсутствуют." },
        { space: 4 },
        { p: ["На основании изложенного ", { t: "ПРОШУ", b: true }, " рассмотреть настоящий рапорт, дать оценку результатам моей служебной деятельности и присвоить мне очередное воинское звание ", target ? `«${target.toLowerCase()}»` : { ph: "«звание»" }, "."] },
        { sign: {
          date: ph(D.human(v("date")), "ДД.ММ.ГГГГ"), dateLabel: "Дата подачи", label: "Рапорт составил:", pos: v("fromPos"),
          rank, name: n ? n.short : { ph: "Фамилия И.О." },
          image: n ? await D.signImage({ name: v("fromName"), stamp: $("stampOn").checked }) : null } }
      ]
    };
  }
  function validate() {
    if (!D.check(["num", "date", "fromRank", "fromStatic", "fromName", "fromUnit", "fromPos", "target", "toDate"])) return false;
    const r = compute();
    if (r.step && !r.met && !confirm("Критерии повышения пока не выполнены. Всё равно выгрузить рапорт?")) return false;
    return true;
  }
  const page = D.wire({ preview: $("preview"), spec, validate, counter: num, base: () => "povyshenie_" + (v("num") || "x") });
  $("form").addEventListener("input", () => page.refresh());
  $("form").addEventListener("change", () => page.refresh());
  $("clear").addEventListener("click", () => {
    if (!confirm("Обнулить все отмеченные достижения и ссылки?")) return;
    crit.reset(); draft.clear(["result", "extra", "target", "fromDate"]); ["result", "extra", "target", "fromDate"].forEach(id => $(id).value = "");
    num.next(); recalc(); page.refresh();
  });
  recalc();
  window.__vp = { spec, crit, compute, validate };
})();

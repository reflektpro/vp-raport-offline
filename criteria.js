// Панель критериев (основные / дополнительные) для еженедельного отчёта и рапорта на повышение.
// Список берётся из window.PROMO.acts (promo-rules.js); группа — поле group. Можно добавлять свои пункты.
(() => {
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const GROUPS = { main: "Основные критерии", extra: "Дополнительные критерии" };
  const linksOf = s => String(s || "").split(/\s+/).map(x => x.trim()).filter(x => window.VPDOC.isLink(x));

  window.VP_CRIT = function (opt) {
    const acts = opt.acts;
    let state = {};
    try { state = JSON.parse(localStorage.getItem(opt.storeKey) || "{}"); } catch (e) {}
    state.n = state.n || {}; state.links = state.links || {}; state.custom = state.custom || [];
    const save = () => localStorage.setItem(opt.storeKey, JSON.stringify(state));
    const box = opt.box;
    const changed = () => { save(); paintCounts(); opt.onChange && opt.onChange(); };

    function card(key, name, pts, custom) {
      const n = custom ? custom.n : (state.n[key] || 0), links = custom ? custom.links : (state.links[key] || "");
      return `<div class="act${n > 0 ? " done" : ""}" data-key="${esc(key)}"${custom ? ' data-custom="1"' : ""}>
        <div class="act-top">
          ${custom ? `<input class="cust-name" data-cname placeholder="свой пункт: что сделано" value="${esc(custom.name)}">` : `<div class="act-name">${esc(name)}${pts ? `<span class="pts">+${pts}</span>` : ""}</div>`}
          <div class="ctr"><button type="button" data-d="-1">−</button><input type="number" min="0" value="${n}" data-n><button type="button" data-d="1">+</button></div>
          ${custom ? `<button type="button" class="ev-x" data-cdel title="Убрать">×</button>` : ""}
        </div>
        ${custom ? `<div class="cust-grp"><label><input type="radio" name="g_${esc(key)}" value="main"${custom.group === "main" ? " checked" : ""} data-cgrp> основной</label><label><input type="radio" name="g_${esc(key)}" value="extra"${custom.group !== "main" ? " checked" : ""} data-cgrp> дополнительный</label></div>` : ""}
        <details${links ? " open" : ""}><summary>ссылки (<span data-lc>${linksOf(links).length}</span>)</summary><textarea data-links rows="2" placeholder="по одной ссылке на строку">${esc(links)}</textarea></details>
      </div>`;
    }
    function draw() {
      let html = "";
      ["main", "extra"].forEach(g => {
        html += `<h3>${GROUPS[g]}</h3>`;
        acts.filter(a => (a.group || "extra") === g).forEach(a => { html += card(a.key, a.name, a.pts, null); });
        state.custom.filter(c => (c.group === "main" ? "main" : "extra") === g).forEach(c => { html += card(c.id, "", 0, c); });
      });
      html += `<button type="button" class="btn ghost" data-cadd>+ свой пункт</button>`;
      box.innerHTML = html;
    }
    function find(row) { return row.dataset.custom ? state.custom.find(c => c.id === row.dataset.key) : null; }
    function setN(row, n) {
      n = Math.max(0, n | 0); const c = find(row);
      if (c) c.n = n; else state.n[row.dataset.key] = n;
      row.querySelector("[data-n]").value = n;
    }
    function getN(row) { const c = find(row); return c ? c.n : (state.n[row.dataset.key] || 0); }
    box.addEventListener("click", e => {
      const row = e.target.closest(".act");
      if (e.target.matches("[data-cadd]")) { state.custom.push({ id: "c" + Date.now().toString(36), name: "", group: "extra", n: 1, links: "" }); draw(); changed(); const ins = box.querySelectorAll("[data-cname]"); ins[ins.length - 1] && ins[ins.length - 1].focus(); return; }
      if (!row) return;
      if (e.target.matches("[data-d]")) { setN(row, getN(row) + Number(e.target.dataset.d)); changed(); }
      if (e.target.matches("[data-cdel]")) { state.custom = state.custom.filter(c => c.id !== row.dataset.key); draw(); changed(); }
    });
    box.addEventListener("change", e => {
      const row = e.target.closest(".act"); if (!row) return;
      if (e.target.matches("[data-cgrp]")) { const c = find(row); c.group = e.target.value; draw(); changed(); }
    });
    box.addEventListener("input", e => {
      const row = e.target.closest(".act"); if (!row) return;
      const c = find(row);
      if (e.target.matches("[data-n]")) { const n = Math.max(0, parseInt(e.target.value) || 0); if (c) c.n = n; else state.n[row.dataset.key] = n; }
      if (e.target.matches("[data-cname]")) c.name = e.target.value;
      if (e.target.matches("[data-links]")) {
        if (c) c.links = e.target.value; else state.links[row.dataset.key] = e.target.value;
        const got = linksOf(e.target.value).length;
        if (got > getN(row)) setN(row, got);
      }
      changed();
    });
    function paintCounts() {
      box.querySelectorAll(".act").forEach(row => {
        const c = find(row), links = c ? c.links : state.links[row.dataset.key];
        row.querySelector("[data-lc]").textContent = linksOf(links).length;
        row.classList.toggle("done", getN(row) > 0);
      });
    }
    function n(key) { return state.n[key] || 0; }
    // Пункты для документа: {group, text, n, pts, links}
    function items() {
      const out = [];
      acts.forEach(a => { const k = n(a.key); if (k > 0) out.push({ key: a.key, group: a.group || "extra", text: a.doc || a.name, n: k, pts: a.pts || 0, links: linksOf(state.links[a.key]) }); });
      state.custom.forEach(c => { if (c.n > 0 && String(c.name || "").trim()) out.push({ key: c.id, group: c.group === "main" ? "main" : "extra", text: c.name.trim(), n: c.n, pts: 0, links: linksOf(c.links), custom: true }); });
      return out;
    }
    function total() { return acts.reduce((s, a) => s + n(a.key) * (a.pts || 0), 0); }
    function reset() { state = { n: {}, links: {}, custom: [] }; save(); draw(); opt.onChange && opt.onChange(); }
    // Строки пункта документа. att — общий счётчик приложений {n}.
    // «Вид работы — штук: N (… баллов)», под ним каждая ссылка с новой строки: «а) адрес» (в PNG — «а) Приложение №N»).
    function docList(group, att, showPts) {
      return items().filter(i => i.group === group).map(i => {
        const r = [`${i.text} — штук: `, { t: String(i.n), b: true }];
        if (showPts && i.pts) r.push(` (${i.n * i.pts} баллов)`);
        const links = i.links.map(u => ({ url: u, alt: `Приложение №${++att.n}` }));
        return links.length ? { r, links } : r;
      });
    }
    // всего выполнено мероприятий и служебных действий (сумма «штук» по всем отмеченным пунктам)
    function count() { return items().reduce((s, i) => s + i.n, 0); }
    draw();
    return { items, total, count, n, reset, docList, redraw: draw, state: () => state };
  };
})();

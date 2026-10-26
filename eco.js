// Единая экосистема ГУ ВП: шторка (боковое меню) с разделами учебного сайта и бланками + вход через Discord
// (общий с учебным сайтом vp-exam: тот же API и та же сессия — оба сайта на reflektpro.github.io).
// Бланки, PDF и PNG работают без входа; вход нужен только для отправки отчёта.
// После входа Имя Фамилия, звание, статик (и должность) подставляются из профиля на сайте ГУ ВП.
(() => {
  const E = window.VP_ECO_CONFIG || {};
  const TOKEN_KEY = "vpexam_token"; // тот же ключ, что и на учебном сайте → один вход на оба сайта
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const online = /^https?:$/.test(location.protocol);
  const token = () => { try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } };
  async function api(method, path, body) {
    const h = {}; const t = token(); if (t) h.Authorization = "Bearer " + t;
    if (body !== undefined) h["Content-Type"] = "application/json";
    let res;
    try { res = await fetch(E.API_BASE + path, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined }); }
    catch (e) { const er = new Error("Нет связи с сервером ГУ ВП. Проверьте интернет."); er.network = true; throw er; }
    let data = null; try { data = await res.json(); } catch (e) {}
    if (res.status === 401) { try { localStorage.removeItem(TOKEN_KEY); } catch (e) {} ECO.me = null; paint(); }
    if (!res.ok) { const e = new Error((data && data.error) || ("Ошибка " + res.status)); e.status = res.status; throw e; }
    return data;
  }
  function login() {
    if (!online) { alert("Вход и отправка работают только на сайте (https://reflektpro.github.io/vp-raport-offline/), не из файла на диске."); return; }
    const ret = location.origin + location.pathname;
    location.href = E.API_BASE + "/auth/login?return=" + encodeURIComponent(ret);
  }
  async function logout() { try { await api("POST", "/api/logout"); } catch (e) {} try { localStorage.removeItem(TOKEN_KEY); } catch (e) {} ECO.me = null; paint(); ECO.onChange.forEach(f => f()); }
  const ECO = { me: null, api, login, logout, online, onChange: [], authError: null };

  // Разделы учебного сайта: [путь, название, значок, нужная возможность]
  const SITE = [["/", "Главная", "🏠", ""], ["/study", "Учебный отдел", "🎓", "vp"], ["/reatt", "Переаттестация", "🔁", "reatt"], ["/reports", "Мои отчёты", "📝", "vp"],
    ["/premiums", "Премирование", "💰", "vp"], ["/promo", "Система повышения", "⭐", "vp"], ["/docs", "База данных", "📚", ""], ["/people", "Личные дела", "🗂", ""],
    ["/lead", "Руководство: отчёты", "📊", "lead"], ["/admin", "Админка", "⚙", "examiner"]];
  const FORMS = [["index.html", "Рапорт на взыскание"], ["povyshenie.html", "Рапорт на повышение"], ["otchet.html", "Еженедельный отчёт"], ["vygovor.html", "Приказ"], ["ugolovnoe.html", "Уголовные дела"], ["gajd.html", "Гайд УД"]];
  const caps = (me) => {
    if (!me) return {};
    if (me.caps) return me.caps;
    const adm = me.role === "admin" || me.super;
    return { vp: !!(me.vp || adm), reatt: !!(me.reatt || adm), examiner: me.role === "examiner" || adm, admin: adm, lead: !!(me.leader || adm) };
  };
  const nameOf = (me) => me.ic_name || me.global_name || me.username;
  function drawerHtml() {
    const me = ECO.me, c = caps(me), exam = E.EXAM_URL || "#";
    const here = location.pathname.split("/").pop() || "index.html";
    const site = me ? SITE.filter(s => !s[3] || c[s[3]]) : [["/", "Вход на сайт ГУ ВП", "🎓", ""]];
    return `<div class="eco-dh"><img src="emblem.png" alt=""><div><b>ГУ ВП</b><div class="eco-sm">${me ? esc(nameOf(me)) + (me.rank ? " · " + esc(me.rank) : "") : "вы не вошли"}</div></div>
        <button type="button" class="eco-x" aria-label="Закрыть меню">✕</button></div>
      <div class="eco-sec">Бланки</div>
      <nav class="eco-nav">${FORMS.map(f => `<a href="${f[0]}" class="${f[0] === here ? "on" : ""}"><i>📄</i><span>${esc(f[1])}</span></a>`).join("")}</nav>
      <div class="eco-sec">Сайт ГУ ВП</div>
      <nav class="eco-nav">${site.map(s => `<a href="${esc(exam)}#${s[0]}"><i>${s[2]}</i><span>${esc(s[1])}</span></a>`).join("")}</nav>
      <div class="eco-df">${me ? `<button type="button" class="eco-out">Выйти</button>` : `<button type="button" class="eco-in">Войти через Discord</button>`}</div>`;
  }
  function open(on) {
    document.body.classList.toggle("eco-open", on);
    const b = document.getElementById("ecoBurger"); if (b) b.setAttribute("aria-expanded", on ? "true" : "false");
  }
  function paint() {
    if (!document.body) return;
    document.body.classList.add("eco-drawer");
    const top = document.querySelector("header.topbar");
    let b = document.getElementById("ecoBurger");
    if (!b) {
      b = document.createElement("button"); b.type = "button"; b.id = "ecoBurger"; b.className = "eco-burger"; b.setAttribute("aria-label", "Меню"); b.setAttribute("aria-controls", "ecoDrawer");
      b.innerHTML = "<span></span><span></span><span></span>"; b.onclick = () => open(!document.body.classList.contains("eco-open"));
      if (top) top.insertBefore(b, top.firstChild); else document.body.insertBefore(b, document.body.firstChild);
      const ov = document.createElement("div"); ov.className = "eco-ov"; ov.onclick = () => open(false); document.body.appendChild(ov);
      document.addEventListener("keydown", e => { if (e.key === "Escape") open(false); });
    }
    let u = document.getElementById("ecoBar");
    if (!u) { u = document.createElement("div"); u.id = "ecoBar"; u.className = "eco-user"; if (top) top.appendChild(u); else document.body.insertBefore(u, document.body.firstChild); }
    const me = ECO.me;
    u.innerHTML = me ? `${me.avatar_url ? `<img src="${esc(me.avatar_url)}" alt="">` : ""}<span>${esc(nameOf(me))}</span><button type="button" class="eco-out">выйти</button>`
      : `<button type="button" class="eco-in">Войти через Discord</button>`;
    let d = document.getElementById("ecoDrawer");
    if (!d) { d = document.createElement("aside"); d.id = "ecoDrawer"; d.className = "eco-drawer-p"; d.setAttribute("aria-label", "Меню ГУ ВП"); document.body.appendChild(d); }
    d.innerHTML = drawerHtml();
    d.querySelector(".eco-x").onclick = () => open(false);
    document.querySelectorAll(".eco-in").forEach(x => x.onclick = login);
    document.querySelectorAll(".eco-out").forEach(x => x.onclick = logout);
  }
  // Профиль → поля бланка (звание, статик, имя, должность). Поля остаются редактируемыми.
  function setField(id, val) {
    const el = document.getElementById(id); if (!el || !val) return false;
    if (el.tagName === "SELECT") {
      const o = Array.from(el.options).find(x => x.value && x.value.toLowerCase() === String(val).trim().toLowerCase());
      if (!o || el.value === o.value) return false; el.value = o.value;
    } else { if (el.value === val) return false; el.value = val; }
    el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  function autofill() {
    const me = ECO.me; if (!me) return;
    let n = 0;
    n += setField("fromName", me.ic_name); n += setField("fromRank", me.rank); n += setField("fromStatic", me.static_id);
    if (me.position) n += setField("fromPos", me.position);
    ECO.autofilled = n;
  }
  // Система повышения: если администраторы изменили требования на сайте ГУ ВП — применить их к рапорту на повышение.
  async function promoSync() {
    const P = window.PROMO; if (!P || !online) return;
    let r; try { r = await api("GET", "/api/promo-config"); } catch (e) { return; }
    if (!r || !r.custom || !r.config) return;
    const c = r.config;
    if (c.points_per_item) P.pointsPerItem = c.points_per_item;
    if (c.pts) P.acts.forEach(a => { if (Object.prototype.hasOwnProperty.call(c.pts, a.key)) a.pts = c.pts[a.key]; });
    if (Array.isArray(c.ladder)) { Object.keys(P.ladder).forEach(k => delete P.ladder[k]); c.ladder.forEach(s => { P.ladder[s.rank] = { to: s.to, points: s.points, need: s.need || {} }; }); }
    ECO.promoCustom = true;
    const fr = document.getElementById("fromRank"); if (fr) fr.dispatchEvent(new Event("input", { bubbles: true }));
  }
  ECO.ready = (async () => {
    const qs = new URLSearchParams(location.search);
    const code = qs.get("login_code"); ECO.authError = qs.get("auth_error");
    if (code || ECO.authError) history.replaceState(null, "", location.pathname + location.hash);
    if (code) {
      try { const r = await api("POST", "/auth/exchange", { code }); localStorage.setItem(TOKEN_KEY, r.token); ECO.justLoggedIn = true; }
      catch (e) { ECO.authError = e.message; }
    }
    if (token() && online) { try { ECO.me = (await api("GET", "/api/me")).user; } catch (e) { if (!e.network && e.status !== 401) ECO.authError = ECO.authError || e.message; } }
    if (document.readyState === "loading") await new Promise(r => document.addEventListener("DOMContentLoaded", r));
    paint();
    autofill();
    await promoSync();
    return ECO;
  })();
  window.VP_ECO = ECO;
  if (document.body) paint(); else document.addEventListener("DOMContentLoaded", paint);
})();

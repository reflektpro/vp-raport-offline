// Единая экосистема ГУ ВП: верхняя полоса «ГУ ВП · Отчёты / Учебный отдел / Админка» и вход через Discord
// (общий с учебным сайтом vp-exam: тот же API и та же сессия — оба сайта на reflektpro.github.io).
// Бланки, PDF и PNG работают без входа; вход нужен только для отправки отчёта.
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
  function bar() {
    const exam = E.EXAM_URL || "#";
    const me = ECO.me;
    const adm = me && (me.role === "examiner" || me.role === "admin" || me.super);
    const lead = me && (me.leader || me.super);
    return `<b>ГУ ВП</b><a href="${esc(E.REPORTS_URL || "otchet.html")}" class="on">Отчёты</a><a href="${esc(exam)}">Учебный отдел</a>`
      + (adm ? `<a href="${esc(exam)}#/admin">Админка</a>` : "") + (lead ? `<a href="${esc(exam)}#/reports">Отчёты и премии</a>` : "")
      + `<span class="eco-user">${me ? `${me.avatar_url ? `<img src="${esc(me.avatar_url)}" alt="">` : ""}<span>${esc(me.ic_name || me.global_name || me.username)}</span><button type="button" class="eco-out">выйти</button>`
        : `<button type="button" class="eco-in">Войти через Discord</button>`}</span>`;
  }
  function paint() {
    let el = document.getElementById("ecoBar");
    if (!el) { el = document.createElement("div"); el.id = "ecoBar"; el.className = "eco-bar"; document.body.insertBefore(el, document.body.firstChild); }
    el.innerHTML = bar();
    const i = el.querySelector(".eco-in"); if (i) i.onclick = login;
    const o = el.querySelector(".eco-out"); if (o) o.onclick = logout;
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
    paint();
    return ECO;
  })();
  window.VP_ECO = ECO;
  if (document.body) paint(); else document.addEventListener("DOMContentLoaded", paint);
})();

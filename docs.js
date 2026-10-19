// Ядро автономных бланков ГУ ВП: шрифты, документ → PDF (pdfmake, векторный текст, кликабельные ссылки)
// и PNG (тот же PDF без ссылок, отрисованный pdf.js в картинки A4). Никаких сетевых запросов.
(() => {
  const C = window.VP_CONFIG || {};
  const FD = window.VP_FONT_DATA || {};
  const A = window.VP_ASSETS || {};
  const MONTHS = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];

  // ---------------- шрифты (FontFace из base64: работает и с file://) ----------------
  function b64buf(b) { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; }
  const FACES = [
    ["Tinos", "Tinos-Regular.ttf", {}], ["Tinos", "Tinos-Bold.ttf", { weight: "700" }],
    ["Tinos", "Tinos-Italic.ttf", { style: "italic" }], ["Tinos", "Tinos-BoldItalic.ttf", { weight: "700", style: "italic" }],
    ["Marck Script", "MarckScript-Regular.ttf", {}], ["Oswald", "Oswald.ttf", { weight: "200 700" }]
  ];
  const fontsReady = Promise.all(FACES.map(([fam, file, d]) => {
    if (!FD[file] || !window.FontFace) return null;
    const f = new FontFace(fam, b64buf(FD[file]), d);
    document.fonts.add(f);
    return f.load().catch(() => null);
  }));
  const VFS = {}; Object.keys(FD).forEach(k => { VFS[k] = FD[k]; });
  const FONTS = { Tinos: { normal: "Tinos-Regular.ttf", bold: "Tinos-Bold.ttf", italics: "Tinos-Italic.ttf", bolditalics: "Tinos-BoldItalic.ttf" } };

  function loadImg(src) { return new Promise(r => { if (!src) return r(null); const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; }); }
  const imgs = { emblem: loadImg(A.emblem), stamp: loadImg(A.stamp) };
  const ready = Promise.all([fontsReady, imgs.emblem, imgs.stamp]);

  // ---------------- утилиты ----------------
  const pad = n => String(n).padStart(2, "0");
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const human = v => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ""); return m ? `${m[3]}.${m[2]}.${m[1]}` : ""; };
  const longDate = v => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ""); return m ? `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]} г.` : ""; };
  // «Инспектор ВП» → «инспектор ВП» внутри фразы; аббревиатуры («ВП», «ГУ ВП») не трогаем
  const lcFirst = s => { s = String(s || ""); return /^[А-ЯЁA-Z][а-яёa-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s; };
  const cap = s => String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const words = s => String(s || "").trim().split(/\s+/).filter(Boolean).map(cap);
  // Ввод «Имя Фамилия» (как в игре) или «Фамилия Имя Отчество».
  function parseName(full) {
    const p = words(full);
    if (p.length >= 3) return { surname: p[0], initial: p[1][0], fi: `${p[0]} ${p[1]}`, short: `${p[0]} ${p[1][0]}.${p[2][0]}.` };
    if (p.length === 2) return { surname: p[1], initial: p[0][0], fi: `${p[1]} ${p[0]}`, short: `${p[1]} ${p[0][0]}.` };
    if (p.length === 1) return { surname: p[0], initial: "", fi: p[0], short: p[0] };
    return null;
  }
  const LINK_RE = /^(https?:\/\/)?[^\s\/.]+(\.[^\s\/.]+)+(\/\S*)?$/i;
  const isLink = s => LINK_RE.test(String(s || "").trim());
  const normUrl = u => { u = String(u || "").trim(); return u && !/^[a-z][a-z0-9+.-]*:/i.test(u) ? "https://" + u : u; };
  // В длинных адресах разрешаем перенос строки (U+200B есть в шрифте), ссылка-аннотация остаётся целой.
  function breakable(u) {
    if (u.length <= 40) return u;
    return u.replace(/([\/?&=#])/g, "$1\u200B").replace(/([^\u200B]{24})(?=[^\u200B])/g, "$1\u200B");
  }
  function rng(seedStr) {
    let h = 2166136261;
    for (const ch of String(seedStr)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; };
  }

  // ---------------- подпись + печать одной картинкой ----------------
  // Логический холст 360×200 (2 px на pt): печать слева, роспись поверх, линия подписи.
  async function signImage(opt) {
    await ready;
    const n = parseName(opt.name || "");
    const W = 360, H = 200, K = 2.5;
    const cv = document.createElement("canvas"); cv.width = W * K; cv.height = H * K;
    const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.scale(K, K);
    const stamp = await imgs.stamp;
    if (opt.stamp !== false && stamp) {
      const r = rng("stamp" + (n ? n.surname : "x")), d = 176;
      g.save(); g.globalAlpha = 0.86; g.translate(100, 100); g.rotate((r() * 40 - 20) * Math.PI / 180);
      g.drawImage(stamp, -d / 2, -d / 2, d, d); g.restore();
    }
    if (n) {
      const r = rng(n.surname + n.initial), len = 3 + Math.floor(r() * 3);
      const text = (n.initial || "") + n.surname[0] + n.surname.slice(1, len).toLowerCase();
      const fs = 34 + Math.round(r() * 8);
      const ox = 130, oy = 58; // левый верх блока росписи 240×100
      g.save(); g.fillStyle = "#16205e"; g.strokeStyle = "#16205e";
      g.font = `${fs}px "Marck Script"`;
      const tw = Math.min(150, g.measureText(text).width);
      g.save(); g.translate(ox + 12, oy + 4 + fs * 0.75);
      g.rotate(-(4 + r() * 8) * Math.PI / 180); g.transform(1, 0, Math.tan(-(6 + r() * 10) * Math.PI / 180), 1, 0, 0);
      g.fillText(text, 0, 0); g.restore();
      const ex = 14 + tw, ey = 38 + r() * 8;
      const d = `M ${ex} ${ey} C ${ex + 18} ${ey + 22}, ${ex - 40} ${ey + 34}, ${18 + r() * 10} ${70 + r() * 8} C 4 84, ${60 + r() * 20} ${78 + r() * 6}, ${120 + r() * 20} ${64 + r() * 6} S ${200 + r() * 15} ${44 + r() * 10}, ${226 + r() * 8} ${40 + r() * 8}`;
      g.translate(ox, oy); g.lineWidth = 2.2; g.lineCap = "round"; g.stroke(new Path2D(d)); g.restore();
    }
    return cv.toDataURL("image/jpeg", 0.92); // белый фон: картинка стоит в своей колонке и не перекрывает текст
  }
  async function emblemData() { return A.emblem || null; }

  // ---------------- текстовые куски ----------------
  // run: строка | {t, b, i} | {url, alt} (в PDF — видимый кликабельный адрес, в PNG — alt или ничего) | {ph} (пусто)
  function runs(r, mode) {
    const out = [];
    (Array.isArray(r) ? r : [r]).forEach(x => {
      if (x == null || x === false || x === "") return;
      if (typeof x === "string" || typeof x === "number") { out.push({ text: String(x) }); return; }
      if (x.pdf !== undefined || x.png !== undefined) { out.push(...runs(mode === "png" ? (x.png || []) : (x.pdf || []), mode)); return; }
      if (x.url !== undefined) {
        if (mode !== "png") { const u = normUrl(x.url); out.push({ text: breakable(u), link: u, color: "#0b3a8c", decoration: "underline" }); }
        else if (x.alt) out.push({ text: x.alt });
        return;
      }
      if (x.ph !== undefined) { out.push({ text: x.ph || "________", color: mode === "preview" ? "#a58b2c" : "#000" }); return; }
      const o = { text: String(x.t == null ? "" : x.t) };
      if (x.b) o.bold = true; if (x.i) o.italics = true;
      out.push(o);
    });
    return out;
  }
  const rmode = m => m === "png" ? "png" : "pdf";

  // ---------------- HTML бланков УД/приказа → pdfmake ----------------
  const URL_IN_TEXT = /((?:https?:\/\/|www\.)[^\s<>«»"]+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:ru|com|net|org|be|tv|io|me|gg|su|рф)\/[^\s<>«»"]*)/gi;
  function linkify(text, mode, alt) {
    const out = []; let last = 0; text.replace(URL_IN_TEXT, (m, _1, off) => {
      if (off > last) out.push(text.slice(last, off));
      const tail = /[.,;:)]+$/.exec(m); const url = tail ? m.slice(0, -tail[0].length) : m;
      out.push({ url, alt: alt || "приобщена к материалам дела" });
      if (tail) out.push(tail[0]);
      last = off + m.length; return m;
    });
    if (last < text.length) out.push(text.slice(last));
    return out;
  }
  function htmlInline(node, mode, st) {
    let out = [];
    node.childNodes.forEach(ch => {
      if (ch.nodeType === 3) {
        const t = ch.nodeValue.replace(/\s+/g, " ");
        if (!t) return;
        linkify(t, mode).forEach(x => {
          if (typeof x === "string") out.push(Object.assign({ text: x }, st.b ? { bold: true } : {}, st.i ? { italics: true } : {}));
          else out = out.concat(runs([x], rmode(mode)));
        });
      } else if (ch.nodeType === 1) {
        const tag = ch.tagName.toLowerCase();
        if (tag === "br") { out.push({ text: "\n" }); return; }
        if (tag === "ol" || tag === "ul") return; // блочные — отдельно
        const s2 = Object.assign({}, st);
        if (tag === "b" || tag === "strong") s2.b = true;
        if (tag === "i" || tag === "em") s2.i = true;
        out = out.concat(htmlInline(ch, mode, s2));
      }
    });
    return out;
  }
  function trimRuns(rs) {
    while (rs.length && typeof rs[0].text === "string" && !rs[0].text.trim() && !rs[0].link) rs.shift();
    if (rs.length && typeof rs[0].text === "string") rs[0] = Object.assign({}, rs[0], { text: rs[0].text.replace(/^\s+/, "") });
    return rs;
  }
  function htmlList(ol, mode, depth) {
    const items = [...ol.children].filter(li => li.tagName.toLowerCase() === "li");
    return items.map((li, i) => {
      const stack = [{ text: trimRuns(htmlInline(li, mode, {})), alignment: "justify" }];
      li.querySelectorAll(":scope > ol, :scope > ul").forEach(sub => stack.push({ stack: htmlList(sub, mode, depth + 1), margin: [0, 2, 0, 0] }));
      return { columns: [{ width: 22, text: depth ? `${i + 1})` : `${i + 1}.` }, { width: "*", stack }], columnGap: 2, margin: [depth ? 0 : 8, 0, 0, 4] };
    });
  }
  function htmlBlocks(html, mode) {
    const root = new DOMParser().parseFromString(`<div>${html || ""}</div>`, "text/html").body.firstChild;
    const out = [];
    root.childNodes.forEach(n => {
      if (n.nodeType === 3) { if (n.nodeValue.trim()) out.push({ text: linkify(n.nodeValue.trim(), mode).map(x => typeof x === "string" ? { text: x } : runs([x], rmode(mode))[0]).filter(Boolean), margin: [0, 0, 0, 6] }); return; }
      if (n.nodeType !== 1) return;
      const tag = n.tagName.toLowerCase();
      if (tag === "ol" || tag === "ul") { out.push({ stack: htmlList(n, mode, 0), margin: [0, 2, 0, 6] }); return; }
      if (n.classList.contains("ud-h")) { out.push({ text: trimRuns(htmlInline(n, mode, {})), bold: true, alignment: "center", characterSpacing: 0.6, margin: [0, 8, 0, 5] }); return; }
      const indent = n.classList.contains("para") && !n.classList.contains("nl");
      out.push({ text: trimRuns(htmlInline(n, mode, {})), alignment: "justify", leadingIndent: indent ? 35 : 0, margin: [0, 0, 0, 6] });
      n.querySelectorAll(":scope > ol, :scope > ul").forEach(sub => out.push({ stack: htmlList(sub, mode, 0), margin: [0, 0, 0, 6] }));
    });
    return out;
  }

  // ---------------- документ → pdfmake ----------------
  const LINE = (w, m, lw) => ({ canvas: [{ type: "line", x1: 0, y1: 0, x2: w || 480, y2: 0, lineWidth: lw || 0.8 }], margin: m || [0, 4, 0, 4] });
  const CW = 595.28 - 70 - 45; // ширина набора
  function block(b, mode) {
    const rm = rmode(mode);
    if (b.raw) return b.raw;
    if (b.section) return { text: b.section, bold: true, fontSize: 12.5, characterSpacing: 0.4, margin: [0, 9, 0, 5], keepWithNext: true };
    if (b.p !== undefined) return { text: runs(b.p, mode === "preview" ? "preview" : rm), alignment: b.align || "justify", leadingIndent: b.indent === false ? 0 : 35, bold: !!b.bold, margin: b.margin || [0, 0, 0, 6] };
    if (b.html !== undefined) return { stack: htmlBlocks(b.html, rm) };
    if (b.olist) return { stack: b.olist.map((li, i) => ({ columns: [{ width: 22, text: `${i + 1}.` }, { width: "*", text: runs(li, mode === "preview" ? "preview" : rm) }], columnGap: 2, margin: [8, 0, 0, 2], unbreakable: true })), margin: b.margin || [0, 0, 0, 4] };
    if (b.rule) return LINE(CW, b.margin || [0, 8, 0, 8], b.width);
    if (b.space) return { text: "", margin: [0, b.space, 0, 0] };
    if (b.item !== undefined) {
      const head = [{ text: b.label + (b.value !== undefined || b.list ? ":" : ""), bold: true }];
      const val = b.value !== undefined ? runs(b.value, mode === "preview" ? "preview" : rm) : [];
      if (b.dot !== false && val.length) {
        const last = val[val.length - 1];
        if (typeof last.text === "string" && !last.link && !/[.!?…:;]\s*$/.test(last.text)) val.push({ text: "." });
      }
      const stack = [{ text: head.concat(val.length ? [{ text: " " }].concat(val) : []), alignment: b.align || "left" }];
      if (b.list && b.list.length) stack.push({
        stack: b.list.map((li, i) => ({ columns: [{ width: 18, text: (b.bullet || "num") === "num" ? `${i + 1})` : "—" }, { width: "*", text: runs(li, mode === "preview" ? "preview" : rm), alignment: b.align || "left" }], columnGap: 2, margin: [0, 2, 0, 0], unbreakable: true })),
        margin: [0, 1, 0, 0]
      });
      if (b.after) stack.push({ text: runs(b.after, mode === "preview" ? "preview" : rm), margin: [0, 2, 0, 0], alignment: "justify" });
      return { columns: [{ width: 22, text: `${b.item}.`, bold: true }, { width: "*", stack }], columnGap: 2, margin: [0, 0, 0, 4] };
    }
    if (b.sign) {
      const s = b.sign, out = [];
      if (s.date !== undefined) out.push({ text: [{ text: (s.dateLabel || "Дата") + ": ", bold: true }].concat(runs(s.date, mode === "preview" ? "preview" : rm)), margin: [0, 16, 0, 0] });
      const rr = x => ({ text: runs(x, mode === "preview" ? "preview" : rm) });
      let left, right;
      if (s.left) left = s.left.map(rr);
      else { left = [{ text: s.label || "Рапорт составил:", bold: true }]; if (s.pos) left.push({ text: s.pos }); }
      right = s.right ? s.right.map(rr) : [rr(s.rank || ""), rr(s.name || "")];
      out.push({
        columns: [
          { width: "*", stack: left, margin: [0, s.leftTop || 40, 0, 0] },
          s.image ? { width: 180, image: s.image, fit: [180, 100] } : { width: 180, text: "" },
          { width: s.rightWidth || 140, stack: right, alignment: "right", margin: [0, s.rightTop || 40, 0, 0] }
        ], columnGap: 6, margin: [0, 0, 0, 0], unbreakable: true
      });
      return { stack: out, unbreakable: true };
    }
    return { text: "" };
  }

  function build(spec, mode) {
    const rm = mode === "preview" ? "preview" : rmode(mode);
    const content = [];
    if (spec.emblem !== false && A.emblem) content.push({ image: "emblem", width: 58, alignment: "center", margin: [0, 0, 0, 5] });
    (spec.header || C.header || []).forEach(l => content.push({ text: l, bold: true, alignment: "center", fontSize: 12, characterSpacing: 0.3, lineHeight: 1.1 }));
    if (spec.unitLine !== false && (spec.unitLine || C.unitLine)) content.push({ text: spec.unitLine || C.unitLine, alignment: "center", fontSize: 11.5, margin: [0, 2, 0, 0] });
    content.push(LINE(CW, [0, 7, 0, 0], 1.4)); content.push(LINE(CW, [0, 1.6, 0, 0], 0.5));
    if (spec.approve) content.push({ columns: [{ width: "*", text: "" }, { width: 220, stack: spec.approve.map(l => ({ text: runs(l, rm) })), fontSize: 11.5 }], margin: [0, 10, 0, 0] });
    if (spec.to) content.push({
      columns: [{ width: "*", text: "" }, { width: 245, stack: spec.to.map(l => ({ text: runs(l, rm), margin: [0, 0, 0, 3] })) }], margin: [0, 14, 0, 0]
    });
    if (spec.title) content.push({ text: spec.title, fontSize: 18, bold: true, alignment: "center", characterSpacing: 6, margin: [0, 16, 0, 2] });
    if (spec.subtitle) content.push({ text: spec.subtitle, alignment: "center", bold: true, fontSize: 12.5, margin: [0, 0, 0, 2] });
    if (spec.metaLine) content.push({ columns: spec.metaLine.map((m, i, a) => ({ width: "*", text: runs(m, rm), alignment: a.length === 1 ? "center" : i === 0 ? "left" : i === a.length - 1 ? "right" : "center" })), fontSize: 12, margin: [0, 2, 0, 0] });
    content.push({ text: "", margin: [0, 8, 0, 0] });
    (spec.blocks || []).forEach(b => content.push(block(b, rm)));
    const motto = spec.motto === false ? "" : (spec.motto || C.motto || "");
    return {
      pageSize: "A4", pageMargins: [70, 50, 45, 62],
      info: { title: spec.docTitle || spec.title || "Документ", author: spec.author || "", subject: spec.subtitle || "", creator: "ГУ ВП · автономные бланки", producer: "pdfmake" },
      images: A.emblem ? { emblem: A.emblem } : {},
      defaultStyle: { font: "Tinos", fontSize: 12.5, lineHeight: 1.16 },
      header: cur => cur > 1 ? { text: String(cur), alignment: "center", fontSize: 11.5, margin: [0, 24, 0, 0] } : null,
      footer: (cur, count) => (cur === count && motto) ? { stack: [LINE(CW, [0, 0, 0, 4], 0.5), { text: motto, alignment: "center", bold: true, fontSize: 11, characterSpacing: 0.5 }], margin: [70, 14, 45, 0] } : null,
      content
    };
  }

  // ---------------- PDF / PNG ----------------
  async function pdfBytes(spec, mode) {
    await ready;
    if (!window.pdfMake) throw new Error("pdfmake не загрузился");
    const dd = build(spec, mode);
    return new Promise((res, rej) => {
      try { pdfMake.createPdf(dd, null, FONTS, VFS).getBuffer(b => res(new Uint8Array(b))); } catch (e) { rej(e); }
    });
  }
  let pdfjsOk = false;
  function pdfjs() {
    const L = window.pdfjsLib || window["pdfjs-dist/build/pdf"];
    if (!L) throw new Error("pdf.js не загрузился");
    if (!pdfjsOk) { if (!window.pdfjsWorker) L.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js"; pdfjsOk = true; }
    return L;
  }
  async function renderPages(bytes, scale) {
    const L = pdfjs();
    const doc = await L.getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: false }).promise;
    const out = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i), vp = page.getViewport({ scale });
      const cv = document.createElement("canvas"); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
      const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height);
      await page.render({ canvasContext: g, viewport: vp }).promise;
      out.push(cv);
    }
    doc.destroy();
    return out;
  }
  function save(blob, name) {
    const a = document.createElement("a"); const url = URL.createObjectURL(blob);
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  const safe = s => String(s || "doc").replace(/[^\wА-яЁё.-]+/g, "_").replace(/^_+|_+$/g, "") || "doc";
  async function downloadPDF(spec, base) {
    const b = await pdfBytes(spec, "pdf");
    save(new Blob([b], { type: "application/pdf" }), safe(base) + ".pdf");
    return b;
  }
  const PNG_SCALE = 1588 / 595.28; // ширина листа 1588 px (~192 dpi)
  async function downloadPNG(spec, base) {
    const pages = await renderPages(await pdfBytes(spec, "png"), PNG_SCALE);
    for (let i = 0; i < pages.length; i++) {
      const blob = await new Promise(r => pages[i].toBlob(r, "image/png"));
      save(blob, safe(base) + (pages.length > 1 ? `_стр${i + 1}` : "") + ".png");
      if (pages.length > 1) await new Promise(r => setTimeout(r, 250));
    }
    return pages.length;
  }

  // ---------------- живой предпросмотр ----------------
  function preview(box, getSpec, opt) {
    opt = opt || {};
    let timer = 0, seq = 0, mode = "preview";
    async function draw() {
      const my = ++seq;
      try {
        const spec = await getSpec();
        if (!spec) return;
        const bytes = await pdfBytes(spec, mode === "png" ? "png" : "preview");
        if (my !== seq) return;
        const w = Math.max(320, box.clientWidth || 700);
        const pages = await renderPages(bytes, (w / 595.28) * Math.min(2, window.devicePixelRatio || 1));
        if (my !== seq) return;
        box.innerHTML = "";
        pages.forEach((c, i) => { c.className = "pv-page"; c.setAttribute("aria-label", "Лист " + (i + 1)); box.appendChild(c); });
        if (opt.onPages) opt.onPages(pages.length);
      } catch (e) { if (opt.onError) opt.onError(e); else console.error(e); }
    }
    const api = {
      refresh(now) { clearTimeout(timer); timer = setTimeout(draw, now ? 0 : 350); },
      setMode(m) { mode = m; api.refresh(true); }
    };
    window.addEventListener("resize", () => api.refresh());
    return api;
  }

  // ---------------- номер документа: локальный счётчик ----------------
  function incNum(s) {
    s = String(s || "").trim();
    if (!s) return "1";
    const m = /^(.*?)(\d+)(\D*)$/.exec(s);
    if (!m) return s + "-1";
    const n = String(+m[2] + 1).padStart(m[2].length, "0");
    return m[1] + n + m[3];
  }
  function counter(kind, el) {
    const key = "vp_num_" + kind;
    const next = () => incNum(localStorage.getItem(key) || "0");
    const draft = localStorage.getItem(key + "_draft");
    el.value = draft || next();
    el.addEventListener("input", () => localStorage.setItem(key + "_draft", el.value.trim()));
    return {
      commit() { const v = el.value.trim(); if (v) { localStorage.setItem(key, v); localStorage.setItem(key + "_draft", v); } },
      next() { el.value = next(); localStorage.removeItem(key + "_draft"); el.dispatchEvent(new Event("input", { bubbles: true })); localStorage.removeItem(key + "_draft"); },
      last() { return localStorage.getItem(key) || ""; }
    };
  }

  // ---------------- сохранение полей формы ----------------
  function persist(key, ids) {
    let st = {}; try { st = JSON.parse(localStorage.getItem(key) || "{}"); } catch (e) {}
    ids.forEach(id => {
      const el = document.getElementById(id); if (!el) return;
      if (st[id] !== undefined) { if (el.type === "checkbox") el.checked = !!st[id]; else el.value = st[id]; }
      el.addEventListener(el.type === "checkbox" ? "change" : "input", () => { st[id] = el.type === "checkbox" ? el.checked : el.value; localStorage.setItem(key, JSON.stringify(st)); });
    });
    return { clear(list) { (list || ids).forEach(id => delete st[id]); localStorage.setItem(key, JSON.stringify(st)); } };
  }

  // ---------------- кнопки страницы: «Скачать PDF» / «Скачать PNG» + предпросмотр ----------------
  function check(ids) {
    let first = null;
    ids.forEach(id => {
      const el = typeof id === "string" ? document.getElementById(id) : id;
      if (!el) return;
      const bad = el.type === "checkbox" ? false : !String(el.value || "").trim();
      el.classList.toggle("bad", bad);
      if (bad && !first) first = el;
    });
    if (first) { first.focus(); first.scrollIntoView && first.scrollIntoView({ block: "center" }); }
    return !first;
  }
  document.addEventListener("input", e => { if (e.target.classList && e.target.classList.contains("bad")) e.target.classList.remove("bad"); });
  function wire(o) {
    const $ = id => document.getElementById(id);
    const st = $(o.statusId || "status");
    const status = (t, cls) => { if (st) { st.textContent = t; st.className = "status " + (cls || ""); } };
    const btns = [o.pdfId || "pdf", o.pngId || "png"].map($).filter(Boolean);
    const busy = b => btns.forEach(x => x.disabled = b);
    let pv = null;
    if (o.preview) {
      const pages = $(o.pagesId || "pvPages");
      pv = preview(o.preview, o.spec, {
        onPages: n => { if (pages) pages.textContent = n === 1 ? "1 лист A4" : `${n} листа(ов) A4`; },
        onError: e => status("Ошибка предпросмотра: " + e.message, "err")
      });
      document.querySelectorAll("input[name=pvMode]").forEach(r => r.addEventListener("change", () => { if (r.checked) pv.setMode(r.value); }));
      pv.refresh(true);
    }
    async function run(kind) {
      if (o.validate && !o.validate()) { status(o.invalidText || "Заполни подсвеченные красным поля.", "err"); return; }
      busy(true); status(kind === "pdf" ? "Собираю PDF…" : "Рисую PNG…");
      try {
        const spec = await o.spec();
        const base = o.base();
        if (kind === "pdf") { await downloadPDF(spec, base); status("PDF скачан: " + safe(base) + ".pdf", "ok"); }
        else { const n = await downloadPNG(spec, base); status(n > 1 ? `Скачано листов PNG: ${n}.` : "PNG скачан: " + safe(base) + ".png", "ok"); }
        if (o.counter) o.counter.commit();
        if (o.onExport) o.onExport(kind, spec);
      } catch (e) { console.error(e); status("Ошибка: " + e.message, "err"); } finally { busy(false); }
    }
    btns.forEach(b => b.addEventListener("click", () => run(b.id === (o.pdfId || "pdf") ? "pdf" : "png")));
    return { status, refresh: now => pv && pv.refresh(now), run };
  }

  window.VPDOC = { check, wire, safe, ready, build, pdfBytes, renderPages, downloadPDF, downloadPNG, preview, counter, persist, signImage, emblemData,
    parseName, lcFirst, human, longDate, iso, cap, esc, isLink, normUrl, htmlBlocks, incNum, MONTHS };
})();

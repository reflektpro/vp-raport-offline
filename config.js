// Настройки бланков. Бланки, PDF и PNG работают автономно, без входа и без сети.
// Сеть нужна только для «Отправить отчёт» (еженедельный отчёт → руководству ГУ ВП, вход через Discord).
(function () {
  const local = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  window.VP_ECO_CONFIG = {
    API_BASE: local ? "http://localhost:8787" : "https://vp-exam-api.reflektpro8.workers.dev",
    EXAM_URL: local ? "http://localhost:8080/" : "https://reflektpro.github.io/vp-exam/",
    REPORTS_URL: "otchet.html"
  };
})();
window.VP_CONFIG = {
  // Шапка документа (по центру)
  header: [
    "МИНИСТЕРСТВО ОБОРОНЫ РОССИЙСКОЙ ФЕДЕРАЦИИ",
    "ГЛАВНОЕ УПРАВЛЕНИЕ ВОЕННОЙ ПОЛИЦИИ"
  ],
  unitLine: "1-я мотострелковая бригада | В/Ч №12132",
  // Адресат рапортов (блок «Кому» справа)
  to: "Военному коменданту гарнизона, начальнику ГУ ВП",
  // Девиз внизу последнего листа
  motto: "ГУ ВП — ЗАКОН. ПОРЯДОК. ДИСЦИПЛИНА.",
  city: "Москва"
};

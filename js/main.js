/* Kaffibrennslan — behavior. Exposes window.KAFFI hooks so cms.js can
   re-init animations / live status after it renders content from content.json. */
(function () {
  "use strict";

  var nav = document.getElementById("nav");
  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- Mobile menu ---- */
  var toggle = document.getElementById("navToggle");
  var links = document.getElementById("navLinks");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      links.classList.toggle("open");
      nav.classList.toggle("menu-open");
      document.body.classList.toggle("nav-lock", links.classList.contains("open"));
    });
    links.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        links.classList.remove("open");
        nav.classList.remove("menu-open");
        document.body.classList.remove("nav-lock");
      }
    });
  }

  /* ---- Parallax ---- */
  var parallaxEls = [];
  var ticking = false;
  function collectParallax() { parallaxEls = [].slice.call(document.querySelectorAll("[data-parallax]")); }
  function applyParallax() {
    var vh = window.innerHeight;
    for (var i = 0; i < parallaxEls.length; i++) {
      var el = parallaxEls[i];
      var r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) continue;
      var p = (r.top + r.height / 2 - vh / 2) / vh;
      var s = parseFloat(el.getAttribute("data-parallax")) || 0.1;
      el.style.transform = "translate3d(0," + (-p * s * 100).toFixed(2) + "px,0)";
    }
  }
  function onScroll() {
    if (nav) nav.classList.toggle("scrolled", window.scrollY > 40);
    if (!prefersReduced && parallaxEls.length && !ticking) {
      ticking = true;
      requestAnimationFrame(function () { applyParallax(); ticking = false; });
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", applyParallax, { passive: true });

  /* ---- Reveal on scroll (idempotent, re-callable) ---- */
  var io = null;
  function revealEl(el) {
    el.classList.add("in");
    if (el.hasAttribute("data-stagger")) {
      var step = parseInt(el.getAttribute("data-stagger"), 10) || 90;
      var kids = el.querySelectorAll("[data-reveal]");
      for (var i = 0; i < kids.length; i++) {
        kids[i].style.transitionDelay = (i * step) + "ms";
        kids[i].classList.add("in");
      }
    }
  }
  function initReveal() {
    collectParallax();
    if (prefersReduced || !("IntersectionObserver" in window)) {
      document.querySelectorAll("[data-reveal]").forEach(function (el) { el.classList.add("in"); });
      return;
    }
    if (!io) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { revealEl(e.target); io.unobserve(e.target); } });
      }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    }
    var targets = [].slice.call(document.querySelectorAll("[data-reveal], [data-stagger]")).filter(function (el) {
      if (el.classList.contains("in")) return false;
      if (el.hasAttribute("data-stagger")) return true;
      return !el.closest("[data-stagger]");
    });
    targets.forEach(function (el) { io.observe(el); });
    requestAnimationFrame(function () {
      var vh = window.innerHeight;
      targets.forEach(function (el) {
        if (el.getBoundingClientRect().top < vh * 0.95) { revealEl(el); io.unobserve(el); }
      });
    });
  }

  /* ---- Live open/closed status, derived from the displayed hours ---- */
  function parseTime(t) {
    var m = String(t).match(/(\d{1,2}):(\d{2})/);
    return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
  }
  function fmt(mins) {
    var v = ((mins % 1440) + 1440) % 1440;
    var h = Math.floor(v / 60), mm = v % 60;
    return (h < 10 ? "0" : "") + h + ":" + (mm < 10 ? "0" : "") + mm;
  }
  function updateStatus() {
    var sched = {};
    document.querySelectorAll(".hours__row[data-day]").forEach(function (row) {
      var timeEl = row.querySelector(".time");
      if (!timeEl) return;
      var parts = timeEl.textContent.split(/[–—-]/);
      var o = parseTime(parts[0]), c = parseTime(parts[1]);
      if (o == null || c == null) return;
      if (c <= o) c += 1440;
      row.getAttribute("data-day").split(",").forEach(function (d) { sched[+d] = { open: o, close: c }; });
    });
    var now = new Date(), d = now.getDay(), mins = now.getHours() * 60 + now.getMinutes();
    var open = false, closeAt = null, openAt = null, today = sched[d];
    if (today && mins >= today.open && mins < today.close) { open = true; closeAt = today.close; }
    var yd = sched[(d + 6) % 7];
    if (!open && yd && yd.close > 1440 && mins < yd.close - 1440) { open = true; closeAt = yd.close; }
    if (!open) {
      if (today && mins < today.open) openAt = today.open;
      else { var nd = sched[(d + 1) % 7]; if (nd) openAt = nd.open; }
    }
    var el = document.getElementById("liveStatus");
    if (el) {
      if (open) { el.className = "livestatus is-open"; el.innerHTML = '<span class="livedot"></span><span>Opið núna</span><em>til ' + fmt(closeAt) + "</em>"; }
      else { el.className = "livestatus is-closed"; el.innerHTML = '<span class="livedot"></span><span>Lokað</span>' + (openAt != null ? '<em>opnar ' + fmt(openAt) + "</em>" : ""); }
    }
    document.querySelectorAll(".hours__row[data-day]").forEach(function (row) {
      var days = row.getAttribute("data-day").split(",").map(Number);
      row.classList.toggle("is-now", days.indexOf(d) !== -1);
    });
  }

  function setYear() { var y = document.getElementById("year"); if (y) y.textContent = new Date().getFullYear(); }

  /* expose for cms.js */
  window.KAFFI = { initReveal: initReveal, updateStatus: updateStatus, applyParallax: applyParallax };

  /* initial run on the static (fallback) content */
  onScroll();
  initReveal();
  updateStatus();
  setYear();
  if (!prefersReduced) applyParallax();
})();

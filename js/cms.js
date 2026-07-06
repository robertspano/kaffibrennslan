/* Kaffibrennslan — content layer. Loads content.json and fills the page.
   If it fails, the static HTML (baked-in fallback) stays untouched. */
(function () {
  "use strict";

  var ICONS = {
    coffee: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4Z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>',
    tea: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11h13a2 2 0 0 1 0 4h-1"/><path d="M4 11v5a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-5Z"/><path d="M8 4c0 1-1 1-1 2s1 1 1 2"/><path d="M12 4c0 1-1 1-1 2s1 1 1 2"/></svg>',
    bar: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22h8"/><path d="M12 11v11"/><path d="M5 3h14l-2 8H7Z"/><path d="M5 3 4 1"/></svg>'
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function setText(key, val) {
    if (val == null) return;
    document.querySelectorAll('[data-cms="' + key + '"]').forEach(function (el) { el.textContent = val; });
  }

  fetch("content.json?ts=" + Date.now(), { cache: "no-store" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) { if (d) apply(d); })
    .catch(function () { /* keep static fallback */ });

  function apply(d) {
    var h = d.hero || {};
    setText("hero.location", h.location);
    setText("hero.titleLine1", h.titleLine1);
    setText("hero.titleLine2", h.titleLine2);
    setText("hero.lead", h.lead);
    setText("hero.ctaPrimary", h.ctaPrimary);
    setText("hero.ctaSecondary", h.ctaSecondary);
    var tagWrap = document.querySelector('[data-cms-list="hero.tags"]');
    if (tagWrap && h.tags) {
      tagWrap.innerHTML = h.tags.map(function (t, i) {
        return (i ? '<span class="dot"></span>' : "") + "<span>" + esc(t) + "</span>";
      }).join("");
    }

    var m = d.menu || {};
    setText("menu.eyebrow", m.eyebrow);
    setText("menu.title", m.title);
    setText("menu.subtitle", m.subtitle);
    if (m.categories) renderMenu(m.categories);

    var g = d.gallery || {};
    setText("gallery.eyebrow", g.eyebrow);
    setText("gallery.title", g.title);
    if (g.images) renderGallery(g.images);

    var v = d.visit || {};
    setText("visit.eyebrow", v.eyebrow);
    setText("visit.title", v.title);
    setText("visit.hoursTitle", v.hoursTitle);
    setText("visit.contactTitle", v.contactTitle);
    setText("visit.address", v.address);
    document.querySelectorAll('[data-cms="visit.phone"]').forEach(function (el) {
      if (v.phone != null) el.textContent = v.phone;
      if (v.phoneHref) el.setAttribute("href", "tel:" + v.phoneHref);
    });
    document.querySelectorAll('[data-cms="visit.reviews"]').forEach(function (el) {
      if (v.reviewsText != null) el.textContent = v.reviewsText;
      if (v.reviewsUrl) el.setAttribute("href", v.reviewsUrl);
    });
    if (v.hours) renderHours(v.hours);

    var c = d.cta || {};
    setText("cta.eyebrow", c.eyebrow);
    setText("cta.title", c.title);
    setText("cta.text", c.text);
    if (c.image) { var ctaImg = document.querySelector(".cta__bg img"); if (ctaImg) ctaImg.src = c.image; }

    if (d.footer) setText("footer.text", d.footer.text);

    /* re-init animations for freshly rendered nodes + recompute live status */
    if (window.KAFFI) { window.KAFFI.initReveal(); window.KAFFI.updateStatus(); window.KAFFI.applyParallax(); }
  }

  function renderMenu(cats) {
    var grid = document.querySelector(".menu-grid");
    if (!grid) return;
    grid.innerHTML = cats.map(function (c, ci) {
      var no = ("0" + (ci + 1)).slice(-2);
      var reveal = ci === 0 ? 'data-reveal="up"' : 'data-reveal="up" data-delay="' + ci + '"';
      var items = (c.items || []).map(function (it) {
        var pop = it.popular ? ' <span class="pop">Vinsælt</span>' : "";
        return '<li data-reveal><span class="name">' + esc(it.name) + pop +
          '</span><span class="price">' + esc(it.price) + "</span></li>";
      }).join("");
      return '<article class="mcard" ' + reveal + ">" +
        '<div class="mcard__top"><span class="mcard__no">' + no + "</span>" +
        '<div class="mcard__icon">' + (ICONS[c.icon] || ICONS.coffee) + "</div></div>" +
        '<span class="mcard__tag">' + esc(c.tag) + "</span>" +
        "<h3><span>" + esc(c.name) + "</span></h3>" +
        '<ul data-stagger="80">' + items + "</ul>" +
        "</article>";
    }).join("");
  }

  function renderGallery(images) {
    var grid = document.querySelector(".gallery");
    if (!grid || !images.length) return;
    var speeds = [0.06, 0.14, 0.12, 0.16, 0.1, 0.14];
    grid.innerHTML = images.map(function (im, i) {
      var cls = i === 0 ? "gi-feat" : "";
      var sp = speeds[i % speeds.length];
      var cap = im.caption ? "<figcaption>" + esc(im.caption) + "</figcaption>" : "";
      return '<figure class="' + cls + '" data-reveal="scale">' +
        '<span class="gimg" data-parallax="' + sp + '"><img src="' + esc(im.src) + '" alt="' + esc(im.caption || "Kaffibrennslan") + '" /></span>' +
        cap + "</figure>";
    }).join("");
  }

  function renderHours(hours) {
    var wrap = document.querySelector(".hours");
    if (!wrap) return;
    wrap.querySelectorAll(".hours__row").forEach(function (r) { r.remove(); });
    var frag = hours.map(function (hh) {
      return '<div class="hours__row" data-day="' + (hh.days || []).join(",") + '">' +
        '<span class="day">' + esc(hh.label) + "</span>" +
        '<span class="time">' + esc(hh.time) + "</span></div>";
    }).join("");
    var head = wrap.querySelector(".hours__head");
    if (head) head.insertAdjacentHTML("afterend", frag);
    else wrap.insertAdjacentHTML("beforeend", frag);
  }
})();

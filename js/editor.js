/* Kaffibrennslan — sjónrænn ritill (visual inline editor).
   Opnast með index.html?edit=1 . Sýnir vefinn nákvæmlega eins og hann er,
   en texti er smellanlegur til að breyta og myndir er hægt að skipta út.
   Vistun/upphleðsla krefjast þjónsins (serve.py) og lykilorðs. */
(function () {
  "use strict";

  var ICONS = {
    coffee: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4Z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>',
    tea: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11h13a2 2 0 0 1 0 4h-1"/><path d="M4 11v5a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-5Z"/><path d="M8 4c0 1-1 1-1 2s1 1 1 2"/><path d="M12 4c0 1-1 1-1 2s1 1 1 2"/></svg>',
    bar: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22h8"/><path d="M12 11v11"/><path d="M5 3h14l-2 8H7Z"/><path d="M5 3 4 1"/></svg>'
  };
  var data = null, pw = sessionStorage.getItem("kaffi_pw") || "", dirty = false;

  function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];}); }
  function setPath(o, p, v){ var ks=p.split("."), last=ks.pop(); var t=o; for(var i=0;i<ks.length;i++){ if(t==null) return; t=t[ks[i]]; } if(t) t[last]=v; }

  document.body.classList.add("editing");
  injectStyle();

  fetch("content.json?ts="+Date.now(), {cache:"no-store"})
    .then(function(r){ return r.json(); })
    .then(function(d){ data=d; render(d); enable(); buildBar(); if(window.KAFFI){window.KAFFI.initReveal();window.KAFFI.updateStatus();} })
    .catch(function(){ render(null); enable(); buildBar(); });

  function setText(key,val){ if(val==null) return; document.querySelectorAll('[data-cms="'+key+'"]').forEach(function(el){ el.textContent=val; }); }

  function render(d){
    if(!d) return;
    var h=d.hero||{};
    setText("hero.location",h.location); setText("hero.titleLine1",h.titleLine1); setText("hero.titleLine2",h.titleLine2);
    setText("hero.lead",h.lead); setText("hero.ctaPrimary",h.ctaPrimary); setText("hero.ctaSecondary",h.ctaSecondary);
    var tw=document.querySelector('[data-cms-list="hero.tags"]');
    if(tw&&h.tags){ tw.innerHTML=h.tags.map(function(t,i){ return (i?'<span class="dot"></span>':"")+'<span data-cms="hero.tags.'+i+'">'+esc(t)+"</span>"; }).join(""); }

    var m=d.menu||{}; setText("menu.eyebrow",m.eyebrow); setText("menu.title",m.title); setText("menu.subtitle",m.subtitle);
    if(m.categories) renderMenu(m.categories);

    var g=d.gallery||{}; setText("gallery.eyebrow",g.eyebrow); setText("gallery.title",g.title);
    if(g.images) renderGallery(g.images);

    var v=d.visit||{}; setText("visit.eyebrow",v.eyebrow); setText("visit.title",v.title);
    setText("visit.hoursTitle",v.hoursTitle); setText("visit.contactTitle",v.contactTitle); setText("visit.address",v.address);
    document.querySelectorAll('[data-cms="visit.phone"]').forEach(function(el){ if(v.phone!=null) el.textContent=v.phone; });
    document.querySelectorAll('[data-cms="visit.reviews"]').forEach(function(el){ if(v.reviewsText!=null) el.textContent=v.reviewsText; });
    if(v.hours) renderHours(v.hours);

    var c=d.cta||{}; setText("cta.eyebrow",c.eyebrow); setText("cta.title",c.title); setText("cta.text",c.text);
    if(c.image){ var ci=document.querySelector(".cta__bg img"); if(ci){ ci.src=c.image; ci.setAttribute("data-img","cta.image"); } }
    if(d.footer) setText("footer.text",d.footer.text);
  }

  function renderMenu(cats){
    var grid=document.querySelector(".menu-grid"); if(!grid) return;
    grid.innerHTML=cats.map(function(c,ci){
      var no=("0"+(ci+1)).slice(-2);
      var items=(c.items||[]).map(function(it,ii){
        var b="menu.categories."+ci+".items."+ii;
        var pop=it.popular?' <span class="pop">Vinsælt</span>':"";
        return '<li data-reveal><span class="itemname"><span class="name" data-cms="'+b+'.name">'+esc(it.name)+"</span>"+pop+
          '</span><span class="price" data-cms="'+b+'.price">'+esc(it.price)+"</span></li>";
      }).join("");
      return '<article class="mcard" data-reveal="up">'+
        '<div class="mcard__top"><span class="mcard__no">'+no+'</span><div class="mcard__icon">'+(ICONS[c.icon]||ICONS.coffee)+"</div></div>"+
        '<span class="mcard__tag" data-cms="menu.categories.'+ci+'.tag">'+esc(c.tag)+"</span>"+
        '<h3><span data-cms="menu.categories.'+ci+'.name">'+esc(c.name)+"</span></h3>"+
        '<ul data-stagger="80">'+items+"</ul></article>";
    }).join("");
  }

  function renderGallery(images){
    var grid=document.querySelector(".gallery"); if(!grid||!images.length) return;
    var speeds=[0.06,0.14,0.12,0.16,0.1,0.14];
    grid.innerHTML=images.map(function(im,i){
      var cls=i===0?"gi-feat":"";
      var cap='<figcaption data-cms="gallery.images.'+i+'.caption">'+esc(im.caption||"")+"</figcaption>";
      return '<figure class="'+cls+'" data-reveal="scale">'+
        '<span class="gimg" data-parallax="'+speeds[i%speeds.length]+'"><img src="'+esc(im.src)+'" alt="'+esc(im.caption||"")+'" data-img="gallery.images.'+i+'.src" /></span>'+
        cap+"</figure>";
    }).join("");
  }

  function renderHours(hours){
    var wrap=document.querySelector(".hours"); if(!wrap) return;
    wrap.querySelectorAll(".hours__row").forEach(function(r){ r.remove(); });
    var frag=hours.map(function(hh,i){
      return '<div class="hours__row" data-day="'+(hh.days||[]).join(",")+'">'+
        '<span class="day" data-cms="visit.hours.'+i+'.label">'+esc(hh.label)+"</span>"+
        '<span class="time" data-cms="visit.hours.'+i+'.time">'+esc(hh.time)+"</span></div>";
    }).join("");
    var head=wrap.querySelector(".hours__head");
    if(head) head.insertAdjacentHTML("afterend",frag); else wrap.insertAdjacentHTML("beforeend",frag);
  }

  /* ---- enable inline editing ---- */
  function enable(){
    // text fields
    document.querySelectorAll("[data-cms]").forEach(function(el){
      el.setAttribute("contenteditable","true");
      el.classList.add("edt-text");
      el.setAttribute("spellcheck","false");
      el.addEventListener("input", function(){ if(data){ setPath(data, el.getAttribute("data-cms"), el.textContent); dirty=true; markDirty(); } });
      el.addEventListener("keydown", function(e){ if(e.key==="Enter"){ e.preventDefault(); el.blur(); } });
    });
    // images
    document.querySelectorAll("[data-img]").forEach(function(img){
      img.classList.add("edt-img");
      img.addEventListener("click", function(e){ e.preventDefault(); e.stopPropagation(); replaceImage(img); });
    });
    // stop links from navigating while editing
    document.addEventListener("click", function(e){
      var a=e.target.closest("a");
      if(a && !e.target.closest(".editbar")){ e.preventDefault(); }
    }, true);
  }

  function replaceImage(img){
    pickFile(function(file){
      uploadImage(file, function(path){
        img.src = path + "?t=" + Date.now();
        var p = img.getAttribute("data-img");
        if(p){ setPath(data, p, path); dirty=true; markDirty(); }
      });
    });
  }
  function pickFile(cb){
    var inp=document.createElement("input"); inp.type="file"; inp.accept="image/*";
    inp.addEventListener("change", function(){ if(inp.files[0]) cb(inp.files[0]); });
    inp.click();
  }
  function uploadImage(file, cb){
    if(!ensurePw()) return;
    if(file.size>11*1024*1024){ setStatus("Mynd of stór (~10MB hámark)","err"); return; }
    var reader=new FileReader();
    reader.onload=function(){
      setStatus("Hleð upp mynd…");
      fetch("/api/upload",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({password:pw,name:file.name,data:reader.result})})
        .then(function(r){ return r.json().then(function(j){return {s:r.status,j:j};}); })
        .then(function(res){ if(res.j.ok){ setStatus("Mynd komin ✓","ok"); cb(res.j.path); } else { setStatus("Villa: "+(res.j.error||""),"err"); if(res.s===401){ pw=""; sessionStorage.removeItem("kaffi_pw"); } } })
        .catch(function(){ setStatus("Villa við upphleðslu (er þjónninn í gangi?)","err"); });
    };
    reader.readAsDataURL(file);
  }

  /* ---- toolbar ---- */
  var bar, statusEl;
  function buildBar(){
    bar=document.createElement("div"); bar.className="editbar";
    bar.innerHTML=
      '<div class="editbar__l"><span class="editbar__dot"></span> Sjónrænn ritill'+
      '<span class="editbar__hint">— smelltu á texta eða mynd til að breyta</span></div>'+
      '<div class="editbar__r"><span class="editbar__status" id="edtStatus"></span>'+
      '<a class="editbar__btn ghost" href="'+location.pathname+'">Hætta</a>'+
      '<button class="editbar__btn gold" id="edtSave">Vista breytingar</button></div>';
    document.body.appendChild(bar);
    statusEl=document.getElementById("edtStatus");
    document.getElementById("edtSave").addEventListener("click", save);
  }
  function setStatus(msg,kind){ if(!statusEl) return; statusEl.textContent=msg; statusEl.className="editbar__status "+(kind||""); if(kind==="ok") setTimeout(function(){ if(statusEl.textContent===msg) statusEl.textContent=""; },3500); }
  function markDirty(){ var b=document.getElementById("edtSave"); if(b) b.classList.add("has-changes"); }

  function ensurePw(){
    if(pw) return true;
    var p=window.prompt("Lykilorð til að vista:");
    if(p){ pw=p; sessionStorage.setItem("kaffi_pw",pw); return true; }
    return false;
  }
  function save(){
    if(!data){ setStatus("Ekkert efni hlaðið","err"); return; }
    if(!ensurePw()) return;
    setStatus("Vista…");
    fetch("/api/save",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:pw,content:data})})
      .then(function(r){ return r.json().then(function(j){return {s:r.status,j:j};}); })
      .then(function(res){
        if(res.j.ok){ setStatus("Vistað ✓","ok"); dirty=false; var b=document.getElementById("edtSave"); if(b) b.classList.remove("has-changes"); }
        else { setStatus("Villa: "+(res.j.error||""),"err"); if(res.s===401){ pw=""; sessionStorage.removeItem("kaffi_pw"); } }
      })
      .catch(function(){ setStatus("Vistun virkar aðeins heima (serve.py)","err"); });
  }

  window.addEventListener("beforeunload", function(e){ if(dirty){ e.preventDefault(); e.returnValue=""; } });

  /* ---- styles ---- */
  function injectStyle(){
    var s=document.createElement("style");
    s.textContent=
      "body.editing [data-reveal]{opacity:1!important;transform:none!important}"+
      "body.editing [data-parallax]{transform:none!important}"+
      "body.editing .mcard h3>span{transform:none!important}"+
      "body.editing{padding-bottom:64px}"+
      ".edt-text{outline:1px dashed rgba(102,71,10,.35);outline-offset:3px;border-radius:3px;transition:background .15s,outline-color .15s;cursor:text}"+
      ".edt-text:hover{outline-color:var(--gold,#66470a);background:rgba(216,173,91,.14)}"+
      ".edt-text:focus{outline:2px solid var(--gold,#66470a);background:rgba(216,173,91,.18)}"+
      ".hero .edt-text:hover,.cta .edt-text:hover{background:rgba(255,255,255,.14)}"+
      ".edt-img{cursor:pointer!important;transition:filter .15s}"+
      ".edt-img:hover{filter:brightness(.72)}"+
      "figure:hover .edt-img,.cta__bg .edt-img{outline:2px solid rgba(216,173,91,.7);outline-offset:-2px}"+
      ".editbar{position:fixed;left:0;right:0;bottom:0;z-index:9999;display:flex;align-items:center;justify-content:space-between;gap:1rem;"+
      "padding:.7rem clamp(1rem,4vw,2rem);background:rgba(28,19,11,.98);color:#fff;font-family:'Open Sans',sans-serif;box-shadow:0 -6px 24px rgba(0,0,0,.3)}"+
      ".editbar__l{font-size:.82rem;font-weight:600;display:flex;align-items:center;gap:.5em}"+
      ".editbar__hint{font-weight:400;opacity:.6;font-size:.76rem}"+
      ".editbar__dot{width:9px;height:9px;border-radius:50%;background:#7ec98f;box-shadow:0 0 0 0 rgba(126,201,143,.6);animation:edtp 2s infinite}"+
      "@keyframes edtp{70%{box-shadow:0 0 0 7px rgba(126,201,143,0)}100%{box-shadow:0 0 0 0 rgba(126,201,143,0)}}"+
      ".editbar__r{display:flex;align-items:center;gap:.7rem}"+
      ".editbar__status{font-size:.78rem;font-weight:600}.editbar__status.ok{color:#9fe0ad}.editbar__status.err{color:#f0ad92}"+
      ".editbar__btn{font-family:inherit;font-size:.8rem;font-weight:700;border:0;border-radius:100px;padding:.6em 1.3em;cursor:pointer;text-decoration:none;transition:.2s}"+
      ".editbar__btn.gold{background:#66470a;color:#fff}.editbar__btn.gold:hover{background:#7d5811}.editbar__btn.gold.has-changes{box-shadow:0 0 0 3px rgba(216,173,91,.4)}"+
      ".editbar__btn.ghost{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.35)}.editbar__btn.ghost:hover{background:rgba(255,255,255,.12)}"+
      ".hero__hint,.editbar__hint{display:none}@media(min-width:760px){.editbar__hint{display:inline}}";
    document.head.appendChild(s);
  }
})();

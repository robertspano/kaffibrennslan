/* Kaffibrennslan — sjónrænn ritill (visual inline editor).
   index.html?edit=1 . Vefurinn sjálfur verður ritill: smelltu á texta til að
   breyta, á mynd til að skipta út, og notaðu litlu +/× hnappana til að bæta við
   eða eyða. Vistun+birting krefjast serve.py (localhost). */
(function () {
  "use strict";

  var ICONS = {
    coffee: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4Z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>',
    tea: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11h13a2 2 0 0 1 0 4h-1"/><path d="M4 11v5a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-5Z"/><path d="M8 4c0 1-1 1-1 2s1 1 1 2"/><path d="M12 4c0 1-1 1-1 2s1 1 1 2"/></svg>',
    bar: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22h8"/><path d="M12 11v11"/><path d="M5 3h14l-2 8H7Z"/><path d="M5 3 4 1"/></svg>'
  };
  var ICON_KEYS = ["coffee", "tea", "bar"];
  var DAY_LABELS = [[0, "Su"], [1, "Má"], [2, "Þr"], [3, "Mi"], [4, "Fi"], [5, "Fö"], [6, "La"]];
  var data = null, dirty = false, statusEl = null;
  var isLocal = /^(localhost|127\.0\.0\.1|::1|\[::1\])$/.test(location.hostname) || location.protocol === "file:";
  var LOCAL_URL = "http://localhost:8080/index.html?edit=1";

  function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];}); }
  function setPath(o,p,v){ var ks=p.split("."),last=ks.pop(),t=o; for(var i=0;i<ks.length;i++){ if(t==null)return; t=t[ks[i]]; } if(t) t[last]=v; }
  function ctrl(act,p,label,cls){ return '<button type="button" class="ed-btn '+(cls||"")+'" data-act="'+act+'"'+(p!=null?' data-p="'+p+'"':"")+'>'+label+"</button>"; }

  document.body.classList.add("editing");
  injectStyle();

  fetch("content.json?ts="+Date.now(),{cache:"no-store"})
    .then(function(r){ return r.json(); })
    .then(function(d){ data=d; rerender(); if(isLocal) attachHandlers(); buildBar(); })
    .catch(function(){ buildBar(); });

  function setText(key,val){ if(val==null)return; document.querySelectorAll('[data-cms="'+key+'"]').forEach(function(el){ el.textContent=val; }); }

  function rerender(){
    render(data);
    if(isLocal) enable();
    if(window.KAFFI){ window.KAFFI.initReveal(); window.KAFFI.updateStatus(); }
  }

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
    var html=cats.map(function(c,ci){
      var no=("0"+(ci+1)).slice(-2);
      var items=(c.items||[]).map(function(it,ii){
        var b="menu.categories."+ci+".items."+ii;
        var pop=it.popular?' <span class="pop">Vinsælt</span>':"";
        var ctrls=isLocal?'<span class="ed-rowctrl">'+ctrl("star",ci+"."+ii,it.popular?"★":"☆","ed-star"+(it.popular?" on":""))+ctrl("delitem",ci+"."+ii,"×","ed-x")+"</span>":"";
        return '<li data-reveal><span class="itemname"><span class="name" data-cms="'+b+'.name">'+esc(it.name)+"</span>"+pop+
          '</span><span class="price" data-cms="'+b+'.price">'+esc(it.price)+"</span>"+ctrls+"</li>";
      }).join("");
      var addItem=isLocal?ctrl("additem",ci,"+ atriði","ed-add"):"";
      var catCtrls=isLocal?'<div class="ed-cathead">'+iconSelect(ci,c.icon)+ctrl("delcat",ci,"Eyða flokki","ed-del")+"</div>":"";
      return '<article class="mcard" data-reveal="up">'+catCtrls+
        '<div class="mcard__top"><span class="mcard__no">'+no+'</span><div class="mcard__icon">'+(ICONS[c.icon]||ICONS.coffee)+"</div></div>"+
        '<span class="mcard__tag" data-cms="menu.categories.'+ci+'.tag">'+esc(c.tag)+"</span>"+
        '<h3><span data-cms="menu.categories.'+ci+'.name">'+esc(c.name)+"</span></h3>"+
        '<ul data-stagger="80">'+items+"</ul>"+addItem+"</article>";
    }).join("");
    if(isLocal) html+='<button type="button" class="mcard ed-addcard" data-act="addcat">+ Bæta við flokki</button>';
    grid.innerHTML=html;
  }
  function iconSelect(ci,cur){
    var opts=ICON_KEYS.map(function(k){ return '<option value="'+k+'"'+(k===cur?" selected":"")+">"+({coffee:"☕ Kaffi",tea:"🍵 Te",bar:"🍸 Bar"}[k])+"</option>"; }).join("");
    return '<select class="ed-icon" data-act="icon" data-p="'+ci+'">'+opts+"</select>";
  }

  function renderGallery(images){
    var grid=document.querySelector(".gallery"); if(!grid||!images.length) return;
    var speeds=[0.06,0.14,0.12,0.16,0.1,0.14];
    var html=images.map(function(im,i){
      var cls=i===0?"gi-feat":"";
      var over=isLocal?'<div class="ed-imgctrl">'+(i>0?ctrl("feat",i,"Aðal","ed-mini"):"")+ctrl("delimg",i,"×","ed-x")+"</div>":"";
      return '<figure class="'+cls+'" data-reveal="scale">'+
        '<span class="gimg" data-parallax="'+speeds[i%speeds.length]+'"><img src="'+esc(im.src)+'" alt="'+esc(im.caption||"")+'" data-img="gallery.images.'+i+'.src" /></span>'+
        over+'<figcaption data-cms="gallery.images.'+i+'.caption">'+esc(im.caption||"")+"</figcaption></figure>";
    }).join("");
    if(isLocal) html+='<figure class="ed-addtile" data-act="addimg">+ Bæta við mynd</figure>';
    grid.innerHTML=html;
  }

  function renderHours(hours){
    var wrap=document.querySelector(".hours"); if(!wrap) return;
    wrap.querySelectorAll(".hours__row, .ed-hourctrl, .ed-addhour").forEach(function(r){ r.remove(); });
    var frag=hours.map(function(hh,i){
      var days=isLocal?'<span class="ed-days">'+DAY_LABELS.map(function(d){ var on=(hh.days||[]).indexOf(d[0])!==-1; return '<label class="'+(on?"on":"")+'"><input type="checkbox" data-act="day" data-p="'+i+"."+d[0]+'"'+(on?" checked":"")+">"+d[1]+"</label>"; }).join("")+"</span>":"";
      var del=isLocal?ctrl("delhour",i,"×","ed-x"):"";
      return '<div class="hours__row" data-day="'+(hh.days||[]).join(",")+'">'+
        '<span class="day" data-cms="visit.hours.'+i+'.label">'+esc(hh.label)+"</span>"+
        '<span class="time" data-cms="visit.hours.'+i+'.time">'+esc(hh.time)+"</span>"+days+del+"</div>";
    }).join("");
    var head=wrap.querySelector(".hours__head");
    if(head) head.insertAdjacentHTML("afterend",frag); else wrap.insertAdjacentHTML("beforeend",frag);
    if(isLocal){ var last=wrap.querySelector(".hours__row:last-of-type"); if(last) last.insertAdjacentHTML("afterend",'<button type="button" class="ed-add ed-addhour" data-act="addhour">+ Bæta við línu</button>'); }
  }

  /* ---- inline text + image editing ---- */
  function enable(){
    document.querySelectorAll("[data-cms]").forEach(function(el){
      el.setAttribute("contenteditable","true"); el.classList.add("edt-text"); el.setAttribute("spellcheck","false");
      el.oninput=function(){ if(data){ setPath(data, el.getAttribute("data-cms"), el.textContent); markDirty(); } };
      el.onkeydown=function(e){ if(e.key==="Enter"){ e.preventDefault(); el.blur(); } };
    });
    document.querySelectorAll("[data-img]").forEach(function(img){
      img.classList.add("edt-img");
      img.onclick=function(e){ e.preventDefault(); e.stopPropagation(); replaceImage(img); };
    });
  }

  /* ---- one-time delegated handlers for +/× / toggles ---- */
  function attachHandlers(){
    document.addEventListener("click", function(e){
      var a=e.target.closest("a"); if(a && !e.target.closest(".editbar")){ e.preventDefault(); }
      var b=e.target.closest("[data-act]"); if(!b || b.tagName==="SELECT" || b.tagName==="INPUT") return;
      if(b.closest(".editbar")) return;
      e.preventDefault(); e.stopPropagation();
      act(b.getAttribute("data-act"), b.getAttribute("data-p"));
    }, true);
    document.addEventListener("change", function(e){
      var el=e.target; var a=el.getAttribute && el.getAttribute("data-act"); if(!a) return;
      if(a==="icon"){ setPath(data,"menu.categories."+el.getAttribute("data-p")+".icon", el.value); markDirty(); rerender(); }
      else if(a==="day"){ var pp=el.getAttribute("data-p").split("."); var hi=+pp[0], dv=+pp[1]; var arr=data.visit.hours[hi].days||[]; if(el.checked){ if(arr.indexOf(dv)===-1)arr.push(dv); } else { arr=arr.filter(function(x){return x!==dv;}); } arr.sort(function(x,y){return x-y;}); data.visit.hours[hi].days=arr; markDirty(); rerender(); }
    }, true);
  }

  function act(a, p){
    var m=data.menu, g=data.gallery, v=data.visit;
    if(a==="star"){ var s=p.split("."); m.categories[+s[0]].items[+s[1]].popular=!m.categories[+s[0]].items[+s[1]].popular; }
    else if(a==="delitem"){ var d=p.split("."); m.categories[+d[0]].items.splice(+d[1],1); }
    else if(a==="additem"){ m.categories[+p].items.push({name:"Nýtt atriði",price:"0 kr",popular:false}); }
    else if(a==="delcat"){ if(m.categories.length>1) m.categories.splice(+p,1); else return; }
    else if(a==="addcat"){ m.categories.push({icon:"coffee",tag:"Nýtt",name:"Nýr flokkur",items:[{name:"Atriði",price:"0 kr",popular:false}]}); }
    else if(a==="delimg"){ if(g.images.length>1) g.images.splice(+p,1); else return; }
    else if(a==="feat"){ var im=g.images.splice(+p,1)[0]; g.images.unshift(im); }
    else if(a==="delhour"){ if(v.hours.length>1) v.hours.splice(+p,1); else return; }
    else if(a==="addhour"){ v.hours.push({days:[],label:"Nýir dagar",time:"9:00 – 17:00"}); }
    else if(a==="addimg"){ pickFile(function(f){ uploadImage(f,function(path){ g.images.push({src:path,caption:""}); markDirty(); rerender(); }); }); return; }
    else return;
    markDirty(); rerender();
  }

  function replaceImage(img){
    pickFile(function(file){ uploadImage(file,function(path){ img.src=path+"?t="+Date.now(); var pp=img.getAttribute("data-img"); if(pp){ setPath(data,pp,path); markDirty(); } }); });
  }
  function pickFile(cb){ var i=document.createElement("input"); i.type="file"; i.accept="image/*"; i.onchange=function(){ if(i.files[0]) cb(i.files[0]); }; i.click(); }
  function uploadImage(file, cb){
    if(file.size>11*1024*1024){ setStatus("Mynd of stór (~10MB hámark)","err"); return; }
    var reader=new FileReader();
    reader.onload=function(){
      setStatus("Hleð upp mynd…");
      fetch("/api/upload",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:file.name,data:reader.result})})
        .then(function(r){ return r.json(); })
        .then(function(j){ if(j.ok){ setStatus("Mynd komin ✓","ok"); cb(j.path); } else setStatus("Villa: "+(j.error||""),"err"); })
        .catch(function(){ setStatus("Villa við upphleðslu (er þjónninn í gangi?)","err"); });
    };
    reader.readAsDataURL(file);
  }

  /* ---- toolbar ---- */
  var bar;
  function buildBar(){
    bar=document.createElement("div"); bar.className="editbar";
    if(isLocal){
      bar.innerHTML='<div class="editbar__l"><span class="editbar__dot"></span> Sjónrænn ritill<span class="editbar__hint">— smelltu á texta eða mynd; +/× til að bæta við/eyða</span></div>'+
        '<div class="editbar__r"><span class="editbar__status" id="edtStatus"></span><a class="editbar__btn ghost" href="'+location.pathname+'">Hætta</a><button class="editbar__btn gold" id="edtSave">Vista &amp; birta</button></div>';
      document.body.appendChild(bar);
      statusEl=document.getElementById("edtStatus");
      document.getElementById("edtSave").addEventListener("click", save);
    } else {
      bar.classList.add("view");
      bar.innerHTML='<div class="editbar__l"><span class="editbar__dot amber"></span> Lifandi vefur (skoðun)<span class="editbar__hint">— til að breyta, opnaðu ritilinn heima</span></div>'+
        '<div class="editbar__r"><a class="editbar__btn ghost" href="'+location.pathname+'">Loka</a><a class="editbar__btn gold" href="'+LOCAL_URL+'">Opna ritil heima →</a></div>';
      document.body.appendChild(bar);
    }
  }
  function setStatus(msg,kind){ if(!statusEl)return; statusEl.textContent=msg; statusEl.className="editbar__status "+(kind||""); if(kind==="ok")setTimeout(function(){ if(statusEl.textContent===msg)statusEl.textContent=""; },3500); }
  function markDirty(){ dirty=true; var b=document.getElementById("edtSave"); if(b)b.classList.add("has-changes"); }

  function save(){
    if(!data){ setStatus("Ekkert efni","err"); return; }
    setStatus("Vista & birti…");
    fetch("/api/save",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:data})})
      .then(function(r){ return r.json(); })
      .then(function(j){ if(j.ok){ setStatus("Vistað ✓ — birtist á vefnum eftir ~1 mín","ok"); dirty=false; var b=document.getElementById("edtSave"); if(b)b.classList.remove("has-changes"); } else setStatus("Villa: "+(j.error||""),"err"); })
      .catch(function(){ setStatus("Villa — er serve.py í gangi?","err"); });
  }

  window.addEventListener("beforeunload", function(e){ if(dirty){ e.preventDefault(); e.returnValue=""; } });

  function injectStyle(){
    var s=document.createElement("style");
    s.textContent=
      "body.editing [data-reveal]{opacity:1!important;transform:none!important}"+
      "body.editing [data-parallax]{transform:none!important}"+
      "body.editing .mcard h3>span{transform:none!important}"+
      "body.editing{padding-bottom:70px}"+
      ".edt-text{outline:1px dashed rgba(102,71,10,.35);outline-offset:3px;border-radius:3px;transition:background .15s,outline-color .15s;cursor:text}"+
      ".edt-text:hover{outline-color:var(--gold,#66470a);background:rgba(216,173,91,.14)}"+
      ".edt-text:focus{outline:2px solid var(--gold,#66470a);background:rgba(216,173,91,.18)}"+
      ".hero .edt-text:hover,.cta .edt-text:hover{background:rgba(255,255,255,.14)}"+
      ".edt-img{cursor:pointer!important;transition:filter .15s}.edt-img:hover{filter:brightness(.72)}"+
      "figure:hover .edt-img,.cta__bg .edt-img{outline:2px solid rgba(216,173,91,.7);outline-offset:-2px}"+
      /* controls */
      ".ed-btn{font-family:'Open Sans',sans-serif;cursor:pointer;border:0;border-radius:100px;font-weight:700;line-height:1}"+
      ".ed-x{width:22px;height:22px;background:#f3ddd2;color:#b5532f;font-size:.95rem}"+
      ".ed-x:hover{background:#e9c7b7}"+
      ".ed-star{width:24px;height:22px;background:rgba(216,173,91,.18);color:#9a7420;font-size:.85rem}.ed-star.on{background:var(--gold,#66470a);color:#fff}"+
      ".ed-mini{padding:.15em .6em;font-size:.6rem;background:rgba(0,0,0,.6);color:#fff;letter-spacing:.06em;text-transform:uppercase}"+
      ".ed-del{padding:.3em .8em;font-size:.62rem;background:transparent;border:1px dashed #d9b6a6!important;color:#b5532f;text-transform:uppercase;letter-spacing:.08em}"+
      ".ed-add{display:inline-block;margin-top:.7rem;padding:.5em 1.1em;font-size:.72rem;font-weight:700;background:transparent;border:1px dashed rgba(102,71,10,.4);border-radius:100px;color:var(--gold,#66470a);cursor:pointer;font-family:'Open Sans',sans-serif}"+
      ".ed-add:hover{background:rgba(102,71,10,.06);border-color:var(--gold,#66470a)}"+
      ".mcard li{position:relative}.ed-rowctrl{display:inline-flex;gap:4px;margin-left:8px;vertical-align:middle}"+
      ".ed-cathead{display:flex;justify-content:space-between;align-items:center;gap:.5rem;margin-bottom:.9rem}"+
      ".ed-icon{font-family:'Open Sans',sans-serif;font-size:.75rem;padding:.3em .5em;border-radius:8px;border:1px solid rgba(102,71,10,.25);background:#fff;color:var(--coffee,#492e1e)}"+
      ".ed-addcard{display:flex!important;align-items:center;justify-content:center;min-height:180px;border:2px dashed rgba(102,71,10,.3)!important;background:transparent!important;color:var(--gold,#66470a);font-family:'Open Sans',sans-serif;font-weight:700;font-size:.95rem;cursor:pointer;border-radius:16px}"+
      ".ed-addcard:hover{background:rgba(102,71,10,.05)!important;box-shadow:none!important;transform:none!important}"+
      ".ed-imgctrl{position:absolute;top:8px;right:8px;z-index:4;display:flex;gap:5px}"+
      ".ed-addtile{display:flex!important;align-items:center;justify-content:center;border:2px dashed rgba(102,71,10,.35);color:var(--gold,#66470a);font-family:'Open Sans',sans-serif;font-weight:700;cursor:pointer;background:transparent;box-shadow:none;border-radius:14px}"+
      ".ed-addtile:hover{background:rgba(102,71,10,.05)}"+
      ".ed-days{display:inline-flex;gap:3px;margin-left:10px;vertical-align:middle}"+
      ".ed-days label{display:inline-flex;align-items:center;justify-content:center;width:22px;height:20px;font-size:.58rem;border-radius:5px;background:rgba(102,71,10,.09);color:var(--muted,#666);cursor:pointer;font-weight:600}"+
      ".ed-days label.on{background:var(--gold,#66470a);color:#fff}.ed-days input{display:none}"+
      ".ed-addhour{margin-top:.6rem}"+
      /* toolbar */
      ".editbar{position:fixed;left:0;right:0;bottom:0;z-index:9999;display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.7rem clamp(1rem,4vw,2rem);background:rgba(28,19,11,.98);color:#fff;font-family:'Open Sans',sans-serif;box-shadow:0 -6px 24px rgba(0,0,0,.3)}"+
      ".editbar__l{font-size:.82rem;font-weight:600;display:flex;align-items:center;gap:.5em}"+
      ".editbar__hint{font-weight:400;opacity:.6;font-size:.76rem}"+
      ".editbar__dot{width:9px;height:9px;border-radius:50%;background:#7ec98f;box-shadow:0 0 0 0 rgba(126,201,143,.6);animation:edtp 2s infinite}"+
      ".editbar__dot.amber{background:#e0a03a;animation:none;box-shadow:none}"+
      "@keyframes edtp{70%{box-shadow:0 0 0 7px rgba(126,201,143,0)}100%{box-shadow:0 0 0 0 rgba(126,201,143,0)}}"+
      ".editbar__r{display:flex;align-items:center;gap:.7rem}"+
      ".editbar__status{font-size:.78rem;font-weight:600}.editbar__status.ok{color:#9fe0ad}.editbar__status.err{color:#f0ad92}"+
      ".editbar__btn{font-family:inherit;font-size:.8rem;font-weight:700;border:0;border-radius:100px;padding:.6em 1.3em;cursor:pointer;text-decoration:none;transition:.2s}"+
      ".editbar__btn.gold{background:#66470a;color:#fff}.editbar__btn.gold:hover{background:#7d5811}.editbar__btn.gold.has-changes{box-shadow:0 0 0 3px rgba(216,173,91,.4)}"+
      ".editbar__btn.ghost{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.35)}.editbar__btn.ghost:hover{background:rgba(255,255,255,.12)}"+
      "@media(max-width:760px){.editbar__hint{display:none}}";
    document.head.appendChild(s);
  }
})();

/* ===== Executive Overview — section logic =====
   Reads window.MOS (defined by the dashboard shell). Quarterly data only,
   so every date range snaps to whole calendar quarters. Listeners are bound
   directly to elements inside #p-exec-overview (no document-level handlers). */
(function(){
  var root = document.getElementById('p-exec-overview');
  if(!root) return;
  var body = root.querySelector('#eo-body');
  var MOS = window.MOS;

  if(!MOS || !MOS.qtr || !MOS.qtr.length){
    body.innerHTML = '<div class="eo-notice">The Math of Sales data isn\u2019t loaded yet, so the executive summary can\u2019t be built. Open the <strong>Math of Sales</strong> tab once, then return here.</div>';
    return;
  }

  /* ---- parse quarters into date bounds (calendar quarters) ---- */
  var QT = MOS.qtr.slice();
  function parseQ(p){
    var m = String(p).match(/Q([1-4])\s+(\d{4})/);
    var q = +m[1], y = +m[2];
    return { q:q, y:y, start:new Date(y,(q-1)*3,1), end:new Date(y,(q-1)*3+3,0) };
  }
  QT.forEach(function(r){ var d=parseQ(r.period); r._q=d.q; r._y=d.y; r._start=d.start; r._end=d.end; });

  /* ---- aggregation + derived rates ---- */
  var SUMKEYS = ['leads','dials','emails','connections','meetings','opps','pipeline','partner_signs'];
  function agg(rows){
    var s={}; SUMKEYS.forEach(function(k){ s[k]=0; });
    rows.forEach(function(r){ SUMKEYS.forEach(function(k){ s[k]+=(+r[k]||0); }); });
    s.avg_opp = s.opps ? s.pipeline/s.opps : 0;
    s.conv    = s.meetings ? (s.opps/s.meetings*100) : 0;   // meeting -> opp
    s.conn    = s.dials ? (s.connections/s.dials*100) : 0;  // dial -> connection
    return s;
  }

  /* ---- window selection ---- */
  var PRESETS = { '30d':1, 'quarter':1, '6m':2, '9m':3, 'year':4 };
  function lastN(n){ return QT.slice(Math.max(0,QT.length-n)); }
  function priorN(n){ var e=QT.length-n; return QT.slice(Math.max(0,e-n), Math.max(0,e)); }
  function customRange(start,end){
    var inc = QT.filter(function(r){ return r._end>=start && r._start<=end; });
    if(!inc.length) return {cur:[],prior:[]};
    var first = QT.indexOf(inc[0]), n = inc.length;
    return { cur:inc, prior:QT.slice(Math.max(0,first-n), first) };
  }
  var state = { preset:'year', start:null, end:null };
  function getWindows(){
    if(state.preset==='custom' && state.start && state.end) return customRange(state.start, state.end);
    var n = PRESETS[state.preset]||4;
    return { cur:lastN(n), prior:priorN(n) };
  }

  /* ---- metric catalogue (all "higher is better") ---- */
  var METRICS = [
    { key:'pipeline', label:'Pipeline generated',     fmt:'money', noun:'pipeline' },
    { key:'opps',     label:'Opportunities created',  fmt:'int',   noun:'opportunities' },
    { key:'meetings', label:'Meetings booked',        fmt:'int',   noun:'meetings' },
    { key:'avg_opp',  label:'Avg opportunity value',  fmt:'money', noun:'average deal size' },
    { key:'conv',     label:'Meeting\u2192opp conversion', fmt:'pct', noun:'conversion' },
    { key:'leads',    label:'Leads (top of funnel)',  fmt:'int',   noun:'lead volume' },
    { key:'conn',     label:'Connection rate',        fmt:'pct',   noun:'connect rate' }
  ];

  /* ---- formatting ---- */
  function money(v){ if(Math.abs(v)>=1e6) return '$'+(v/1e6).toFixed(2)+'M'; if(Math.abs(v)>=1e3) return '$'+(v/1e3).toFixed(1)+'K'; return '$'+Math.round(v); }
  function intf(v){ return Math.round(v).toLocaleString(); }
  function pctf(v){ return v.toFixed(1)+'%'; }
  function fmt(v,t){ return t==='money'?money(v):t==='pct'?pctf(v):intf(v); }
  function chg(cur,prior){ if(!isFinite(prior)||prior===0) return null; return (cur-prior)/Math.abs(prior)*100; }
  function chgTxt(c){ return (c>0?'+':'')+c.toFixed(1)+'%'; }
  var TH = 3; // +/- 3% = notable

  function esc(s){ return String(s).replace(/[&<>]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;'}[c];}); }
  function rangeLabel(rows){
    if(!rows.length) return '\u2014';
    return rows.length===1 ? rows[0].period : rows[0].period+' \u2013 '+rows[rows.length-1].period;
  }

  /* ---- mini bar chart (inline SVG, no deps) ---- */
  function sparkBars(rows){
    if(!rows.length) return '';
    var W=720, H=150, padL=8, padR=8, padT=14, padB=26;
    var n=rows.length, gap=10;
    var bw=(W-padL-padR-gap*(n-1))/n;
    var max=Math.max.apply(null, rows.map(function(r){return +r.pipeline||0;})) || 1;
    var bars='', i;
    for(i=0;i<n;i++){
      var v=+rows[i].pipeline||0;
      var h=Math.max(2,(v/max)*(H-padT-padB));
      var x=padL+i*(bw+gap), y=H-padB-h;
      var is26 = rows[i].period.indexOf('2026')>-1;
      bars += '<rect class="eo-bar" x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+h.toFixed(1)+'" rx="3" fill="'+(is26?'var(--eo-blue)':'rgba(30,136,229,0.45)')+'"></rect>';
      bars += '<text class="eo-bar-val" x="'+(x+bw/2).toFixed(1)+'" y="'+(y-5).toFixed(1)+'" text-anchor="middle">$'+(v/1e6).toFixed(1)+'M</text>';
      bars += '<text class="eo-bar-lbl" x="'+(x+bw/2).toFixed(1)+'" y="'+(H-9)+'" text-anchor="middle">'+esc(rows[i].period)+'</text>';
    }
    return '<svg class="eo-svg" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet">'+bars+'</svg>';
  }

  var ICO_UP   = '<svg class="eo-item-ico" viewBox="0 0 24 24" fill="none" stroke="#1f9d55" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>';
  var ICO_DOWN = '<svg class="eo-item-ico" viewBox="0 0 24 24" fill="none" stroke="#d12b5e" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7l10 10M17 9v8H9"/></svg>';

  /* ---- render ---- */
  function render(){
    var w=getWindows(), cur=agg(w.cur), prior=agg(w.prior), hasPrior=w.prior.length>0;

    /* compute metric rows */
    var rows = METRICS.map(function(m){
      var cv=cur[m.key], pv=prior[m.key], c=hasPrior?chg(cv,pv):null;
      return { m:m, cur:cv, prior:pv, c:c };
    });

    /* window summary */
    var lenTxt = w.cur.length+(w.cur.length===1?' quarter':' quarters');
    var html = '';
    html += '<div class="eo-window">'
          +   '<span class="eo-window-main">Window: '+esc(rangeLabel(w.cur))+'</span>'
          +   '<span class="eo-window-sub">'+lenTxt
          +     (hasPrior ? ' \u00b7 vs prior '+esc(rangeLabel(w.prior)) : ' \u00b7 no prior period to compare')
          +   '</span>'
          + '</div>';
    var snap = (state.preset==='30d') ? 'Daily data isn\u2019t tracked \u2014 \u201cLast 30 days\u201d resolves to the most recent quarter.'
             : (state.preset==='custom') ? 'Custom range snapped to the quarters it overlaps.'
             : 'Range snapped to whole quarters.';
    html += '<div class="eo-snap-note">'+snap+'</div>';

    /* narrative */
    html += buildNarrative(rows, cur, hasPrior, w);

    /* KPI cards (first 5 headline metrics) */
    html += '<div class="eo-kpis">';
    rows.slice(0,5).forEach(function(r){
      var cls = r.c===null?'flat':(r.c>=TH?'up':(r.c<=-TH?'down':'flat'));
      var ar  = r.c===null?'\u00b7':(r.c>0.5?'\u25b2':(r.c<-0.5?'\u25bc':'\u2014'));
      html += '<div class="eo-kpi">'
            +   '<div class="eo-kpi-lbl">'+esc(r.m.label)+'</div>'
            +   '<div class="eo-kpi-val">'+fmt(r.cur,r.m.fmt)+'</div>'
            +   '<div class="eo-kpi-delta '+cls+'">'+ar+' '+(r.c===null?'no prior':chgTxt(r.c))+'</div>'
            + '</div>';
    });
    html += '</div>';

    /* panels: trends / positives / negatives */
    html += '<div class="eo-panels">';

    // trends
    html += '<div class="eo-panel trend"><h3>Key Trends</h3>';
    rows.forEach(function(r){
      var cls = r.c===null?'eo-flat':(r.c>=TH?'eo-up':(r.c<=-TH?'eo-down':'eo-flat'));
      var ar  = r.c===null?'':(r.c>0.5?'\u25b2':(r.c<-0.5?'\u25bc':'\u2014'));
      html += '<div class="eo-trow">'
            +   '<span class="eo-trow-lbl">'+esc(r.m.label)+'</span>'
            +   '<span class="eo-trow-val">'+fmt(r.cur,r.m.fmt)+'</span>'
            +   '<span class="eo-trow-chg '+cls+'">'+ar+' '+(r.c===null?'\u2014':chgTxt(r.c))+'</span>'
            + '</div>';
    });
    html += '</div>';

    var pos = rows.filter(function(r){ return r.c!==null && r.c>=TH; }).sort(function(a,b){return b.c-a.c;});
    var neg = rows.filter(function(r){ return r.c!==null && r.c<=-TH; }).sort(function(a,b){return a.c-b.c;});

    // positives
    html += '<div class="eo-panel pos"><h3>What\u2019s Working</h3>';
    if(!hasPrior){ html += '<p class="eo-empty">No prior period available to compare against.</p>'; }
    else if(!pos.length){ html += '<p class="eo-empty">Nothing moved up by more than '+TH+'% this window.</p>'; }
    else pos.forEach(function(r){
      html += '<div class="eo-item">'+ICO_UP+'<span class="eo-item-txt"><b>'+esc(r.m.label)+'</b> rose <b>'+chgTxt(r.c)+'</b> to '+fmt(r.cur,r.m.fmt)+'.</span></div>';
    });
    html += '</div>';

    // negatives
    html += '<div class="eo-panel neg"><h3>Needs Attention</h3>';
    if(!hasPrior){ html += '<p class="eo-empty">No prior period available to compare against.</p>'; }
    else if(!neg.length){ html += '<p class="eo-empty">No metric declined by more than '+TH+'% this window.</p>'; }
    else neg.forEach(function(r){
      html += '<div class="eo-item">'+ICO_DOWN+'<span class="eo-item-txt"><b>'+esc(r.m.label)+'</b> fell <b>'+chgTxt(r.c)+'</b> to '+fmt(r.cur,r.m.fmt)+'.</span></div>';
    });
    html += '</div>';

    html += '</div>'; // /panels

    /* pipeline-by-quarter chart for the window */
    html += '<div class="eo-chart-card">'
          +   '<div class="eo-chart-head"><span class="eo-chart-title">Pipeline by quarter</span>'
          +     '<span class="eo-chart-sub">'+esc(rangeLabel(w.cur))+' \u00b7 2026 quarters highlighted</span></div>'
          +   sparkBars(w.cur)
          + '</div>';

    body.innerHTML = html;
  }

  function buildNarrative(rows, cur, hasPrior, w){
    var byKey={}; rows.forEach(function(r){ byKey[r.m.key]=r; });
    var p=[];
    if(!hasPrior){
      p.push('Showing <strong>'+esc(rangeLabel(w.cur))+'</strong>. There isn\u2019t an equal prior period in the data, so trend comparisons are unavailable for this window.');
    } else {
      var pl=byKey.pipeline, cv=byKey.conv;
      var dir = pl.c>=0?'rose':'fell';
      p.push('Across <strong>'+esc(rangeLabel(w.cur))+'</strong>, the ADR org generated <strong>'+money(cur.pipeline)+'</strong> in pipeline from <strong>'+intf(cur.opps)+'</strong> opportunities and <strong>'+intf(cur.meetings)+'</strong> meetings \u2014 pipeline '+dir+' <strong>'+chgTxt(pl.c)+'</strong> versus the prior '+(w.cur.length===1?'quarter':w.cur.length+' quarters')+'.');
      var convDir = cv.c>=0?'improved to':'slipped to';
      p.push('Meeting\u2192opp conversion '+convDir+' <strong>'+pctf(cur.conv)+'</strong>, with average deal size at <strong>'+money(cur.avg_opp)+'</strong>.');
      var neg = rows.filter(function(r){return r.c!==null && r.c<=-TH;}).sort(function(a,b){return a.c-b.c;});
      if(neg.length){
        p.push('Watch: <strong>'+esc(neg[0].m.noun)+'</strong> is down <strong>'+chgTxt(neg[0].c)+'</strong>'+(neg.length>1?', alongside '+esc(neg[1].m.noun):'')+'.');
      }
    }
    return '<div class="eo-narrative">'+p.map(function(s){return '<p>'+s+'</p>';}).join('')+'</div>';
  }

  /* ---- wire controls (direct element listeners) ---- */
  var presetBtns = root.querySelectorAll('[data-eo-preset]');
  var customBox  = root.querySelector('#eo-custom');
  presetBtns.forEach(function(b){
    b.addEventListener('click', function(){
      state.preset = b.getAttribute('data-eo-preset');
      presetBtns.forEach(function(x){ x.classList.toggle('on', x===b); });
      if(customBox) customBox.classList.toggle('show', state.preset==='custom');
      if(state.preset!=='custom') render();
    });
  });
  // drill-down to the full Math of Sales section (guarded — degrades silently if the
  // shell ever renames showMainTab or the parent tab isn't present)
  var toParent = root.querySelector('#eo-toparent');
  if(toParent) toParent.addEventListener('click', function(e){
    e.preventDefault();
    if(typeof window.showMainTab === 'function'){
      var navBtn = document.querySelector('.nav-item[data-nav="mathofsales"]');
      window.showMainTab('mathofsales', navBtn || null);
    }
  });

  var apply = root.querySelector('#eo-apply');
  if(apply) apply.addEventListener('click', function(){
    var s=root.querySelector('#eo-start').value, e=root.querySelector('#eo-end').value;
    if(!s||!e) return;
    var sd=new Date(s+'T00:00:00'), ed=new Date(e+'T00:00:00');
    if(ed<sd){ var t=sd; sd=ed; ed=t; }
    state.start=sd; state.end=ed; render();
  });

  render();
})();

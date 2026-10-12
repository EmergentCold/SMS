(function(){
'use strict';

/* ============================================================
   DADOS SALVOS (somente neste navegador / aparelho)
   ============================================================ */
var KEY = 'ec_galpao_seguro_v1';
var DB;
function load(){
  try { DB = JSON.parse(localStorage.getItem(KEY)); } catch (e) { DB = null; }
  if (!DB || typeof DB !== 'object' || !DB.players) DB = { players:{}, atual:null, som:true };
}
function save(){
  try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) { toast('Atenção: este navegador não permitiu salvar o progresso.'); }
}
load();

var LOGO = 'data:image/jpeg;base64,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';
var DEBUG = /debug/.test(location.search);
var ADM = window.GS_MODO === 'adm'; // jogos-admin.html = administração; jogos.html = só jogar
var app = document.getElementById('app');
var M = document.getElementById('modal'), MB = document.getElementById('mbox');
var TIMERS = [], CLEAN = [];
function clearAll(){ TIMERS.forEach(function(t){ clearInterval(t); clearTimeout(t); }); TIMERS = []; CLEAN.forEach(function(f){ try{ f(); }catch(e){} }); CLEAN = []; closeModal(); }

function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function shuffle(a){ for (var i = a.length - 1; i > 0; i--){ var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function fmt(n){ return Math.round(n).toLocaleString('pt-BR'); }
function hoje(){ return new Date().toISOString(); }
function dataBR(iso){ if (!iso) return '—'; var d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); }
function iniciais(n){ var p = String(n).trim().split(/\s+/); return ((p[0]||'')[0] || '' ) .toUpperCase() + ((p.length > 1 ? p[p.length-1][0] : '') || '').toUpperCase(); }
var tt;
function alertaAmigo(mini){
  if (mini) return '<div class="alerta-amigo mini"><span class="mg">📣</span><div>Viu esse desvio no dia a dia? <b>Relate no Alerta Amigo!</b></div></div>';
  return '<div class="alerta-amigo"><span class="mg">📣</span><div><b class="t">Viu um desvio? Relate no ALERTA AMIGO!</b>Qualquer desvio — condição insegura, comportamento inseguro ou quase acidente — deve ser relatado no <b>Alerta Amigo</b>. Relatar é cuidar de você e dos seus colegas.</div></div>';
}
function toast(t){ var el = document.getElementById('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(tt); tt = setTimeout(function(){ el.classList.remove('on'); }, 2600); }
function modal(html){ MB.innerHTML = html; M.classList.remove('hidden'); return MB; }
function closeModal(){ M.classList.add('hidden'); MB.innerHTML = ''; }

/* ---------- som ---------- */
var AC = null;
function beep(f, d, type, vol){
  if (!DB.som) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    var o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime;
    o.type = type || 'sine'; o.frequency.value = f; o.connect(g); g.connect(AC.destination);
    g.gain.setValueAtTime(vol || 0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.start(t); o.stop(t + d + 0.02);
  } catch (e) {}
}
var SND = {
  ok: function(){ beep(660,.12); setTimeout(function(){ beep(880,.2); }, 110); },
  bad: function(){ beep(190,.3,'sawtooth',.05); },
  click: function(){ beep(520,.05,'sine',.05); },
  hit: function(){ beep(110,.45,'square',.06); },
  win: function(){ [523,659,784,1046].forEach(function(f,i){ setTimeout(function(){ beep(f,.22); }, i*130); }); }
};
function updSom(){ document.getElementById('btnSom').textContent = DB.som ? '🔊' : '🔇'; }
updSom();

/* ---------- confete ---------- */
function confete(){
  var cv = document.getElementById('confetti'), cx = cv.getContext('2d');
  cv.width = innerWidth; cv.height = innerHeight;
  var cores = ['#f5b700','#2E8B57','#1A2540','#e67e22','#3b82f6','#c0392b'], P = [];
  for (var i = 0; i < 150; i++) P.push({ x: Math.random()*cv.width, y: -20 - Math.random()*cv.height*0.5, vx: (Math.random()-.5)*3, vy: 2+Math.random()*4, r: Math.random()*6.28, vr:(Math.random()-.5)*.3, c: cores[i%cores.length], w: 6+Math.random()*6 });
  var t0 = performance.now();
  (function fr(t){
    cx.clearRect(0,0,cv.width,cv.height);
    P.forEach(function(p){ p.x += p.vx; p.y += p.vy; p.r += p.vr; cx.save(); cx.translate(p.x,p.y); cx.rotate(p.r); cx.fillStyle = p.c; cx.fillRect(-p.w/2,-3,p.w,6); cx.restore(); });
    if (t - t0 < 3200) requestAnimationFrame(fr); else cx.clearRect(0,0,cv.width,cv.height);
  })(t0);
}

/* ============================================================
   DESENHOS (SVG) — galpão, pessoas, equipamentos
   ============================================================ */
var F = 470; // linha do piso
var R = function(n){ return Math.round(n*10)/10; };
function rad(a){ return a * Math.PI / 180; }
function seg(p, len, a){ return [p[0] + len*Math.sin(rad(a)), p[1] + len*Math.cos(rad(a))]; }
function pts(arr){ return arr.map(function(p){ return R(p[0]) + ',' + R(p[1]); }).join(' '); }
function txt(x, y, t, sz, cor, o){ o = o || {}; return '<text x="'+x+'" y="'+y+'" text-anchor="'+(o.a||'middle')+'" font-size="'+sz+'" font-weight="'+(o.w||800)+'" fill="'+cor+'" font-family="Arial, Helvetica, sans-serif"'+(o.extra||'')+'>'+t+'</text>'; }

function defs(){
  return '<defs>' +
    '<linearGradient id="gw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef2f7"/><stop offset="1" stop-color="#d5dde7"/></linearGradient>' +
    '<linearGradient id="gf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#aab3bd"/><stop offset="1" stop-color="#8f99a4"/></linearGradient>' +
    '<linearGradient id="gsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ec5f0"/><stop offset="1" stop-color="#dff0fb"/></linearGradient>' +
    '<linearGradient id="gmir" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f7fb"/><stop offset="1" stop-color="#9fb0c3"/></linearGradient>' +
    '<pattern id="furos" width="12" height="14" patternUnits="userSpaceOnUse"><rect x="4" y="3" width="4" height="7" rx="1" fill="#8fb0e0"/></pattern>' +
    '<pattern id="zebra" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="16" fill="#f5c400"/><rect x="8" width="8" height="16" fill="#1f2937"/></pattern>' +
    '</defs>';
}
function bg(o){
  o = o || {};
  var s = defs() + '<rect width="1000" height="'+F+'" fill="url(#gw)"/>';
  for (var x = 0; x <= 1000; x += 125) s += '<line x1="'+x+'" y1="30" x2="'+x+'" y2="'+F+'" stroke="#cad4df" stroke-width="2"/>';
  s += '<rect width="1000" height="30" fill="#7d8b9c"/>';
  for (x = 0; x < 1000; x += 50) s += '<line x1="'+x+'" y1="0" x2="'+(x+50)+'" y2="30" stroke="#687587" stroke-width="2"/>';
  for (x = 90; x < 1000; x += 270) s += '<polygon points="'+x+',38 '+(x+80)+',38 '+(x+150)+','+F+' '+(x-70)+','+F+'" fill="#fff6c8" opacity=".16"/><rect x="'+x+'" y="30" width="80" height="8" rx="3" fill="#fffbe6" stroke="#c8c19a"/>';
  s += '<rect y="'+(F-14)+'" width="1000" height="14" fill="#b9c3ce"/>';
  s += '<rect y="'+F+'" width="1000" height="'+(560-F)+'" fill="url(#gf)"/>';
  if (o.faixa){
    s += '<rect x="0" y="497" width="1000" height="46" fill="#2f9e5f"/><rect y="493" width="1000" height="4" fill="#f5c400"/><rect y="543" width="1000" height="4" fill="#f5c400"/>';
    for (x = 30; x < 1000; x += 120) s += pegada(x, 520);
  }
  if (o.linha) s += '<rect y="486" width="1000" height="6" fill="#f5c400"/><rect y="548" width="1000" height="6" fill="#f5c400"/>';
  return s;
}
function pegada(x, y){ return '<g fill="#fff" opacity=".5"><ellipse cx="'+x+'" cy="'+(y-7)+'" rx="9" ry="4"/><ellipse cx="'+(x+22)+'" cy="'+(y+6)+'" rx="9" ry="4"/></g>'; }

/* pessoa articulada: x,y = ponto no chão (pés) */
var POSES = {
  stand: { hip:[0,-52], t:0,  legs:[[4,2],[-4,-2]],     arms:[[10,4],[-10,-4]] },
  walk:  { hip:[0,-50], t:4,  legs:[[22,8],[-20,-12]],  arms:[[-22,-8],[26,44]] },
  run:   { hip:[0,-45], t:16, legs:[[40,10],[-30,-80]], arms:[[55,110],[-45,-10]] },
  bend:  { hip:[0,-52], t:82, legs:[[3,2],[-3,-2]],     arms:[[2,0],[-4,-2]] },
  squat: { hip:[-6,-24], t:12, legs:[[95,8],[92,4]],    arms:[[40,30],[46,36]] },
  climb: { hip:[0,-52], t:0,  legs:[[70,-20],[0,0]],    arms:[[172,178],[160,172]] },
  reach: { hip:[0,-52], t:-4, legs:[[4,2],[-4,-2]],     arms:[[176,182],[166,174]] },
  jump:  { hip:[0,-46], t:12, legs:[[60,-20],[38,-36]], arms:[[140,160],[-140,-160]] },
  throwp:{ hip:[0,-52], t:-12,legs:[[16,6],[-16,-6]],   arms:[[205,225],[40,25]] },
  ride:  { hip:[0,-52], t:2,  legs:[[10,4],[-10,-4]],   arms:[[100,96],[-100,-96]] },
  crouch:{ hip:[0,-38], t:52, legs:[[55,-5],[-30,-50]], arms:[[30,20],[-10,-10]] },
  lean:  { hip:[0,-52], t:46, legs:[[4,2],[-4,-2]],     arms:[[115,125],[70,80]] },
  push:  { hip:[0,-50], t:10, legs:[[20,8],[-18,-10]],  arms:[[68,80],[60,74]] },
  hold:  { hip:[0,-52], t:2,  legs:[[4,2],[-4,-2]],     arms:[[40,95],[30,85]] },
  smoke: { hip:[0,-52], t:0,  legs:[[4,2],[-4,-2]],     arms:[[30,170],[-10,-4]] },
  phone: { hip:[0,-50], t:6,  legs:[[22,8],[-20,-12]],  arms:[[30,160],[-26,-40]] }
};
function P(x, y, o){
  o = o || {};
  var po = POSES[o.pose || 'stand'], sc = o.s || 1;
  var shirt = o.shirt || '#4a7bd0', pants = o.pants || '#2f3b52', skin = o.skin || '#d9a066', hair = o.hair || '#3b2a1f';
  var hip = po.hip.slice(), tA = po.t;
  var top = [hip[0] + 50*Math.sin(rad(tA)), hip[1] - 50*Math.cos(rad(tA))];
  var sh = [hip[0] + 44*Math.sin(rad(tA)), hip[1] - 44*Math.cos(rad(tA))];
  var head = [hip[0] + 64*Math.sin(rad(tA)), hip[1] - 64*Math.cos(rad(tA))];
  function leg(a){ var k = seg(hip, 26, a[0]); return [hip, k, seg(k, 26, a[1])]; }
  function arm(a){ var e = seg(sh, 22, a[0]); return [sh, e, seg(e, 21, a[1])]; }
  var L1 = leg(po.legs[0]), L2 = leg(po.legs[1]), A1 = arm(po.arms[0]), A2 = arm(po.arms[1]);
  var hand = o.luva ? '#5b6b7f' : skin;
  var s = '<g transform="translate('+x+','+y+') scale('+(o.flip ? -sc : sc)+','+sc+')">';
  s += '<ellipse cx="0" cy="2" rx="22" ry="4" fill="#000" opacity=".14"/>';
  if (o.pose === 'run') s += '<g stroke="#5b6b7f" stroke-width="4" stroke-linecap="round" opacity=".6"><line x1="-60" y1="-90" x2="-30" y2="-90"/><line x1="-70" y1="-70" x2="-34" y2="-70"/><line x1="-58" y1="-50" x2="-32" y2="-50"/></g>';
  // perna e braço de trás
  s += '<polyline points="'+pts(L2)+'" fill="none" stroke="'+pants+'" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>';
  s += '<circle cx="'+R(L2[2][0]+3)+'" cy="'+R(L2[2][1]-2)+'" r="6" fill="#2b1d12"/>';
  s += '<polyline points="'+pts(A2)+'" fill="none" stroke="'+shirt+'" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>';
  s += '<circle cx="'+R(A2[2][0])+'" cy="'+R(A2[2][1])+'" r="4.5" fill="'+hand+'"/>';
  // tronco
  s += '<line x1="'+R(hip[0])+'" y1="'+R(hip[1])+'" x2="'+R(top[0])+'" y2="'+R(top[1])+'" stroke="'+shirt+'" stroke-width="24" stroke-linecap="round"/>';
  if (o.colete){
    var v1 = [hip[0] + 6*Math.sin(rad(tA)), hip[1] - 6*Math.cos(rad(tA))];
    s += '<line x1="'+R(v1[0])+'" y1="'+R(v1[1])+'" x2="'+R(sh[0])+'" y2="'+R(sh[1])+'" stroke="#ff8a00" stroke-width="25" stroke-linecap="round"/>';
    [0.42, 0.7].forEach(function(f){
      var c = [hip[0] + 50*f*Math.sin(rad(tA)), hip[1] - 50*f*Math.cos(rad(tA))], dx = 12*Math.cos(rad(tA)), dy = 12*Math.sin(rad(tA));
      s += '<line x1="'+R(c[0]-dx)+'" y1="'+R(c[1]-dy)+'" x2="'+R(c[0]+dx)+'" y2="'+R(c[1]+dy)+'" stroke="#e5e7eb" stroke-width="4"/>';
    });
  }
  // perna da frente
  s += '<polyline points="'+pts(L1)+'" fill="none" stroke="'+pants+'" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>';
  s += '<circle cx="'+R(L1[2][0]+3)+'" cy="'+R(L1[2][1]-2)+'" r="6" fill="#2b1d12"/>';
  // cabeça
  s += '<circle cx="'+R(head[0])+'" cy="'+R(head[1])+'" r="12.5" fill="'+skin+'"/>';
  s += '<path d="M'+R(head[0]-12.5)+','+R(head[1]-1)+' A12.5 12.5 0 0 1 '+R(head[0]+11)+','+R(head[1]-6)+' L'+R(head[0]-4)+','+R(head[1]-4)+' Z" fill="'+hair+'"/>';
  s += '<circle cx="'+R(head[0]+6)+'" cy="'+R(head[1]-1)+'" r="1.8" fill="#1f2937"/>';
  if (o.capacete) s += '<path d="M'+R(head[0]-14)+','+R(head[1]-3)+' A14 14 0 0 1 '+R(head[0]+14)+','+R(head[1]-3)+' Z" fill="'+o.capacete+'"/><rect x="'+R(head[0]-15)+'" y="'+R(head[1]-4)+'" width="34" height="4" rx="2" fill="'+o.capacete+'"/>';
  if (o.fone) s += '<path d="M'+R(head[0]-13)+','+R(head[1])+' A13 13 0 0 1 '+R(head[0]+13)+','+R(head[1])+'" fill="none" stroke="#111" stroke-width="3"/><circle cx="'+R(head[0]+1)+'" cy="'+R(head[1]+2)+'" r="5" fill="#111"/>';
  // braço da frente
  s += '<polyline points="'+pts(A1)+'" fill="none" stroke="'+shirt+'" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>';
  var h = A1[2];
  s += '<circle cx="'+R(h[0])+'" cy="'+R(h[1])+'" r="4.5" fill="'+hand+'"/>';
  if (o.celular) s += '<rect x="'+R(h[0]-2)+'" y="'+R(h[1]-15)+'" width="9" height="15" rx="2" fill="#111"/><rect x="'+R(h[0]-0.5)+'" y="'+R(h[1]-13)+'" width="6" height="10" fill="#60a5fa"/>';
  if (o.cigarro) s += '<line x1="'+R(h[0])+'" y1="'+R(h[1]-2)+'" x2="'+R(h[0]+12)+'" y2="'+R(h[1]-6)+'" stroke="#fff" stroke-width="3"/><circle cx="'+R(h[0]+13)+'" cy="'+R(h[1]-6.5)+'" r="2.2" fill="#ff5a1f"/>' +
                     '<path d="M'+R(h[0]+14)+','+R(h[1]-10)+' q-6,-8 0,-14 q6,-6 0,-14 q-5,-6 2,-12" fill="none" stroke="#9aa3ad" stroke-width="2.5" opacity=".8"/>';
  if (o.caixa) s += '<rect x="'+R(h[0]-14)+'" y="'+R(h[1]-12)+'" width="34" height="26" fill="#cf9d62" stroke="#8a6034" stroke-width="1.5"/><rect x="'+R(h[0]+1)+'" y="'+R(h[1]-12)+'" width="5" height="26" fill="#e8c38f"/>';
  if (o.vidro) s += '<path d="M'+R(h[0]-4)+','+R(h[1]+12)+' l0,-16 l3,-6 l-1,-5 l4,3 l3,-4 l1,6 l2,5 l0,17 z" fill="#4d9a5d" opacity=".85" stroke="#2f6b3a"/><circle cx="'+R(h[0]-6)+'" cy="'+R(h[1]+4)+'" r="2.4" fill="#d00"/>';
  s += '</g>';
  return s;
}

function roda(cx, cy, r){ return '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="#1f2937"/><circle cx="'+cx+'" cy="'+cy+'" r="'+R(r*0.42)+'" fill="#9ca3af"/>'; }

/* palete com carga: x = esquerda, y = base do palete */
function carga(x, y, w, h, o){
  o = o || {};
  var s = '', pc = '#b9824a';
  s += '<rect x="'+x+'" y="'+(y-14)+'" width="'+w+'" height="4" fill="'+pc+'"/><rect x="'+x+'" y="'+(y-4)+'" width="'+w+'" height="4" fill="'+pc+'"/>';
  [x, x + w/2 - 6, x + w - 12].forEach(function(bx){ s += '<rect x="'+R(bx)+'" y="'+(y-10)+'" width="12" height="6" fill="#8d5f2f"/>'; });
  if (o.quebrado){
    s += '<path d="M'+R(x+w*0.28)+','+(y-15)+' l8,6 l-6,4 l10,6" stroke="#2a1a0c" stroke-width="3.5" fill="none"/>';
    s += '<rect x="'+R(x+w*0.5)+'" y="'+(y-6)+'" width="'+R(w*0.45)+'" height="6" fill="'+pc+'" stroke="#5a3a1a" transform="rotate(28 '+R(x+w*0.5)+' '+(y-6)+')"/>';
  }
  if (o.pregos) for (var i = 0; i < 5; i++){ var nx = x + 12 + i*(w-24)/4; s += '<line x1="'+R(nx)+'" y1="'+(y-14)+'" x2="'+R(nx+(i%2?3:-3))+'" y2="'+(y-27)+'" stroke="#6b7280" stroke-width="2.5"/><circle cx="'+R(nx+(i%2?3:-3))+'" cy="'+(y-27)+'" r="2.5" fill="#6b7280"/>'; }
  if (h > 0){
    var top = y - 14 - h, cols = Math.max(1, Math.round(w/44)), rows = Math.max(1, Math.round(h/34)), bw = w/cols, bh = h/rows;
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++){
      var bx = x + c*bw, by = top + r*bh, tr = '';
      if (o.solto && r === 0) tr = ' transform="rotate('+(c%2 ? 13 : -9)+' '+R(bx+bw/2)+' '+R(by+bh)+')"';
      s += '<g'+tr+'><rect x="'+R(bx+1)+'" y="'+R(by+1)+'" width="'+R(bw-2)+'" height="'+R(bh-2)+'" fill="'+(o.cor||'#cf9d62')+'" stroke="#8a6034" stroke-width="1.5"/><rect x="'+R(bx+bw/2-3)+'" y="'+R(by+1)+'" width="6" height="'+R(bh-2)+'" fill="#e8c38f" opacity=".7"/></g>';
    }
    if (o.filme) s += '<rect x="'+(x-1)+'" y="'+top+'" width="'+(w+2)+'" height="'+h+'" fill="#e9f3ff" opacity=".3" stroke="#cfe2f7"/>';
    if (o.rotulo) s += '<rect x="'+R(x+w/2-34)+'" y="'+R(top+h/2-11)+'" width="68" height="22" rx="3" fill="#fff" stroke="#c0392b" stroke-width="2"/>' + txt(R(x+w/2), R(top+h/2+5), o.rotulo, 13, '#c0392b');
  }
  return s;
}
function caixas(x, y, cols, rows, bw, bh, o){
  o = o || {}; var s = '';
  for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++){
    var bx = x + c*bw + (r%2 ? (o.desalinho||0) : 0), by = y - (r+1)*bh;
    s += '<rect x="'+R(bx+1)+'" y="'+R(by+1)+'" width="'+(bw-2)+'" height="'+(bh-2)+'" fill="'+(o.cor||'#cf9d62')+'" stroke="#8a6034" stroke-width="1.5"/><rect x="'+R(bx+bw/2-3)+'" y="'+R(by+1)+'" width="6" height="'+(bh-2)+'" fill="#e8c38f" opacity=".7"/>';
  }
  return s;
}

/* estrutura porta-paletes (vista frontal) */
function rack(x, o){
  var B = o.bays, L = o.levels, bw = o.bw, lh = o.lh, s = '', ups = '', beams = '';
  var cell = o.cell || function(){ return {}; }, beam = o.beam || function(){ return {}; }, up = o.up || function(){ return {}; };
  for (var b = 0; b < B; b++){
    var x0 = x + b*bw + 12, x1 = x + (b+1)*bw;
    for (var k = 0; k <= L; k++){
      var by = F - k*lh, bo = k > 0 ? beam(b, k) : {}, c = cell(b, k);
      if (c === null) continue;
      var w = c.w || (bw - 34), h = c.h != null ? c.h : lh - 32, cx = x0 + (bw - 12 - w)/2 + (c.dx || 0);
      var g = carga(R(cx), by - (k > 0 ? 12 : 0) + (bo.sag ? bo.sag*0.85 : 0), w, h, c);
      if (bo.tilt) g = '<g transform="rotate('+bo.tilt+' '+x1+' '+(by-12)+')">' + g + '</g>';
      s += g;
      if (k > 0){
        if (bo.sag) beams += '<path d="M'+x0+','+(by-6)+' Q'+R((x0+x1)/2)+','+(by-6+bo.sag*2)+' '+x1+','+(by-6)+'" fill="none" stroke="#f07c1e" stroke-width="12"/><path d="M'+x0+','+(by-1)+' Q'+R((x0+x1)/2)+','+(by-1+bo.sag*2)+' '+x1+','+(by-1)+'" fill="none" stroke="#b85a10" stroke-width="2"/>';
        else if (bo.tilt) beams += '<g transform="rotate('+bo.tilt+' '+x1+' '+(by-12)+')"><rect x="'+x0+'" y="'+(by-12)+'" width="'+(x1-x0)+'" height="12" fill="#f07c1e" stroke="#b85a10"/></g>';
        else beams += '<rect x="'+x0+'" y="'+(by-12)+'" width="'+(x1-x0)+'" height="12" fill="#f07c1e" stroke="#b85a10"/><rect x="'+x0+'" y="'+(by-14)+'" width="8" height="16" fill="#9c4a0d"/><rect x="'+(x1-8)+'" y="'+(by-14)+'" width="8" height="16" fill="#9c4a0d"/>';
      }
    }
  }
  var topY = F - L*lh - 18;
  for (var i = 0; i <= B; i++){
    var ux = x + i*bw, u = up(i);
    if (u.bent){
      ups += '<polyline points="'+(ux+6)+','+F+' '+(ux+6)+','+(F-18)+' '+(ux+20)+','+(F-38)+' '+(ux+6)+','+(F-60)+' '+(ux+6)+','+topY+'" fill="none" stroke="#2e5fa8" stroke-width="12" stroke-linejoin="round"/>' +
             '<path d="M'+(ux+14)+','+(F-46)+' l8,4 M'+(ux+16)+','+(F-34)+' l9,-2 M'+(ux+12)+','+(F-26)+' l8,3" stroke="#f5f5f5" stroke-width="2"/>';
    } else {
      ups += '<rect x="'+ux+'" y="'+topY+'" width="12" height="'+(F-topY)+'" fill="#2e5fa8"/><rect x="'+ux+'" y="'+topY+'" width="12" height="'+(F-topY)+'" fill="url(#furos)"/>';
    }
    ups += '<rect x="'+(ux-4)+'" y="'+(F-5)+'" width="20" height="5" fill="#1d3f75"/>';
    if (u.guard) ups += '<rect x="'+(ux-8)+'" y="'+(F-52)+'" width="28" height="52" rx="3" fill="url(#zebra)" stroke="#1f2937" stroke-width="2"/>';
    if (u.plate) ups += '<rect x="'+(ux+16)+'" y="'+(u.plate)+'" width="74" height="40" rx="3" fill="#fff" stroke="#1A2540" stroke-width="2"/>' + txt(ux+53, u.plate+16, 'CARGA MÁX.', 10, '#1A2540') + txt(ux+53, u.plate+31, '1.000 kg/nível', 10, '#c0392b');
  }
  return s + beams + ups;
}

/* empilhadeira (vista lateral). x = traseira; garfo à direita (ou à esquerda se flip) */
function empilhadeira(x, o){
  o = o || {};
  var y = o.y || F, fh = o.garfo != null ? o.garfo : 10;
  var s = '<g transform="translate('+x+','+y+') scale('+(o.flip ? -1 : 1)+',1)">';
  s += '<ellipse cx="120" cy="1" rx="132" ry="7" fill="#000" opacity=".18"/>';
  if (o.movendo) s += '<g stroke="#5b6b7f" stroke-width="4" stroke-linecap="round" opacity=".65"><line x1="-46" y1="-62" x2="-12" y2="-62"/><line x1="-64" y1="-42" x2="-14" y2="-42"/><line x1="-38" y1="-84" x2="-10" y2="-84"/></g>';
  var mt = Math.min(-238, -fh - 80);
  s += '<rect x="147" y="-238" width="9" height="238" fill="#4b5563"/><rect x="155" y="'+mt+'" width="7" height="'+(-mt)+'" fill="#6b7280"/>';
  s += '<path d="M2,-26 L2,-98 Q2,-112 16,-112 L50,-112 L50,-26 Z" fill="#d99a00"/><rect x="6" y="-62" width="40" height="8" fill="#222" opacity=".8"/>';
  s += '<rect x="24" y="-78" width="126" height="54" rx="7" fill="#f5b800"/><rect x="24" y="-40" width="126" height="6" fill="#222" opacity=".22"/>';
  s += '<path d="M54,-78 L54,-108 Q54,-114 60,-114 L68,-114 L68,-90 L90,-90 L90,-78Z" fill="#2b2b2b"/>';
  if (!o.vazia){
    var sk = '#d9a066', sh = o.camisa || '#2563eb';
    s += '<polyline points="74,-92 104,-90 108,-76" fill="none" stroke="#2f3b52" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>';
    s += '<line x1="74" y1="-94" x2="78" y2="-132" stroke="'+sh+'" stroke-width="20" stroke-linecap="round"/>';
    s += '<line x1="75" y1="-98" x2="78" y2="-128" stroke="#ff8a00" stroke-width="21" stroke-linecap="round"/><line x1="65" y1="-112" x2="88" y2="-113" stroke="#e5e7eb" stroke-width="4"/>';
    s += '<circle cx="80" cy="-148" r="12" fill="'+sk+'"/><path d="M68,-149 A12 12 0 0 1 92,-152 L84,-152 Z" fill="#3b2a1f"/>';
    if (o.celular) s += '<polyline points="80,-126 96,-122 94,-142" fill="none" stroke="'+sh+'" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><rect x="92" y="-160" width="9" height="16" rx="2" fill="#111"/><rect x="93.5" y="-158" width="6" height="11" fill="#60a5fa"/>';
    else s += '<polyline points="80,-126 98,-114 108,-110" fill="none" stroke="'+sh+'" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>';
  }
  s += '<line x1="124" y1="-78" x2="113" y2="-108" stroke="#222" stroke-width="4"/><line x1="102" y1="-113" x2="122" y2="-105" stroke="#222" stroke-width="5" stroke-linecap="round"/>';
  s += '<path d="M48,-78 L48,-190 L142,-190 L146,-78" fill="none" stroke="#374151" stroke-width="6" stroke-linejoin="round"/>';
  s += '<rect x="64" y="-200" width="16" height="10" rx="3" fill="#ff7a00"/>';
  if (o.re) s += '<rect x="0" y="-92" width="6" height="12" fill="#fff59d"/><rect x="0" y="-76" width="6" height="10" fill="#ef4444"/>';
  s += roda(36, -20, 20) + roda(124, -24, 24);
  s += '<rect x="161" y="'+(-fh-58)+'" width="9" height="58" fill="#374151"/><rect x="161" y="'+(-fh-7)+'" width="'+(o.garfoLen || 96)+'" height="7" fill="#1f2937"/>';
  if (o.carga) s += carga(172, -fh - 7, o.cargaW || 86, o.carga, o.cargaOpt || {});
  if (o.luzAzul) s += '<ellipse cx="'+o.luzAzul+'" cy="3" rx="30" ry="7" fill="#3b82f6" opacity=".5"/>';
  return s + '</g>';
}
/* empilhadeira vista por trás */
function empilhadeiraTras(cx, by){
  var s = '<ellipse cx="'+cx+'" cy="'+(by+2)+'" rx="95" ry="9" fill="#000" opacity=".2"/>';
  s += '<rect x="'+(cx-42)+'" y="'+(by-262)+'" width="10" height="70" fill="#6b7280"/><rect x="'+(cx+32)+'" y="'+(by-262)+'" width="10" height="70" fill="#6b7280"/>';
  s += '<rect x="'+(cx-76)+'" y="'+(by-40)+'" width="24" height="40" rx="5" fill="#1f2937"/><rect x="'+(cx+52)+'" y="'+(by-40)+'" width="24" height="40" rx="5" fill="#1f2937"/>';
  s += '<rect x="'+(cx-62)+'" y="'+(by-120)+'" width="124" height="96" rx="10" fill="#f5b800"/><rect x="'+(cx-62)+'" y="'+(by-70)+'" width="124" height="46" rx="8" fill="#d99a00"/>';
  s += '<rect x="'+(cx-56)+'" y="'+(by-60)+'" width="112" height="9" fill="#222" opacity=".8"/>';
  s += '<rect x="'+(cx-56)+'" y="'+(by-112)+'" width="12" height="9" fill="#ef4444"/><rect x="'+(cx+44)+'" y="'+(by-112)+'" width="12" height="9" fill="#ef4444"/>';
  s += '<path d="M'+(cx-36)+','+(by-120)+' q36,-26 72,0 z" fill="#ff8a00"/><rect x="'+(cx-36)+'" y="'+(by-150)+'" width="72" height="34" rx="14" fill="#ff8a00"/><line x1="'+(cx-34)+'" y1="'+(by-134)+'" x2="'+(cx+34)+'" y2="'+(by-134)+'" stroke="#e5e7eb" stroke-width="4"/>';
  s += '<circle cx="'+cx+'" cy="'+(by-166)+'" r="17" fill="#3b2a1f"/>';
  s += '<path d="M'+(cx-58)+','+(by-120)+' L'+(cx-58)+','+(by-232)+' L'+(cx+58)+','+(by-232)+' L'+(cx+58)+','+(by-120)+'" fill="none" stroke="#374151" stroke-width="7" stroke-linejoin="round"/>';
  s += '<rect x="'+(cx-9)+'" y="'+(by-246)+'" width="18" height="12" rx="4" fill="#ff7a00"/>';
  return s;
}
/* paleteira manual: x = base do timão; garfo à direita */
function paleteira(x, o){
  o = o || {}; var y = o.y || F;
  var s = '<g transform="translate('+x+','+y+') scale('+(o.flip ? -1 : 1)+',1)">';
  s += '<ellipse cx="80" cy="1" rx="85" ry="5" fill="#000" opacity=".15"/>';
  if (o.carga != null) s += carga(30, -2, 124, o.carga, o.cargaOpt || {});
  s += '<rect x="22" y="-15" width="134" height="9" rx="2" fill="#c0392b"/><circle cx="150" cy="-4" r="4.5" fill="#1f2937"/>';
  s += '<rect x="6" y="-42" width="28" height="32" rx="5" fill="#c0392b"/><circle cx="19" cy="-8" r="8" fill="#1f2937"/>';
  if (o.deitado) s += '<line x1="16" y1="-34" x2="-92" y2="-10" stroke="#1f2937" stroke-width="7" stroke-linecap="round"/><ellipse cx="-102" cy="-9" rx="12" ry="7" fill="none" stroke="#1f2937" stroke-width="6"/>';
  else s += '<line x1="18" y1="-38" x2="-6" y2="-116" stroke="#1f2937" stroke-width="7" stroke-linecap="round"/><ellipse cx="-9" cy="-126" rx="13" ry="7" fill="none" stroke="#1f2937" stroke-width="6" transform="rotate(-18 -9 -126)"/>';
  return s + '</g>';
}
/* transpaleteira elétrica */
function transpaleteira(x, o){
  o = o || {}; var y = o.y || F;
  var s = '<g transform="translate('+x+','+y+') scale('+(o.flip ? -1 : 1)+',1)">';
  s += '<ellipse cx="100" cy="1" rx="110" ry="6" fill="#000" opacity=".15"/>';
  if (o.carga != null) s += carga(62, -2, 120, o.carga, o.cargaOpt || {});
  s += '<rect x="56" y="-15" width="132" height="9" rx="2" fill="#374151"/><circle cx="182" cy="-4" r="4.5" fill="#111"/>';
  s += '<rect x="0" y="-98" width="58" height="88" rx="8" fill="#e67e22"/><rect x="6" y="-92" width="46" height="26" rx="4" fill="#c4641a"/>' + txt(29, -50, '⚡', 18, '#fff');
  s += '<circle cx="26" cy="-10" r="10" fill="#1f2937"/>';
  s += '<line x1="12" y1="-94" x2="-46" y2="-136" stroke="#374151" stroke-width="7" stroke-linecap="round"/><rect x="-66" y="-150" width="30" height="16" rx="6" fill="#1f2937"/>';
  return s + '</g>';
}
function placa(x, y, w, h, L, fundo, cor, borda){
  var s = '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="6" fill="'+fundo+'" stroke="'+(borda||'rgba(0,0,0,.25)')+'" stroke-width="3"/>';
  var fs = Math.min(20, (h - 10) / L.length * 0.85);
  L.forEach(function(t, i){ s += txt(x + w/2, R(y + (h / L.length) * (i + 0.5) + fs*0.36), t, R(fs), cor); });
  return s;
}
function oleo(cx, cy, rx, cor){
  cor = cor || '#141414';
  return '<ellipse cx="'+cx+'" cy="'+cy+'" rx="'+rx+'" ry="'+R(rx*0.24)+'" fill="'+cor+'" opacity=".88"/><ellipse cx="'+(cx+rx*0.35)+'" cy="'+(cy+4)+'" rx="'+R(rx*0.45)+'" ry="'+R(rx*0.14)+'" fill="'+cor+'" opacity=".88"/>' +
         '<ellipse cx="'+(cx-rx*0.3)+'" cy="'+(cy-2)+'" rx="'+R(rx*0.3)+'" ry="3" fill="#8aa0d8" opacity=".45"/>';
}
function extintor(x, y){
  return '<rect x="'+(x-34)+'" y="'+(y-74)+'" width="68" height="28" rx="3" fill="#d62828"/>' + txt(x, y-55, 'EXTINTOR', 12, '#fff') +
    '<rect x="'+(x-24)+'" y="'+(y-40)+'" width="48" height="110" fill="#fde2e2" stroke="#d62828" stroke-width="3"/>' +
    '<rect x="'+(x-11)+'" y="'+(y-10)+'" width="22" height="62" rx="9" fill="#d62828"/><rect x="'+(x-5)+'" y="'+(y-22)+'" width="10" height="13" fill="#333"/>' +
    '<path d="M'+(x+5)+','+(y-18)+' q18,4 12,34" stroke="#222" stroke-width="3" fill="none"/><rect x="'+(x-9)+'" y="'+(y+8)+'" width="18" height="16" fill="#fff" opacity=".8"/>';
}
function espelho(cx, cy, quebrado){
  var s = '<line x1="'+cx+'" y1="'+cy+'" x2="'+(cx+44)+'" y2="'+(cy-50)+'" stroke="#4b5563" stroke-width="6"/><rect x="'+(cx+38)+'" y="'+(cy-62)+'" width="12" height="24" fill="#4b5563"/>';
  s += '<circle cx="'+cx+'" cy="'+cy+'" r="36" fill="url(#gmir)" stroke="#f97316" stroke-width="7"/>';
  if (quebrado) s += '<polyline points="'+(cx-30)+','+(cy-14)+' '+(cx-6)+','+(cy-2)+' '+(cx+4)+','+(cy-28)+'" fill="none" stroke="#1f2937" stroke-width="2.5"/><polyline points="'+(cx-6)+','+(cy-2)+' '+(cx+24)+','+(cy+12)+' '+(cx+14)+','+(cy+30)+'" fill="none" stroke="#1f2937" stroke-width="2.5"/><polyline points="'+(cx-6)+','+(cy-2)+' '+(cx-14)+','+(cy+28)+'" fill="none" stroke="#1f2937" stroke-width="2.5"/><path d="M'+(cx+8)+','+(cy-34)+' L'+(cx+30)+','+(cy-20)+' L'+(cx+18)+','+(cy-8)+' Z" fill="#475569"/>';
  return s;
}
function buraco(cx, cy){
  return '<path d="M'+(cx-46)+','+cy+' Q'+(cx-36)+','+(cy-15)+' '+(cx-4)+','+(cy-13)+' Q'+(cx+32)+','+(cy-17)+' '+(cx+46)+','+(cy-2)+' Q'+(cx+30)+','+(cy+13)+' '+cx+','+(cy+12)+' Q'+(cx-32)+','+(cy+13)+' '+(cx-46)+','+cy+' Z" fill="#40464e"/>' +
         '<ellipse cx="'+cx+'" cy="'+(cy+1)+'" rx="28" ry="6" fill="#23272c"/>' +
         '<path d="M'+(cx-46)+','+cy+' l-22,-6 M'+(cx+46)+','+(cy-2)+' l20,-8 l14,3 M'+(cx+10)+','+(cy+12)+' l6,14" stroke="#4b525b" stroke-width="2.5" fill="none"/>';
}
function proibidoFumar(cx, cy){
  return '<circle cx="'+cx+'" cy="'+cy+'" r="30" fill="#fff" stroke="#d62828" stroke-width="7"/><rect x="'+(cx-20)+'" y="'+(cy-4)+'" width="34" height="8" fill="#374151"/><rect x="'+(cx+14)+'" y="'+(cy-4)+'" width="6" height="8" fill="#ff5a1f"/><line x1="'+(cx-20)+'" y1="'+(cy-20)+'" x2="'+(cx+20)+'" y2="'+(cy+20)+'" stroke="#d62828" stroke-width="7"/>';
}
function estilete(cx, cy){
  return '<g transform="rotate(-14 '+cx+' '+cy+')"><rect x="'+(cx-34)+'" y="'+(cy-7)+'" width="44" height="14" rx="4" fill="#f5c400" stroke="#8a6d00" stroke-width="1.5"/><polygon points="'+(cx+10)+','+(cy-6)+' '+(cx+40)+','+(cy-6)+' '+(cx+10)+','+(cy+5)+'" fill="#cbd5e1" stroke="#64748b" stroke-width="1.5"/><rect x="'+(cx-14)+'" y="'+(cy-9)+'" width="8" height="5" fill="#374151"/></g>';
}
function saida(x, y){
  return '<rect x="'+(x+8)+'" y="'+(y-60)+'" width="88" height="32" rx="4" fill="#15803d"/>' + txt(x+52, y-38, 'SAÍDA ➜', 15, '#fff') +
    '<rect x="'+x+'" y="'+y+'" width="104" height="'+(F-y)+'" fill="#e5e7eb" stroke="#64748b" stroke-width="4"/><line x1="'+(x+52)+'" y1="'+y+'" x2="'+(x+52)+'" y2="'+F+'" stroke="#94a3b8" stroke-width="3"/>' +
    '<rect x="'+(x+8)+'" y="'+(y+90)+'" width="88" height="8" rx="3" fill="#d62828"/>';
}

/* ============================================================
   CENAS "CAÇA AOS RISCOS"
   tipo: 'c' = condição insegura, 'b' = comportamento inseguro
   ============================================================ */
var CENAS = {
  corredor: {
    titulo: 'Corredor de pedestres',
    instr: 'Toque nos riscos que você encontrar no corredor do galpão.',
    tempo: 100,
    draw: function(){
      var s = bg({faixa:true});
      s += placa(470, 120, 190, 64, ['USE A FAIXA', 'DE PEDESTRES'], '#2f9e5f', '#fff');
      s += rack(20, { bays:2, levels:2, bw:170, lh:125, cell:function(b,k){ return (b === 1 && k === 0) ? null : { h:86 }; } });
      s += P(272, 468, { pose:'crouch', shirt:'#7c3aed' });
      s += extintor(915, 330);
      s += carga(850, 470, 140, 86, { filme:true });
      s += P(120, 532, { pose:'walk', colete:true, shirt:'#0f766e' });
      s += carga(395, 535, 104, 72, { filme:true });
      s += P(585, 532, { pose:'run', shirt:'#0ea5e9' });
      s += oleo(705, 525, 48);
      s += P(815, 534, { pose:'phone', celular:true, shirt:'#be185d' });
      return s;
    },
    riscos: [
      { x:285, y:420, r:54, tipo:'b', t:'Atalho por dentro da estrutura porta-paletes', e:'Passar por dentro ou por baixo das estruturas expõe a pessoa à queda de materiais e ao trânsito de empilhadeiras do outro lado. Use sempre a faixa de pedestres.' },
      { x:447, y:494, r:54, tipo:'c', t:'Palete obstruindo a faixa de pedestres', e:'Materiais na faixa obrigam o pedestre a desviar para a área de máquinas. A faixa deve ficar sempre livre.' },
      { x:585, y:470, r:50, tipo:'b', t:'Correndo dentro do galpão', e:'Correr aumenta o risco de escorregões, tropeços e de surgir de repente na frente de uma empilhadeira. Ande, nunca corra.' },
      { x:705, y:525, r:48, tipo:'c', t:'Óleo derramado no piso', e:'Piso escorregadio causa quedas. Sinalize o local e acione a limpeza imediatamente.' },
      { x:815, y:470, r:44, tipo:'b', t:'Andando distraído com o celular', e:'O celular tira a atenção do trânsito de máquinas. Pare em local seguro, fora da circulação, para usar o celular.' },
      { x:925, y:392, r:56, tipo:'c', t:'Extintor obstruído por paletes', e:'Extintores e hidrantes devem ficar sempre desobstruídos e sinalizados para serem usados rapidamente em uma emergência.' }
    ]
  },
  empilhadeiras: {
    titulo: 'Trânsito de empilhadeiras',
    instr: 'Observe o trânsito das empilhadeiras e toque em cada risco.',
    tempo: 100,
    draw: function(){
      var s = bg({linha:true});
      s += placa(400, 92, 170, 70, ['VELOCIDADE', 'MÁX. 10 km/h'], '#fff', '#c0392b', '#c0392b');
      s += espelho(770, 128, true);
      s += empilhadeira(50, { garfo:230, carga:82, movendo:true });
      s += buraco(330, 518);
      s += empilhadeira(610, { flip:true, celular:true, movendo:true, garfo:12 });
      s += P(402, 451, { pose:'ride', shirt:'#16a34a' });
      s += empilhadeira(895, { flip:true, re:true, camisa:'#0f766e' });
      s += txt(915, 330, 'BIP!', 18, '#c0392b') + txt(940, 300, 'BIP!', 14, '#c0392b');
      s += '<path d="M905,250 l30,0 m-10,-8 l10,8 l-10,8" stroke="#c0392b" stroke-width="4" fill="none"/>';
      s += P(958, 470, { pose:'walk', flip:true, shirt:'#9333ea' });
      return s;
    },
    riscos: [
      { x:262, y:188, r:62, tipo:'b', t:'Trafegar com a carga elevada', e:'Com a carga no alto a empilhadeira perde estabilidade e pode tombar. Desloque-se com os garfos baixos (cerca de 15 cm do piso) e o mastro inclinado para trás.' },
      { x:330, y:515, r:42, tipo:'c', t:'Buraco no piso de circulação', e:'Buracos e desníveis podem desequilibrar a carga ou tombar a empilhadeira. Comunique a manutenção e isole o local.' },
      { x:402, y:394, r:50, tipo:'b', t:'Pessoa sendo transportada no garfo', e:'É proibido transportar pessoas nos garfos ou em cima da carga. O risco de queda e esmagamento é muito alto.' },
      { x:528, y:322, r:40, tipo:'b', t:'Operador usando celular enquanto dirige', e:'Celular ao volante é distração grave. Para usar, pare a máquina em local seguro, abaixe os garfos e acione o freio.' },
      { x:770, y:128, r:44, tipo:'c', t:'Espelho convexo quebrado no cruzamento', e:'O espelho permite ver quem vem pelo outro corredor. Quebrado, o cruzamento fica "cego". Comunique para troca imediata.' },
      { x:958, y:412, r:42, tipo:'b', t:'Pedestre passando atrás de empilhadeira em ré', e:'O operador tem pouca visão para trás. Nunca passe atrás de máquina em manobra; mantenha distância e faça contato visual com o operador.' }
    ]
  },
  paleteiras: {
    titulo: 'Transpaleteiras e paleteiras',
    instr: 'Encontre os riscos com paleteiras manuais, transpaleteiras e na recarga de baterias.',
    tempo: 100,
    draw: function(){
      var s = bg({faixa:true});
      s += placa(20, 150, 150, 52, ['RECARGA DE', 'BATERIAS'], '#f5c400', '#111');
      s += proibidoFumar(225, 176);
      s += '<rect x="20" y="350" width="84" height="120" rx="6" fill="#64748b"/><rect x="32" y="362" width="60" height="30" rx="3" fill="#0f172a"/>' + txt(62, 383, '80%', 16, '#4ade80') + '<circle cx="46" cy="408" r="6" fill="#22c55e"/><circle cx="76" cy="408" r="6" fill="#facc15"/>';
      s += transpaleteira(150, {});
      s += '<path d="M104,430 C150,420 120,456 152,452 C168,450 160,440 172,430" fill="none" stroke="#111" stroke-width="6"/>';
      s += '<path d="M134,446 l-6,-10 M138,446 l2,-12 M142,447 l8,-9" stroke="#d97706" stroke-width="2.5"/><path d="M128,428 l4,8 l-6,2 l8,8" stroke="#facc15" stroke-width="3" fill="none"/><circle cx="136" cy="440" r="7" fill="#fde047" opacity=".6"/>';
      s += P(355, 470, { pose:'smoke', cigarro:true, shirt:'#64748b' });
      s += paleteira(400, { y:535 });
      s += P(492, 521, { pose:'ride', shirt:'#dc2626' });
      s += transpaleteira(650, { carga:66, cargaOpt:{ quebrado:true } });
      s += P(586, 470, { pose:'push', colete:true, shirt:'#0f766e' });
      s += paleteira(880, { y:533, deitado:true });
      return s;
    },
    riscos: [
      { x:137, y:442, r:36, tipo:'c', t:'Cabo do carregador danificado', e:'Fios expostos causam choque elétrico e incêndio. Não use o carregador; isole e chame a manutenção elétrica.' },
      { x:360, y:408, r:46, tipo:'b', t:'Fumando na área de recarga de baterias', e:'A recarga libera hidrogênio, gás inflamável e explosivo. É proibido fumar ou fazer chama perto das baterias.' },
      { x:492, y:462, r:52, tipo:'b', t:'Andando de "patinete" na paleteira', e:'Paleteira não é meio de transporte. Subir nela causa quedas e prensamento dos pés. Use-a apenas para movimentar carga.' },
      { x:769, y:452, r:44, tipo:'c', t:'Movimentando carga sobre palete quebrado', e:'Palete danificado pode ceder e derrubar a carga. Troque o palete antes de movimentar.' },
      { x:880, y:516, r:52, tipo:'c', t:'Paleteira abandonada na faixa, timão no chão', e:'Equipamento largado na faixa causa tropeços. Guarde em local demarcado, garfos abaixados e o timão na vertical.' }
    ]
  },
  portapaletes: {
    titulo: 'Estruturas porta-paletes',
    instr: 'Inspecione a estrutura: toque nos danos e nas atitudes de risco.',
    tempo: 100,
    draw: function(){
      var s = bg({});
      s += '<rect y="492" width="1000" height="6" fill="#f5c400"/>';
      s += rack(40, {
        bays:3, levels:3, bw:290, lh:112,
        cell: function(b, k){
          if (b === 0 && k === 1) return { h:96, cor:'#a87445', rotulo:'1.800 kg' };
          if (b === 2 && k === 1) return { dx:44 };
          if (b === 1 && k === 3) return { solto:true, h:62 };
          if (k === 3) return { h:62, filme: b !== 1 };
          return { filme: (b + k) % 2 === 0 };
        },
        beam: function(b, k){ if (b === 0 && k === 1) return { sag:9 }; if (b === 2 && k === 2) return { tilt:-5 }; return {}; },
        up: function(i){ if (i === 1) return { bent:true }; if (i === 2) return { guard:true }; if (i === 0) return { plate:395 }; return {}; }
      });
      s += '<g transform="rotate(28 600 92)">' + caixas(578, 112, 1, 1, 46, 34) + '</g><path d="M600,124 l0,18 M614,124 l0,14" stroke="#c0392b" stroke-width="3" fill="none"/>';
      s += P(474, 358, { pose:'climb', shirt:'#dc2626' });
      return s;
    },
    riscos: [
      { x:190, y:362, r:58, tipo:'c', t:'Longarina envergada por excesso de peso', e:'A carga ultrapassa a capacidade da placa (1.000 kg por nível). Longarina deformada pode romper. Respeite a capacidade e retire a carga.' },
      { x:340, y:428, r:42, tipo:'c', t:'Montante (coluna) amassado', e:'Colunas danificadas por batidas de empilhadeira podem levar ao colapso da estrutura. Comunique, isole e descarregue até a avaliação.' },
      { x:474, y:294, r:50, tipo:'b', t:'Escalando a estrutura', e:'Nunca suba na estrutura porta-paletes. Use equipamento adequado e autorizado para acessar níveis altos.' },
      { x:545, y:84, r:64, tipo:'c', t:'Caixas soltas no topo, caindo', e:'Carga sem filme stretch e desalinhada pode cair de grande altura. As cargas devem estar estáveis e envolvidas.' },
      { x:690, y:252, r:46, tipo:'c', t:'Longarina desencaixada (sem trava)', e:'Sem a trava de segurança a longarina pode se soltar do montante com uma batida. Verifique as travas em todas as longarinas.' },
      { x:930, y:306, r:44, tipo:'c', t:'Palete saliente / desalinhado', e:'Palete fora do alinhamento pode cair ou ser atingido pela empilhadeira. Posicione o palete centralizado sobre as longarinas.' }
    ]
  },
  picking: {
    titulo: 'Área de picking (separação)',
    instr: 'Encontre os riscos da separação de pedidos.',
    tempo: 100,
    draw: function(){
      var s = bg({});
      s += rack(30, { bays:3, levels:2, bw:200, lh:130, cell:function(b,k){ return { h:80, w:150, filme:false }; } });
      s += P(132, 522, { pose:'bend', shirt:'#dc2626' });
      s += caixas(160, 522, 1, 1, 40, 30);
      s += P(292, 526, { pose:'squat', colete:true, shirt:'#0f766e', caixa:true });
      s += caixas(398, 528, 1, 3, 64, 32);
      s += P(430, 432, { pose:'reach', shirt:'#7c3aed' });
      s += estilete(540, 514);
      // carrinho com pilha inclinada
      s += '<rect x="600" y="500" width="100" height="10" fill="#475569"/>' + roda(612, 518, 8) + roda(688, 518, 8) + '<line x1="602" y1="500" x2="602" y2="380" stroke="#475569" stroke-width="5"/>';
      s += '<g transform="rotate(9 610 500)">' + caixas(606, 500, 2, 6, 46, 30, { desalinho:8 }) + '</g>';
      // selecionadora de pedidos
      s += '<rect x="752" y="432" width="170" height="34" rx="6" fill="#1e3a8a"/>' + roda(780, 452, 16) + roda(900, 452, 16);
      s += '<rect x="900" y="40" width="16" height="394" fill="#64748b"/><rect x="916" y="60" width="8" height="374" fill="#94a3b8"/>';
      s += '<rect x="772" y="206" width="132" height="12" fill="#1e3a8a"/><line x1="776" y1="206" x2="776" y2="156" stroke="#f5c400" stroke-width="6"/><line x1="900" y1="206" x2="900" y2="156" stroke="#f5c400" stroke-width="6"/><line x1="776" y1="158" x2="900" y2="158" stroke="#f5c400" stroke-width="6"/><line x1="776" y1="182" x2="900" y2="182" stroke="#f5c400" stroke-width="5"/>';
      s += P(822, 206, { pose:'lean', flip:true, shirt:'#ea580c' });
      s += '<path d="M880,208 q6,40 -4,70" stroke="#facc15" stroke-width="4" fill="none" stroke-dasharray="6 4"/><circle cx="876" cy="280" r="5" fill="none" stroke="#475569" stroke-width="3"/>';
      return s;
    },
    riscos: [
      { x:150, y:470, r:52, tipo:'b', t:'Levantando caixa com a coluna curvada', e:'Dobrar a coluna para levantar peso causa lesões nas costas. Dobre os joelhos, mantenha a coluna reta e a carga junto ao corpo.' },
      { x:430, y:380, r:60, tipo:'b', t:'Subindo em caixas para alcançar o nível alto', e:'Caixas não são degraus: podem ceder e causar queda. Use plataforma ou escada adequada, com guarda-corpo.' },
      { x:540, y:512, r:36, tipo:'c', t:'Estilete aberto largado no chão', e:'Lâmina exposta causa cortes. Use estilete retrátil (de segurança) e guarde-o fechado após o uso.' },
      { x:655, y:400, r:60, tipo:'c', t:'Pilha alta e desalinhada no carrinho', e:'Pilha inclinada e acima da altura recomendada pode tombar. Monte pilhas estáveis, com as caixas pesadas embaixo.' },
      { x:790, y:166, r:58, tipo:'b', t:'Debruçado para fora da selecionadora, sem talabarte', e:'Na selecionadora elevada, mantenha o cinto/talabarte conectado ao ponto de ancoragem e não se debruce para fora do guarda-corpo.' }
    ]
  },
  reversa: {
    titulo: 'Logística reversa',
    instr: 'Na área de devoluções, encontre todos os riscos.',
    tempo: 100,
    draw: function(){
      var s = bg({});
      s += placa(320, 56, 360, 44, ['ÁREA DE LOGÍSTICA REVERSA'], '#1A2540', '#fff');
      s += carga(40, 470, 130, 70, {});
      s += '<path d="M120,402 l14,10 l-10,8 l12,10" stroke="#5b3b1a" stroke-width="3" fill="none"/>' + oleo(118, 496, 62, '#c8a200') + '<path d="M128,440 q2,20 -2,40" stroke="#c8a200" stroke-width="5" fill="none"/>';
      s += '<polygon points="64,382 84,350 104,382" fill="#fde047" stroke="#111" stroke-width="2"/>' + txt(84, 377, '!', 18, '#111');
      var pil = '';
      for (var i = 0; i < 14; i++) pil += '<rect x="230" y="'+(470-(i+1)*14)+'" width="120" height="4" fill="#b9824a"/><rect x="230" y="'+(470-(i+1)*14+4)+'" width="120" height="10" fill="#8d5f2f" opacity=".55"/>';
      s += '<g transform="rotate(7 230 470)">' + pil + '</g>';
      s += carga(382, 524, 120, 0, { quebrado:true, pregos:true });
      s += '<polygon points="520,525 532,518 528,528" fill="#7dd3c0"/><polygon points="600,530 612,522 616,532" fill="#7dd3c0"/><polygon points="586,520 594,516 592,526" fill="#7dd3c0"/>';
      s += P(560, 524, { pose:'hold', vidro:true, shirt:'#2563eb' });
      s += P(690, 524, { pose:'throwp', shirt:'#b45309' });
      s += '<path d="M700,360 q60,-90 120,10" stroke="#5b6b7f" stroke-width="3" fill="none" stroke-dasharray="7 6"/>';
      s += '<g transform="rotate(25 760 300)">' + caixas(742, 318, 1, 1, 38, 30) + '</g>';
      s += '<polygon points="770,400 860,400 850,470 780,470" fill="#4d7c5a"/><rect x="766" y="396" width="98" height="10" rx="3" fill="#355a40"/>' + txt(815, 445, 'DESCARTE', 13, '#fff');
      s += saida(886, 250);
      s += caixas(872, 470, 3, 4, 42, 32);
      return s;
    },
    riscos: [
      { x:110, y:460, r:58, tipo:'c', t:'Produto avariado vazando', e:'Vazamentos podem ser tóxicos, corrosivos ou escorregadios. Isole a área, consulte a FDS (antiga FISPQ) e use os EPIs indicados para conter.' },
      { x:300, y:362, r:62, tipo:'c', t:'Pilha de paletes alta e inclinada', e:'Pilhas altas e tortas podem tombar sobre as pessoas. Empilhe paletes em pilhas estáveis, com altura limitada e em local demarcado.' },
      { x:442, y:508, r:46, tipo:'c', t:'Palete quebrado com pregos expostos', e:'Pregos expostos causam perfurações e tropeços. Retire de circulação e descarte corretamente.' },
      { x:560, y:462, r:46, tipo:'b', t:'Manuseando vidro quebrado sem luva', e:'Cacos de vidro cortam. Use luva de proteção adequada e recolha os cacos com pá e vassoura, nunca com as mãos.' },
      { x:722, y:390, r:62, tipo:'b', t:'Arremessando caixas', e:'Arremessar materiais pode atingir colegas e espalhar produtos. Leve a caixa até o local e deposite com cuidado.' },
      { x:936, y:380, r:58, tipo:'c', t:'Saída de emergência obstruída', e:'Rotas de fuga e saídas de emergência devem ficar sempre livres e sinalizadas. Nunca use essa área para guardar devoluções.' }
    ]
  },
  docas: {
    titulo: 'Carregamento de docas',
    instr: 'Observe as três docas e a vista do pátio. Toque em cada risco.',
    tempo: 100,
    draw: function(){
      var s = defs();
      s += '<rect width="1000" height="400" fill="#d3dae3"/>';
      for (var x = 0; x <= 1000; x += 100) s += '<line x1="'+x+'" y1="26" x2="'+x+'" y2="400" stroke="#c3ccd7" stroke-width="2"/>';
      s += '<rect width="1000" height="26" fill="#7d8b9c"/>';
      s += '<rect y="400" width="1000" height="160" fill="url(#gf)"/>';
      [40, 380, 720].forEach(function(dx, i){
        s += '<rect x="'+(dx-10)+'" y="120" width="260" height="290" fill="#374151"/>';
        s += '<rect x="'+(dx-6)+'" y="104" width="252" height="26" rx="4" fill="#94a3b8"/>';
        s += '<rect x="'+(dx-18)+'" y="356" width="14" height="44" fill="#111"/><rect x="'+(dx+244)+'" y="356" width="14" height="44" fill="#111"/>';
        s += txt(dx+120, 123, 'DOCA ' + (i+1), 15, '#1A2540');
      });
      // doca 1 — carreta acoplada, semáforo vermelho
      s += '<rect x="40" y="130" width="240" height="270" fill="#4b5563"/><polygon points="40,130 90,175 230,175 280,130" fill="#3f4651"/><rect x="90" y="175" width="140" height="160" fill="#2d333b"/><polygon points="40,400 90,335 230,335 280,400" fill="#6b7280"/>';
      s += carga(102, 335, 116, 120, { filme:true });
      s += '<rect x="40" y="396" width="240" height="14" fill="#8b949e"/>';
      // doca 2 — sem veículo, porta aberta
      s += '<rect x="380" y="130" width="240" height="190" fill="url(#gsky)"/><rect x="380" y="320" width="240" height="80" fill="#b9b2a2"/><line x1="380" y1="300" x2="620" y2="300" stroke="#9aa3ad" stroke-width="3"/>';
      for (x = 390; x < 620; x += 24) s += '<line x1="'+x+'" y1="280" x2="'+x+'" y2="320" stroke="#9aa3ad" stroke-width="2"/>';
      s += '<rect x="380" y="396" width="240" height="12" fill="url(#zebra)"/>';
      // doca 3 — carreta com vão, nivelador recolhido
      s += '<rect x="720" y="130" width="240" height="262" fill="#4b5563"/><polygon points="720,130 770,175 910,175 960,130" fill="#3f4651"/><rect x="770" y="175" width="140" height="160" fill="#2d333b"/><polygon points="720,392 770,335 910,335 960,392" fill="#6b7280"/>';
      s += '<g transform="rotate(9 806 335)">' + carga(790, 335, 112, 150, { solto:true }) + '</g>';
      s += '<rect x="720" y="392" width="240" height="18" fill="#0b0f14"/><rect x="726" y="406" width="228" height="6" fill="#8b949e"/>';
      // semáforos
      [[292,'#ef4444','#14532d'],[632,'#5f1d1d','#14532d'],[968,'#5f1d1d','#22c55e']].forEach(function(l){
        s += '<rect x="'+(l[0]-2)+'" y="186" width="26" height="58" rx="6" fill="#111"/><circle cx="'+(l[0]+11)+'" cy="201" r="9" fill="'+l[1]+'"/><circle cx="'+(l[0]+11)+'" cy="228" r="9" fill="'+l[2]+'"/>';
      });
      s += '<circle cx="303" cy="201" r="15" fill="#ef4444" opacity=".3"/><circle cx="979" cy="228" r="15" fill="#22c55e" opacity=".3"/>';
      // goteira e poça
      s += '<path d="M650,26 l6,10 l-4,6" stroke="#475569" stroke-width="2" fill="none"/>';
      for (var d = 60; d < 440; d += 56) s += '<path d="M'+(664)+','+d+' q-5,10 0,13 q5,-3 0,-13 z" fill="#60a5fa"/>';
      s += '<ellipse cx="664" cy="474" rx="74" ry="14" fill="#93c5fd" opacity=".75"/><ellipse cx="664" cy="474" rx="40" ry="7" fill="none" stroke="#e0f2fe" stroke-width="2"/>';
      // pessoa pulando da doca 2
      s += '<path d="M470,404 q30,-80 70,-60" stroke="#5b6b7f" stroke-width="3" fill="none" stroke-dasharray="6 5"/>';
      s += P(522, 352, { pose:'jump', shirt:'#dc2626' });
      // empilhadeira entrando na doca 1
      s += empilhadeiraTras(160, 540);
      // vista do pátio (calço)
      s += '<rect x="706" y="4" width="290" height="98" rx="8" fill="#fff" stroke="#1A2540" stroke-width="3"/><rect x="712" y="22" width="278" height="74" fill="url(#gsky)"/><rect x="712" y="84" width="278" height="12" fill="#b9b2a2"/>';
      s += txt(716, 18, 'VISTA DO PÁTIO — DOCA 1', 11, '#1A2540', {a:'start'});
      s += '<rect x="740" y="36" width="230" height="40" fill="#f8fafc" stroke="#94a3b8" stroke-width="2"/><rect x="740" y="64" width="230" height="5" fill="#2563eb"/><rect x="720" y="40" width="22" height="34" fill="#94a3b8"/>';
      s += roda(890, 80, 10) + roda(918, 80, 10) + '<line x1="790" y1="76" x2="790" y2="90" stroke="#475569" stroke-width="3"/>';
      s += '<polygon points="760,94 774,94 774,84" fill="#f5c400" stroke="#111" stroke-width="1"/>';
      return s;
    },
    riscos: [
      { x:160, y:420, r:72, tipo:'b', t:'Entrando na carreta com o semáforo vermelho', e:'Semáforo vermelho significa que o veículo não está liberado (pode sair a qualquer momento). Só entre com a luz verde e o calço posicionado.' },
      { x:522, y:296, r:54, tipo:'b', t:'Pulando da doca para o pátio', e:'A altura da doca causa quedas e torções. Use a escada de acesso. Doca sem veículo deve ficar com a porta fechada ou com barreira.' },
      { x:664, y:470, r:56, tipo:'c', t:'Piso molhado por goteira', e:'Água no piso da doca causa escorregões e derrapagem de equipamentos. Sinalize, seque e comunique a manutenção do telhado.' },
      { x:850, y:266, r:56, tipo:'c', t:'Carga instável dentro da carreta', e:'Carga mal arrumada pode cair sobre quem entra na carreta. Confira a amarração e a estabilidade antes de descarregar.' },
      { x:840, y:401, r:46, w:250, h:36, tipo:'c', t:'Vão entre a doca e a carreta (nivelador não apoiado)', e:'Com o vão aberto a empilhadeira ou a paleteira pode cair. Só entre com o nivelador apoiado corretamente na carreta.' },
      { x:900, y:76, r:44, tipo:'c', t:'Carreta sem calço nas rodas', e:'Sem calço a carreta pode se mover durante o carregamento, abrindo o vão. O calço deve estar nas rodas antes de liberar a doca.' }
    ]
  }
};

/* ============================================================
   CONTEÚDO DAS FASES
   ============================================================ */
var FASES = [
  { id:'f1', nome:'Caminho Seguro', ic:'🚶', cor:'#2E8B57', resumo:'Circule pela faixa de pedestres, atravesse na faixa e reconheça os riscos do corredor.',
    etapas:[ { tipo:'labirinto' }, { tipo:'cena', cena:'corredor' }, { tipo:'quiz', perguntas:[
      { p:'Qual é o local correto para o pedestre circular no galpão?', o:['Na faixa de pedestres demarcada','No corredor das empilhadeiras, se estiver vazio','Por dentro das estruturas porta-paletes (atalho)','Por onde for mais curto'], e:'O pedestre deve circular somente pelas faixas demarcadas, longe do trânsito de máquinas.' },
      { p:'Você precisa atravessar o corredor das empilhadeiras. O que fazer?', o:['Atravessar na faixa: parar, olhar e fazer contato visual com o operador','Atravessar correndo para ser rápido','Atravessar olhando o celular','Passar por trás da empilhadeira em manobra'], e:'Pare, olhe para os dois lados, faça contato visual com o operador e só então atravesse pela faixa.' },
      { p:'Você encontrou óleo derramado na faixa de pedestres. Qual a atitude correta?', o:['Sinalizar o local, pedir limpeza imediata e relatar no Alerta Amigo','Passar por cima com cuidado','Ignorar, alguém vai ver','Jogar um papelão por cima e seguir'], e:'Sinalize para ninguém escorregar, acione a limpeza e relate no Alerta Amigo. Cobrir sem limpar esconde o risco.' },
      { p:'Você viu um colega cortando caminho por dentro da estrutura porta-paletes. O que fazer?', o:['Orientar o colega com respeito e relatar o desvio no Alerta Amigo','Fazer igual, é mais rápido','Ignorar, não é problema meu','Esperar acontecer um acidente para avisar'], e:'Comportamento inseguro também é desvio: oriente o colega e relate no Alerta Amigo. Cuidar do outro é o espírito do Alerta Amigo.' }
    ] } ] },
  { id:'f2', nome:'Trânsito de Empilhadeiras', ic:'🚜', cor:'#d97706', resumo:'Operação segura, carga baixa, carona proibida e convivência com pedestres.',
    etapas:[ { tipo:'cena', cena:'empilhadeiras' }, { tipo:'cartas', itens:[
      { ic:'🚜', t:'O operador trafega com os garfos a cerca de 15 cm do piso e o mastro inclinado para trás.', ok:true, e:'Correto! Garfos baixos e mastro inclinado para trás dão estabilidade à carga.' },
      { ic:'📦', t:'A carga é alta e tapa a visão. O operador segue de frente, devagar, buzinando.', ok:false, e:'Com a visão bloqueada, trafegue de ré olhando no sentido do deslocamento (ou com auxílio de um sinaleiro).' },
      { ic:'🙋', t:'Um colega pede carona no garfo da empilhadeira até a doca.', ok:false, e:'Transportar pessoas nos garfos é proibido: risco de queda e esmagamento.' },
      { ic:'🅿️', t:'Antes de descer, o operador abaixa os garfos até o piso, aciona o freio de estacionamento e desliga a máquina.', ok:true, e:'Correto! Essa é a forma segura de estacionar e deixar a empilhadeira.' }
    ] }, { tipo:'quiz', perguntas:[
      { p:'Em que altura os garfos devem ficar durante o deslocamento da empilhadeira?', o:['Baixos, a cerca de 15 cm do piso','Na altura dos olhos do operador','No ponto mais alto, para não bater em nada','Tanto faz'], e:'Garfos baixos mantêm o centro de gravidade baixo e evitam tombamentos.' },
      { p:'Quem pode operar a empilhadeira?', o:['Somente o operador treinado, autorizado e identificado (NR-11)','Qualquer colaborador com CNH','Quem estiver mais perto','O ajudante, se o operador deixar'], e:'A NR-11 exige operador habilitado (treinado) e identificado. CNH não substitui o treinamento.' },
      { p:'Antes de começar o turno, o operador da empilhadeira deve…', o:['Fazer o checklist: freios, buzina, luzes, garfos, pneus e vazamentos','Apenas ligar e sair','Verificar só o combustível/bateria','Pedir para outro colega testar'], e:'O checklist diário encontra defeitos antes que virem acidentes. Equipamento com defeito não deve operar.' }
    ] } ] },
  { id:'f3', nome:'Transpaleteiras e Paleteiras', ic:'🛞', cor:'#c0392b', resumo:'Uso correto de paleteiras manuais, transpaleteiras elétricas e recarga de baterias.',
    etapas:[ { tipo:'cena', cena:'paleteiras' }, { tipo:'cartas', itens:[
      { ic:'🛴', t:'Usar a paleteira manual como patinete para chegar mais rápido.', ok:false, e:'Paleteira não é meio de transporte: causa quedas e prensamento dos pés.' },
      { ic:'✅', t:'Ao terminar, deixar a paleteira em local demarcado, com os garfos abaixados e o timão na vertical.', ok:true, e:'Correto! Assim ninguém tropeça e o equipamento fica pronto para o próximo uso.' },
      { ic:'🔋', t:'Recarregar a bateria da transpaleteira em local ventilado e sinalizado, sem fumar por perto.', ok:true, e:'Correto! A recarga libera hidrogênio, que é inflamável.' },
      { ic:'🪵', t:'Movimentar carga sobre palete quebrado, só por alguns metros.', ok:false, e:'Mesmo em trajetos curtos o palete pode ceder. Troque o palete antes.' }
    ] }, { tipo:'quiz', perguntas:[
      { p:'Por que é proibido fumar na área de recarga de baterias?', o:['A recarga libera hidrogênio, gás inflamável e explosivo','Porque suja o piso','Por causa do cheiro','Não é proibido'], e:'O hidrogênio liberado na recarga pode explodir com uma faísca ou chama.' },
      { p:'Como deixar a paleteira após o uso?', o:['Em local demarcado, garfos abaixados e fora da circulação','No meio do corredor para o próximo usar','Com os garfos levantados','Na faixa de pedestres'], e:'Equipamento fora do lugar vira obstáculo e causa tropeços.' },
      { p:'Antes de usar a transpaleteira elétrica, o operador deve…', o:['Fazer o checklist: freio, buzina, botão de emergência, rodas e bateria','Apenas ligar e sair','Verificar só a bateria','Pedir para outro colega testar'], e:'O checklist identifica falhas como freio ruim ou botão de emergência sem funcionar.' }
    ] } ] },
  { id:'f4', nome:'Estruturas Porta-Paletes', ic:'🏗️', cor:'#2e5fa8', resumo:'Inspeção de montantes, longarinas, travas, capacidade de carga e armazenagem correta.',
    etapas:[ { tipo:'cena', cena:'portapaletes' }, { tipo:'cartas', itens:[
      { ic:'🔍', t:'Notei um montante amassado: isolei a área, avisei a liderança e relatei no Alerta Amigo.', ok:true, e:'Correto! Danos na estrutura devem ser relatados no Alerta Amigo na hora e a área isolada.' },
      { ic:'🧗', t:'Subir pela estrutura para pegar uma caixa no 3º nível, é rapidinho.', ok:false, e:'Nunca escale a estrutura. Use equipamento adequado e autorizado.' },
      { ic:'⚖️', t:'Respeitar a carga máxima indicada na placa de identificação da estrutura.', ok:true, e:'Correto! Excesso de peso deforma longarinas e pode derrubar a estrutura.' },
      { ic:'📦', t:'Armazenar palete com a carga passando da longarina e sem filme stretch.', ok:false, e:'A carga deve estar estável, envolvida e centralizada sobre as longarinas.' }
    ] }, { tipo:'quiz', perguntas:[
      { p:'O que fazer ao encontrar um montante (coluna) amassado?', o:['Isolar a área, avisar a liderança/SST e relatar no Alerta Amigo','Desamassar com uma marreta','Continuar usando com cuidado','Colocar mais carga para firmar'], e:'Só um profissional pode avaliar o dano. Até lá, a posição fica isolada e descarregada.' },
      { p:'Para que serve a trava de segurança da longarina?', o:['Impedir que a longarina se desencaixe do montante','É apenas um enfeite','Servir de degrau','Aumentar a capacidade de carga'], e:'Sem a trava, uma batida pode soltar a longarina e derrubar a carga.' },
      { p:'Onde está a capacidade máxima de carga da estrutura?', o:['Na placa de identificação de carga fixada na estrutura','Na memória do operador','Não existe limite','Na nota fiscal do produto'], e:'A placa informa o peso máximo por nível/posição. Consulte sempre antes de armazenar.' }
    ] } ] },
  { id:'f5', nome:'Picking', ic:'📦', cor:'#7c3aed', resumo:'Ergonomia, uso de estilete, acesso a níveis altos e selecionadora de pedidos.',
    etapas:[ { tipo:'cena', cena:'picking' }, { tipo:'cartas', itens:[
      { ic:'🏋️', t:'Levantar a caixa dobrando os joelhos, com a coluna reta e a carga próxima ao corpo.', ok:true, e:'Correto! Essa postura protege a coluna.' },
      { ic:'🔪', t:'Cortar a fita da caixa com o estilete na direção do corpo.', ok:false, e:'Corte sempre para longe do corpo, com estilete de segurança e luva anticorte.' },
      { ic:'📚', t:'Subir em caixas para alcançar o produto no nível de cima.', ok:false, e:'Use plataforma ou escada adequada. Caixas cedem e causam quedas.' },
      { ic:'🦺', t:'Na selecionadora de pedidos, manter o cinto/talabarte conectado ao ponto de ancoragem.', ok:true, e:'Correto! O talabarte evita a queda em caso de desequilíbrio.' }
    ] }, { tipo:'quiz', perguntas:[
      { p:'Qual a postura correta para levantar uma caixa do chão?', o:['Joelhos dobrados, coluna reta e carga junto ao corpo','Pernas esticadas e coluna curvada','Girar o tronco enquanto levanta','Levantar com um braço só'], e:'Use a força das pernas, não das costas, e evite torcer o tronco.' },
      { p:'Qual o uso correto do estilete?', o:['Estilete retrátil, cortando para longe do corpo e com luva anticorte','Cortar em direção ao corpo para ter firmeza','Guardar com a lâmina aberta no bolso','Usar sem luva para ter mais tato'], e:'Estilete de segurança + corte para longe do corpo + luva = mãos protegidas.' },
      { p:'O produto está num nível alto, fora do alcance. O que fazer?', o:['Usar equipamento adequado (plataforma/escada com guarda-corpo) ou pedir apoio','Subir na estrutura','Subir em caixas empilhadas','Puxar a caixa com um gancho improvisado'], e:'Improviso em altura é uma das principais causas de queda no picking.' }
    ] } ] },
  { id:'f6', nome:'Logística Reversa', ic:'♻️', cor:'#0f766e', resumo:'Devoluções, produtos avariados, paletes danificados, descarte e rotas de fuga.',
    etapas:[ { tipo:'cena', cena:'reversa' }, { tipo:'cartas', itens:[
      { ic:'🧪', t:'Separar e sinalizar o produto avariado com vazamento, usando os EPIs indicados na FDS.', ok:true, e:'Correto! A FDS (antiga FISPQ) informa os riscos do produto e os EPIs necessários.' },
      { ic:'🍾', t:'Recolher garrafas quebradas sem luva porque é só um minuto.', ok:false, e:'Use luva adequada e pá/vassoura. Um corte acontece em um segundo.' },
      { ic:'🚪', t:'Deixar as devoluções na frente da saída de emergência até liberar espaço.', ok:false, e:'Saída de emergência nunca pode ser obstruída, nem por pouco tempo.' },
      { ic:'🔨', t:'Retirar de uso os paletes com pregos expostos e encaminhar para descarte ou reparo.', ok:true, e:'Correto! Pregos expostos causam perfurações e rasgam embalagens.' }
    ] }, { tipo:'quiz', perguntas:[
      { p:'Um produto devolvido está vazando. Qual o primeiro passo?', o:['Isolar a área, consultar a FDS e usar os EPIs indicados para conter','Limpar com as mãos','Guardar junto com os outros produtos','Jogar no lixo comum'], e:'Primeiro proteja as pessoas: isole, identifique o produto e use o EPI correto.' },
      { p:'Como deve ficar a área da saída de emergência?', o:['Sempre desobstruída e sinalizada','Pode guardar devoluções temporariamente','Pode ficar trancada','Só precisa estar livre em dia de auditoria'], e:'Em uma emergência cada segundo conta. A rota de fuga deve estar sempre livre.' },
      { p:'Paletes vazios devem ser empilhados…', o:['Em pilhas estáveis, com altura limitada e em local demarcado','O mais alto possível para economizar espaço','Encostados na parede, inclinados','Na faixa de pedestres'], e:'Pilhas altas e tortas tombam. Respeite a altura máxima definida pela empresa.' }
    ] } ] },
  { id:'f7', nome:'Carregamento de Docas', ic:'🚚', cor:'#1A2540', resumo:'Calço de roda, nivelador, semáforo da doca, quedas e carga na carreta.',
    etapas:[ { tipo:'cena', cena:'docas' }, { tipo:'cartas', itens:[
      { ic:'🛞', t:'Colocar o calço nas rodas da carreta antes de iniciar o carregamento.', ok:true, e:'Correto! O calço impede que a carreta se mova durante a operação.' },
      { ic:'🦘', t:'Pular da doca para o pátio para economizar caminho.', ok:false, e:'Use a escada de acesso. Pular da doca causa quedas e torções.' },
      { ic:'🚦', t:'Entrar com a empilhadeira na carreta com o semáforo da doca vermelho.', ok:false, e:'Vermelho = veículo não liberado. Aguarde o verde.' },
      { ic:'🔩', t:'Conferir se o nivelador está bem apoiado na carreta antes de entrar com o equipamento.', ok:true, e:'Correto! Nivelador mal apoiado abre um vão perigoso.' }
    ] }, { tipo:'quiz', perguntas:[
      { p:'Para que serve o calço de roda na doca?', o:['Impedir que a carreta se movimente durante a carga e descarga','Nivelar a carreta','Proteger o pneu do sol','Servir de degrau'], e:'Se a carreta se mover, abre-se um vão entre a doca e o veículo, com risco de queda.' },
      { p:'O semáforo da doca está vermelho. Isso significa que…', o:['É proibido entrar na carreta: o veículo não está liberado','Pode entrar com cuidado','Só a paleteira pode entrar','O motorista está almoçando'], e:'Só entre com a luz verde, calço posicionado e nivelador apoiado.' },
      { p:'Onde o motorista do caminhão deve ficar durante o carregamento?', o:['Na área de espera indicada, fora da doca e da área de manobra','Dentro da carreta ajudando','Entre o caminhão e a doca','Na cabine com o motor ligado'], e:'Siga a regra da unidade: o motorista aguarda em local seguro, longe da operação.' }
    ] } ] },
  { id:'f8', nome:'Desafio Final', ic:'🏆', cor:'#b7800b', resumo:'Perguntas de todas as fases contra o relógio. Responda rápido para ganhar bônus!',
    etapas:[ { tipo:'quiz', aleatorio:10, tempo:20 } ] }
];
var EXTRAS = [
  { p:'O que é uma CONDIÇÃO insegura?', o:['Uma falha no ambiente ou no equipamento que pode causar acidente','Uma atitude errada da pessoa','Um acidente que já aconteceu','Um tipo de EPI'], e:'Exemplos: piso com óleo, montante amassado, extintor obstruído.' },
  { p:'O que é um COMPORTAMENTO inseguro?', o:['Uma atitude da pessoa que a expõe (ou expõe outros) ao risco','Um defeito na máquina','Uma placa de sinalização','Um tipo de treinamento'], e:'Exemplos: correr no galpão, usar celular dirigindo, subir na estrutura.' },
  { p:'Você viu um risco que não consegue resolver sozinho. O que fazer?', o:['Relatar no Alerta Amigo e avisar a liderança/SST','Esperar alguém resolver','Comentar no grupo e seguir','Nada, não é minha área'], e:'Todo desvio relatado no Alerta Amigo é um acidente evitado. Segurança é responsabilidade de todos.' },
  { p:'Onde relatar qualquer desvio de segurança (condição insegura, comportamento inseguro ou quase acidente)?', o:['No Alerta Amigo','Em lugar nenhum, se ninguém se machucou','Só no grupo de WhatsApp da equipe','Só no fim do mês, na reunião'], e:'Qualquer desvio deve ser relatado no Alerta Amigo, mesmo que ninguém tenha se machucado. O quase acidente de hoje é o acidente de amanhã.' },
  { p:'Quando você pode exercer o direito de recusa?', o:['Quando houver risco grave e iminente à sua vida ou saúde','Quando não gostar da tarefa','Quando estiver cansado','Quando o colega faltar'], e:'A NR-1 garante o direito de interromper a atividade diante de risco grave e iminente, comunicando a liderança.' },
  { p:'Qual a distância segura para o pedestre em relação a uma empilhadeira em operação?', o:['Manter distância (no mínimo cerca de 3 m ou a definida pela empresa) e contato visual','Encostar para ajudar a guiar','1 palmo, se o operador for experiente','Não existe distância segura'], e:'Distância e contato visual com o operador evitam atropelamentos.' }
];

/* ============================================================
   NÍVEIS
   ============================================================ */
var NIVEIS = [
  { min:0, nome:'Iniciante', ic:'🟢' },
  { min:1500, nome:'Atento', ic:'👀' },
  { min:3500, nome:'Prevencionista', ic:'🛡️' },
  { min:5500, nome:'Guardião do Galpão', ic:'🦺' },
  { min:7500, nome:'Mestre da Segurança', ic:'🏆' }
];
function nivel(t){ var n = NIVEIS[0], prox = null; for (var i = 0; i < NIVEIS.length; i++){ if (t >= NIVEIS[i].min) { n = NIVEIS[i]; prox = NIVEIS[i+1] || null; } } return { n:n, prox:prox }; }
function total(p){ var s = 0; FASES.forEach(function(f){ var r = p.fases && p.fases[f.id]; if (r) s += r.best || 0; }); return s; }
function concluidas(p){ return FASES.filter(function(f){ var r = p.fases && p.fases[f.id]; return r && r.stars >= 1; }).length; }
function estrelasTot(p){ var s = 0; FASES.forEach(function(f){ var r = p.fases && p.fases[f.id]; if (r) s += r.stars || 0; }); return s; }
function liberada(p, i){ if (i === 0) return true; var r = p.fases && p.fases[FASES[i-1].id]; return !!(r && r.stars >= 1); }
function atual(){ return DB.atual && DB.players[DB.atual] ? DB.players[DB.atual] : null; }
function stars(n){ var s = ''; for (var i = 0; i < 3; i++) s += i < n ? '<b>★</b>' : '★'; return s; }

/* ============================================================
   TELAS
   ============================================================ */
function heroSvg(){
  var s = '<svg viewBox="0 120 1000 440" aria-hidden="true">' + bg({faixa:true});
  s += rack(560, { bays:2, levels:2, bw:200, lh:125, cell:function(b,k){ return { h:86, filme:true }; } });
  s += empilhadeira(140, { carga:70, garfo:12, movendo:true, luzAzul:300 });
  s += P(480, 532, { pose:'walk', colete:true, shirt:'#0f766e' }) + P(620, 532, { pose:'walk', colete:true, flip:true, shirt:'#7c3aed', capacete:'#fff' });
  return s + '</svg>';
}
function telaInicio(){
  clearAll();
  var p = atual();
  var h = '<div class="logo-bar"><img src="' + LOGO + '" alt="Emergent Cold LatAm"></div><div class="hero"><div class="txt"><h1>Galpão Seguro 🦺</h1><p>Jogos de segurança do trabalho para o armazém: trânsito de empilhadeiras, paleteiras, porta-paletes, picking, reversa, docas e caminho seguro. Encontre condições e comportamentos inseguros, passe de fase e acumule pontos!</p></div>' + heroSvg() + '</div>';
  if (p){
    h += '<div class="card quem"><div class="av">' + esc(iniciais(p.nome)) + '</div><div style="flex:1"><b>' + esc(p.nome) + '</b><div class="muted">Matrícula ' + esc(p.matricula) + ' · ' + fmt(total(p)) + ' pontos · ' + nivel(total(p)).n.ic + ' ' + nivel(total(p)).n.nome + '</div></div><button class="btn sm ghost" data-act="trocar">Trocar</button></div>';
  }
  h += alertaAmigo() + '<div style="height:14px"></div>';
  h += '<div class="menu">';
  if (p){
    h += '<button class="btn ok" data-act="jogar"><span>▶️</span>Continuar jogando<small>Ir para o mapa de fases</small></button>';
    h += '<button class="btn" data-act="trocar"><span>🔄</span>Não é você?<small>Entrar com outra matrícula</small></button>';
  } else {
    h += '<button class="btn ok" data-act="inscricao"><span>📝</span>Cadastrar e jogar<small>Primeira vez? Comece aqui</small></button>';
    h += '<button class="btn" data-act="entrarMat"><span>🔑</span>Já tenho cadastro<small>Entrar com a matrícula</small></button>';
  }
  h += '</div>';
  h += '<div class="card" style="margin-top:14px"><h2>Como funciona</h2><div class="grid2">' +
       '<div>🔍 <b>Caça aos Riscos:</b> toque nos perigos da cena e diga se é <span class="tag c">CONDIÇÃO</span> ou <span class="tag b">COMPORTAMENTO</span> inseguro.</div>' +
       '<div>👍 <b>Seguro ou Inseguro?</b> Avalie situações do dia a dia.</div>' +
       '<div>❓ <b>Quiz:</b> perguntas rápidas com explicação de cada resposta.</div>' +
       '<div>🚶 <b>Labirinto:</b> chegue ao posto de trabalho pelo caminho seguro, sem ser atingido.</div>' +
       '</div><p class="muted" style="margin:12px 0 0;font-size:14px"><span class="tag c">CONDIÇÃO INSEGURA</span> = falha no ambiente ou equipamento (ex.: óleo no piso). <span class="tag b">COMPORTAMENTO INSEGURO</span> = atitude da pessoa (ex.: correr, usar celular dirigindo).</p></div>';
  h += '<div class="card credito"><div class="av" style="background:var(--navy);color:#fff">LT</div><div><div class="muted" style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;font-weight:700">Criação e conteúdo</div><b style="font-size:17px">Luan Tavarez</b><div class="muted">Técnico em Segurança do Trabalho</div><div style="font-size:14px;margin-top:6px;line-height:1.45">Programa Galpão Seguro, desenvolvido para conscientizar as equipes do armazém sobre condições e comportamentos inseguros na operação: trânsito de empilhadeiras, paleteiras, porta-paletes, picking, logística reversa, docas e caminho seguro.</div></div></div>';
  h += '<div class="foot">Os dados de inscrição e pontuação ficam salvos somente neste aparelho/navegador.</div>';
  app.innerHTML = h; scrollTo(0,0);
}

var SETORES = ['Recebimento','Armazenagem','Picking / Separação','Expedição','Docas / Carregamento','Logística Reversa','Inventário','Manutenção','Administrativo','Liderança','Terceiro / Temporário','Outro'];
function telaInscricao(foco){
  clearAll();
  var h = '<div class="grid2"><div class="card"><h2>📝 Cadastro</h2><form id="fIns" autocomplete="off">' +
    '<label class="f">Nome completo *<input name="nome" required maxlength="80" placeholder="Ex.: Maria da Silva"></label>' +
    '<label class="f">Matrícula *<input name="matricula" required maxlength="20" placeholder="Ex.: 12345"></label>' +
    '<label class="f">Setor<select name="setor"><option value="">Selecione…</option>' + SETORES.map(function(s){ return '<option>' + s + '</option>'; }).join('') + '</select></label>' +
    '<label class="f">Turno<select name="turno"><option value="">Selecione…</option><option>1º turno</option><option>2º turno</option><option>3º turno</option><option>Comercial</option></select></label>' +
    '<label class="f">Função<input name="funcao" maxlength="50" placeholder="Ex.: Operador de empilhadeira"></label>' +
    '<button class="btn ok big" type="submit">✅ Inscrever e jogar</button></form></div>';
  h += '<div class="card" id="cardEntrar"><h2>🔑 Já tenho cadastro</h2><p class="muted" style="margin-top:-4px">Digite a sua matrícula para continuar de onde parou.</p><form id="fEnt" autocomplete="off">' +
    '<label class="f">Matrícula<input name="mat" required maxlength="20" placeholder="Ex.: 12345"></label>' +
    '<button class="btn big" type="submit">▶ Entrar e jogar</button></form></div></div>';
  app.innerHTML = h; scrollTo(0,0);
  if (foco){ var ce = document.getElementById('cardEntrar'); ce.scrollIntoView({ block:'start' }); ce.querySelector('input').focus(); }
  document.getElementById('fEnt').addEventListener('submit', function(ev){
    ev.preventDefault();
    var mat = String(new FormData(ev.target).get('mat')).trim().toUpperCase(), p = DB.players[mat];
    if (!p) { toast('Matrícula não encontrada neste aparelho. Faça o cadastro.'); SND.bad(); return; }
    DB.atual = mat; save(); SND.ok(); toast('Bem-vindo(a) de volta, ' + p.nome.split(' ')[0] + '!'); telaMapa();
  });
  document.getElementById('fIns').addEventListener('submit', function(ev){
    ev.preventDefault();
    var fd = new FormData(ev.target), nome = String(fd.get('nome')).trim().replace(/\s+/g,' '), mat = String(fd.get('matricula')).trim().toUpperCase();
    if (nome.length < 3) { toast('Informe o nome completo.'); return; }
    if (!mat) { toast('Informe a matrícula.'); return; }
    var id = mat, ex = DB.players[id];
    if (ex && ex.nome.toLowerCase() !== nome.toLowerCase()){
      toast('Esta matrícula já tem cadastro. Use “Já tenho cadastro” para entrar.'); SND.bad(); return;
    } else if (!ex){
      DB.players[id] = { id:id, nome:nome, matricula:mat, setor:String(fd.get('setor')||''), turno:String(fd.get('turno')||''), funcao:String(fd.get('funcao')||'').trim(), criado:hoje(), fases:{} };
    }
    DB.atual = id; save(); SND.ok(); toast('Bem-vindo(a), ' + DB.players[id].nome.split(' ')[0] + '!'); telaMapa();
  });
}

function telaMapa(){
  clearAll();
  var p = atual(); if (!p) { telaInscricao(); return; }
  var t = total(p), nv = nivel(t), pct = nv.prox ? Math.min(100, (t - nv.n.min) / (nv.prox.min - nv.n.min) * 100) : 100;
  var todas = concluidas(p) === FASES.length;
  var h = '<div class="card perfil"><div class="av" style="width:60px;height:60px;font-size:22px">' + esc(iniciais(p.nome)) + '</div><div class="dados"><b style="font-size:19px">' + esc(p.nome) + '</b><div class="muted" style="font-size:14px">Mat. ' + esc(p.matricula) + (p.setor ? ' · ' + esc(p.setor) : '') + (p.turno ? ' · ' + esc(p.turno) : '') + '</div>' +
    '<div style="margin-top:6px"><span class="badge">' + nv.n.ic + ' ' + nv.n.nome + '</span></div>' +
    '<div class="prog"><i style="width:' + pct + '%"></i></div><small class="muted">' + (nv.prox ? 'Faltam ' + fmt(nv.prox.min - t) + ' pontos para ' + nv.prox.ic + ' ' + nv.prox.nome : 'Nível máximo alcançado!') + '</small></div>' +
    '<div style="text-align:right"><div class="pts">' + fmt(t) + '</div><div class="muted">pontos · ' + concluidas(p) + '/' + FASES.length + ' fases · ' + estrelasTot(p) + '★</div>' + (todas ? '<button class="btn sm gold" style="margin-top:8px" data-act="certificado" data-id="' + esc(p.id) + '">🎓 Certificado</button>' : '') + '</div></div>';
  h += '<div class="fases">';
  FASES.forEach(function(f, i){
    var r = (p.fases && p.fases[f.id]) || null, lib = liberada(p, i), st = r ? r.stars : 0;
    h += '<div class="fase' + (lib ? '' : ' lock') + (st >= 1 ? ' done' : '') + '"><span class="num">' + (i+1) + '</span><div class="ic" style="background:' + f.cor + '">' + (lib ? f.ic : '🔒') + '</div><h3>' + f.nome + '</h3><p>' + f.resumo + '</p>' +
      '<div class="row" style="justify-content:space-between"><span class="estrelas">' + stars(st) + '</span><small class="muted">' + (r ? 'Recorde: <b>' + fmt(r.best) + '</b>' : '') + '</small></div>' +
      (lib ? '<button class="btn ' + (st >= 1 ? 'ghost' : 'ok') + '" data-act="fase" data-i="' + i + '">' + (st >= 1 ? '🔁 Jogar de novo' : '▶ Jogar') + '</button>' : '<button class="btn" disabled>🔒 Conclua a fase ' + i + '</button>') + '</div>';
  });
  h += '</div><div class="foot">Faça pelo menos ★ (1 estrela) para liberar a próxima fase. O ranking usa a soma dos seus recordes em cada fase.</div>';
  app.innerHTML = h; scrollTo(0,0);
}

/* ============================================================
   MOTOR DAS FASES
   ============================================================ */
var RUN = null, stage = null;
var NOMES_ETAPA = { labirinto:'Labirinto do Caminho Seguro', cena:'Caça aos Riscos', cartas:'Seguro ou Inseguro?', quiz:'Quiz' };
function iniciarFase(i){
  clearAll();
  var f = FASES[i];
  RUN = { f:f, idx:i, e:0, pts:0, max:0, bonus:0 };
  app.innerHTML = '<div class="hud"><button class="btn sm ghost" data-act="sair">✕ Sair</button><div class="t"><b>' + f.ic + ' Fase ' + (i+1) + ' · ' + f.nome + '</b><small id="hudEt"></small></div><div class="steps" id="hudSt"></div><div class="score">⭐ <span id="hudPts">0</span></div></div><div id="stage"></div>';
  stage = document.getElementById('stage');
  proximaEtapa();
}
function hud(local){
  var el = document.getElementById('hudPts'); if (el) el.textContent = fmt(RUN.pts + (local || 0));
}
function proximaEtapa(){
  clearAll();
  if (RUN.e >= RUN.f.etapas.length) { finalizarFase(); return; }
  var et = RUN.f.etapas[RUN.e];
  document.getElementById('hudEt').textContent = 'Etapa ' + (RUN.e+1) + ' de ' + RUN.f.etapas.length + ' · ' + NOMES_ETAPA[et.tipo];
  document.getElementById('hudSt').innerHTML = RUN.f.etapas.map(function(_, k){ return '<i class="' + (k < RUN.e ? 'ok' : k === RUN.e ? 'on' : '') + '"></i>'; }).join('');
  hud(0); scrollTo(0,0);
  intro(et, function(){ ETAPAS[et.tipo](et, function(pts, max, bonus){ RUN.pts += pts; RUN.max += max; RUN.bonus += bonus || 0; RUN.e++; proximaEtapa(); }); });
}
function intro(et, go){
  var I = {
    labirinto: ['🚶','Labirinto do Caminho Seguro','Leve o colaborador 👷 até o 🏁 posto de trabalho.',['Ande somente pela <b>faixa verde de pedestres</b>.','Atravesse os corredores das empilhadeiras <b>só nas faixas zebradas</b>.','Na faixa, <b>pare e olhe</b>: espere a empilhadeira passar.','Pegue os 3 EPIs no caminho: 🦺 🥾 🧤','Use as setas do teclado, os botões na tela ou toque na casa ao lado.']],
    cena: ['🔍','Caça aos Riscos', CENAS[et.cena] ? CENAS[et.cena].titulo + ': ' + CENAS[et.cena].instr : '', ['Toque no risco que você encontrar na cena.','Diga se é <span class="tag c">CONDIÇÃO INSEGURA</span> (ambiente/equipamento) ou <span class="tag b">COMPORTAMENTO INSEGURO</span> (atitude da pessoa).','Acertou a classificação: <b>+100</b>. Toque errado na cena: <b>−10</b>.','Achou tudo antes do tempo acabar? Ganha bônus de tempo!','📣 Na vida real, qualquer desvio que você encontrar deve ser relatado no <b>Alerta Amigo</b>.']],
    cartas: ['👍','Seguro ou Inseguro?','Leia cada situação e decida se ela é segura ou insegura.',['Cada acerto vale <b>+50</b> pontos.','Leia a explicação para aprender o porquê.']],
    quiz: ['❓', RUN.f.id === 'f8' ? 'Desafio Final' : 'Quiz', RUN.f.id === 'f8' ? 'Perguntas de todas as fases. Você tem ' + (et.tempo||20) + ' segundos por pergunta.' : 'Responda às perguntas sobre o tema da fase.',['Cada acerto vale <b>+100</b> pontos.'].concat(et.tempo ? ['Responda rápido: bônus de até <b>+50</b> por pergunta!'] : [])]
  }[et.tipo];
  stage.innerHTML = '<div class="card intro"><div class="big">' + I[0] + '</div><h2>' + I[1] + '</h2><p>' + I[2] + '</p><ul>' + I[3].map(function(l){ return '<li>' + l + '</li>'; }).join('') + '</ul><button class="btn ok big" id="goEt" style="max-width:360px">Começar ▶</button></div>';
  document.getElementById('goEt').onclick = function(){ SND.click(); go(); };
}

var ETAPAS = {};

/* ---------- CAÇA AOS RISCOS ---------- */
ETAPAS.cena = function(et, done){
  var c = CENAS[et.cena], RS = c.riscos, total = RS.length, found = {}, nF = 0, pts = 0, left = c.tempo || 100, paused = false, ended = false;
  stage.innerHTML = '<div class="bar"><span class="pill">🔍 <b id="cf">0</b>/' + total + ' riscos</span><span class="pill" id="ctp">⏱️ <b id="ct">' + left + '</b>s</span><button class="btn sm" id="dica">💡 Dica (−30)</button><span class="lg c"><i></i>Condição</span><span class="lg b"><i></i>Comportamento</span></div><div class="rot">📱↻ Dica: gire o celular na horizontal para ver a cena maior.</div>' +
    '<div class="scene-wrap"><svg id="scene" viewBox="0 0 1000 560">' + c.draw() + (DEBUG ? RS.map(function(r){ return r.w ? '<rect x="'+(r.x-r.w/2)+'" y="'+(r.y-r.h/2)+'" width="'+r.w+'" height="'+r.h+'" fill="#f0f" opacity=".3"/>' : '<circle cx="'+r.x+'" cy="'+r.y+'" r="'+r.r+'" fill="#f0f" opacity=".3"/>'; }).join('') : '') + '<g id="marks"></g></svg></div>' +
    '<div class="tbar"><i id="tbar"></i></div><div id="cenaFim"></div>';
  var svg = document.getElementById('scene'), marks = document.getElementById('marks');
  function upd(){ document.getElementById('cf').textContent = nF; hud(pts); }
  var tm = setInterval(function(){
    if (paused || ended) return;
    left--; document.getElementById('ct').textContent = left;
    var b = document.getElementById('tbar'); b.style.width = (left / (c.tempo||100) * 100) + '%'; if (left <= 20) { b.style.background = 'var(--bad)'; document.getElementById('ctp').classList.add('warn'); }
    if (left <= 0) fim(false);
  }, 1000);
  TIMERS.push(tm);
  function hitTest(r, p){ if (r.w) return Math.abs(p.x - r.x) <= r.w/2 && Math.abs(p.y - r.y) <= r.h/2; return Math.hypot(p.x - r.x, p.y - r.y) <= r.r * 1.12; }
  function marca(r, n, cls){
    var col = r.tipo === 'c' ? '#e67e22' : '#c0392b', rr = r.w ? Math.max(r.h, 40) : r.r;
    marks.insertAdjacentHTML('beforeend', '<g class="' + (cls || 'mk') + '"><circle cx="'+r.x+'" cy="'+r.y+'" r="'+rr+'" fill="'+col+'" fill-opacity=".14" stroke="'+col+'" stroke-width="5"' + (cls === 'missed' ? ' stroke-dasharray="10 7"' : '') + '/><circle cx="'+(r.x+rr*0.72)+'" cy="'+(r.y-rr*0.72)+'" r="15" fill="'+(cls === 'missed' ? '#6b7280' : col)+'"/>' + txt(r.x+rr*0.72, r.y-rr*0.72+6, n, 17, '#fff') + '</g>');
  }
  svg.addEventListener('click', function(ev){
    if (paused || ended) return;
    var pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
    var p = pt.matrixTransform(svg.getScreenCTM().inverse()), hit = null;
    for (var i = 0; i < RS.length; i++){ if (!found[i] && hitTest(RS[i], p)) { hit = i; break; } }
    if (hit === null){
      for (i = 0; i < RS.length; i++) if (found[i] && hitTest(RS[i], p)) return; // já encontrado
      pts = Math.max(0, pts - 10); upd(); SND.bad();
      marks.insertAdjacentHTML('beforeend', '<g class="miss">' + txt(R(p.x), R(p.y+12), '✖', 38, '#c0392b') + '</g>');
      return;
    }
    paused = true; SND.click();
    var r = RS[hit];
    modal('<h3>🔍 Você encontrou um risco!</h3><p style="margin:0;font-size:17px"><b>' + r.t + '</b></p><p class="muted" style="margin:8px 0 0">Como ele se classifica?</p><div class="opts">' +
      '<button class="btn cond" data-c="c">🏚️ Condição insegura<small>Falha no ambiente, estrutura ou equipamento</small></button>' +
      '<button class="btn comp" data-c="b">🙋 Comportamento inseguro<small>Atitude ou ação da pessoa</small></button></div>');
    MB.querySelectorAll('[data-c]').forEach(function(b){ b.onclick = function(){
      var ok = b.getAttribute('data-c') === r.tipo, g = ok ? 100 : 40;
      found[hit] = { ok:ok, n:++nF }; pts += g; upd(); marca(r, nF); ok ? SND.ok() : SND.bad();
      modal('<div class="fb ' + (ok ? 'ok' : 'bad') + '"><b class="h">' + (ok ? '✅ Correto! +100' : '⚠️ Quase! +40') + '</b>' + (ok ? '' : 'Este é um <b>' + (r.tipo === 'c' ? 'CONDIÇÃO INSEGURA' : 'COMPORTAMENTO INSEGURO') + '</b>.<br>') +
        '<b>' + r.t + '</b><br>' + r.e + '</div>' + alertaAmigo(true) + '<div class="opts"><button class="btn ok" id="contC">Continuar ▶</button></div>');
      document.getElementById('contC').onclick = function(){ closeModal(); if (nF >= total) fim(true); else paused = false; };
    }; });
  });
  document.getElementById('dica').onclick = function(){
    if (paused || ended) return;
    var rest = []; RS.forEach(function(r, i){ if (!found[i]) rest.push(r); });
    if (!rest.length) return;
    var r = rest[Math.floor(Math.random()*rest.length)];
    pts = Math.max(0, pts - 30); upd(); SND.click();
    var x = r.x + (Math.random()*40 - 20), y = r.y + (Math.random()*40 - 20);
    marks.insertAdjacentHTML('beforeend', '<g class="hint" style="animation-fill-mode:forwards"><circle cx="'+R(x)+'" cy="'+R(y)+'" r="'+(Math.max(r.r, 40)+40)+'" fill="#facc15" fill-opacity=".25" stroke="#facc15" stroke-width="6"/></g>');
    var g = marks.lastChild; TIMERS.push(setTimeout(function(){ if (g && g.parentNode) g.parentNode.removeChild(g); }, 2200));
  };
  function fim(todos){
    if (ended) return; ended = true; clearInterval(tm); closeModal();
    var bonus = todos ? left * 2 : 0; pts += bonus; upd();
    var n = nF;
    RS.forEach(function(r, i){ if (!found[i]) marca(r, ++n, 'missed'); });
    if (todos) SND.win(); else SND.bad();
    var lista = RS.map(function(r, i){ var f = found[i]; return { r:r, f:f }; }).sort(function(a, b){ return (a.f ? a.f.n : 99) - (b.f ? b.f.n : 99); });
    var h = '<div class="card resumo"><h2>' + (todos ? '🎉 Você encontrou todos os riscos!' : '⏰ O tempo acabou!') + '</h2><p class="muted" style="margin-top:-6px">' + nF + ' de ' + total + ' riscos encontrados' + (bonus ? ' · Bônus de tempo: <b>+' + bonus + '</b>' : '') + ' · Pontos da etapa: <b>' + fmt(pts) + '</b></p>';
    var k = nF;
    lista.forEach(function(o){
      var num = o.f ? o.f.n : ++k, col = o.f ? (o.r.tipo === 'c' ? 'var(--cond)' : 'var(--comp)') : '#9aa3ad';
      h += '<div class="rz"><div class="n" style="background:' + col + '">' + num + '</div><div><div class="tt">' + o.r.t + ' <span class="tag ' + o.r.tipo + '">' + (o.r.tipo === 'c' ? 'CONDIÇÃO' : 'COMPORTAMENTO') + '</span>' + (o.f ? (o.f.ok ? ' ✅' : ' ⚠️ classificação errada') : ' <span class="tag miss">NÃO ENCONTRADO</span>') + '</div><div class="ex">' + o.r.e + '</div></div></div>';
    });
    h += alertaAmigo() + '<button class="btn ok big" id="cenaOk" style="margin-top:12px">Próxima etapa ▶</button></div>';
    document.getElementById('cenaFim').innerHTML = h;
    document.getElementById('cenaOk').onclick = function(){ done(pts, total * 100, bonus); };
    TIMERS.push(setTimeout(function(){ var el = document.getElementById('cenaFim'); if (el) el.scrollIntoView({ behavior:'smooth' }); }, todos ? 900 : 300));
  }
};

/* ---------- SEGURO OU INSEGURO ---------- */
ETAPAS.cartas = function(et, done){
  var itens = shuffle(et.itens.slice()), i = 0, pts = 0, acertos = 0;
  function render(){
    var it = itens[i];
    stage.innerHTML = '<div class="cardq" id="cq"><div class="emo">' + it.ic + '</div><div class="txt">' + it.t + '</div><div class="cnt">Situação ' + (i+1) + ' de ' + itens.length + '</div></div>' +
      '<div class="duo" id="duo"><button class="btn big ok" data-r="1">👍 SEGURO</button><button class="btn big bad" data-r="0">⚠️ INSEGURO</button></div><div id="fb"></div>';
    stage.querySelectorAll('[data-r]').forEach(function(b){ b.onclick = function(){
      var resp = b.getAttribute('data-r') === '1', ok = resp === it.ok;
      if (ok) { pts += 50; acertos++; SND.ok(); } else SND.bad();
      hud(pts);
      document.getElementById('cq').classList.add(ok ? 'ok' : 'bad');
      document.getElementById('duo').style.display = 'none';
      document.getElementById('fb').innerHTML = '<div class="fb ' + (ok ? 'ok' : 'bad') + '"><b class="h">' + (ok ? '✅ Acertou! +50' : '❌ Errou!') + '</b>Esta situação é <b>' + (it.ok ? 'SEGURA' : 'INSEGURA') + '</b>. ' + it.e + '<br><button class="btn ' + (ok ? 'ok' : '') + '" id="nx">' + (i + 1 < itens.length ? 'Próxima ▶' : 'Concluir etapa ▶') + '</button></div>';
      document.getElementById('nx').onclick = function(){ i++; if (i < itens.length) render(); else done(pts, itens.length * 50); };
    }; });
  }
  render();
};

/* ---------- QUIZ ---------- */
ETAPAS.quiz = function(et, done){
  var qs;
  if (et.aleatorio){
    var pool = EXTRAS.slice();
    FASES.forEach(function(f){ f.etapas.forEach(function(e){ if (e.tipo === 'quiz' && e.perguntas) pool = pool.concat(e.perguntas); }); });
    qs = shuffle(pool).slice(0, et.aleatorio);
  } else qs = et.perguntas.slice();
  var i = 0, pts = 0, bon = 0, T = et.tempo || 0;
  function render(){
    var q = qs[i], ops = shuffle(q.o.map(function(t, k){ return { t:t, c:k === 0 }; })), left = T, answered = false, tm = null;
    stage.innerHTML = '<div class="qbox"><div class="bar"><span class="pill">Pergunta ' + (i+1) + ' de ' + qs.length + '</span>' + (T ? '<span class="pill" id="qtp">⏱️ <b id="qt">' + T + '</b>s</span>' : '') + '</div>' + (T ? '<div class="tbar" style="margin:0 0 6px"><i id="qbar"></i></div>' : '') +
      '<div class="qp">' + q.p + '</div>' + ops.map(function(o, k){ return '<button class="op" data-k="' + k + '"><span class="l">' + 'ABCD'[k] + '</span>' + o.t + '</button>'; }).join('') + '<div id="qfb"></div></div>';
    if (T){
      tm = setInterval(function(){
        left--; var qt = document.getElementById('qt'); if (qt) qt.textContent = left;
        var b = document.getElementById('qbar'); if (b){ b.style.width = (left / T * 100) + '%'; if (left <= 5) b.style.background = 'var(--bad)'; }
        if (left <= 0) { clearInterval(tm); responder(-1); }
      }, 1000);
      TIMERS.push(tm);
    }
    function responder(k){
      if (answered) return; answered = true; if (tm) clearInterval(tm);
      var ok = k >= 0 && ops[k].c, bonus = ok && T ? Math.round(left / T * 50) : 0, g = ok ? 100 + bonus : 0;
      pts += g; bon += bonus; hud(pts); ok ? SND.ok() : SND.bad();
      stage.querySelectorAll('.op').forEach(function(b, j){ b.disabled = true; if (ops[j].c) b.classList.add('cert'); else if (j === k) b.classList.add('err'); });
      document.getElementById('qfb').innerHTML = '<div class="fb ' + (ok ? 'ok' : 'bad') + '" style="margin-top:4px"><b class="h">' + (ok ? '✅ Correto! +' + g + (bonus ? ' (bônus ' + bonus + ')' : '') : (k < 0 ? '⏰ Tempo esgotado!' : '❌ Resposta errada')) + '</b>' + q.e + '<br><button class="btn ' + (ok ? 'ok' : '') + '" id="qnx">' + (i + 1 < qs.length ? 'Próxima pergunta ▶' : 'Concluir ▶') + '</button></div>';
      document.getElementById('qnx').onclick = function(){ i++; if (i < qs.length) render(); else done(pts, qs.length * 100, bon); };
      document.getElementById('qfb').scrollIntoView({ behavior:'smooth', block:'nearest' });
    }
    stage.querySelectorAll('.op').forEach(function(b){ b.onclick = function(){ responder(+b.getAttribute('data-k')); }; });
  }
  render();
};

/* ---------- LABIRINTO DO CAMINHO SEGURO ---------- */
var MAPA = [
  'S..E.......####',
  '##########.####',
  '==========+====',
  '####.....E.####',
  '####.##########',
  '====+==========',
  '##.....E.....##',
  '##.#########.##',
  '============+==',
  '#G...........##'
];
ETAPAS.labirinto = function(et, done){
  var RW = MAPA.length, CL = MAPA[0].length, cs = 40, pos = null, last, pen = 0, hits = 0, fora = 0, ended = false;
  var EPIS = ['🦺','🥾','🧤'], NOMES_EPI = ['o colete refletivo','a botina de segurança','as luvas'], epis = [], got = {};
  for (var r = 0; r < RW; r++) for (var c = 0; c < CL; c++){ var ch = MAPA[r][c]; if (ch === 'S') pos = [r, c]; if (ch === 'E') epis.push([r, c]); }
  last = pos.slice();
  var fks = [{ r:2, c:1, d:1 }, { r:5, c:13, d:-1 }, { r:8, c:0, d:1 }, { r:8, c:8, d:1 }];
  function cell(r, c){ return (MAPA[r] || '')[c]; }
  var st = '';
  for (r = 0; r < RW; r++) for (c = 0; c < CL; c++){
    var x = c*cs, y = r*cs; ch = MAPA[r][c];
    if (ch === '#') st += '<rect x="'+x+'" y="'+y+'" width="'+cs+'" height="'+cs+'" fill="#2e4a6b"/><rect x="'+(x+3)+'" y="'+(y+5)+'" width="'+(cs-6)+'" height="4" fill="#f07c1e"/><rect x="'+(x+3)+'" y="'+(y+cs-9)+'" width="'+(cs-6)+'" height="4" fill="#f07c1e"/><rect x="'+(x+8)+'" y="'+(y+12)+'" width="10" height="14" fill="#cf9d62"/><rect x="'+(x+22)+'" y="'+(y+12)+'" width="10" height="14" fill="#cf9d62"/>';
    else if (ch === '=') st += '<rect x="'+x+'" y="'+y+'" width="'+cs+'" height="'+cs+'" fill="#6b7280"/>';
    else if (ch === '+') { st += '<rect x="'+x+'" y="'+y+'" width="'+cs+'" height="'+cs+'" fill="#6b7280"/>'; for (var k = 0; k < 4; k++) st += '<rect x="'+(x+4)+'" y="'+(y+3+k*9.5)+'" width="'+(cs-8)+'" height="5" fill="#fff"/>'; }
    else { st += '<rect x="'+x+'" y="'+y+'" width="'+cs+'" height="'+cs+'" fill="#2f9e5f"/><g fill="#fff" opacity=".28"><ellipse cx="'+(x+14)+'" cy="'+(y+15)+'" rx="4" ry="2.5"/><ellipse cx="'+(x+26)+'" cy="'+(y+25)+'" rx="4" ry="2.5"/></g>'; }
  }
  [2, 5, 8].forEach(function(rr){ st += '<line x1="0" y1="'+(rr*cs+cs/2)+'" x2="'+(CL*cs)+'" y2="'+(rr*cs+cs/2)+'" stroke="#f5c400" stroke-width="2" stroke-dasharray="10 8" opacity=".8"/>'; });
  for (r = 0; r < RW; r++) for (c = 0; c < CL; c++){
    ch = MAPA[r][c];
    if (ch === 'S') st += txt(c*cs+20, r*cs+15, 'ENTRADA', 8, '#fff') + txt(c*cs+20, r*cs+33, '🚪', 16, '#fff');
    if (ch === 'G') st += '<rect x="'+(c*cs+2)+'" y="'+(r*cs+2)+'" width="'+(cs-4)+'" height="'+(cs-4)+'" rx="6" fill="#f5c400"/>' + txt(c*cs+20, r*cs+20, '🏁', 18, '#111') + txt(c*cs+20, r*cs+35, 'POSTO', 8, '#111');
  }
  stage.innerHTML = '<div class="bar" style="justify-content:center"><span class="pill" id="lEpi"></span><span class="pill">⭐ Etapa: <b id="lPts">300</b></span><span class="pill">💥 <b id="lHit">0</b> · 🚫 <b id="lFora">0</b></span></div>' +
    '<div class="lab-wrap"><svg id="lab" viewBox="0 0 ' + (CL*cs) + ' ' + (RW*cs) + '">' + st + '<g id="dyn"></g><rect id="lFlash" width="' + (CL*cs) + '" height="' + (RW*cs) + '" fill="#c0392b" opacity="0"/></svg></div>' +
    '<div class="msg" id="lMsg">👷 Comece pela ENTRADA e siga a faixa verde. Pegue os EPIs pelo caminho!</div>' +
    '<div class="dpad"><button class="u" data-m="-1,0" aria-label="Cima">▲</button><button class="l" data-m="0,-1" aria-label="Esquerda">◀</button><button class="d" data-m="1,0" aria-label="Baixo">▼</button><button class="r" data-m="0,1" aria-label="Direita">▶</button></div>';
  var dyn = document.getElementById('dyn'), svg = document.getElementById('lab');
  function msg(t, cls){ var m = document.getElementById('lMsg'); if (m){ m.className = 'msg ' + (cls || ''); m.innerHTML = t; } }
  function score(){ return Math.max(60, 300 - pen); }
  function upd(){
    document.getElementById('lEpi').innerHTML = 'EPIs: ' + EPIS.map(function(e, i){ return got[i] ? e : '<span style="opacity:.3">' + e + '</span>'; }).join(' ');
    document.getElementById('lPts').textContent = score(); document.getElementById('lHit').textContent = hits; document.getElementById('lFora').textContent = fora;
    hud(score());
  }
  function draw(){
    var s = '';
    epis.forEach(function(e, i){ if (!got[i]) s += '<circle cx="'+(e[1]*cs+20)+'" cy="'+(e[0]*cs+20)+'" r="16" fill="#fff" opacity=".85"/>' + txt(e[1]*cs+20, e[0]*cs+27, EPIS[i], 20, '#000'); });
    fks.forEach(function(f){
      var x = f.c*cs + 20, y = f.r*cs + 20, nx = f.c + f.d*2;
      if (nx >= 0 && nx < CL) s += '<circle cx="'+(nx*cs+20)+'" cy="'+y+'" r="9" fill="#3b82f6" opacity=".55"/>';
      s += '<g transform="translate('+x+','+y+') scale('+f.d+',1)"><rect x="-17" y="-12" width="26" height="24" rx="4" fill="#f5b800" stroke="#7a5a00" stroke-width="1.5"/><rect x="-17" y="-12" width="8" height="24" rx="3" fill="#c98a00"/><rect x="-7" y="-8" width="12" height="16" fill="none" stroke="#374151" stroke-width="2.5"/><rect x="9" y="-11" width="4" height="22" fill="#374151"/><rect x="13" y="-9" width="9" height="3" fill="#111"/><rect x="13" y="6" width="9" height="3" fill="#111"/></g>';
    });
    s += '<circle cx="'+(pos[1]*cs+20)+'" cy="'+(pos[0]*cs+20)+'" r="17" fill="#fff" stroke="#ff8a00" stroke-width="3"/>' + txt(pos[1]*cs+20, pos[0]*cs+28, '👷', 22, '#000');
    dyn.innerHTML = s;
  }
  function flash(){ var f = document.getElementById('lFlash'); f.setAttribute('opacity', '.45'); TIMERS.push(setTimeout(function(){ f.setAttribute('opacity', '0'); }, 260)); }
  function check(){
    if (ended) return;
    if (fks.some(function(f){ return f.r === pos[0] && f.c === pos[1]; })){
      pen += 80; hits++; SND.hit(); flash();
      msg('💥 Você foi atingido pela empilhadeira! (−80) Na faixa: <b>pare, olhe</b> e espere a empilhadeira passar.', 'bad');
      pos = last.slice(); upd();
    }
  }
  function move(dr, dc){
    if (ended) return;
    var nr = pos[0] + dr, nc = pos[1] + dc, ch = cell(nr, nc);
    if (!ch) return;
    if (ch === '#') { msg('🧱 Estrutura porta-paletes! Não passe por dentro das estruturas.', 'warn'); return; }
    pos = [nr, nc];
    if (ch === '=') { pen += 40; fora++; SND.bad(); msg('🚫 Fora da faixa de pedestres! (−40) Esse é o corredor das empilhadeiras. Atravesse só na faixa zebrada.', 'bad'); }
    else if (ch === '+') msg('⚠️ Faixa de travessia: olhe para os dois lados. A <span style="color:#3b82f6">luz azul</span> mostra para onde a empilhadeira vai.', 'warn');
    else {
      last = pos.slice();
      var perto = cell(nr+1, nc) === '+' || cell(nr-1, nc) === '+';
      if (ch === 'E'){
        epis.forEach(function(e, i){ if (e[0] === nr && e[1] === nc && !got[i]) { got[i] = true; SND.ok(); msg('✅ Você pegou ' + NOMES_EPI[i] + ' ' + EPIS[i] + '!', 'ok'); } });
      } else if (ch === 'G'){
        if (Object.keys(got).length < epis.length) msg('🦺 Quase lá! Volte e pegue todos os EPIs antes de começar a trabalhar.', 'warn');
        else { fim(); return; }
      } else if (perto) msg('👀 Pare e olhe antes de atravessar! Espere a empilhadeira passar.', '');
      else msg('👷 Siga pela faixa verde de pedestres.', '');
    }
    SND.click(); check(); upd(); draw();
  }
  function tick(){ fks.forEach(function(f){ f.c += f.d; if (f.c >= CL) f.c = 0; if (f.c < 0) f.c = CL - 1; }); check(); draw(); }
  TIMERS.push(setInterval(tick, 520));
  function onKey(e){
    var m = { ArrowUp:[-1,0], ArrowDown:[1,0], ArrowLeft:[0,-1], ArrowRight:[0,1], w:[-1,0], s:[1,0], a:[0,-1], d:[0,1], W:[-1,0], S:[1,0], A:[0,-1], D:[0,1] }[e.key];
    if (m && !ended && M.classList.contains('hidden')) { e.preventDefault(); move(m[0], m[1]); }
  }
  document.addEventListener('keydown', onKey);
  CLEAN.push(function(){ document.removeEventListener('keydown', onKey); });
  stage.querySelectorAll('[data-m]').forEach(function(b){ b.onclick = function(){ var m = b.getAttribute('data-m').split(','); move(+m[0], +m[1]); }; });
  svg.addEventListener('click', function(ev){
    var pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
    var p = pt.matrixTransform(svg.getScreenCTM().inverse()), r = Math.floor(p.y / cs), c = Math.floor(p.x / cs), dr = r - pos[0], dc = c - pos[1];
    if (Math.abs(dr) + Math.abs(dc) === 1) move(dr, dc);
  });
  function fim(){
    ended = true; clearAll(); SND.win(); draw();
    var sc = score();
    var bx = document.createElement('div');
    bx.innerHTML = '<div class="card" style="text-align:center;max-width:760px;margin:10px auto"><h2>🏁 Você chegou ao posto de trabalho!</h2><p>Atingido por empilhadeira: <b>' + hits + '</b> · Passos fora da faixa: <b>' + fora + '</b></p><p class="pts">' + sc + ' / 300</p>' +
      (hits || fora ? '<p class="muted">Lembre: use sempre a faixa de pedestres e, na travessia, pare, olhe e espere.</p>' : '<p class="muted">Perfeito! Caminho 100% seguro.</p>') + '<button class="btn ok big" id="labOk" style="max-width:360px">Próxima etapa ▶</button></div>';
    stage.querySelector('.dpad').replaceWith(bx);
    msg('🎉 Chegou com segurança e com todos os EPIs!', 'ok');
    document.getElementById('labOk').onclick = function(){ done(sc, 300); };
  }
  if (DEBUG) window.__LAB = { fks:fks, pos:function(){ return pos; } };
  upd(); draw();
};

/* ---------- FIM DA FASE ---------- */
function finalizarFase(){
  clearAll();
  var p = atual(), f = RUN.f, pct = RUN.max ? Math.min(1, Math.max(0, RUN.pts - RUN.bonus) / RUN.max) : 0, st = pct >= 0.9 ? 3 : pct >= 0.7 ? 2 : pct >= 0.4 ? 1 : 0;
  var r = p.fases[f.id] || { best:0, stars:0, tentativas:0 };
  var recorde = RUN.pts > r.best;
  r.best = Math.max(r.best, Math.round(RUN.pts)); r.stars = Math.max(r.stars, st); r.tentativas = (r.tentativas || 0) + 1; r.ultima = hoje();
  p.fases[f.id] = r; p.ultima = hoje(); save();
  var novoCert = emitirCert(p);
  var prox = RUN.idx + 1 < FASES.length && liberada(p, RUN.idx + 1) ? RUN.idx + 1 : null;
  var msgs = ['Não desanime! Revise as explicações e tente de novo.', 'Bom começo! Dá para melhorar.', 'Muito bem! Você está atento aos riscos.', 'Excelente! Você é exemplo de segurança!'];
  var h = '<div class="card res"><div class="stars">' + stars(st) + '</div><h1>' + (st >= 1 ? 'Fase concluída!' : 'Fase não concluída') + '</h1><p class="muted">' + f.ic + ' ' + f.nome + '</p>' +
    '<div class="pp">' + fmt(RUN.pts) + '</div><div class="muted">pontos · aproveitamento de ' + Math.round(pct*100) + '%' + (RUN.bonus ? ' + ' + fmt(RUN.bonus) + ' de bônus de tempo' : '') + (recorde ? ' · <b style="color:var(--ok)">Novo recorde! 🎉</b>' : ' · Recorde: ' + fmt(r.best)) + '</div>' +
    '<p style="font-size:18px">' + msgs[st] + '</p>' + '<div style="max-width:620px;margin:0 auto 12px">' + alertaAmigo() + '</div>' + (st < 1 ? '<p class="muted">Faça pelo menos 40% de aproveitamento para ganhar ★ e liberar a próxima fase.</p>' : '') +
    '<div class="row" style="justify-content:center;margin-top:10px">' + (prox !== null ? '<button class="btn ok" data-act="fase" data-i="' + prox + '">▶ Próxima fase: ' + FASES[prox].nome + '</button>' : '') +
    '<button class="btn ghost" data-act="fase" data-i="' + RUN.idx + '">🔁 Jogar de novo</button><button class="btn" data-act="mapa">🗺️ Mapa de fases</button></div>' +
    (concluidas(p) === FASES.length ? '<p style="margin-top:16px"><button class="btn gold" data-act="certificado" data-id="' + esc(p.id) + '">🎓 Ver meu certificado</button></p>' : '') +
    '<p class="muted" style="margin-top:14px">Total acumulado: <b>' + fmt(total(p)) + '</b> pontos · ' + nivel(total(p)).n.ic + ' ' + nivel(total(p)).n.nome + '</p></div>';
  app.innerHTML = h; scrollTo(0,0);
  if (st >= 1) { SND.win(); confete(); }
  RUN = null;
  if (novoCert) TIMERS.push(setTimeout(function(){
    modal('<div style="text-align:center"><div style="font-size:64px">🎓</div><h3 style="font-size:24px">Parabéns, ' + esc(p.nome.split(' ')[0]) + '!</h3><p>Você concluiu as ' + FASES.length + ' fases do <b>Galpão Seguro</b> e ganhou seu <b>certificado de conclusão</b>.</p></div>' +
      '<div class="opts"><button class="btn ok" data-act="certificado" data-id="' + esc(p.id) + '">🎓 Ver meu certificado</button><button class="btn ghost" id="mFechar">Agora não</button></div>');
    document.getElementById('mFechar').onclick = closeModal; SND.win();
  }, 1600));
}

/* ---------- ÁREA DO SST (PIN) ---------- */
var SST_OK = false;
function hashPin(p){ var h = 5381, t = 'galpao-seguro:' + p; for (var i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) >>> 0; return 'h' + h.toString(36); }
function sstGate(cb){
  if (SST_OK) { cb(); return; }
  var novo = !DB.pin;
  modal('<h3>🔒 Administração</h3><p class="muted" style="margin:0 0 10px">' + (novo ? 'Primeiro acesso de administrador neste aparelho: crie um PIN (4 a 8 números). Ele será pedido sempre que a administração for aberta.' : 'Digite o PIN de administrador para acessar o painel, o ranking e as exportações.') + '</p>' +
    '<form id="fPin" autocomplete="off"><label class="f">PIN<input name="p1" type="password" inputmode="numeric" maxlength="8" required></label>' +
    (novo ? '<label class="f">Repita o PIN<input name="p2" type="password" inputmode="numeric" maxlength="8" required></label>' : '') +
    '<div class="opts"><button class="btn ok" type="submit">' + (novo ? 'Criar PIN e entrar' : 'Entrar') + '</button><button class="btn ghost" type="button" id="pinX">Cancelar</button></div></form>' +
    (novo ? '' : '<p class="muted" style="font-size:12px;margin:12px 0 0">O PIN fica salvo só neste aparelho. Se esquecer, procure quem configurou o tablet.</p>'));
  MB.querySelector('input').focus();
  document.getElementById('pinX').onclick = closeModal;
  document.getElementById('fPin').onsubmit = function(ev){
    ev.preventDefault();
    var fd = new FormData(ev.target), p1 = String(fd.get('p1')), p2 = String(fd.get('p2') || '');
    if (!/^[0-9]{4,8}$/.test(p1)) { toast('O PIN deve ter de 4 a 8 números.'); return; }
    if (novo){ if (p1 !== p2) { toast('Os PINs não conferem.'); return; } DB.pin = hashPin(p1); save(); }
    else if (hashPin(p1) !== DB.pin) { toast('PIN incorreto.'); SND.bad(); ev.target.reset(); return; }
    SST_OK = true; closeModal(); SND.ok(); cb();
  };
}
function sstTabs(on){
  return '<div class="sst-tabs"><b style="margin-right:4px">🛠️ Administração</b><button class="btn sm' + (on === 'painel' ? ' on' : '') + '" data-act="painel">📋 Painel</button><button class="btn sm' + (on === 'ranking' ? ' on' : '') + '" data-act="ranking">🏆 Ranking</button><a class="btn sm ghost" href="jogos.html" target="_blank" rel="noopener">🎮 Abrir o jogo</a><button class="btn sm ghost" data-act="sstSair">🔒 Bloquear</button></div>';
}
function telaAdmin(){
  clearAll();
  if (SST_OK) { telaPainel(); return; }
  app.innerHTML = '<div class="logo-bar"><img src="' + LOGO + '" alt="Emergent Cold LatAm"></div><div class="card" style="text-align:center;padding:30px 18px"><div style="font-size:54px">🔒</div><h1>Administração do Galpão Seguro</h1><p class="muted">Painel, ranking, exportação da planilha, backup e certificados dos funcionários.<br>Acesso somente com o PIN de administrador.</p><button class="btn ok big" style="max-width:340px" data-act="painel">Entrar com PIN</button>' +
    '<p class="muted" style="font-size:13px;margin-top:16px">Os dados ficam no aparelho onde os funcionários jogam. Abra este link no mesmo tablet/computador do jogo, ou junte os backups de vários aparelhos pelo painel.</p></div>';
  scrollTo(0,0);
  sstGate(telaPainel);
}

/* ---------- RANKING ---------- */
function telaRanking(filtro){
  clearAll();
  filtro = filtro || '';
  var lista = Object.keys(DB.players).map(function(k){ return DB.players[k]; }).filter(function(p){ return !filtro || p.setor === filtro || p.turno === filtro; })
    .sort(function(a, b){ return total(b) - total(a) || estrelasTot(b) - estrelasTot(a) || a.nome.localeCompare(b.nome); });
  var opts = SETORES.concat(['1º turno','2º turno','3º turno','Comercial']);
  var h = sstTabs('ranking') + '<div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">🏆 Ranking</h2><select id="filt" style="padding:10px;border-radius:10px;border:2px solid var(--line);font-size:15px"><option value="">Todos os setores e turnos</option>' + opts.map(function(o){ return '<option' + (o === filtro ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select></div>';
  if (!lista.length) h += '<p class="muted">Ninguém pontuou ainda. Que tal ser o primeiro?</p>';
  else {
    var top = lista.slice(0, 3), ord = [1, 0, 2];
    h += '<div class="podio">' + ord.map(function(k){ var p = top[k]; if (!p) return ''; return '<div class="pd p' + (k+1) + '"><div style="font-size:30px">' + ['🥇','🥈','🥉'][k] + '</div><div class="nm">' + esc(p.nome.split(' ')[0]) + '</div><div class="pt">' + fmt(total(p)) + ' pts</div><div class="bx">' + (k+1) + 'º</div></div>'; }).join('') + '</div>';
    h += '<div class="tabwrap"><table><thead><tr><th>#</th><th>Nome</th><th>Setor</th><th class="num">Fases</th><th class="num">★</th><th class="num">Pontos</th></tr></thead><tbody>';
    lista.forEach(function(p, i){ h += '<tr' + (p.id === DB.atual ? ' style="background:var(--warnbg)"' : '') + '><td><b>' + (i < 3 ? ['🥇','🥈','🥉'][i] : (i+1) + 'º') + '</b></td><td><b>' + esc(p.nome) + '</b><br><small class="muted">' + nivel(total(p)).n.ic + ' ' + nivel(total(p)).n.nome + '</small></td><td>' + esc(p.setor || '—') + '<br><small class="muted">' + esc(p.turno || '') + '</small></td><td class="num">' + concluidas(p) + '/' + FASES.length + '</td><td class="num">' + estrelasTot(p) + '</td><td class="num"><b>' + fmt(total(p)) + '</b></td></tr>'; });
    h += '</tbody></table></div>';
  }
  h += '</div>';
  app.innerHTML = h; scrollTo(0,0);
  document.getElementById('filt').onchange = function(){ telaRanking(this.value); };
}

/* ---------- PAINEL SST ---------- */
function telaPainel(){
  clearAll();
  var lista = Object.keys(DB.players).map(function(k){ return DB.players[k]; }).sort(function(a, b){ return a.nome.localeCompare(b.nome); });
  var tot = lista.length, conc = lista.filter(function(p){ return concluidas(p) === FASES.length; }).length;
  var h = sstTabs('painel') + '<div class="card"><h2>📋 Painel SST</h2><div class="grid2" style="margin-bottom:12px">' +
    '<div class="card" style="background:#f6f8fb;margin:0"><div class="muted">Inscritos</div><div class="pts">' + tot + '</div></div>' +
    '<div class="card" style="background:#f6f8fb;margin:0"><div class="muted">Concluíram todas as fases</div><div class="pts">' + conc + '</div></div>' +
    '<div class="card" style="background:#f6f8fb;margin:0"><div class="muted">Média de pontos</div><div class="pts">' + (tot ? fmt(lista.reduce(function(s, p){ return s + total(p); }, 0) / tot) : 0) + '</div></div></div>' +
    '<div class="row" style="margin-bottom:12px"><button class="btn ok" data-act="csv">⬇️ Exportar planilha (CSV)</button><button class="btn" data-act="backup">💾 Salvar backup</button><label class="btn ghost" style="cursor:pointer">📂 Importar backup<input type="file" id="impBk" accept=".json,application/json" hidden></label><button class="btn ghost" data-act="trocarPin">🔑 Trocar PIN</button><button class="btn bad" data-act="zerar">🗑️ Apagar tudo</button></div>' +
    '<p class="muted" style="font-size:14px;margin-top:0">Os dados ficam somente neste aparelho. Para juntar resultados de vários tablets/computadores, salve o backup em cada um e importe aqui (o maior recorde de cada fase é mantido).</p>';
  if (tot){
    h += '<div class="tabwrap"><table><thead><tr><th>Nome</th><th>Matrícula</th><th>Setor / Turno</th>' + FASES.map(function(f, i){ return '<th class="num" title="' + f.nome + '">F' + (i+1) + '</th>'; }).join('') + '<th class="num">Total</th><th>Última atividade</th><th></th></tr></thead><tbody>';
    lista.forEach(function(p){
      h += '<tr><td><b>' + esc(p.nome) + '</b><br><small class="muted">' + esc(p.funcao || '') + '</small></td><td>' + esc(p.matricula) + '</td><td>' + esc(p.setor || '—') + '<br><small class="muted">' + esc(p.turno || '') + '</small></td>' +
        FASES.map(function(f){ var r = p.fases[f.id]; return '<td class="num">' + (r ? fmt(r.best) + '<br><small style="color:var(--gold)">' + '★'.repeat(r.stars) + '</small>' : '<span class="muted">—</span>') + '</td>'; }).join('') +
        '<td class="num"><b>' + fmt(total(p)) + '</b></td><td><small>' + dataBR(p.ultima || p.criado) + '</small></td><td style="white-space:nowrap">' +
        (concluidas(p) === FASES.length ? '<button class="btn sm gold" data-act="certificado" data-id="' + esc(p.id) + '" title="Certificado">🎓</button> ' : '') + '<button class="btn sm ghost" data-act="excluir" data-id="' + esc(p.id) + '" title="Excluir">🗑️</button></td></tr>';
    });
    h += '</tbody></table></div>';
  } else h += '<p class="muted">Nenhum funcionário inscrito.</p>';
  h += '</div>';
  app.innerHTML = h; scrollTo(0,0);
  document.getElementById('impBk').onchange = function(ev){
    var fl = ev.target.files[0]; if (!fl) return;
    var rd = new FileReader();
    rd.onload = function(){
      try {
        var d = JSON.parse(rd.result), n = 0;
        if (!d || !d.players) throw new Error('formato');
        Object.keys(d.players).forEach(function(id){
          var src = d.players[id]; if (!src || !src.nome) return;
          var dst = DB.players[id];
          if (!dst) { DB.players[id] = src; src.fases = src.fases || {}; n++; return; }
          Object.keys(src.fases || {}).forEach(function(fid){
            var a = dst.fases[fid], b = src.fases[fid];
            if (!a) dst.fases[fid] = b;
            else { a.best = Math.max(a.best || 0, b.best || 0); a.stars = Math.max(a.stars || 0, b.stars || 0); a.tentativas = (a.tentativas || 0) + (b.tentativas || 0); if ((b.ultima || '') > (a.ultima || '')) a.ultima = b.ultima; }
          });
          if ((src.ultima || '') > (dst.ultima || '')) dst.ultima = src.ultima;
          if (src.cert && (!dst.cert || src.cert.data < dst.cert.data)) dst.cert = src.cert;
        });
        save(); toast('Backup importado. ' + n + ' novo(s) funcionário(s).'); telaPainel();
      } catch (e) { toast('Arquivo de backup inválido.'); }
    };
    rd.readAsText(fl);
  };
}
function baixar(nome, conteudo, tipo){
  var a = document.createElement('a'), url = URL.createObjectURL(new Blob([conteudo], { type:tipo }));
  a.href = url; a.download = nome; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); }, 500);
}
function exportarCSV(){
  var lista = Object.keys(DB.players).map(function(k){ return DB.players[k]; });
  if (!lista.length) { toast('Nenhum funcionário inscrito.'); return; }
  var q = function(v){ v = String(v == null ? '' : v); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
  var cab = ['Nome','Matrícula','Setor','Turno','Função'].concat(FASES.map(function(f, i){ return 'F' + (i+1) + ' ' + f.nome + ' (pontos)'; }), FASES.map(function(f, i){ return 'F' + (i+1) + ' estrelas'; }), ['Fases concluídas','Total de pontos','Nível','Certificado emitido em','Código do certificado','Inscrição','Última atividade']);
  var linhas = [cab.map(q).join(';')];
  lista.sort(function(a, b){ return total(b) - total(a); }).forEach(function(p){
    linhas.push([p.nome, p.matricula, p.setor, p.turno, p.funcao].concat(
      FASES.map(function(f){ var r = p.fases[f.id]; return r ? r.best : ''; }),
      FASES.map(function(f){ var r = p.fases[f.id]; return r ? r.stars : ''; }),
      [concluidas(p), total(p), nivel(total(p)).n.nome, p.cert ? dataBR(p.cert.data) : '', p.cert ? p.cert.codigo : '', dataBR(p.criado), dataBR(p.ultima)]).map(q).join(';'));
  });
  baixar('galpao-seguro-participacao-' + new Date().toISOString().slice(0,10) + '.csv', '﻿' + linhas.join('\r\n'), 'text/csv;charset=utf-8');
}
/* ---------- CERTIFICADO ---------- */
var C_NAVY = '#26215A', C_RED = '#A02039', C_GOLD = '#E0A800';
function emitirCert(p){
  if (p.cert || concluidas(p) < FASES.length) return false;
  var d = new Date();
  p.cert = { data:d.toISOString(), codigo:'GS-' + String(p.matricula).replace(/[^A-Za-z0-9]/g,'').toUpperCase() + '-' + d.toISOString().slice(0,10).replace(/-/g,'') };
  save(); return true;
}
function gerarCertificado(p, cb){
  var W = 1754, H = 1240, S = 1.5, cv = document.createElement('canvas'); cv.width = W*S; cv.height = H*S;
  var x = cv.getContext('2d'); x.scale(S, S);
  var serif = 'Georgia, "Times New Roman", serif', sans = '"Segoe UI", Roboto, Arial, Helvetica, sans-serif';
  var img = new Image();
  img.onload = function(){ desenhar(true); }; img.onerror = function(){ desenhar(false); };
  img.src = LOGO;
  function centro(t, y, font, cor){ x.font = font; x.fillStyle = cor; x.textAlign = 'center'; x.fillText(t, W/2, y); }
  function linhas(t, maxW){ var ws = t.split(' '), out = [], l = ''; ws.forEach(function(w){ var tt = l ? l + ' ' + w : w; if (x.measureText(tt).width > maxW && l) { out.push(l); l = w; } else l = tt; }); if (l) out.push(l); return out; }
  function losango(cx, cy, r, cor){ x.save(); x.translate(cx, cy); x.rotate(Math.PI/4); x.fillStyle = cor; x.fillRect(-r, -r, 2*r, 2*r); x.restore(); }
  function desenhar(temLogo){
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    x.save(); x.globalAlpha = 0.035; losango(W/2, 700, 290, C_NAVY); x.restore();
    x.strokeStyle = C_NAVY; x.lineWidth = 16; x.strokeRect(30, 30, W-60, H-60);
    x.strokeStyle = C_RED; x.lineWidth = 3; x.strokeRect(58, 58, W-116, H-116);
    [[58,58],[W-58,58],[58,H-58],[W-58,H-58]].forEach(function(c){ losango(c[0], c[1], 13, C_GOLD); });
    if (temLogo){ var lw = 500, lh = lw * img.height / img.width; x.drawImage(img, (W - lw)/2, 98, lw, lh); }
    else centro('emergent cold LatAm', 170, 'bold 64px ' + sans, C_NAVY);
    centro('CERTIFICADO', 330, 'bold 104px ' + serif, C_NAVY);
    if ('letterSpacing' in x) x.letterSpacing = '10px';
    centro('DE CONCLUSÃO', 385, 'bold 32px ' + sans, C_RED);
    if ('letterSpacing' in x) x.letterSpacing = '0px';
    x.fillStyle = C_GOLD; x.fillRect(W/2 - 170, 412, 340, 5);
    centro('Certificamos que', 490, 'italic 38px ' + serif, '#5b6b7f');
    var size = 92; do { x.font = 'bold ' + size + 'px ' + serif; size -= 2; } while (x.measureText(p.nome).width > 1380 && size > 40);
    var nw = x.measureText(p.nome).width;
    x.fillStyle = C_NAVY; x.textAlign = 'center'; x.fillText(p.nome, W/2, 600);
    x.fillStyle = C_GOLD; x.fillRect(W/2 - nw/2 - 40, 628, nw + 80, 4);
    centro('Matrícula ' + p.matricula + (p.setor ? '  ·  ' + p.setor : '') + (p.funcao ? '  ·  ' + p.funcao : ''), 684, '30px ' + sans, '#5b6b7f');
    var fs = 31, ls;
    var t = 'concluiu com êxito as ' + FASES.length + ' fases do programa Galpão Seguro — Jogos de Segurança do Trabalho, abordando caminho seguro, trânsito de empilhadeiras, transpaleteiras e paleteiras, estruturas porta-paletes, picking, logística reversa e carregamento de docas, totalizando ' + fmt(total(p)) + ' pontos (nível ' + nivel(total(p)).n.nome + ').';
    do { x.font = fs + 'px ' + sans; ls = linhas(t, 1480); fs--; } while (ls.length > 3 && fs > 22);
    var y = 762;
    ls.forEach(function(l){ centro(l, y, x.font, '#1f2937'); y += fs + 15; });
    var dt = new Date(p.cert ? p.cert.data : Date.now());
    centro('Concluído em ' + dt.toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' }), y + 26, 'bold 30px ' + sans, C_NAVY);
    // selo
    var sx = W/2, sy = 1040;
    x.fillStyle = C_GOLD; x.beginPath(); for (var i = 0; i < 24; i++){ var a = i * Math.PI / 12, rr = i % 2 ? 84 : 94; x.lineTo(sx + rr*Math.cos(a), sy + rr*Math.sin(a)); } x.closePath(); x.fill();
    x.fillStyle = C_NAVY; x.beginPath(); x.arc(sx, sy, 72, 0, Math.PI*2); x.fill();
    x.strokeStyle = C_GOLD; x.lineWidth = 3; x.beginPath(); x.arc(sx, sy, 62, 0, Math.PI*2); x.stroke();
    centro('★', sy - 18, 'bold 30px ' + sans, C_GOLD);
    centro('GALPÃO', sy + 14, 'bold 21px ' + sans, '#fff');
    centro('SEGURO', sy + 38, 'bold 21px ' + sans, '#fff');
    // rodapé
    x.font = '20px ' + sans; x.fillStyle = '#8a97a8';
    x.textAlign = 'left'; x.fillText('Emergent Cold LatAm · Segurança e Saúde do Trabalho', 92, 1136);
    x.fillStyle = '#5b6b7f'; x.fillText('Programa criado por Luan Tavarez — Técnico em Segurança do Trabalho', 92, 1164);
    x.fillStyle = '#8a97a8'; x.textAlign = 'right'; x.fillText('Código: ' + (p.cert ? p.cert.codigo : '—'), W - 92, 1164);
    cb(cv);
  }
}
function pdfDoCanvas(cv){
  var jpg = atob(cv.toDataURL('image/jpeg', 0.92).split(',')[1]);
  var pw = 841.89, ph = 595.28, out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', offs = [];
  var cont = 'q ' + pw + ' 0 0 ' + ph + ' 0 0 cm /Im0 Do Q';
  var objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pw + ' ' + ph + '] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /XObject /Subtype /Image /Width ' + cv.width + ' /Height ' + cv.height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpg.length + ' >>\nstream\n' + jpg + '\nendstream',
    '<< /Length ' + cont.length + ' >>\nstream\n' + cont + '\nendstream',
    '<< /Title (Certificado Galpao Seguro) /Author (Emergent Cold LatAm) /Creator (Galpao Seguro - Luan Tavarez) >>'
  ];
  objs.forEach(function(o, i){ offs.push(out.length); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
  var xref = out.length;
  out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
  offs.forEach(function(o){ out += ('0000000000' + o).slice(-10) + ' 00000 n \n'; });
  out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R /Info 6 0 R >>\nstartxref\n' + xref + '\n%%EOF';
  var bytes = new Uint8Array(out.length);
  for (var i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
  return new Blob([bytes], { type:'application/pdf' });
}
function baixarBlob(blob, nome){
  var url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = nome; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
}
function telaCertificado(id){
  clearAll();
  var p = DB.players[id]; if (!p) { telaInicio(); return; }
  if (concluidas(p) < FASES.length) { toast('O certificado é liberado ao concluir as ' + FASES.length + ' fases.'); return; }
  emitirCert(p);
  var meu = !ADM && DB.atual === id, prim = esc(p.nome.split(' ')[0]);
  app.innerHTML = '<div class="card" style="text-align:center"><div style="font-size:52px">🎓</div><h1>' + (meu ? 'Parabéns, ' + prim + '!' : 'Certificado de ' + esc(p.nome)) + '</h1>' +
    '<p class="muted" style="margin:0">' + (meu ? 'Você concluiu todas as fases do Galpão Seguro. Este certificado é seu!' : 'Concluiu todas as fases do Galpão Seguro.') + '</p>' +
    '<div class="certview" id="certView">Gerando certificado…</div>' +
    '<div class="row" style="justify-content:center;margin-top:16px"><button class="btn ok" id="cPdf" disabled>📄 Baixar certificado em PDF</button><button class="btn" id="cImg" disabled>🖼️ Baixar imagem</button><button class="btn gold" id="cShare" hidden>📤 Compartilhar</button></div>' +
    '<p class="muted" style="font-size:13px;margin:10px 0 0">Funciona no celular, tablet e notebook. Se o download não começar (ex.: link aberto dentro do WhatsApp), abra o jogo no Chrome ou Safari, ou use “Compartilhar”.</p>' +
    '<div class="row" style="justify-content:center;margin-top:10px">' + (meu ? '<button class="btn ghost" data-act="mapa">🗺️ Mapa de fases</button>' : '<button class="btn ghost" data-act="painel">📋 Voltar ao Painel SST</button>') + '</div></div>';
  scrollTo(0,0);
  gerarCertificado(p, function(cv){
    var v = document.getElementById('certView'); if (!v) return;
    v.innerHTML = '<img alt="Certificado de ' + esc(p.nome) + '" src="' + cv.toDataURL('image/jpeg', 0.9) + '">';
    var base = 'certificado-galpao-seguro-' + p.nome.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    var pdf = pdfDoCanvas(cv);
    var bP = document.getElementById('cPdf'), bI = document.getElementById('cImg'), bS = document.getElementById('cShare');
    bP.disabled = bI.disabled = false;
    bP.onclick = function(){ baixarBlob(pdf, base + '.pdf'); toast('Certificado em PDF baixado.'); };
    bI.onclick = function(){ cv.toBlob(function(b){ baixarBlob(b, base + '.png'); }, 'image/png'); };
    try {
      var file = new File([pdf], base + '.pdf', { type:'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files:[file] })){
        bS.hidden = false;
        bS.onclick = function(){ navigator.share({ files:[file], title:'Certificado Galpão Seguro', text:'Concluí o Galpão Seguro — Jogos de Segurança do Trabalho!' }).catch(function(){}); };
      }
    } catch (e) {}
  });
}

/* ============================================================
   AÇÕES
   ============================================================ */
var ACT = {
  inicio: function(){ if (ADM) { telaAdmin(); return; } if (RUN && !confirm('Sair da fase? O progresso desta tentativa será perdido.')) return; RUN = null; telaInicio(); },
  som: function(){ DB.som = !DB.som; save(); updSom(); if (DB.som) SND.ok(); },
  jogar: function(){ atual() ? telaMapa() : telaInscricao(); },
  inscricao: function(){ telaInscricao(false); },
  entrarMat: function(){ telaInscricao(true); },
  trocar: function(){ DB.atual = null; save(); telaInscricao(true); },
  mapa: telaMapa,
  ranking: function(){ sstGate(function(){ telaRanking(''); }); },
  painel: function(){ sstGate(telaPainel); },
  sstSair: function(){ SST_OK = false; toast('Administração bloqueada.'); telaAdmin(); },
  trocarPin: function(){ if (!SST_OK) return; if (confirm('Criar um novo PIN de administrador?')) { DB.pin = null; save(); SST_OK = false; sstGate(telaPainel); } },
  fase: function(d){ var p = atual(); if (!p) { telaInscricao(); return; } var i = +d.i; if (!liberada(p, i)) return; iniciarFase(i); },
  sair: function(){ if (confirm('Sair da fase? O progresso desta tentativa será perdido.')) { RUN = null; telaMapa(); } },
  csv: function(){ if (SST_OK) exportarCSV(); },
  backup: function(){ if (!SST_OK) return; baixar('galpao-seguro-backup-' + new Date().toISOString().slice(0,10) + '.json', JSON.stringify({ app:'galpao-seguro', versao:1, exportado:hoje(), players:DB.players }, null, 1), 'application/json'); },
  zerar: function(){ if (!SST_OK) return; if (confirm('Apagar TODOS os inscritos e pontuações deste aparelho? Esta ação não pode ser desfeita.') && confirm('Tem certeza? Recomendamos salvar um backup antes.')) { DB = { players:{}, atual:null, som:DB.som, pin:DB.pin }; save(); telaPainel(); } },
  excluir: function(d){ if (!SST_OK) return; var p = DB.players[d.id]; if (p && confirm('Excluir ' + p.nome + ' e toda a sua pontuação?')) { delete DB.players[d.id]; if (DB.atual === d.id) DB.atual = null; save(); telaPainel(); } },
  certificado: function(d){ if (ADM ? SST_OK : d.id === DB.atual) telaCertificado(d.id); }
};
// no link do jogador, nenhuma ação de administração existe
if (!ADM) ['ranking','painel','sstSair','trocarPin','csv','backup','zerar','excluir'].forEach(function(k){ delete ACT[k]; });
else ['jogar','inscricao','entrarMat','trocar','mapa','fase','sair'].forEach(function(k){ delete ACT[k]; });
document.addEventListener('click', function(ev){
  var b = ev.target.closest('[data-act]'); if (!b) return;
  var a = ACT[b.getAttribute('data-act')]; if (!a) return;
  ev.preventDefault(); a({ id:b.getAttribute('data-id'), i:b.getAttribute('data-i') });
});

if (DEBUG) window.__G = { ACT:ACT, DB:function(){ return DB; }, FASES:FASES, CENAS:CENAS, iniciarFase:iniciarFase };
if (ADM) telaAdmin(); else telaInicio();
})();

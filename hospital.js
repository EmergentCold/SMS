(function(){
'use strict';

/* ============================================================
   DADOS SALVOS (somente neste navegador / aparelho)
   ============================================================ */
var KEY = 'hospital_seguro_v1';
var DB;
function load(){
  try { DB = JSON.parse(localStorage.getItem(KEY)); } catch (e) { DB = null; }
  if (!DB || typeof DB !== 'object' || !DB.players) DB = { players:{}, atual:null, som:true };
}
function save(){
  try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) { toast('Atenção: este navegador não permitiu salvar o progresso.'); }
}
load();

var DEBUG = /debug/.test(location.search);
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
    '<linearGradient id="hw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f9fc"/><stop offset="1" stop-color="#dbe8f0"/></linearGradient>' +
    '<linearGradient id="inox" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef2f5"/><stop offset="1" stop-color="#a9b6c1"/></linearGradient>' +
    '<linearGradient id="vid" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d7eefc"/><stop offset="1" stop-color="#9cc9e6"/></linearGradient>' +
    '<pattern id="piso" width="50" height="30" patternUnits="userSpaceOnUse"><rect width="50" height="30" fill="#d3dde4"/><path d="M0 0H50M0 0V30" stroke="#bccad4" stroke-width="2"/></pattern>' +
    '<pattern id="azul" width="34" height="34" patternUnits="userSpaceOnUse"><rect width="34" height="34" fill="none" stroke="#b9ddd3" stroke-width="2"/></pattern>' +
    '</defs>';
}
/* fundo de um ambiente hospitalar: parede até F, piso de F até 560 */
function bg(o){
  o = o || {};
  var s = defs() + '<rect width="1000" height="'+F+'" fill="'+(o.parede || 'url(#hw)')+'"/>';
  if (o.azulejo) s += '<rect y="26" width="1000" height="'+(F-26)+'" fill="url(#azul)"/>';
  s += '<rect width="1000" height="26" fill="#e3eaef"/><line x1="0" y1="26" x2="1000" y2="26" stroke="#c4d0d9" stroke-width="2"/>';
  for (var x = 70; x < 1000; x += 260) s += '<rect x="'+x+'" y="26" width="120" height="7" rx="3" fill="#fffef2" stroke="#d8dccb"/><polygon points="'+x+',33 '+(x+120)+',33 '+(x+170)+','+F+' '+(x-50)+','+F+'" fill="#fffde8" opacity=".14"/>';
  if (o.faixa !== false) s += '<rect y="372" width="1000" height="12" fill="'+(o.faixa || '#9fd2ae')+'" opacity=".8"/>';
  s += '<rect y="'+(F-10)+'" width="1000" height="10" fill="#9fb3c0"/>';
  s += '<rect y="'+F+'" width="1000" height="'+(560-F)+'" fill="url(#piso)"/>';
  return s;
}
function plaqueta(x, y, w, L, fundo, cor){
  var h = 18 + L.length * 18, s = '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="6" fill="'+(fundo||'#00703A')+'" stroke="#fff" stroke-width="2"/>';
  L.forEach(function(l, i){ s += txt(x + w/2, y + 24 + i*18, l, 14, cor || '#fff'); });
  return s;
}
var EMB = (document.querySelector('link[rel=icon]') || {}).href || '';
function placaLogo(x, y, sz){
  sz = sz || 60;
  return '<rect x="'+x+'" y="'+y+'" width="'+sz+'" height="'+sz+'" rx="10" fill="#fff" stroke="#dfe3e1" stroke-width="2"/><image href="'+EMB+'" x="'+(x+6)+'" y="'+(y+6)+'" width="'+(sz-12)+'" height="'+(sz-12)+'"/>';
}
function janela(x, y, w, h){
  return '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="4" fill="url(#vid)" stroke="#94a3b8" stroke-width="5"/><line x1="'+(x+w/2)+'" y1="'+y+'" x2="'+(x+w/2)+'" y2="'+(y+h)+'" stroke="#94a3b8" stroke-width="4"/>' +
    '<path d="M'+(x+12)+','+(y+h-14)+' l26,-30 l18,16 l22,-26" fill="none" stroke="#fff" stroke-width="3" opacity=".6"/>';
}

/* pessoa articulada: x,y = ponto no chão (pés) */
var POSES = {
  stand: { hip:[0,-52], t:0,  legs:[[4,2],[-4,-2]],     arms:[[10,4],[-10,-4]] },
  walk:  { hip:[0,-50], t:4,  legs:[[22,8],[-20,-12]],  arms:[[-22,-8],[26,44]] },
  bend:  { hip:[0,-52], t:82, legs:[[3,2],[-3,-2]],     arms:[[2,0],[-4,-2]] },
  squat: { hip:[-6,-24], t:12, legs:[[95,8],[92,4]],    arms:[[40,30],[46,36]] },
  climb: { hip:[0,-52], t:0,  legs:[[70,-20],[0,0]],    arms:[[172,178],[160,172]] },
  reach: { hip:[0,-52], t:-4, legs:[[4,2],[-4,-2]],     arms:[[176,182],[166,174]] },
  crouch:{ hip:[0,-38], t:52, legs:[[55,-5],[-30,-50]], arms:[[30,20],[-10,-10]] },
  lean:  { hip:[0,-52], t:40, legs:[[4,2],[-4,-2]],     arms:[[40,20],[30,10]] },
  hold:  { hip:[0,-52], t:2,  legs:[[4,2],[-4,-2]],     arms:[[40,95],[30,85]] },
  recap: { hip:[0,-52], t:4,  legs:[[4,2],[-4,-2]],     arms:[[30,128],[18,112]] },
  drop:  { hip:[0,-52], t:8,  legs:[[4,2],[-4,-2]],     arms:[[64,48],[-10,-4]] },
  drink: { hip:[0,-52], t:0,  legs:[[4,2],[-4,-2]],     arms:[[28,165],[40,100]] },
  maos:  { hip:[0,-52], t:2,  legs:[[4,2],[-4,-2]],     arms:[[36,118],[22,128]] },
  pour:  { hip:[0,-52], t:6,  legs:[[4,2],[-4,-2]],     arms:[[70,120],[46,84]] },
  sit:   { hip:[-24,-30], t:-4, legs:[[92,2],[88,-2]],  arms:[[50,92],[40,86]] },
  tilt:  { hip:[-24,-30], t:-22, legs:[[78,10],[74,8]], arms:[[-30,-20],[-40,-30]] }
};
function itemMao(n, h){
  var x = R(h[0]), y = R(h[1]);
  switch (n){
    case 'seringa': return '<g transform="translate('+x+','+y+') rotate(-70)"><rect x="-6" y="-3.5" width="22" height="7" rx="1.5" fill="#fff" stroke="#64748b" stroke-width="1.5"/><line x1="-12" y1="0" x2="-6" y2="0" stroke="#64748b" stroke-width="3"/><line x1="16" y1="0" x2="30" y2="0" stroke="#475569" stroke-width="1.6"/></g>';
    case 'tampa': return '<rect x="'+(x-2)+'" y="'+(y-12)+'" width="4.5" height="12" rx="1.5" fill="#f97316"/>';
    case 'seringaBaixo': return '<g transform="translate('+x+','+y+') rotate(80)"><rect x="-6" y="-3.5" width="22" height="7" rx="1.5" fill="#fff" stroke="#64748b" stroke-width="1.5"/><line x1="-12" y1="0" x2="-6" y2="0" stroke="#64748b" stroke-width="3"/><line x1="16" y1="0" x2="30" y2="0" stroke="#475569" stroke-width="1.6"/></g>';
    case 'cafe': return '<rect x="'+(x-4)+'" y="'+(y-14)+'" width="10" height="13" rx="2" fill="#fff" stroke="#94a3b8"/><rect x="'+(x-3)+'" y="'+(y-13)+'" width="8" height="3" fill="#7c4a1e"/><path d="M'+(x)+','+(y-17)+' q-3,-5 1,-9" fill="none" stroke="#94a3b8" stroke-width="1.5"/>';
    case 'lanche': return '<ellipse cx="'+(x+3)+'" cy="'+(y-3)+'" rx="10" ry="5" fill="#d9a35b"/><rect x="'+(x-6)+'" y="'+(y-4)+'" width="18" height="2.5" fill="#4ade80"/>';
    case 'papel': return '<rect x="'+(x-2)+'" y="'+(y-22)+'" width="17" height="22" fill="#fff" stroke="#94a3b8"/><rect x="'+(x)+'" y="'+(y-20)+'" width="13" height="4" fill="#dc2626"/><line x1="'+x+'" y1="'+(y-12)+'" x2="'+(x+12)+'" y2="'+(y-12)+'" stroke="#94a3b8"/><line x1="'+x+'" y1="'+(y-7)+'" x2="'+(x+12)+'" y2="'+(y-7)+'" stroke="#94a3b8"/>';
    case 'pinca': return '<path d="M'+x+','+y+' l10,18 M'+x+','+y+' l4,20" stroke="#64748b" stroke-width="2.4" fill="none"/>';
    case 'bisturi': return '<line x1="'+x+'" y1="'+y+'" x2="'+(x+12)+'" y2="'+(y+12)+'" stroke="#94a3b8" stroke-width="3.5"/><path d="M'+(x+12)+','+(y+12)+' l8,4 l-3,4 z" fill="#e2e8f0" stroke="#64748b"/>';
    case 'frasco': return '<rect x="'+(x-3)+'" y="'+(y-14)+'" width="10" height="15" rx="2" fill="#a16207" opacity=".85"/><rect x="'+(x-1)+'" y="'+(y-18)+'" width="6" height="4" fill="#475569"/><path d="M'+(x+7)+','+(y-6)+' l4,-2 l-2,4 l5,1" stroke="#475569" fill="none"/>';
    case 'saco': return '<path d="M'+(x-10)+','+(y+4)+' q-6,26 10,28 q16,-2 10,-28 z" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5"/><path d="M'+(x-2)+','+(y+4)+' l2,-6 l3,6" stroke="#94a3b8" fill="none" stroke-width="2"/>';
    case 'pet': return '<rect x="'+(x-4)+'" y="'+(y-22)+'" width="10" height="24" rx="3" fill="#bfdbfe" opacity=".9" stroke="#60a5fa"/><rect x="'+(x-4)+'" y="'+(y-12)+'" width="10" height="14" fill="#a3e635" opacity=".75"/><rect x="'+(x-2)+'" y="'+(y-26)+'" width="6" height="4" fill="#ef4444"/>';
    case 'frascoR': return '<rect x="'+(x-4)+'" y="'+(y-22)+'" width="12" height="24" rx="2" fill="#e0f2fe" stroke="#64748b"/><rect x="'+(x-4)+'" y="'+(y-12)+'" width="12" height="14" fill="#a3e635" opacity=".75"/><rect x="'+(x-3)+'" y="'+(y-19)+'" width="10" height="7" fill="#fff" stroke="#dc2626"/><rect x="'+(x-1)+'" y="'+(y-26)+'" width="6" height="4" fill="#1e3a8a"/>';
    case 'galao': return '<rect x="'+(x-8)+'" y="'+(y-6)+'" width="20" height="24" rx="3" fill="#f8fafc" stroke="#64748b" stroke-width="1.5" transform="rotate(-50 '+x+' '+y+')"/>';
    case 'pa': return '<line x1="'+x+'" y1="'+y+'" x2="'+(x+4)+'" y2="'+(y+24)+'" stroke="#334155" stroke-width="3"/><path d="M'+(x-6)+','+(y+24)+' h22 l-4,8 h-14 z" fill="#2563eb"/>';
    case 'vassoura': return '<line x1="'+x+'" y1="'+y+'" x2="'+(x+20)+'" y2="'+(y+26)+'" stroke="#a16207" stroke-width="3"/><path d="M'+(x+14)+','+(y+24)+' l16,-8 l6,10 l-16,8 z" fill="#facc15"/>';
    case 'cacos': return '<path d="M'+(x-2)+','+(y+2)+' l6,-8 l3,8 z M'+(x+6)+','+(y+4)+' l5,-5 l2,6 z" fill="#bae6fd" stroke="#0ea5e9"/>';
    case 'caixa': return '<rect x="'+R(x-14)+'" y="'+R(y-12)+'" width="34" height="26" fill="#cf9d62" stroke="#8a6034" stroke-width="1.5"/><rect x="'+R(x+1)+'" y="'+R(y-12)+'" width="5" height="26" fill="#e8c38f"/>';
    case 'remedio': return '<rect x="'+(x-4)+'" y="'+(y-12)+'" width="10" height="14" rx="2" fill="#fde68a" stroke="#a16207"/><path d="M'+(x+6)+','+(y-12)+' l5,-4 M'+(x+6)+','+(y-6)+' l6,0" stroke="#0ea5e9" stroke-width="2"/>';
  }
  return '';
}
function P(x, y, o){
  o = o || {};
  var po = POSES[o.pose || 'stand'], sc = o.s || 1;
  var shirt = o.shirt || '#3aa6a0', pants = o.pants || shirt, skin = o.skin || '#d9a066', hair = o.hair || '#3b2a1f';
  var hip = po.hip.slice(), tA = po.t;
  var top = [hip[0] + 50*Math.sin(rad(tA)), hip[1] - 50*Math.cos(rad(tA))];
  var sh = [hip[0] + 44*Math.sin(rad(tA)), hip[1] - 44*Math.cos(rad(tA))];
  var head = [hip[0] + 64*Math.sin(rad(tA)), hip[1] - 64*Math.cos(rad(tA))];
  function leg(a){ var k = seg(hip, 26, a[0]); return [hip, k, seg(k, 26, a[1])]; }
  function arm(a){ var e = seg(sh, 22, a[0]); return [sh, e, seg(e, 21, a[1])]; }
  var L1 = leg(po.legs[0]), L2 = leg(po.legs[1]), A1 = arm(po.arms[0]), A2 = arm(po.arms[1]);
  var hand = o.luva ? o.luva : skin;
  var s = '<g transform="translate('+x+','+y+') scale('+(o.flip ? -sc : sc)+','+sc+')">';
  s += '<ellipse cx="0" cy="2" rx="22" ry="4" fill="#000" opacity=".14"/>';
  s += '<polyline points="'+pts(L2)+'" fill="none" stroke="'+pants+'" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>';
  s += '<circle cx="'+R(L2[2][0]+3)+'" cy="'+R(L2[2][1]-2)+'" r="6" fill="'+(o.sapato||'#f1f5f9')+'" stroke="#64748b"/>';
  s += '<polyline points="'+pts(A2)+'" fill="none" stroke="'+(o.manga||shirt)+'" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>';
  s += '<circle cx="'+R(A2[2][0])+'" cy="'+R(A2[2][1])+'" r="4.5" fill="'+hand+'"/>';
  if (o.mao2) s += itemMao(o.mao2, A2[2]);
  s += '<line x1="'+R(hip[0])+'" y1="'+R(hip[1])+'" x2="'+R(top[0])+'" y2="'+R(top[1])+'" stroke="'+shirt+'" stroke-width="24" stroke-linecap="round"/>';
  if (o.jaleco){
    var lo = [hip[0] - 6*Math.sin(rad(tA)) , hip[1] + 6*Math.cos(rad(tA))];
    s += '<line x1="'+R(lo[0])+'" y1="'+R(lo[1])+'" x2="'+R(top[0])+'" y2="'+R(top[1])+'" stroke="#fff" stroke-width="27" stroke-linecap="round" opacity=".97"/>';
    s += '<line x1="'+R(lo[0]+3)+'" y1="'+R(lo[1])+'" x2="'+R(sh[0]+3)+'" y2="'+R(sh[1])+'" stroke="#cbd5e1" stroke-width="1.5"/>';
  }
  if (o.avental) s += '<line x1="'+R(hip[0]+4)+'" y1="'+R(hip[1]+12)+'" x2="'+R(sh[0]+4)+'" y2="'+R(sh[1]+4)+'" stroke="'+o.avental+'" stroke-width="20" stroke-linecap="round" opacity=".9"/>';
  if (o.cracha) s += '<rect x="'+R(sh[0]+2)+'" y="'+R(sh[1]+10)+'" width="8" height="10" fill="#fff" stroke="#0b3b5c"/>';
  s += '<polyline points="'+pts(L1)+'" fill="none" stroke="'+pants+'" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>';
  s += '<circle cx="'+R(L1[2][0]+3)+'" cy="'+R(L1[2][1]-2)+'" r="6" fill="'+(o.sapato||'#f1f5f9')+'" stroke="#64748b"/>';
  s += '<circle cx="'+R(head[0])+'" cy="'+R(head[1])+'" r="12.5" fill="'+skin+'"/>';
  s += '<path d="M'+R(head[0]-12.5)+','+R(head[1]-1)+' A12.5 12.5 0 0 1 '+R(head[0]+11)+','+R(head[1]-6)+' L'+R(head[0]-4)+','+R(head[1]-4)+' Z" fill="'+hair+'"/>';
  s += '<circle cx="'+R(head[0]+6)+'" cy="'+R(head[1]-1)+'" r="1.8" fill="#1f2937"/>';
  if (o.touca) s += '<path d="M'+R(head[0]-14)+','+R(head[1]-1)+' A14 13 0 0 1 '+R(head[0]+14)+','+R(head[1]-1)+' Z" fill="'+o.touca+'"/>';
  if (o.mascara) s += '<path d="M'+R(head[0]-2)+','+R(head[1]+2)+' h14 q0,9 -8,10 h-6 z" fill="'+(o.mascara === true ? '#bfe3f5' : o.mascara)+'"/>';
  if (o.oculos) s += '<rect x="'+R(head[0]+1)+'" y="'+R(head[1]-5)+'" width="13" height="7" rx="2" fill="#bae6fd" fill-opacity=".7" stroke="#334155" stroke-width="1.5"/>';
  s += '<polyline points="'+pts(A1)+'" fill="none" stroke="'+(o.manga||shirt)+'" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>';
  s += '<circle cx="'+R(A1[2][0])+'" cy="'+R(A1[2][1])+'" r="4.5" fill="'+hand+'"/>';
  if (o.mao) s += itemMao(o.mao, A1[2]);
  if (o.espuma) s += '<g fill="#fff" stroke="#bae6fd"><circle cx="'+R(A1[2][0]+2)+'" cy="'+R(A1[2][1]-3)+'" r="4"/><circle cx="'+R(A1[2][0]-4)+'" cy="'+R(A1[2][1]+1)+'" r="3"/><circle cx="'+R(A1[2][0]+6)+'" cy="'+R(A1[2][1]+3)+'" r="3"/></g>';
  s += '</g>';
  return s;
}

/* ---------- objetos ---------- */
function bio(cx, cy, r, cor){
  cor = cor || '#111'; var s = '<g fill="none" stroke="'+cor+'" stroke-width="'+R(r*0.22)+'">';
  [0, 120, 240].forEach(function(a){ s += '<circle cx="'+R(cx + r*0.5*Math.sin(rad(a)))+'" cy="'+R(cy - r*0.5*Math.cos(rad(a)))+'" r="'+R(r*0.5)+'"/>'; });
  return s + '<circle cx="'+cx+'" cy="'+cy+'" r="'+R(r*0.3)+'"/></g>';
}
var BINS = {
  comum:  { c:'#6b7280', l:['LIXO','COMUM'], tc:'#fff' },
  infect: { c:'#f8fafc', l:['INFEC-','TANTE'], tc:'#111', bio:true },
  papel:  { c:'#2563eb', l:['PAPEL'], tc:'#fff' },
  plast:  { c:'#dc2626', l:['PLÁS-','TICO'], tc:'#fff' },
  dados:  { c:'#1e293b', l:['DADOS','SENSÍVEIS'], tc:'#fde047', lock:true }
};
/* lixeira: x = centro, y = base; o.sai = conteúdo saindo pela boca (svg, desenhado atrás) */
function lixeira(x, y, k, o){
  o = o || {}; var b = BINS[k], w = o.w || 58, h = o.h || 76, s = '';
  if (o.sai) s += o.sai;
  s += '<path d="M'+(x-w/2)+','+(y-h)+' h'+w+' l-5,'+h+' h-'+(w-10)+' z" fill="'+b.c+'" stroke="#334155" stroke-width="2"/>';
  if (b.lock){
    s += '<rect x="'+(x-w/2-2)+'" y="'+(y-h-8)+'" width="'+(w+4)+'" height="10" rx="3" fill="#0f172a"/><rect x="'+(x-14)+'" y="'+(y-h-6)+'" width="28" height="4" rx="2" fill="#94a3b8"/>';
    s += '<rect x="'+(x-6)+'" y="'+(y-22)+'" width="12" height="10" rx="2" fill="#fde047"/><path d="M'+(x-4)+','+(y-22)+' v-4 a4 4 0 0 1 8,0 v4" fill="none" stroke="#fde047" stroke-width="2"/>';
  } else if (!o.semTampa) s += '<rect x="'+(x-w/2-3)+'" y="'+(y-h-7)+'" width="'+(w+6)+'" height="9" rx="3" fill="'+b.c+'" stroke="#334155" stroke-width="2"/>';
  b.l.forEach(function(l, i){ s += txt(x, y - h + 20 + i*12, l, b.l.length > 1 ? 10 : 12, b.tc); });
  if (b.bio) s += bio(x, y - h + 48, 9, '#111');
  if (!b.lock) s += '<rect x="'+(x+w/2-16)+'" y="'+(y-6)+'" width="16" height="5" rx="2" fill="#334155"/>';
  return s;
}
/* caixa de perfurocortante (amarela): x = centro, y = base */
function caixaPerf(x, y, o){
  o = o || {}; var s = '';
  if (o.cheia){
    s += '<g transform="translate('+(x-12)+','+(y-58)+') rotate(-60)"><rect x="-6" y="-3.5" width="22" height="7" rx="1.5" fill="#fff" stroke="#64748b" stroke-width="1.5"/><line x1="16" y1="0" x2="30" y2="0" stroke="#475569" stroke-width="1.8"/></g>';
    s += '<g transform="translate('+(x+6)+','+(y-56)+') rotate(-115)"><rect x="-6" y="-3.5" width="22" height="7" rx="1.5" fill="#fff" stroke="#64748b" stroke-width="1.5"/><line x1="16" y1="0" x2="30" y2="0" stroke="#475569" stroke-width="1.8"/></g>';
    s += '<line x1="'+(x+14)+'" y1="'+(y-56)+'" x2="'+(x+26)+'" y2="'+(y-76)+'" stroke="#475569" stroke-width="2"/><line x1="'+(x-2)+'" y1="'+(y-54)+'" x2="'+(x-10)+'" y2="'+(y-80)+'" stroke="#475569" stroke-width="2"/>';
  }
  if (o.suporte) s += '<rect x="'+(x-34)+'" y="'+(y-4)+'" width="68" height="8" fill="#94a3b8"/><path d="M'+(x-34)+','+(y+4)+' l0,-50 M'+(x+34)+','+(y+4)+' l0,-50" stroke="#94a3b8" stroke-width="4"/>';
  s += '<rect x="'+(x-29)+'" y="'+(y-50)+'" width="58" height="50" rx="3" fill="#facc15" stroke="#a16207" stroke-width="2"/>';
  s += '<path d="M'+(x-29)+','+(y-50)+' l8,-10 h42 l8,10 z" fill="#fde047" stroke="#a16207" stroke-width="2"/><rect x="'+(x-10)+'" y="'+(y-62)+'" width="20" height="5" rx="2" fill="#a16207"/>';
  s += '<line x1="'+(x-27)+'" y1="'+(y-38)+'" x2="'+(x+27)+'" y2="'+(y-38)+'" stroke="#b91c1c" stroke-width="2" stroke-dasharray="4 3"/>';
  s += txt(x, y-26, 'PERFURO', 9.5, '#111') + txt(x, y-16, 'CORTANTE', 9.5, '#111') + bio(x, y-7, 4, '#111');
  return s;
}
/* caixa laranja (medicamentos / resíduo químico): x = centro, y = base */
function caixaLar(x, y, o){
  o = o || {}; var s = '';
  if (o.entra) s += o.entra;
  s += '<rect x="'+(x-30)+'" y="'+(y-48)+'" width="60" height="48" rx="3" fill="#f97316" stroke="#9a3412" stroke-width="2"/>';
  s += '<path d="M'+(x-30)+','+(y-48)+' l8,-9 h44 l8,9 z" fill="#fb923c" stroke="#9a3412" stroke-width="2"/>';
  s += txt(x, y-30, 'MEDICA-', 9.5, '#fff') + txt(x, y-19, 'MENTOS', 9.5, '#fff') + txt(x, y-7, '☢ QUÍMICO', 7.5, '#fff');
  return s;
}
function seringa(x, y, a, o){
  o = o || {};
  return '<g transform="translate('+x+','+y+') rotate('+(a||0)+')"><rect x="-14" y="-4" width="28" height="8" rx="1.5" fill="#fff" stroke="#64748b" stroke-width="1.5"/><line x1="-22" y1="0" x2="-14" y2="0" stroke="#64748b" stroke-width="3"/><rect x="-25" y="-5" width="3" height="10" fill="#64748b"/>' +
    (o.tampa ? '<rect x="14" y="-2.5" width="16" height="5" rx="2" fill="#f97316"/>' : '<line x1="14" y1="0" x2="32" y2="0" stroke="#475569" stroke-width="1.8"/>') + '</g>';
}
function ampola(x, y, o){
  o = o || {};
  if (o.quebrada) return '<path d="M'+(x-6)+','+y+' v-18 q0,-5 6,-6 q6,1 6,6 v18 z" fill="#e0f2fe" stroke="#0284c7" stroke-width="1.5"/><path d="M'+(x-6)+','+(y-18)+' l3,-3 l3,2 l3,-3 l3,4" fill="none" stroke="#0284c7" stroke-width="1.5"/>' +
    '<path d="M'+(x+12)+','+(y-2)+' l4,-12 l3,2 l-1,10 z" fill="#e0f2fe" stroke="#0284c7" stroke-width="1.5" transform="rotate(50 '+(x+14)+' '+(y-6)+')"/><path d="M'+(x-16)+','+(y)+' l4,-5 l3,5 z M'+(x+20)+','+(y+1)+' l3,-4 l2,4 z" fill="#bae6fd" stroke="#0284c7"/>';
  return '<path d="M'+(x-6)+','+y+' v-18 q0,-5 6,-6 q-3,-4 -2,-10 h4 q1,6 -2,10 q6,1 6,6 v18 z" fill="#e0f2fe" stroke="#0284c7" stroke-width="1.5"/>';
}
function bisturi(x, y, a){
  return '<g transform="translate('+x+','+y+') rotate('+(a||0)+')"><rect x="-22" y="-3" width="28" height="6" rx="2" fill="#94a3b8" stroke="#475569"/><path d="M6,-3 h10 q8,2 6,6 l-16,0 z" fill="#e2e8f0" stroke="#475569" stroke-width="1.5"/></g>';
}
function agulhaSut(x, y){
  return '<path d="M'+(x-10)+','+y+' a10 10 0 0 1 20,0" fill="none" stroke="#475569" stroke-width="2.4"/><path d="M'+(x-10)+','+y+' q-12,10 -24,4" fill="none" stroke="#1d4ed8" stroke-width="1.5"/>';
}
function placaPiso(x, y){
  return '<path d="M'+(x-22)+','+y+' l14,-62 h16 l14,62 z" fill="#facc15" stroke="#a16207" stroke-width="2.5"/>' + '<path d="M'+(x)+','+(y-52)+' l-10,18 h20 z" fill="#111"/>' + txt(x, y-38, '!', 12, '#facc15') +
    txt(x, y-20, 'PISO', 8.5, '#111') + txt(x, y-10, 'MOLHADO', 7.5, '#111');
}
function poca(cx, cy, rx, cor){
  cor = cor || '#7dd3fc';
  return '<ellipse cx="'+cx+'" cy="'+cy+'" rx="'+rx+'" ry="'+R(rx*0.28)+'" fill="'+cor+'" opacity=".75"/><ellipse cx="'+(cx+rx*0.35)+'" cy="'+(cy+3)+'" rx="'+R(rx*0.55)+'" ry="'+R(rx*0.22)+'" fill="'+cor+'" opacity=".75"/><ellipse cx="'+(cx-rx*0.3)+'" cy="'+(cy-2)+'" rx="'+R(rx*0.25)+'" ry="3" fill="#fff" opacity=".6"/>';
}
function cilindro(x, y, o){
  o = o || {}; var s = '<g' + (o.solto ? ' transform="rotate(-11 '+x+' '+y+')"' : '') + '>';
  s += '<rect x="'+(x-13)+'" y="'+(y-112)+'" width="26" height="112" rx="12" fill="#16a34a" stroke="#14532d" stroke-width="2"/><rect x="'+(x-13)+'" y="'+(y-112)+'" width="26" height="20" rx="10" fill="#f8fafc"/>' +
    '<rect x="'+(x-4)+'" y="'+(y-126)+'" width="8" height="14" fill="#64748b"/><circle cx="'+(x+8)+'" cy="'+(y-122)+'" r="6" fill="#e2e8f0" stroke="#475569" stroke-width="2"/>' + txt(x, y-56, 'O₂', 12, '#fff') + '</g>';
  if (o.carrinho){
    s += '<path d="M'+(x-20)+','+(y-4)+' h40 M'+(x-18)+','+(y-80)+' v76 M'+(x+18)+','+(y-80)+' v76" stroke="#475569" stroke-width="4"/>' + roda(x-16, y+2, 6) + roda(x+16, y+2, 6);
    s += '<path d="M'+(x-18)+','+(y-70)+' q18,10 36,0" fill="none" stroke="#94a3b8" stroke-width="3" stroke-dasharray="4 2"/>';
  }
  return s;
}
function roda(cx, cy, r){ return '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="#1f2937"/><circle cx="'+cx+'" cy="'+cy+'" r="'+R(r*0.42)+'" fill="#9ca3af"/>'; }
/* leito com paciente: x = esquerda, y = chão (rodas) */
function cama(x, y, o){
  o = o || {}; var w = 250, s = '';
  s += '<rect x="'+x+'" y="'+(y-175)+'" width="12" height="160" rx="4" fill="#94a3b8"/><rect x="'+(x+w-12)+'" y="'+(y-150)+'" width="12" height="135" rx="4" fill="#94a3b8"/>';
  s += '<rect x="'+(x+8)+'" y="'+(y-62)+'" width="'+(w-16)+'" height="10" fill="#cbd5e1"/><rect x="'+(x+8)+'" y="'+(y-100)+'" width="'+(w-16)+'" height="12" fill="#cbd5e1"/>';
  s += '<path d="M'+(x+30)+','+(y-52)+' v40 M'+(x+w-30)+','+(y-52)+' v40" stroke="#94a3b8" stroke-width="7"/>' + roda(x+30, y-8, 8) + roda(x+w-30, y-8, 8);
  s += '<rect x="'+(x+10)+'" y="'+(y-118)+'" width="'+(w-20)+'" height="20" rx="6" fill="#e0f2fe" stroke="#93c5fd"/>';
  s += '<ellipse cx="'+(x+42)+'" cy="'+(y-124)+'" rx="26" ry="9" fill="#fff" stroke="#cbd5e1"/><circle cx="'+(x+46)+'" cy="'+(y-134)+'" r="14" fill="'+(o.pele||'#c68b59')+'"/><path d="M'+(x+32)+','+(y-136)+' a14 14 0 0 1 26,-6 l-8,2 z" fill="'+(o.cabelo||'#9ca3af')+'"/>';
  s += '<path d="M'+(x+60)+','+(y-118)+' q20,-30 70,-26 q60,-2 90,10 q12,6 8,16 z" fill="'+(o.lencol||'#93c5fd')+'" stroke="#60a5fa"/>';
  s += '<path d="M'+(x+70)+','+(y-140)+' h130 M'+(x+70)+','+(y-124)+' h130 M'+(x+80)+','+(y-142)+' v26 M'+(x+190)+','+(y-142)+' v26" stroke="#64748b" stroke-width="4" fill="none" opacity=".9"/>';
  return s;
}
function monitorMed(x, y){
  return '<rect x="'+x+'" y="'+y+'" width="84" height="60" rx="6" fill="#1e293b" stroke="#475569" stroke-width="3"/><polyline points="'+(x+6)+','+(y+26)+' '+(x+22)+','+(y+26)+' '+(x+28)+','+(y+10)+' '+(x+33)+','+(y+40)+' '+(x+38)+','+(y+26)+' '+(x+78)+','+(y+26)+'" fill="none" stroke="#4ade80" stroke-width="2.5"/>' +
    txt(x+70, y+52, '98', 11, '#38bdf8') + txt(x+20, y+52, '72♥', 11, '#4ade80') + '<rect x="'+(x+38)+'" y="'+(y+60)+'" width="8" height="18" fill="#64748b"/>';
}
function soro(x, y){
  return '<line x1="'+x+'" y1="'+(y-300)+'" x2="'+x+'" y2="'+y+'" stroke="#94a3b8" stroke-width="5"/><path d="M'+(x-24)+','+y+' h48" stroke="#64748b" stroke-width="5"/>' + roda(x-22, y+4, 5) + roda(x+22, y+4, 5) +
    '<path d="M'+(x-14)+','+(y-300)+' h28" stroke="#94a3b8" stroke-width="4"/><rect x="'+(x-22)+'" y="'+(y-296)+'" width="18" height="38" rx="5" fill="#e0f2fe" stroke="#60a5fa" stroke-width="2"/><path d="M'+(x-13)+','+(y-258)+' q0,60 -30,110" fill="none" stroke="#93c5fd" stroke-width="2"/>';
}
function dispenserGel(x, y){
  return '<rect x="'+(x-14)+'" y="'+y+'" width="28" height="44" rx="5" fill="#fff" stroke="#94a3b8" stroke-width="2"/><rect x="'+(x-10)+'" y="'+(y+6)+'" width="20" height="20" rx="3" fill="#bae6fd"/>' + txt(x, y+20, 'GEL', 8, '#0369a1') + '<rect x="'+(x-6)+'" y="'+(y+44)+'" width="12" height="6" fill="#94a3b8"/>' + txt(x, y-6, 'ÁLCOOL 70%', 8, '#0369a1');
}
/* bancada com armários: x = esquerda, y = tampo */
function bancada(x, y, w, ch){
  var h = ch || (488 - y), s = '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/><rect x="'+(x-4)+'" y="'+(y-6)+'" width="'+(w+8)+'" height="10" rx="2" fill="url(#inox)" stroke="#94a3b8"/>';
  for (var i = 0, n = Math.max(1, Math.round(w/70)); i < n; i++){ var dx = x + 6 + i*(w-12)/n; s += '<rect x="'+R(dx)+'" y="'+(y+12)+'" width="'+R((w-12)/n-6)+'" height="'+(h-20)+'" rx="3" fill="#f1f5f9" stroke="#cbd5e1"/><rect x="'+R(dx+(w-12)/n/2-10)+'" y="'+(y+24)+'" width="14" height="4" rx="2" fill="#94a3b8"/>'; }
  return s;
}
/* estante metálica: x esquerda, topo, largura, níveis (y de cada prateleira) */
function estante(x, top, w, niveis, base){
  base = base || 488;
  var s = '<rect x="'+x+'" y="'+top+'" width="7" height="'+(base-top)+'" fill="#64748b"/><rect x="'+(x+w-7)+'" y="'+top+'" width="7" height="'+(base-top)+'" fill="#64748b"/>';
  niveis.forEach(function(yy){ s += '<rect x="'+x+'" y="'+yy+'" width="'+w+'" height="7" fill="#94a3b8" stroke="#64748b"/>'; });
  return s;
}
function caixaMed(x, y, w, h, cor, rot){
  var s = '<rect x="'+x+'" y="'+(y-h)+'" width="'+w+'" height="'+h+'" rx="2" fill="#fff" stroke="#94a3b8"/><rect x="'+x+'" y="'+(y-h)+'" width="'+w+'" height="'+R(h*0.3)+'" fill="'+cor+'"/>';
  if (rot) s += txt(x + w/2, y - h*0.3, rot, Math.min(9, w/5), '#334155');
  return s;
}
function prateleiraMed(x, y, w, cores){
  var s = '', cx = x + 4, i = 0;
  while (cx < x + w - 24){ var bw = 22 + (i*7 % 14), bh = 30 + (i*11 % 22); if (cx + bw > x + w - 4) break; s += caixaMed(cx, y, bw, bh, cores[i % cores.length]); cx += bw + 3; i++; }
  return s;
}
function caixote(x, y, w, h, rot, cor){
  return '<rect x="'+x+'" y="'+(y-h)+'" width="'+w+'" height="'+h+'" fill="'+(cor||'#cf9d62')+'" stroke="#8a6034" stroke-width="1.5"/><rect x="'+R(x+w/2-3)+'" y="'+(y-h)+'" width="6" height="'+h+'" fill="#e8c38f" opacity=".7"/>' + (rot ? txt(x + w/2, y - h/2 + 4, rot, Math.min(11, w/6), '#5b3a14') : '');
}
function extintor(x, y){
  return '<rect x="'+(x-30)+'" y="'+(y-10)+'" width="60" height="'+(F-y+10)+'" fill="#d62828" opacity=".12"/><rect x="'+(x-14)+'" y="'+y+'" width="28" height="64" rx="10" fill="#d62828" stroke="#8b1414" stroke-width="2"/>' +
    '<rect x="'+(x-5)+'" y="'+(y-12)+'" width="10" height="13" fill="#1f2937"/><path d="M'+(x+5)+','+(y-8)+' q20,0 18,40" fill="none" stroke="#1f2937" stroke-width="3"/>' +
    '<rect x="'+(x-20)+'" y="'+(y-62)+'" width="40" height="40" rx="3" fill="#d62828"/><rect x="'+(x-6)+'" y="'+(y-52)+'" width="12" height="22" rx="4" fill="#fff"/><rect x="'+(x-3)+'" y="'+(y-57)+'" width="6" height="5" fill="#fff"/><path d="M'+(x+3)+','+(y-55)+' h8 v6" fill="none" stroke="#fff" stroke-width="2"/>';
}
function kitDerr(x, y, o){
  o = o || {};
  var s = '<rect x="'+(x-62)+'" y="'+(y-70)+'" width="124" height="34" rx="4" fill="#facc15" stroke="#a16207" stroke-width="2"/>' + txt(x, y-56, 'KIT DE DERRAMAMENTO', 9, '#111') + txt(x, y-44, 'NÍVEL I', 10, '#b91c1c');
  s += '<rect x="'+(x-4)+'" y="'+(y-34)+'" width="8" height="10" fill="#64748b"/>';
  if (o.vazio) return s + '<path d="M'+(x-3)+','+(y-24)+' q-8,14 4,16" fill="none" stroke="#64748b" stroke-width="3"/>' + txt(x, y+16, 'VAZIO', 11, '#b91c1c');
  return s + '<path d="M'+(x-12)+','+(y-24)+' q12,-10 24,0" fill="none" stroke="#7f1d1d" stroke-width="4"/><rect x="'+(x-30)+'" y="'+(y-24)+'" width="60" height="58" rx="8" fill="#dc2626" stroke="#7f1d1d" stroke-width="2"/><rect x="'+(x-30)+'" y="'+(y-6)+'" width="60" height="8" fill="#facc15"/>' + txt(x, y+24, 'KIT', 12, '#fff');
}
function galao(x, y, o){
  o = o || {}; var s = '<g' + (o.caido ? ' transform="rotate(-80 '+x+' '+y+')"' : '') + '>';
  s += '<rect x="'+(x-14)+'" y="'+(y-40)+'" width="28" height="40" rx="5" fill="'+(o.cor||'#f8fafc')+'" stroke="#64748b" stroke-width="2"/><rect x="'+(x-5)+'" y="'+(y-47)+'" width="10" height="8" fill="#1e3a8a"/>';
  if (o.rotulo !== false) s += '<rect x="'+(x-10)+'" y="'+(y-30)+'" width="20" height="18" fill="#fff" stroke="#94a3b8"/><path d="M'+x+','+(y-29)+' l8,8 l-8,8 l-8,-8 z" fill="#fff" stroke="#dc2626" stroke-width="2"/>' + txt(x, y-17, '!', 8, '#111');
  return s + '</g>';
}
function frascoQ(x, y, o){
  o = o || {};
  if (o.pet) return '<rect x="'+(x-8)+'" y="'+(y-40)+'" width="16" height="40" rx="5" fill="#bfdbfe" opacity=".85" stroke="#60a5fa" stroke-width="1.5"/><rect x="'+(x-8)+'" y="'+(y-22)+'" width="16" height="22" rx="4" fill="'+(o.liq||'#a3e635')+'" opacity=".8"/><rect x="'+(x-4)+'" y="'+(y-46)+'" width="8" height="6" fill="#ef4444"/>';
  return '<rect x="'+(x-10)+'" y="'+(y-40)+'" width="20" height="40" rx="3" fill="#f1f5f9" stroke="#64748b" stroke-width="1.5"/><rect x="'+(x-4)+'" y="'+(y-46)+'" width="8" height="6" fill="#1e3a8a"/>' +
    (o.rotulo === false ? '' : '<rect x="'+(x-8)+'" y="'+(y-32)+'" width="16" height="22" fill="#fff" stroke="#94a3b8"/><path d="M'+x+','+(y-30)+' l6,6 l-6,6 l-6,-6 z" fill="#fff" stroke="#dc2626" stroke-width="1.8"/><line x1="'+(x-6)+'" y1="'+(y-14)+'" x2="'+(x+6)+'" y2="'+(y-14)+'" stroke="#94a3b8"/>');
}
function barreira(cx, cy, rx){
  return '<ellipse cx="'+cx+'" cy="'+cy+'" rx="'+rx+'" ry="'+R(rx*0.32)+'" fill="none" stroke="#e5e7eb" stroke-width="11"/><ellipse cx="'+cx+'" cy="'+cy+'" rx="'+rx+'" ry="'+R(rx*0.32)+'" fill="none" stroke="#9ca3af" stroke-width="2" stroke-dasharray="6 5"/>';
}
function fioChao(x1, x2, y){
  var mid = (x1 + x2) / 2;
  return '<path d="M'+x1+','+(F-6)+' C'+(x1)+','+(y)+' '+(x1+20)+','+(y+6)+' '+(mid-30)+','+(y-4)+' C'+(mid)+','+(y-26)+' '+(mid+40)+','+(y+20)+' '+(mid+10)+','+(y+8)+' C'+(mid-10)+','+(y)+' '+(x2-40)+','+(y+12)+' '+x2+','+(y-2)+'" fill="none" stroke="#111827" stroke-width="4"/>';
}
function cadeira(x, y, o){
  o = o || {}; var s = '<g' + (o.tilt ? ' transform="rotate(-16 '+(x-24)+' '+y+')"' : '') + '>';
  s += '<rect x="'+(x-48)+'" y="'+(y-36)+'" width="44" height="8" rx="3" fill="#334155"/><rect x="'+(x-52)+'" y="'+(y-92)+'" width="9" height="62" rx="4" fill="#334155"/><line x1="'+(x-26)+'" y1="'+(y-28)+'" x2="'+(x-26)+'" y2="'+(y-8)+'" stroke="#475569" stroke-width="5"/><path d="M'+(x-46)+','+(y-6)+' h40" stroke="#475569" stroke-width="5"/>' + roda(x-44, y-2, 4) + roda(x-8, y-2, 4);
  return s + '</g>';
}
function mesaEsc(x, y, w){
  return '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="10" rx="2" fill="#a47148"/><rect x="'+(x+6)+'" y="'+(y+10)+'" width="8" height="'+(488-y-10)+'" fill="#7c5434"/><rect x="'+(x+w-60)+'" y="'+(y+10)+'" width="54" height="'+(488-y-10)+'" fill="#8b5e3c"/><rect x="'+(x+w-54)+'" y="'+(y+24)+'" width="42" height="4" rx="2" fill="#5c3d24"/><rect x="'+(x+w-54)+'" y="'+(y+52)+'" width="42" height="4" rx="2" fill="#5c3d24"/>';
}
function pc(x, y, o){
  o = o || {}; var s = '<rect x="'+x+'" y="'+y+'" width="96" height="62" rx="4" fill="#111827"/><rect x="'+(x+44)+'" y="'+(y+62)+'" width="8" height="14" fill="#374151"/><rect x="'+(x+30)+'" y="'+(y+74)+'" width="36" height="5" rx="2" fill="#374151"/>';
  if (o.dados){
    s += '<rect x="'+(x+4)+'" y="'+(y+4)+'" width="88" height="54" fill="#f8fafc"/><rect x="'+(x+4)+'" y="'+(y+4)+'" width="88" height="10" fill="#0e7490"/>' + txt(x+48, y+12, 'PRONTUÁRIO', 7.5, '#fff') +
      txt(x+8, y+24, 'Paciente: J. S. Lima', 7, '#111', { a:'start', w:600 }) + txt(x+8, y+33, 'CPF 123.4••.•••-00', 7, '#111', { a:'start', w:600 }) + txt(x+8, y+42, 'Diag.: ••••••••', 7, '#111', { a:'start', w:600 }) + txt(x+8, y+51, 'Convênio: ••••', 7, '#111', { a:'start', w:600 });
  } else {
    s += '<rect x="'+(x+4)+'" y="'+(y+4)+'" width="88" height="54" fill="#1e3a8a"/><rect x="'+(x+40)+'" y="'+(y+20)+'" width="16" height="13" rx="2" fill="#fde047"/><path d="M'+(x+43)+','+(y+20)+' v-4 a5 5 0 0 1 10,0 v4" fill="none" stroke="#fde047" stroke-width="2"/>' + txt(x+48, y+48, 'BLOQUEADO', 8, '#fff');
  }
  return s;
}
function impressora(x, y, o){
  o = o || {}; var s = '<rect x="'+(x-50)+'" y="'+y+'" width="100" height="'+(488-y)+'" fill="#cbd5e1" stroke="#94a3b8"/>';
  s += '<rect x="'+(x-40)+'" y="'+(y-44)+'" width="80" height="44" rx="5" fill="#e5e7eb" stroke="#6b7280" stroke-width="2"/><rect x="'+(x-30)+'" y="'+(y-30)+'" width="60" height="6" fill="#374151"/><circle cx="'+(x+28)+'" cy="'+(y-38)+'" r="3" fill="#22c55e"/>';
  if (o.papeis) s += '<g transform="rotate(-6 '+x+' '+(y-28)+')"><rect x="'+(x-26)+'" y="'+(y-58)+'" width="46" height="34" fill="#fff" stroke="#94a3b8"/><rect x="'+(x-22)+'" y="'+(y-54)+'" width="38" height="6" fill="#dc2626"/>' + txt(x-3, y-36, 'PACIENTE', 7, '#111') + '<line x1="'+(x-22)+'" y1="'+(y-30)+'" x2="'+(x+14)+'" y2="'+(y-30)+'" stroke="#94a3b8"/></g><rect x="'+(x-20)+'" y="'+(y-62)+'" width="46" height="34" fill="#fff" stroke="#94a3b8" transform="rotate(8 '+x+' '+(y-40)+')"/>';
  return s;
}
function arquivo(x, y, o){
  o = o || {}; var s = '<rect x="'+x+'" y="'+y+'" width="70" height="'+(488-y)+'" fill="#9ca3af" stroke="#6b7280" stroke-width="2"/>';
  for (var i = 0; i < 4; i++){ var yy = y + 6 + i*((488-y-8)/4); s += '<rect x="'+(x+5)+'" y="'+R(yy)+'" width="60" height="'+R((488-y-8)/4-6)+'" rx="2" fill="#d1d5db" stroke="#6b7280"/><rect x="'+(x+26)+'" y="'+R(yy+8)+'" width="18" height="5" rx="2" fill="#4b5563"/>'; }
  if (o.aberta){ var yd = y + 6 + 2*((488-y-8)/4); s += '<path d="M'+(x+70)+','+R(yd)+' l46,10 v'+R((488-y-8)/4-6)+' l-46,-10 z" fill="#c4c9d1" stroke="#6b7280" stroke-width="2"/><rect x="'+(x+72)+'" y="'+R(yd-8)+'" width="40" height="12" fill="#fef3c7" stroke="#a16207" transform="skewY(12)"/>'; }
  return s;
}
function tomada(x, y, o){
  o = o || {}; var s = '<rect x="'+(x-14)+'" y="'+(y-14)+'" width="28" height="28" rx="4" fill="#f8fafc" stroke="#94a3b8" stroke-width="2"/>';
  if (o.benjamim){
    s += '<rect x="'+(x-18)+'" y="'+(y-6)+'" width="36" height="22" rx="3" fill="#f1f5f9" stroke="#64748b" stroke-width="2"/>';
    [-12, 0, 12].forEach(function(d, i){ s += '<rect x="'+(x+d-4)+'" y="'+(y+14)+'" width="8" height="12" fill="#111"/><path d="M'+(x+d)+','+(y+26)+' q'+(d*2)+',30 '+(d*4 - 30 + i*30)+',58" fill="none" stroke="#111" stroke-width="3"/>'; });
    s += '<path d="M'+(x+16)+','+(y-10)+' l8,-8 l-2,7 l9,-4" fill="none" stroke="#f59e0b" stroke-width="2.5"/><circle cx="'+(x+20)+'" cy="'+(y-8)+'" r="7" fill="#fde047" opacity=".5"/>';
  } else s += '<rect x="'+(x-4)+'" y="'+(y-6)+'" width="8" height="12" fill="#111"/><path d="M'+x+','+(y+6)+' q0,20 -30,'+(F-y-8)+'" fill="none" stroke="#111" stroke-width="3"/>';
  return s;
}
function escada(x, y){
  return '<path d="M'+(x-26)+','+y+' l10,-66 M'+(x+26)+','+y+' l-10,-66" stroke="#475569" stroke-width="5"/><rect x="'+(x-22)+'" y="'+(y-70)+'" width="44" height="8" fill="#64748b"/><rect x="'+(x-22)+'" y="'+(y-46)+'" width="44" height="6" fill="#94a3b8"/><rect x="'+(x-24)+'" y="'+(y-22)+'" width="48" height="6" fill="#94a3b8"/><path d="M'+(x+16)+','+(y-70)+' v-40 h-10" fill="none" stroke="#475569" stroke-width="4"/>';
}

function placaAviso(x, y, l1, l2){
  return '<path d="M'+(x-22)+','+y+' l14,-62 h16 l14,62 z" fill="#facc15" stroke="#a16207" stroke-width="2.5"/>' + '<path d="M'+(x)+','+(y-52)+' l-10,18 h20 z" fill="#111"/>' + txt(x, y-38, '!', 12, '#facc15') +
    txt(x, y-20, l1, 8, '#111') + txt(x, y-10, l2, 7, '#111');
}
function papeisSai(x, y){
  return '<path d="M'+(x-18)+','+y+' q4,-14 14,-10 q8,-8 14,2 q10,-4 10,8 z" fill="#f8fafc" stroke="#cbd5e1"/>';
}
function carrinhoPeq(x, y){
  return '<rect x="'+x+'" y="'+y+'" width="76" height="6" fill="#94a3b8"/><path d="M'+(x+6)+','+(y+6)+' v14 M'+(x+70)+','+(y+6)+' v14" stroke="#64748b" stroke-width="4"/>' + roda(x+6, y+22, 4) + roda(x+70, y+22, 4);
}
var ENF = { shirt:'#2f9e63', luva:'#93c5fd', cracha:true };
var HIG = { shirt:'#7c6fd6', pants:'#4c3fa8' };
function o2(a, b){ var r = {}, k; for (k in a) r[k] = a[k]; for (k in b) r[k] = b[k]; return r; }

/* ============================================================
   CENAS "CAÇA AOS RISCOS" — os riscos mudam a cada partida
   Cada ponto da cena tem duas versões: insegura (bad) e correta (good).
   tipo: 'c' = condição insegura, 'b' = comportamento inseguro
   ============================================================ */
var CENAS = {
  uti: {
    titulo: 'UTI / Internação — passagem de plantão',
    instr: 'Observe o quarto: toque somente no que está ERRADO. O que estiver certo é exemplo a seguir!',
    tempo: 110, n: 5,
    base: function(){
      var s = bg({});
      s += plaqueta(105, 52, 150, ['UTI · LEITO 01']) + plaqueta(655, 52, 150, ['UTI · LEITO 02']) + placaLogo(560, 60, 58);
      s += janela(880, 70, 100, 140) + monitorMed(70, 190) + monitorMed(760, 190);
      s += cama(40, 490) + soro(318, 488);
      s += cama(600, 490, { pele:'#e0b48a', cabelo:'#4b3621', lencol:'#a7f3d0' });
      s += plaqueta(438, 190, 120, ['PREPARO DE', 'MEDICAÇÃO'], '#00983A');
      s += bancada(340, 382, 220) + caixaLar(528, 376);
      s += dispenserGel(925, 290) + lixeira(962, 548, 'infect', { w:50, h:68 });
      return s;
    },
    slots: [
      { x:385, y:298, r:46, tipo:'c', t:'Caixa de perfurocortante acima da linha de enchimento',
        e:'Caixa cheia demais deixa agulhas para fora e espeta quem descarta ou recolhe. Ao atingir a linha tracejada (3/4 da capacidade), a caixa deve ser fechada, lacrada e trocada.',
        ok:'Respeitar a linha tracejada: chegou no limite, fechar, lacrar e pedir uma caixa nova.', okT:'Caixa de perfurocortante dentro do limite e fixada no suporte.',
        bad:function(){ return caixaPerf(385, 330, { suporte:true, cheia:true }); }, good:function(){ return caixaPerf(385, 330, { suporte:true }); } },
      { x:468, y:362, r:42, tipo:'c', t:'Ampola quebrada e agulha soltas na bancada',
        e:'Ampolas quebradas e agulhas largadas na bancada cortam e perfuram quem vem depois. A ampola vai para a caixa laranja e a agulha para a caixa de perfurocortante, logo após o uso.',
        ok:'Terminou o preparo: ampola na caixa laranja, agulha na caixa de perfurocortante e bancada limpa.', okT:'Bancada de preparo limpa e organizada.',
        bad:function(){ return ampola(440, 376, { quebrada:true }) + seringa(486, 370, -8); }, good:function(){ return '<rect x="430" y="366" width="74" height="10" rx="3" fill="#cbd5e1" stroke="#94a3b8"/>'; } },
      { x:584, y:420, r:46, tipo:'c', t:'Cilindro de oxigênio solto, sem fixação',
        e:'Se o cilindro cair, a válvula pode romper e ele vira um projétil, além de esmagar pés. Deve ficar sempre em pé, preso com corrente ou em carrinho próprio.',
        ok:'Cilindro em pé, preso com corrente no carrinho ou suporte.', okT:'Cilindro de O₂ preso no carrinho com corrente.',
        bad:function(){ return cilindro(584, 490, { solto:true }); }, good:function(){ return cilindro(584, 484, { carrinho:true }); } },
      { x:770, y:540, w:150, h:36, tipo:'c', t:'Cabo elétrico atravessando a passagem',
        e:'Fios soltos no piso causam tropeços e quedas, principalmente na correria de uma urgência. Organize os cabos rente à parede ou em canaletas.',
        ok:'Cabos organizados rente à parede ou em canaleta, longe da passagem.', okT:'Cabos organizados na canaleta, piso livre.',
        bad:function(){ return fioChao(840, 700, 540); }, good:function(){ return '<rect x="690" y="456" width="170" height="9" rx="3" fill="#cbd5e1" stroke="#94a3b8"/>'; } },
      { x:900, y:498, r:46, tipo:'c', t:'Agulha e ampola jogadas no lixo comum',
        e:'O saco de lixo comum não protege contra perfuração: quem fecha o saco, a higienização e a coleta podem se acidentar. Agulha vai na caixa de perfurocortante e ampola na caixa laranja.',
        ok:'No lixo comum só vai resíduo comum: papel toalha, embalagens sem contaminação.', okT:'Lixo comum só com papel toalha.',
        bad:function(){ return lixeira(900, 548, 'comum', { sai: papeisSai(904, 470) + seringa(892, 452, -62) + ampola(918, 468, { quebrada:true }) }); },
        good:function(){ return lixeira(900, 548, 'comum', { sai: papeisSai(904, 470) }); } },
      { x:410, y:520, r:46, tipo:'c', t:'Piso molhado sem sinalização',
        e:'Piso molhado sem placa é uma das principais causas de queda no hospital. Sinalize durante e depois da limpeza, até secar.',
        ok:'Colocar a placa "piso molhado" e, se possível, limpar metade da passagem por vez.', okT:'Piso molhado sinalizado com placa.',
        bad:function(){ return poca(410, 526, 52); }, good:function(){ return poca(410, 526, 52) + placaPiso(366, 530); } },
      { x:190, y:452, r:60, tipo:'b', t:'Reencapando a agulha depois do uso',
        e:'Reencapar agulha é uma das maiores causas de acidente com material biológico (HIV, hepatites B e C). A NR-32 proíbe o reencape e a desconexão manual de agulhas.',
        ok:'Não reencapar: levar a caixa de perfurocortante até o leito e descartar seringa e agulha juntas, na hora.', okT:'Técnica descarta a seringa sem reencapar, direto na caixa levada até o leito.',
        bad:function(){ return carrinhoPeq(214, 522) + '<rect x="222" y="512" width="58" height="10" rx="3" fill="#cbd5e1" stroke="#94a3b8"/>' + P(190, 542, o2(ENF, { pose:'recap', mao:'seringa', mao2:'tampa' })); },
        good:function(){ return carrinhoPeq(214, 522) + caixaPerf(252, 522) + P(190, 542, o2(ENF, { pose:'drop', mao:'seringaBaixo' })); } },
      { x:700, y:455, r:58, tipo:'b', t:'Comendo e bebendo ao lado do leito',
        e:'A NR-32 proíbe comer, beber e guardar alimentos nos postos de trabalho da assistência: há risco de contaminação por agentes biológicos e químicos.',
        ok:'Lanche só na copa ou no refeitório. No leito, higienizar as mãos antes e depois de tocar o paciente.', okT:'Profissional higieniza as mãos com álcool gel antes de tocar o paciente.',
        bad:function(){ return P(700, 542, { pose:'drink', shirt:'#2563eb', mao:'cafe', mao2:'lanche', cracha:true }); },
        good:function(){ return P(700, 542, { pose:'maos', shirt:'#2563eb', espuma:true, cracha:true }); } }
    ]
  },

  cc: {
    titulo: 'Centro Cirúrgico — limpeza da sala após a cirurgia',
    instr: 'A cirurgia terminou e a equipe de higienização vai limpar a sala. Encontre o que está errado antes que alguém se fure!',
    tempo: 110, n: 5,
    base: function(){
      var s = bg({ parede:'#e3f3ee', azulejo:true, faixa:false });
      s += plaqueta(600, 44, 220, ['SALA 03', 'LIMPEZA PÓS-CIRURGIA'], '#00703A') + placaLogo(860, 44, 54);
      s += '<line x1="470" y1="26" x2="470" y2="70" stroke="#94a3b8" stroke-width="8"/><path d="M470,70 l-40,26" stroke="#94a3b8" stroke-width="7"/><ellipse cx="420" cy="112" rx="70" ry="22" fill="#e2e8f0" stroke="#94a3b8" stroke-width="3"/><ellipse cx="420" cy="116" rx="50" ry="12" fill="#fefce8"/>';
      s += '<rect x="30" y="230" width="100" height="250" rx="8" fill="#cbd5e1" stroke="#64748b" stroke-width="2"/><rect x="42" y="246" width="76" height="52" rx="4" fill="#1e293b"/><polyline points="46,276 60,276 66,262 72,290 78,276 114,276" fill="none" stroke="#4ade80" stroke-width="2"/><rect x="44" y="312" width="22" height="40" rx="4" fill="#facc15"/><rect x="76" y="312" width="22" height="40" rx="4" fill="#a78bfa"/>' + roda(48, 484, 7) + roda(112, 484, 7);
      s += '<rect x="455" y="398" width="30" height="72" fill="url(#inox)" stroke="#94a3b8"/><path d="M420,488 l20,-20 h60 l20,20 z" fill="#94a3b8"/><rect x="330" y="384" width="270" height="16" rx="6" fill="#1e3a8a"/><rect x="330" y="380" width="270" height="6" rx="3" fill="#3b82f6"/>';
      s += '<rect x="680" y="410" width="170" height="7" fill="url(#inox)" stroke="#94a3b8"/><rect x="680" y="402" width="170" height="9" fill="#60a5fa" opacity=".6"/><path d="M690,417 v68 M840,417 v68" stroke="#94a3b8" stroke-width="5"/><rect x="684" y="450" width="162" height="5" fill="#cbd5e1"/>' + roda(690, 486, 5) + roda(840, 486, 5);
      s += '<rect x="760" y="426" width="62" height="24" rx="3" fill="#e5e7eb" stroke="#64748b"/><circle cx="808" cy="438" r="5" fill="#f59e0b"/>' + txt(780, 442, 'ESU', 9, '#334155');
      s += '<path d="M700,400 l14,-6 M704,400 l12,-2" stroke="#64748b" stroke-width="2.5"/><circle cx="696" cy="400" r="3" fill="none" stroke="#64748b" stroke-width="2"/>';
      return s;
    },
    slots: [
      { x:930, y:450, w:110, h:200, tipo:'c', t:'Caixa de perfurocortante no chão e transbordando',
        e:'Caixa no chão é chutada e derrubada; cheia demais, deixa agulhas para fora. Ela deve ficar em suporte, acima do piso, e ser trocada ao atingir a linha de enchimento.',
        ok:'Caixa fixada em suporte, na altura adequada, trocada ao atingir a linha tracejada.', okT:'Caixa de perfurocortante no suporte, dentro do limite.',
        bad:function(){ return caixaPerf(930, 548, { cheia:true }) + seringa(968, 548, 170); }, good:function(){ return caixaPerf(930, 404, { suporte:true }); } },
      { x:420, y:372, r:46, tipo:'c', t:'Bisturi, agulha e seringa esquecidos sobre a mesa cirúrgica',
        e:'Perfurocortantes deixados na mesa ferem a equipe de limpeza, que não espera encontrá-los. A NR-32 determina que quem usa o perfurocortante é responsável pelo seu descarte, logo após o uso.',
        ok:'A equipe cirúrgica descarta lâminas e agulhas na caixa antes de liberar a sala; a limpeza confere tudo visualmente antes de começar.', okT:'Mesa cirúrgica liberada sem perfurocortantes.',
        bad:function(){ return bisturi(382, 376, -4) + agulhaSut(426, 378) + seringa(468, 374, 6); }, good:function(){ return '<rect x="360" y="372" width="120" height="8" rx="3" fill="#e0f2fe" stroke="#93c5fd"/>'; } },
      { x:470, y:524, r:46, tipo:'c', t:'Lâmina de bisturi e agulha de sutura caídas sob a mesa cirúrgica',
        e:'Perfurocortantes no chão ou embaixo da mesa/maca são quase invisíveis para quem limpa e podem atravessar luva e calçado.',
        ok:'Antes de limpar, inspecionar o piso e embaixo da mesa e da maca; recolher com pinça e descartar na caixa.', okT:'Piso embaixo da mesa inspecionado e livre.',
        bad:function(){ return bisturi(442, 530, 18) + agulhaSut(504, 532); }, good:function(){ return ''; } },
      { x:575, y:528, r:40, tipo:'c', t:'Piso molhado sem sinalização durante a limpeza',
        e:'Durante a limpeza terminal o piso fica molhado e escorregadio. Sem placa, cirurgiões, enfermagem e maqueiros podem cair.',
        ok:'Sinalizar com a placa "piso molhado" até secar.', okT:'Piso molhado sinalizado com placa.',
        bad:function(){ return poca(575, 532, 40); }, good:function(){ return poca(575, 532, 40) + placaPiso(548, 536); } },
      { x:705, y:540, w:150, h:34, tipo:'c', t:'Cabos do bisturi elétrico espalhados pelo piso',
        e:'Cabos soltos provocam tropeços e podem puxar equipamentos da mesa. Recolha e enrole os cabos ao final do procedimento.',
        ok:'Cabos recolhidos, enrolados e guardados com o equipamento.', okT:'Cabos do bisturi elétrico recolhidos.',
        bad:function(){ return fioChao(770, 640, 540); }, good:function(){ return '<circle cx="792" cy="438" r="8" fill="none" stroke="#111827" stroke-width="3"/>'; } },
      { x:765, y:440, r:60, tipo:'b', t:'Recolhendo bisturi com a mão, sem luva',
        e:'Pegar perfurocortante com a mão desprotegida expõe a cortes e a sangue contaminado. Use luvas e pinça e leve a caixa de perfurocortante até o local.',
        ok:'De luvas, recolher com pinça e descartar direto na caixa de perfurocortante.', okT:'Profissional de luvas usa pinça para levar o bisturi à caixa.',
        bad:function(){ return P(730, 512, o2(HIG, { pose:'hold', mao:'bisturi', touca:'#c4b5fd', mascara:true })); },
        good:function(){ return caixaPerf(815, 402) + P(730, 512, o2(HIG, { pose:'hold', mao:'pinca', luva:'#facc15', touca:'#c4b5fd', mascara:true, oculos:true })); } },
      { x:225, y:462, r:60, tipo:'b', t:'Compactando o lixo infectante com as mãos',
        e:'Empurrar o lixo com as mãos ou os pés pode causar perfuração por agulhas descartadas errado e contato com sangue. O saco deve ser fechado com 2/3 da capacidade, sem compactar.',
        ok:'Fechar o saco com 2/3 da capacidade, sem apertar, e segurá-lo pela parte de cima, longe do corpo.', okT:'Saco fechado com 2/3 da capacidade e lixeira tampada.',
        bad:function(){ return lixeira(262, 548, 'infect', { w:56, h:70, semTampa:true, sai:'<path d="M236,480 q-6,-26 26,-30 q30,4 24,30 z" fill="#f1f5f9" stroke="#94a3b8"/>' }) + P(200, 540, o2(HIG, { pose:'lean', touca:'#c4b5fd' })); },
        good:function(){ return lixeira(268, 548, 'infect', { w:56, h:70 }) + P(200, 540, o2(HIG, { pose:'hold', mao:'saco', luva:'#facc15', touca:'#c4b5fd', mascara:true })); } }
    ]
  },

  farmacia: {
    titulo: 'Farmácia — recebimento e dispensação',
    instr: 'Na farmácia não há perfurocortantes, mas há medicamentos quebrados, extraviados e muito peso. Toque no que está errado.',
    tempo: 110, n: 5,
    base: function(){
      var s = bg({});
      s += plaqueta(560, 40, 150, ['FARMÁCIA']) + placaLogo(900, 28, 58);
      s += estante(20, 90, 480, [100, 180, 260, 340, 420]);
      var C = ['#f87171','#60a5fa','#34d399','#fbbf24','#a78bfa','#f472b6'];
      s += prateleiraMed(24, 180, 470, C) + prateleiraMed(24, 260, 300, C.slice(2)) + prateleiraMed(396, 260, 100, C) + prateleiraMed(24, 340, 470, C.slice(1)) + prateleiraMed(24, 420, 470, C.slice(3));
      s += '<rect x="640" y="150" width="340" height="226" fill="url(#vid)" opacity=".55" stroke="#94a3b8" stroke-width="4"/>' + plaqueta(730, 118, 160, ['DISPENSAÇÃO'], '#00983A');
      s += bancada(640, 382, 340);
      return s;
    },
    slots: [
      { x:170, y:62, w:220, h:80, tipo:'c', t:'Caixas pesadas no alto da estante',
        e:'Caixas pesadas no alto podem cair na cabeça de alguém e obrigam a erguer peso acima dos ombros. O mais pesado fica nas prateleiras de baixo e do meio.',
        ok:'Pesados entre a altura dos joelhos e dos ombros; no alto, só itens leves.', okT:'No alto da estante só ficam itens leves.',
        bad:function(){ return caixote(60, 100, 110, 50, 'SORO 0,9%', '#d6b48a') + caixote(150, 100, 120, 56, 'SORO 0,9%', '#d6b48a') + caixote(90, 50, 110, 24, '', '#d6b48a'); },
        good:function(){ return caixaMed(80, 100, 40, 24, '#60a5fa', 'GAZE') + caixaMed(130, 100, 40, 24, '#34d399', 'GAZE') + caixaMed(180, 100, 40, 24, '#fbbf24', 'LUVA'); } },
      { x:360, y:236, r:38, tipo:'c', t:'Medicamento avariado misturado aos bons na prateleira',
        e:'Medicamento quebrado ou extraviado pode ser dispensado por engano e vazar sobre outros produtos. Deve ser separado, registrado e descartado na caixa laranja.',
        ok:'Separar o medicamento avariado, registrar a perda e descartar na caixa laranja.', okT:'Prateleira só com medicamentos íntegros.',
        bad:function(){ return caixaMed(334, 260, 52, 40, '#f87171') + '<path d="M344,226 l8,10 l-6,6 l10,10" stroke="#111" stroke-width="2.5" fill="none"/>' + txt(360, 254, 'AVARIADO', 8, '#b91c1c') + '<path d="M376,260 q2,10 0,14" stroke="#eab308" stroke-width="4"/>'; },
        good:function(){ return caixaMed(334, 260, 26, 36, '#34d399') + caixaMed(362, 260, 26, 30, '#60a5fa'); } },
      { x:440, y:372, r:70, tipo:'b', t:'Subindo na estante para alcançar uma caixa',
        e:'Subir na estante pode derrubá-la e causar queda de altura. Use escada com degraus e corrimão ou peça ajuda.',
        ok:'Usar a escada/plataforma com corrimão para alcançar itens altos.', okT:'Colaborador usa a escada para pegar item no alto.',
        bad:function(){ return P(440, 420, { pose:'climb', jaleco:true, shirt:'#0e7490', pants:'#334155' }); },
        good:function(){ return escada(440, 522) + P(440, 452, { pose:'reach', jaleco:true, shirt:'#0e7490', pants:'#334155' }); } },
      { x:300, y:528, r:42, tipo:'c', t:'Frasco de medicamento quebrado no chão',
        e:'Cacos de vidro cortam e o líquido derramado deixa o piso escorregadio e pode ser tóxico. Isole, recolha com luvas, pá e vassoura e descarte na caixa laranja.',
        ok:'Isolar, recolher com luvas, pá e vassoura e descartar na caixa laranja.', okT:'Piso livre de cacos e líquidos.',
        bad:function(){ return poca(300, 534, 34, '#fcd34d') + ampola(292, 532, { quebrada:true }) + '<path d="M318,536 l5,-7 l3,7 z M276,538 l4,-5 l3,5 z" fill="#bae6fd" stroke="#0284c7"/>'; }, good:function(){ return ''; } },
      { x:560, y:515, r:48, tipo:'c', t:'Caixas do recebimento largadas no corredor',
        e:'Caixas no chão do corredor causam tropeços e atrapalham a passagem em uma emergência. Guarde ou deixe em área demarcada.',
        ok:'Conferir e guardar logo após o recebimento, ou deixar em área demarcada fora da passagem.', okT:'Corredor livre.',
        bad:function(){ return caixote(520, 552, 52, 40) + caixote(566, 552, 46, 34) + caixote(530, 512, 44, 30); }, good:function(){ return ''; } },
      { x:685, y:462, r:62, tipo:'b', t:'Jogando medicamento quebrado no lixo comum',
        e:'Medicamento é resíduo químico: no lixo comum ele contamina o solo e a água e expõe a equipe de coleta. Na farmácia, o medicamento quebrado ou extraviado vai para a caixa laranja.',
        ok:'Descartar o medicamento quebrado ou extraviado na caixa laranja e registrar a perda.', okT:'Atendente descarta o medicamento quebrado na caixa laranja.',
        bad:function(){ return lixeira(712, 548, 'comum') + P(650, 542, { pose:'drop', jaleco:true, shirt:'#0e7490', pants:'#334155', mao:'frasco' }); },
        good:function(){ return caixaLar(712, 548) + P(650, 542, { pose:'drop', jaleco:true, shirt:'#0e7490', pants:'#334155', mao:'frasco', luva:'#93c5fd' }); } },
      { x:880, y:494, r:55, tipo:'b', t:'Recolhendo cacos de vidro com as mãos',
        e:'Catar cacos com a mão nua causa cortes e contato com o medicamento. Use luvas, pá e vassoura (ou pinça para pedaços pequenos).',
        ok:'Com luvas, recolher com pá e vassoura e descartar na caixa laranja.', okT:'Cacos recolhidos com luvas, pá e vassoura.',
        bad:function(){ return '<path d="M900,544 l5,-7 l3,7 z M926,546 l4,-6 l3,6 z" fill="#bae6fd" stroke="#0284c7"/>' + P(870, 546, { pose:'crouch', shirt:'#0e7490', jaleco:true, pants:'#334155', mao:'cacos' }); },
        good:function(){ return P(870, 546, { pose:'crouch', shirt:'#0e7490', jaleco:true, pants:'#334155', mao:'pa', mao2:'vassoura', luva:'#93c5fd' }); } }
    ]
  },

  almox: {
    titulo: 'Almoxarifado — produtos de limpeza e materiais',
    instr: 'Produtos químicos, caixas pesadas e estantes altas. Encontre o que está errado no almoxarifado.',
    tempo: 110, n: 5,
    base: function(){
      var s = bg({ parede:'#eef2ea', faixa:'#b9c7a8' });
      s += plaqueta(400, 40, 180, ['ALMOXARIFADO']) + placaLogo(600, 36, 52);
      s += estante(20, 110, 300, [190, 270, 350, 430]);
      var L = ['LUVAS','SERINGAS','GAZE','MÁSCARAS','ALGODÃO','AVENTAL','TOUCAS','ATADURA'];
      [190, 270, 350, 430].forEach(function(yy, k){ s += caixote(28, yy, 90, 46, L[k*2]) + caixote(124, yy, 90, 40, L[k*2+1]) + caixote(220, yy, 90, 44, ''); });
      s += plaqueta(775, 96, 200, ['PRODUTOS QUÍMICOS'], '#E1251B');
      s += estante(770, 150, 210, [180, 280, 380]);
      s += galao(800, 180) + galao(840, 180) + galao(880, 180, { cor:'#fef9c3' });
      s += galao(800, 380) + galao(850, 380, { cor:'#dbeafe' }) + galao(900, 380) + galao(950, 380, { cor:'#fef9c3' });
      return s;
    },
    slots: [
      { x:900, y:250, r:48, tipo:'c', t:'Produto químico sem rótulo, em garrafa de refrigerante',
        e:'Sem rótulo ninguém sabe o risco do produto, e embalagem de bebida pode levar alguém a ingerir. Todo produto químico deve ter rótulo com nome, perigos (pictogramas) e ficar na embalagem original.',
        ok:'Produto na embalagem original ou em frasco próprio rotulado com nome e pictogramas de perigo.', okT:'Frascos de produto químico rotulados.',
        bad:function(){ return frascoQ(870, 280, { pet:true }) + frascoQ(905, 280, { rotulo:false }) + frascoQ(940, 280, { pet:true, liq:'#93c5fd' }); },
        good:function(){ return frascoQ(870, 280) + frascoQ(905, 280) + frascoQ(940, 280); } },
      { x:160, y:362, r:70, tipo:'b', t:'Subindo na estante para pegar caixa no alto',
        e:'A estante pode tombar e a pessoa cair de altura. Use escada com degraus e corrimão.',
        ok:'Usar a escada/plataforma para alcançar o alto.', okT:'Colaborador usa escada para alcançar o alto.',
        bad:function(){ return P(160, 430, { pose:'climb', shirt:'#475569', pants:'#1e293b' }); },
        good:function(){ return escada(160, 522) + P(160, 452, { pose:'reach', shirt:'#475569', pants:'#1e293b' }); } },
      { x:520, y:290, r:55, tipo:'c', t:'Kit de derramamento ausente do local',
        e:'Se houver um vazamento, não haverá material para conter o produto. O kit de derramamento nível I deve estar completo, lacrado e no local sinalizado — e ser reposto depois de cada uso.',
        ok:'Bolsa do kit de derramamento nível I completa, no local sinalizado e reposta após o uso.', okT:'Kit de derramamento nível I completo no local.',
        bad:function(){ return kitDerr(520, 300, { vazio:true }); }, good:function(){ return kitDerr(520, 300); } },
      { x:680, y:392, r:58, tipo:'c', t:'Extintor bloqueado por caixas',
        e:'Em um princípio de incêndio, cada segundo conta. Extintores devem ficar desobstruídos, sinalizados e com acesso livre.',
        ok:'Área do extintor sempre livre e demarcada.', okT:'Extintor desobstruído e sinalizado.',
        bad:function(){ return extintor(680, 330) + caixote(632, 488, 96, 56) + caixote(646, 432, 70, 40); }, good:function(){ return extintor(680, 330); } },
      { x:400, y:400, w:110, h:200, tipo:'c', t:'Pilha de caixas alta e desalinhada',
        e:'Pilha alta e torta pode desabar sobre quem passa. Respeite a altura máxima, alinhe as caixas e coloque as mais pesadas embaixo.',
        ok:'Empilhar caixas alinhadas, pesadas embaixo, respeitando a altura máxima.', okT:'Pilha baixa e alinhada.',
        bad:function(){ return caixote(360, 488, 80, 40) + caixote(368, 448, 76, 38) + caixote(352, 410, 80, 36) + '<g transform="rotate(8 400 374)">' + caixote(370, 374, 76, 34) + caixote(378, 340, 70, 32) + '</g>'; },
        good:function(){ return caixote(360, 488, 80, 40) + caixote(360, 448, 80, 38) + caixote(360, 410, 80, 36); } },
      { x:265, y:478, r:55, tipo:'b', t:'Levantando caixa com a coluna curvada',
        e:'Erguer peso com as pernas esticadas e as costas curvadas sobrecarrega a coluna (lombalgia, hérnia). Dobre os joelhos e mantenha a carga perto do corpo.',
        ok:'Dobrar os joelhos, coluna reta e carga junto ao corpo; peso excessivo, pedir ajuda ou usar carrinho.', okT:'Colaborador agacha e levanta a caixa com a coluna reta.',
        bad:function(){ return P(250, 540, { pose:'bend', shirt:'#475569', pants:'#1e293b', mao:'caixa' }); },
        good:function(){ return P(250, 540, { pose:'squat', shirt:'#475569', pants:'#1e293b', mao:'caixa' }); } },
      { x:600, y:522, r:62, tipo:'c', t:'Produto químico derramado e sem contenção',
        e:'O produto se espalha, escorrega e libera vapores. É preciso isolar e sinalizar a área e conter com o kit de derramamento nível I (barreiras e mantas absorventes), de fora para dentro.',
        ok:'Isolar, sinalizar e conter com as barreiras do kit de derramamento nível I, de fora para dentro.', okT:'Derramamento isolado, sinalizado e contido com a barreira do kit.',
        bad:function(){ return poca(606, 530, 64, '#c084fc') + galao(548, 528, { caido:true }); },
        good:function(){ return poca(606, 530, 40, '#c084fc') + barreira(606, 530, 58) + placaAviso(536, 534, 'PRODUTO', 'QUÍMICO') + '<rect x="660" y="520" width="34" height="26" rx="6" fill="#dc2626" stroke="#7f1d1d"/>'; } },
      { x:880, y:455, r:60, tipo:'b', t:'Transferindo produto químico sem luvas e sem óculos',
        e:'Respingos de produto químico causam queimaduras na pele e nos olhos. Consulte a FDS e use os EPIs indicados (luvas, óculos, avental), passando para frasco próprio e rotulado.',
        ok:'Com luvas, óculos e avental, transferir para frasco próprio e rotulado, conforme a FDS.', okT:'Colaborador de luvas, óculos e avental usa frasco rotulado.',
        bad:function(){ return P(860, 540, { pose:'pour', shirt:'#475569', pants:'#1e293b', mao:'galao', mao2:'pet' }); },
        good:function(){ return P(860, 540, { pose:'pour', shirt:'#475569', pants:'#1e293b', mao:'galao', mao2:'frascoR', luva:'#22c55e', oculos:true, avental:'#38bdf8' }); } }
    ]
  },

  adm: {
    titulo: 'Administrativo — faturamento e prontuários',
    instr: 'No administrativo o risco também está nos dados dos pacientes. Toque no que está errado.',
    tempo: 110, n: 5,
    base: function(){
      var s = bg({ parede:'#f3f1ea', faixa:'#d6cfbf' });
      s += plaqueta(560, 30, 260, ['ADMINISTRATIVO', 'FATURAMENTO E PRONTUÁRIOS']) + placaLogo(860, 34, 58);
      s += janela(420, 90, 150, 130);
      s += mesaEsc(200, 432, 170) + cadeira(195, 490);
      s += mesaEsc(450, 432, 180) + pc(520, 353, {}) ;
      s += '<rect x="526" y="357" width="84" height="54" fill="#ecfeff"/>' + txt(568, 372, 'FATURAMENTO', 7, '#0e7490') + '<path d="M532,380 h70 M532,390 h60 M532,400 h66" stroke="#94a3b8" stroke-width="3"/>';
      return s;
    },
    slots: [
      { x:288, y:385, r:46, tipo:'c', t:'Computador desbloqueado com prontuário aberto e ninguém na mesa',
        e:'Qualquer pessoa que passar pode ver ou alterar dados de saúde do paciente, que são dados sensíveis pela LGPD. Ao sair da mesa, bloqueie a tela (Windows + L).',
        ok:'Bloquear a tela sempre que sair da mesa (Windows + L).', okT:'Tela bloqueada com a mesa vazia.',
        bad:function(){ return pc(240, 353, { dados:true }); }, good:function(){ return pc(240, 353, {}); } },
      { x:770, y:388, r:46, tipo:'c', t:'Documentos de pacientes esquecidos na impressora',
        e:'Papéis com nome, diagnóstico ou convênio do paciente expostos podem ser lidos ou levados por qualquer um. Retire a impressão na hora e guarde ou descarte na lixeira de dados sensíveis.',
        ok:'Retirar as impressões na hora; o que não for usado vai para a lixeira de dados sensíveis.', okT:'Impressora sem documentos esquecidos.',
        bad:function(){ return impressora(770, 420, { papeis:true }); }, good:function(){ return impressora(770, 420, {}); } },
      { x:118, y:418, r:36, tipo:'c', t:'Benjamim sobrecarregado na tomada',
        e:'Vários aparelhos ligados em um benjamim ou "T" esquentam a fiação e podem causar choque e incêndio. Use tomadas adequadas e solicite a manutenção.',
        ok:'Um aparelho por tomada; precisando de mais pontos, chamar a manutenção.', okT:'Tomada com um único plugue.',
        bad:function(){ return tomada(118, 410, { benjamim:true }); }, good:function(){ return tomada(118, 410, {}); } },
      { x:260, y:540, w:170, h:34, tipo:'c', t:'Fios atravessando a passagem',
        e:'Fios soltos no chão causam tropeços e quedas. Passe os cabos por canaletas ou rente à parede.',
        ok:'Cabos em canaleta ou presos rente à parede.', okT:'Cabos organizados na canaleta.',
        bad:function(){ return fioChao(340, 180, 540); }, good:function(){ return '<rect x="170" y="456" width="180" height="9" rx="3" fill="#d6d3d1" stroke="#a8a29e"/>'; } },
      { x:440, y:425, r:58, tipo:'b', t:'Balançando na cadeira, apoiado só nas rodas de trás',
        e:'Inclinar a cadeira para trás pode fazê-la virar e causar queda com batida da cabeça. Sente com as costas apoiadas e os pés no chão.',
        ok:'Sentar com as costas apoiadas no encosto, pés no chão e tela na altura dos olhos (NR-17).', okT:'Colaboradora sentada corretamente, com postura adequada.',
        bad:function(){ return cadeira(445, 490, { tilt:true }) + P(445, 486, { pose:'tilt', shirt:'#be185d', pants:'#1e293b', hair:'#111' }); },
        good:function(){ return cadeira(445, 490) + P(445, 490, { pose:'sit', shirt:'#be185d', pants:'#1e293b', hair:'#111' }); } },
      { x:630, y:466, r:62, tipo:'b', t:'Jogando documento de paciente na lixeira de papel',
        e:'Documento com dados de paciente no lixo comum ou reciclável pode ser lido por qualquer pessoa no caminho até a reciclagem: é vazamento de dados (LGPD). Ele deve ir somente para a lixeira de dados sensíveis.',
        ok:'Documentos com dados de pacientes só na lixeira de dados sensíveis.', okT:'Colaborador descarta o documento do paciente na lixeira de dados sensíveis.',
        bad:function(){ return lixeira(668, 552, 'papel') + P(610, 545, { pose:'drop', shirt:'#0f766e', pants:'#1e293b', mao:'papel' }); },
        good:function(){ return lixeira(668, 552, 'dados') + P(610, 545, { pose:'drop', shirt:'#0f766e', pants:'#1e293b', mao:'papel' }); } },
      { x:920, y:420, r:52, tipo:'c', t:'Gaveta do arquivo aberta no caminho',
        e:'Gaveta aberta causa batidas e tropeços, e um arquivo com várias gavetas abertas pode tombar. Feche sempre depois de usar.',
        ok:'Abrir uma gaveta por vez e fechá-la logo após o uso.', okT:'Gavetas do arquivo fechadas.',
        bad:function(){ return arquivo(870, 330, { aberta:true }); }, good:function(){ return arquivo(870, 330, {}); } },
      { x:75, y:505, w:140, h:100, tipo:'c', t:'Papel e plástico nas lixeiras trocadas',
        e:'Resíduo na lixeira errada contamina a reciclagem e vira lixo comum. Papel limpo vai na lixeira azul e plástico na vermelha.',
        ok:'Papel limpo na azul, plástico na vermelha; papel com dados de paciente só na lixeira de dados sensíveis.', okT:'Papel e plástico nas lixeiras certas.',
        bad:function(){ return lixeira(45, 552, 'papel', { w:52, h:66, sai:'<path d="M32,488 l6,-16 h10 l3,16 z" fill="#fca5a5" stroke="#dc2626"/>' }) + lixeira(108, 552, 'plast', { w:52, h:66, sai:'<rect x="96" y="472" width="18" height="16" fill="#fff" stroke="#94a3b8" transform="rotate(-10 104 480)"/>' }); },
        good:function(){ return lixeira(45, 552, 'papel', { w:52, h:66, sai:'<rect x="34" y="474" width="18" height="16" fill="#fff" stroke="#94a3b8" transform="rotate(-10 42 482)"/>' }) + lixeira(108, 552, 'plast', { w:52, h:66, sai:'<path d="M96,488 l6,-16 h10 l3,16 z" fill="#fca5a5" stroke="#dc2626"/>' }); } }
    ]
  }
};

/* sorteia quais pontos da cena estarão inseguros nesta partida */
function sortearCena(c){
  var n = Math.min(c.n || 5, c.slots.length), idx, tent = 0;
  do {
    idx = shuffle(c.slots.map(function(_, i){ return i; })).slice(0, n);
    var tipos = {}; idx.forEach(function(i){ tipos[c.slots[i].tipo] = 1; });
    tent++;
  } while ((!tipos.b || !tipos.c) && tent < 30);
  var m = {}; idx.forEach(function(i){ m[i] = true; });
  if (DEBUG && /todos/.test(location.search)) c.slots.forEach(function(_, i){ m[i] = true; });
  if (DEBUG && /certo/.test(location.search)) m = {};
  return m;
}

/* ============================================================
   DESCARTE CERTO — lixeiras e itens
   ============================================================ */
var LIX = {
  perfuro: { n:'Caixa de perfurocortante', s:'Agulhas, lâminas, scalp, cateter', cor:'#facc15', tc:'#111' },
  laranja: { n:'Caixa laranja', s:'Ampolas e medicamentos', cor:'#f97316', tc:'#fff' },
  infect:  { n:'Infectante (saco branco)', s:'Com sangue ou fluidos', cor:'#f8fafc', tc:'#111' },
  comum:   { n:'Lixo comum', s:'Não reciclável, sem contaminação', cor:'#6b7280', tc:'#fff' },
  papel:   { n:'Reciclável · Papel', s:'Papel sem dados de paciente', cor:'#2563eb', tc:'#fff' },
  plast:   { n:'Reciclável · Plástico', s:'Copos, embalagens limpas', cor:'#dc2626', tc:'#fff' },
  dados:   { n:'Dados sensíveis', s:'Documentos de pacientes', cor:'#1e293b', tc:'#fde047' }
};
function iconeLix(k){
  var L = LIX[k], s = '<svg viewBox="0 0 60 64" aria-hidden="true">';
  if (k === 'perfuro') s += '<rect x="6" y="16" width="48" height="44" rx="3" fill="#facc15" stroke="#a16207" stroke-width="3"/><path d="M6,16 l7,-9 h34 l7,9 z" fill="#fde047" stroke="#a16207" stroke-width="3"/>' + bio(30, 40, 9, '#111');
  else if (k === 'laranja') s += '<rect x="6" y="16" width="48" height="44" rx="3" fill="#f97316" stroke="#9a3412" stroke-width="3"/><path d="M6,16 l7,-9 h34 l7,9 z" fill="#fb923c" stroke="#9a3412" stroke-width="3"/><path d="M26,52 v-14 q0,-4 4,-5 q-2,-3 -1,-8 h2 q1,5 -1,8 q4,1 4,5 v14 z" fill="#fff"/>';
  else {
    s += '<path d="M8,12 h44 l-5,50 h-34 z" fill="' + L.cor + '" stroke="#334155" stroke-width="3"/><rect x="5" y="5" width="50" height="8" rx="3" fill="' + (k === 'dados' ? '#0f172a' : L.cor) + '" stroke="#334155" stroke-width="2"/>';
    if (k === 'infect') s += bio(30, 36, 10, '#111');
    if (k === 'dados') s += '<rect x="22" y="32" width="16" height="13" rx="2" fill="#fde047"/><path d="M25,32 v-4 a5 5 0 0 1 10,0 v4" fill="none" stroke="#fde047" stroke-width="3"/>';
    if (k === 'papel') s += '<rect x="21" y="24" width="18" height="24" fill="#fff"/><path d="M24,31 h12 M24,36 h12 M24,41 h9" stroke="#2563eb" stroke-width="2"/>';
    if (k === 'plast') s += '<path d="M24,26 h12 l-2,22 h-8 z" fill="#fff"/>';
    if (k === 'comum') s += '<path d="M20,34 q10,-10 20,0" fill="none" stroke="#fff" stroke-width="3"/>';
  }
  return s + '</svg>';
}
/* ilustrações dos itens do Descarte Certo (viewBox 100 x 80) */
var ICO = {
  scalp: '<path d="M14,40 h22" stroke="#475569" stroke-width="2.5"/><path d="M36,40 l12,-16 h10 l-6,16 l6,16 h-10 z" fill="#22c55e" stroke="#15803d" stroke-width="2"/><path d="M58,40 c16,0 14,-22 30,-20" fill="none" stroke="#93c5fd" stroke-width="4"/><circle cx="90" cy="20" r="5" fill="#e2e8f0" stroke="#64748b" stroke-width="2"/>',
  lanceta: '<rect x="18" y="32" width="50" height="16" rx="8" fill="#a5b4fc" stroke="#4f46e5" stroke-width="2"/><rect x="62" y="35" width="10" height="10" rx="2" fill="#e0e7ff" stroke="#4f46e5" stroke-width="2"/><path d="M72,40 h14" stroke="#475569" stroke-width="2.4"/><circle cx="90" cy="40" r="3.5" fill="#dc2626"/>',
  frascoQ: '<path d="M38,70 v-34 q0,-6 6,-8 v-8 h12 v8 q6,2 6,8 v34 z" fill="#a16207" opacity=".85" stroke="#713f12" stroke-width="2"/><path d="M44,20 l4,6 l-3,5 l6,6 l-2,8" fill="none" stroke="#fff" stroke-width="2.5"/><path d="M16,70 l6,-9 l4,9 z M70,72 l6,-8 l3,8 z M82,70 l4,-5 l3,5 z" fill="#fde68a" stroke="#a16207"/><ellipse cx="50" cy="73" rx="34" ry="4" fill="#fbbf24" opacity=".5"/>',
  vencido: '<rect x="16" y="18" width="68" height="44" rx="6" fill="#e5e7eb" stroke="#64748b" stroke-width="2"/><g fill="#fff" stroke="#94a3b8" stroke-width="2"><circle cx="32" cy="32" r="7"/><circle cx="50" cy="32" r="7"/><circle cx="68" cy="32" r="7"/><circle cx="32" cy="50" r="7"/><circle cx="50" cy="50" r="7"/></g><rect x="56" y="44" width="30" height="14" rx="3" fill="#E1251B" transform="rotate(-12 71 51)"/><text x="71" y="55" text-anchor="middle" font-size="9" font-weight="800" fill="#fff" font-family="Arial" transform="rotate(-12 71 51)">VENCIDO</text>',
  extraviado: '<path d="M22,26 l28,-10 l28,10 v34 l-28,10 l-28,-10 z" fill="#fde68a" stroke="#a16207" stroke-width="2"/><path d="M22,26 l28,10 l28,-10 M50,36 v34" fill="none" stroke="#a16207" stroke-width="2"/><text x="36" y="58" text-anchor="middle" font-size="22" font-weight="900" fill="#E1251B" font-family="Arial">?</text><rect x="54" y="42" width="18" height="10" rx="2" fill="#fff" stroke="#a16207"/>',
  gaze: '<rect x="24" y="14" width="52" height="52" rx="4" fill="#fff" stroke="#cbd5e1" stroke-width="2"/><path d="M24,27 h52 M24,40 h52 M24,53 h52 M37,14 v52 M50,14 v52 M63,14 v52" stroke="#e2e8f0" stroke-width="1.5"/><path d="M42,34 q10,-8 18,2 q6,10 -4,14 q-12,6 -16,-4 q-2,-6 2,-12 z" fill="#dc2626" opacity=".8"/>',
  luva: '<path d="M30,72 v-26 l-8,-14 q-2,-6 4,-6 l8,12 v-24 q0,-5 5,-5 q5,0 5,5 v20 v-26 q0,-5 5,-5 q5,0 5,5 v26 v-22 q0,-5 5,-5 q5,0 5,5 v24 v-16 q0,-5 5,-5 q5,0 5,5 v32 q0,10 -6,15 v4 z" fill="#93c5fd" stroke="#2563eb" stroke-width="2"/><circle cx="48" cy="52" r="6" fill="#dc2626" opacity=".8"/><circle cx="60" cy="44" r="3.5" fill="#dc2626" opacity=".8"/>',
  equipo: '<rect x="40" y="6" width="20" height="24" rx="6" fill="#e0f2fe" stroke="#60a5fa" stroke-width="2"/><rect x="44" y="18" width="12" height="10" fill="#dc2626" opacity=".7"/><path d="M50,30 c0,16 -30,8 -30,24 c0,14 46,14 46,0 c0,-10 -20,-8 -20,4 c0,8 30,6 40,10" fill="none" stroke="#dc2626" stroke-width="3" opacity=".75"/><rect x="62" y="46" width="12" height="8" rx="2" fill="#94a3b8"/>',
  toalha: '<path d="M26,58 q-6,-16 6,-26 q2,-14 18,-12 q14,-6 22,8 q12,6 6,20 q4,14 -12,16 q-10,8 -24,2 q-14,2 -16,-8 z" fill="#f8fafc" stroke="#94a3b8" stroke-width="2"/><path d="M38,34 q8,6 4,14 M56,30 q-4,10 6,16 M46,54 q8,-4 14,2" fill="none" stroke="#cbd5e1" stroke-width="2"/>',
  resto: '<path d="M50,20 q-14,-2 -16,12 q8,6 0,16 q-2,14 16,18 q18,-4 16,-18 q-8,-10 0,-16 q-2,-14 -16,-12 z" fill="#fde68a" stroke="#ca8a04" stroke-width="2"/><path d="M34,32 q-6,8 0,16 M66,32 q6,8 0,16" fill="none" stroke="#dc2626" stroke-width="5"/><path d="M50,20 q2,-8 8,-10" stroke="#78350f" stroke-width="3" fill="none"/><ellipse cx="50" cy="40" rx="3" ry="5" fill="#78350f"/>',
  guardanapo: '<path d="M22,20 h56 v40 l-12,8 h-44 z" fill="#fff" stroke="#94a3b8" stroke-width="2"/><path d="M66,68 v-8 h12" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/><ellipse cx="44" cy="40" rx="12" ry="8" fill="#92400e" opacity=".55"/><circle cx="60" cy="50" r="4" fill="#92400e" opacity=".45"/>',
  papelao: '<path d="M18,32 h64 v36 h-64 z" fill="#d6a46a" stroke="#8a6034" stroke-width="2"/><path d="M18,32 l-8,-12 h30 l8,12 M82,32 l8,-12 h-30 l-8,12" fill="#e8c38f" stroke="#8a6034" stroke-width="2"/><path d="M40,46 l6,-6 l6,6 M46,40 v14" fill="none" stroke="#5b3a14" stroke-width="2"/>',
  rascunho: '<rect x="28" y="8" width="44" height="62" rx="2" fill="#fff" stroke="#94a3b8" stroke-width="2"/><path d="M34,20 q6,-4 12,0 t12,0 t8,0 M34,32 q6,-4 12,0 t12,0 M34,44 q6,-4 12,0 t12,0 t8,0 M34,56 q6,-4 12,0" fill="none" stroke="#64748b" stroke-width="2"/>',
  bula: '<rect x="18" y="20" width="34" height="48" rx="3" fill="#fde68a" stroke="#a16207" stroke-width="2"/><rect x="18" y="20" width="34" height="12" fill="#E1251B"/><path d="M56,14 l26,4 l-4,52 l-26,-4 z" fill="#fff" stroke="#94a3b8" stroke-width="2"/><path d="M60,26 l18,3 M59,34 l18,3 M58,42 l18,3 M57,50 l18,3" stroke="#cbd5e1" stroke-width="2"/>',
  copo: '<path d="M32,16 h36 l-6,56 h-24 z" fill="#f1f5f9" stroke="#94a3b8" stroke-width="2"/><path d="M34,30 h32 l-4,40 h-24 z" fill="#bfdbfe" opacity=".7"/><path d="M30,16 h40" stroke="#64748b" stroke-width="3"/>',
  embalagem: '<path d="M20,18 h60 v46 l-6,6 h-48 l-6,-6 z" fill="#e0f2fe" fill-opacity=".7" stroke="#60a5fa" stroke-width="2" stroke-dasharray="4 2"/><rect x="26" y="34" width="40" height="10" rx="2" fill="#fff" stroke="#64748b"/><path d="M66,39 h10" stroke="#64748b" stroke-width="2"/><text x="50" y="62" text-anchor="middle" font-size="8" font-weight="700" fill="#2563eb" font-family="Arial">ESTÉRIL</text>',
  pet: '<path d="M42,8 h16 v8 q8,6 8,16 v34 q0,6 -6,6 h-20 q-6,0 -6,-6 v-34 q0,-10 8,-16 z" fill="#bfdbfe" fill-opacity=".8" stroke="#3b82f6" stroke-width="2"/><rect x="34" y="38" width="32" height="16" fill="#38bdf8"/><rect x="42" y="4" width="16" height="6" rx="2" fill="#2563eb"/>',
  bolha: '<rect x="14" y="14" width="72" height="52" rx="6" fill="#e0f2fe" fill-opacity=".6" stroke="#93c5fd" stroke-width="2"/><g fill="#fff" fill-opacity=".8" stroke="#93c5fd" stroke-width="1.5"><circle cx="26" cy="26" r="6"/><circle cx="42" cy="26" r="6"/><circle cx="58" cy="26" r="6"/><circle cx="74" cy="26" r="6"/><circle cx="34" cy="40" r="6"/><circle cx="50" cy="40" r="6"/><circle cx="66" cy="40" r="6"/><circle cx="26" cy="54" r="6"/><circle cx="42" cy="54" r="6"/><circle cx="58" cy="54" r="6"/><circle cx="74" cy="54" r="6"/></g>',
  pulseira: '<ellipse cx="50" cy="42" rx="36" ry="20" fill="none" stroke="#f9a8d4" stroke-width="9"/><rect x="34" y="50" width="34" height="18" rx="3" fill="#fff" stroke="#be185d" stroke-width="2"/><path d="M38,56 h22 M38,62 h14" stroke="#334155" stroke-width="2"/><rect x="60" y="58" width="5" height="6" fill="#334155"/>',
  receita: '<rect x="26" y="8" width="48" height="64" rx="2" fill="#fff" stroke="#94a3b8" stroke-width="2"/><rect x="26" y="8" width="48" height="10" fill="#00983A"/><text x="36" y="36" font-size="14" font-weight="900" fill="#334155" font-family="Georgia">Rx</text><path d="M52,30 h16 M32,46 h36 M32,54 h30 M32,62 h20" stroke="#94a3b8" stroke-width="2"/><text x="58" y="27" font-size="6" font-weight="700" fill="#E1251B" font-family="Arial">PACIENTE</text>',
  relatorio: '<rect x="30" y="12" width="46" height="60" rx="2" fill="#f1f5f9" stroke="#94a3b8" stroke-width="2"/><rect x="24" y="8" width="46" height="60" rx="2" fill="#fff" stroke="#94a3b8" stroke-width="2"/><rect x="24" y="8" width="46" height="9" fill="#E1251B"/><text x="47" y="15" text-anchor="middle" font-size="6" font-weight="800" fill="#fff" font-family="Arial">PACIENTES</text><path d="M28,24 h38 M28,32 h38 M28,40 h38 M28,48 h38 M28,56 h38 M42,20 v40" stroke="#cbd5e1" stroke-width="1.5"/><rect x="22" y="10" width="6" height="3" fill="#64748b"/>',
  etiqueta: '<rect x="30" y="8" width="40" height="64" rx="10" fill="#e0f2fe" stroke="#60a5fa" stroke-width="2"/><rect x="34" y="24" width="32" height="26" rx="2" fill="#fff" stroke="#E1251B" stroke-width="2"/><text x="50" y="34" text-anchor="middle" font-size="6" font-weight="800" fill="#334155" font-family="Arial">LEITO 02</text><path d="M38,40 h24 M38,45 h16" stroke="#94a3b8" stroke-width="2"/>',
  guia: '<rect x="20" y="10" width="60" height="60" rx="3" fill="#fff" stroke="#94a3b8" stroke-width="2"/><rect x="20" y="10" width="60" height="12" fill="#0e7490"/><text x="50" y="19" text-anchor="middle" font-size="7" font-weight="800" fill="#fff" font-family="Arial">GUIA CONVÊNIO</text><path d="M26,30 h20 M50,30 h24 M26,40 h48 M26,50 h30 M26,60 h40" stroke="#cbd5e1" stroke-width="2"/><rect x="58" y="46" width="16" height="16" fill="none" stroke="#64748b" stroke-width="1.5"/>'
};
function svgItem(k){
  if (ICO[k]) return '<svg viewBox="0 0 100 80" aria-hidden="true">' + ICO[k] + '</svg>';
  var w = '<svg viewBox="0 0 100 80" aria-hidden="true">', f = '</svg>';
  if (k === 'seringa') return w + '<g transform="translate(-40,-32) scale(1.8)">' + seringa(50, 40, -20) + '</g>' + f;
  if (k === 'ampola') return w + '<g transform="translate(-50,-28) scale(2)">' + ampola(50, 52) + '</g>' + f;
  if (k === 'ampolaQ') return w + '<g transform="translate(-50,-28) scale(2)">' + ampola(50, 52, { quebrada:true }) + '</g>' + f;
  if (k === 'bisturi') return w + '<g transform="translate(-50,-40) scale(2)">' + bisturi(50, 40, -10) + '</g>' + f;
  if (k === 'sutura') return w + '<g transform="translate(-50,-40) scale(2)">' + agulhaSut(54, 44) + '</g>' + f;
  return '';
}
var ITENS = {
  agulha:    { ic:'💉', svg:'seringa', n:'Seringa com agulha usada', l:'perfuro', e:'Seringa e agulha vão juntas para a caixa de perfurocortante, sem reencapar e sem desconectar a agulha.' },
  scalp:     { ic:'🩸', n:'Scalp / cateter venoso retirado do paciente', l:'perfuro', e:'Scalp e cateter têm agulha ou mandril cortante: caixa de perfurocortante.' },
  bisturi:   { ic:'🔪', svg:'bisturi', n:'Lâmina de bisturi usada', l:'perfuro', e:'Lâmina é perfurocortante: vai para a caixa amarela, logo após o uso, por quem usou.' },
  sutura:    { ic:'🪡', svg:'sutura', n:'Agulha de sutura', l:'perfuro', e:'Agulha de sutura é perfurocortante: caixa de perfurocortante.' },
  lanceta:   { ic:'🩸', n:'Lanceta do teste de glicemia (HGT)', l:'perfuro', e:'A lanceta perfura a pele: caixa de perfurocortante.' },
  ampola:    { ic:'🧪', svg:'ampola', n:'Ampola de medicação vazia', l:'laranja', e:'No nosso hospital, ampolas de medicação vão para a caixa laranja.' },
  ampolaQ:   { ic:'🧪', svg:'ampolaQ', n:'Ampola de medicação quebrada', l:'laranja', e:'Ampola, inteira ou quebrada, vai para a caixa laranja. Recolha os cacos com cuidado, nunca com a mão desprotegida.' },
  frascoQ:   { ic:'🍶', n:'Frasco de medicamento que chegou quebrado', l:'laranja', e:'Medicamento quebrado na farmácia: caixa laranja, e registrar a avaria.' },
  vencido:   { ic:'💊', n:'Comprimidos vencidos', l:'laranja', e:'Medicamento vencido é resíduo químico: caixa laranja. Nunca no lixo comum ou na pia.' },
  extraviado:{ ic:'💊', n:'Medicamento extraviado, sem identificação de lote', l:'laranja', e:'Medicamento extraviado ou sem rastreabilidade não pode ser dispensado: registrar e descartar na caixa laranja.' },
  gaze:      { ic:'🩹', n:'Gaze com sangue do curativo', l:'infect', e:'Material com sangue ou secreção é infectante: saco branco leitoso com o símbolo de risco biológico.' },
  luva:      { ic:'🧤', n:'Luva de procedimento suja de sangue', l:'infect', e:'Luva contaminada com sangue ou fluidos: lixo infectante.' },
  equipo:    { ic:'🩸', n:'Equipo de soro com sangue (sem agulha)', l:'infect', e:'Equipo com sangue é infectante. Se tiver agulha, a agulha vai na caixa de perfurocortante.' },
  toalha:    { ic:'🧻', n:'Papel toalha usado para secar as mãos', l:'comum', e:'Papel toalha usado é resíduo comum (não reciclável).' },
  resto:     { ic:'🍌', n:'Restos de lanche da copa', l:'comum', e:'Resto de alimento é resíduo comum. Lembre: comer só na copa ou no refeitório.' },
  guardanapo:{ ic:'🧻', n:'Guardanapo sujo de café', l:'comum', e:'Papel sujo não é reciclável: vai no lixo comum.' },
  papelao:   { ic:'📦', n:'Caixa de papelão vazia do recebimento', l:'papel', e:'Papelão limpo é reciclável: lixeira azul (papel).' },
  rascunho:  { ic:'📄', n:'Folha de rascunho sem dados de paciente', l:'papel', e:'Papel limpo e sem dados de paciente: lixeira azul (papel).' },
  bula:      { ic:'📄', n:'Bula e cartucho de papel do medicamento', l:'papel', e:'Bula e cartucho de papel, sem dados de paciente: reciclável papel.' },
  copo:      { ic:'🥤', n:'Copo plástico de água', l:'plast', e:'Copo plástico: lixeira vermelha (plástico).' },
  embalagem: { ic:'🛍️', n:'Embalagem plástica da seringa (lacrada, sem uso no paciente)', l:'plast', e:'A embalagem que não teve contato com o paciente é plástico reciclável.' },
  pet:       { ic:'🧴', n:'Garrafa PET de água', l:'plast', e:'Garrafa PET: lixeira vermelha (plástico).' },
  bolha:     { ic:'🫧', n:'Plástico bolha da entrega de medicamentos', l:'plast', e:'Plástico limpo de embalagem: reciclável plástico.' },
  pulseira:  { ic:'🏷️', n:'Pulseira de identificação do paciente', l:'dados', e:'A pulseira tem nome e dados do paciente: lixeira de dados sensíveis.' },
  receita:   { ic:'📝', n:'Receita / prescrição com nome do paciente', l:'dados', e:'Prescrição tem dados de saúde do paciente: somente na lixeira de dados sensíveis.' },
  relatorio: { ic:'📑', n:'Relatório impresso com nomes de pacientes', l:'dados', e:'Qualquer papel com dados de pacientes vai somente para a lixeira de dados sensíveis (LGPD).' },
  etiqueta:  { ic:'🏷️', n:'Etiqueta de soro com nome do paciente', l:'dados', e:'Etiqueta com nome e leito do paciente: lixeira de dados sensíveis.' },
  guia:      { ic:'📋', n:'Cópia de guia do convênio do paciente', l:'dados', e:'Guias de convênio têm dados pessoais e de saúde: lixeira de dados sensíveis.' }
};

/* ============================================================
   FASES — a rotina de um plantão no hospital
   ============================================================ */
var FASES = [
  { id:'f1', nome:'UTI e Internação', hora:'07:00', ic:'🛏️', cor:'#00983A',
    resumo:'Passagem de plantão: agulhas, ampolas, caixa de perfurocortante e acidente com material biológico. Jogo: 🗑️ Descarte em Movimento.',
    etapas:[
      { tipo:'cena', cena:'uti' },
      { tipo:'mov', tempo:60, meta:250, lixeiras:['perfuro','laranja','infect','comum'], itens:['agulha','scalp','lanceta','ampola','ampolaQ','gaze','luva','equipo','toalha','resto'] },
      { tipo:'ordem', titulo:'Acidente com agulha usada', contexto:'Durante a medicação, um colega se furou com uma agulha usada no paciente. Coloque as ações na ordem correta.',
        passos:[
          { t:'Lavar o local imediatamente com água e sabão, sem espremer nem esfregar', e:'Espremer ou fazer cortes aumenta a lesão. Em mucosas (olhos, boca), lavar com água ou soro fisiológico.' },
          { t:'Comunicar imediatamente a liderança e o SESMT / Segurança do Trabalho', e:'Acidente com material biológico é urgência: comunique na hora.' },
          { t:'Procurar atendimento médico para avaliação e profilaxia (de preferência em até 2 horas)', e:'A profilaxia contra o HIV funciona melhor quando começa nas primeiras horas.' },
          { t:'Identificar o paciente-fonte para exames, com o consentimento dele', e:'Os exames do paciente-fonte orientam a conduta e o acompanhamento.' },
          { t:'Registrar o acidente e emitir a CAT', e:'A CAT (Comunicação de Acidente de Trabalho) garante os direitos do trabalhador.' },
          { t:'Fazer o acompanhamento com exames nos prazos indicados', e:'O acompanhamento sorológico deve ser feito até o fim, mesmo que tudo pareça bem.' }
        ] },
      { tipo:'quiz', perguntas:[
        { p:'Você terminou de aplicar uma medicação com seringa e agulha. O que fazer?', o:['Descartar seringa e agulha juntas na caixa de perfurocortante, na hora, sem reencapar','Reencapar a agulha para levar com segurança até o posto','Desconectar a agulha com a mão e descartar separado','Deixar na bandeja e descartar no fim do plantão'], e:'A NR-32 proíbe reencapar e desconectar agulhas com as mãos. Leve a caixa até o leito.' },
        { p:'Até onde a caixa de perfurocortante pode ser enchida?', o:['Até a linha tracejada (3/4 da capacidade); depois fechar, lacrar e trocar','Até a tampa, apertando para caber mais','Até transbordar um pouco','Não tem limite, só trocar quando não fechar'], e:'Respeitar a linha evita que agulhas fiquem para fora e furem quem descarta.' },
        { p:'A ampola de medicação foi aberta e usada. Onde descartar?', o:['Na caixa laranja','No lixo comum','Na lixeira de plástico','Na lixeira de papel'], e:'No nosso hospital, ampolas de medicação vão para a caixa laranja.' },
        { p:'Onde a equipe pode tomar café e fazer o lanche?', o:['Somente na copa ou no refeitório','No posto de enfermagem, longe do paciente','Ao lado do leito, se o paciente estiver dormindo','Em qualquer lugar, desde que rápido'], e:'A NR-32 proíbe comer e beber nos postos de trabalho da assistência.' }
      ] }
    ] },
  { id:'f2', nome:'Centro Cirúrgico', hora:'10:30', ic:'🩺', cor:'#00703A',
    resumo:'Limpeza da sala entre cirurgias: bisturis e agulhas esquecidos na mesa e embaixo da maca. Jogo: ⚡ Risco Ninja.',
    etapas:[
      { tipo:'cena', cena:'cc' },
      { tipo:'ninja', tempo:60, meta:300, riscos:['bisturi','sutura','agulha','ampola','poca','fio','cilindro'], protecoes:['caixaPerf','placa','oculos','mascara','gel','extintor'] },
      { tipo:'ordem', titulo:'Liberação e limpeza da sala cirúrgica', contexto:'A cirurgia terminou. Coloque na ordem o jeito seguro de liberar e limpar a sala.',
        passos:[
          { t:'A equipe cirúrgica descarta lâminas, agulhas e outros perfurocortantes na caixa antes de sair', e:'Quem usa o perfurocortante é responsável por descartá-lo (NR-32).' },
          { t:'A higienização coloca os EPIs: luvas de borracha, avental, máscara e óculos', e:'EPI completo antes de entrar em contato com sangue, fluidos e químicos.' },
          { t:'Inspecionar a mesa cirúrgica, a mesa auxiliar, o piso e embaixo da maca', e:'Procure perfurocortantes esquecidos antes de passar pano ou recolher campos.' },
          { t:'Recolher qualquer perfurocortante encontrado com pinça e descartar na caixa amarela', e:'Nunca com a mão: use pinça e leve a caixa até o local.' },
          { t:'Recolher os resíduos: infectante no saco branco e comum no saco preto, com 2/3 da capacidade', e:'Não compactar o lixo com as mãos ou os pés.' },
          { t:'Limpar e desinfetar a sala, sinalizando o piso molhado', e:'A placa "piso molhado" fica até o piso secar.' },
          { t:'Retirar os EPIs e higienizar as mãos', e:'A higiene das mãos encerra o procedimento.' }
        ] },
      { tipo:'cartas', itens:[
        { ic:'🔪', t:'O cirurgião deixa a lâmina de bisturi na mesa para "a limpeza recolher depois".', ok:false, e:'Quem usa o perfurocortante deve descartá-lo. A limpeza não pode ser surpreendida por lâminas esquecidas.' },
        { ic:'🔦', t:'Antes de passar o pano, a higienização confere embaixo da mesa cirúrgica e da maca com atenção.', ok:true, e:'Correto! Agulhas e lâminas caídas são difíceis de ver.' },
        { ic:'🗑️', t:'Apertar o saco de lixo infectante com o pé para caber mais.', ok:false, e:'Agulhas descartadas errado podem atravessar o saco e o calçado. Feche com 2/3.' },
        { ic:'🗜️', t:'Recolher agulha de sutura do chão com pinça, usando luvas, e levar direto à caixa.', ok:true, e:'Correto! Pinça + luvas + caixa perto = sem acidente.' },
        { ic:'🧤', t:'Usar só uma luva fina de procedimento para fazer toda a limpeza terminal.', ok:false, e:'Na limpeza use luva de borracha de cano longo, mais resistente, além dos demais EPIs.' },
        { ic:'🟨', t:'A caixa de perfurocortante da sala fica em suporte, acima do piso, e é trocada na linha de enchimento.', ok:true, e:'Correto! Caixa no chão é chutada e derrubada.' }
      ] },
      { tipo:'quiz', perguntas:[
        { p:'Ao entrar para limpar a sala após a cirurgia, o que fazer primeiro (já de EPI)?', o:['Inspecionar mesa, mesa auxiliar, piso e embaixo da maca em busca de perfurocortantes','Passar pano no chão para adiantar','Juntar os campos cirúrgicos com as mãos de uma vez','Esvaziar o lixo apertando os sacos'], e:'Primeiro olhar, depois limpar: perfurocortantes esquecidos são a maior causa de acidentes na limpeza.' },
        { p:'Encontrou um bisturi embaixo da maca. Como recolher?', o:['Com pinça, de luvas, e descartar na caixa de perfurocortante','Com a mão, rapidinho','Com a vassoura, junto com o lixo','Deixar lá e avisar no fim do plantão'], e:'Pinça e luvas, com a caixa de perfurocortante perto.' },
        { p:'Quem é o responsável por descartar o perfurocortante usado na cirurgia?', o:['Quem utilizou, logo após o uso','A equipe de higienização','O almoxarifado','Ninguém, ele é recolhido com os campos'], e:'A NR-32 determina que o trabalhador que usa o perfurocortante é responsável pelo seu descarte.' },
        { p:'Com quanto da capacidade o saco de lixo deve ser fechado?', o:['2/3 da capacidade, sem compactar','Completamente cheio','Quando não couber mais nada, apertando','Metade, sempre com nó duplo apertando o conteúdo'], e:'Sacos com 2/3 fecham bem e não rasgam no transporte.' }
      ] }
    ] },
  { id:'f3', nome:'Farmácia', hora:'13:00', ic:'💊', cor:'#E1251B',
    resumo:'Recebimento e dispensação: medicamento quebrado ou extraviado vai para a caixa laranja. Jogo: 🗑️ Descarte em Movimento.',
    etapas:[
      { tipo:'cena', cena:'farmacia' },
      { tipo:'mov', tempo:60, meta:250, lixeiras:['laranja','papel','plast','comum','dados'], itens:['frascoQ','vencido','extraviado','ampola','ampolaQ','papelao','bula','bolha','copo','receita','toalha'] },
      { tipo:'ordem', titulo:'Medicamento chegou quebrado', contexto:'Ao abrir a caixa do fornecedor, um frasco de medicamento está quebrado. Coloque na ordem.',
        passos:[
          { t:'Parar, avisar quem está perto e não pegar os cacos com as mãos', e:'Cacos cortam e o líquido pode ser irritante ou tóxico.' },
          { t:'Calçar luvas (e outros EPIs que a FDS do produto indicar)', e:'Se for um produto perigoso ou em grande quantidade, use o kit de derramamento.' },
          { t:'Recolher os cacos e o medicamento com pá e vassoura ou pinça', e:'Nada de catar com os dedos.' },
          { t:'Descartar o medicamento quebrado e os cacos na caixa laranja', e:'Medicamento é resíduo químico: caixa laranja, nunca lixo comum ou pia.' },
          { t:'Registrar a avaria no sistema e avisar o farmacêutico responsável', e:'O registro mantém o estoque correto e permite reclamar com o fornecedor.' },
          { t:'Limpar o local e higienizar as mãos', e:'Termine deixando a área segura para o próximo.' }
        ] },
      { tipo:'quiz', perguntas:[
        { p:'Foi encontrado um medicamento extraviado, sem identificação de lote. O que fazer?', o:['Separar, registrar e descartar na caixa laranja conforme o protocolo','Colocar de volta na prateleira','Jogar no lixo comum','Levar para casa'], e:'Sem rastreabilidade o medicamento não pode ser dispensado.' },
        { p:'Por que medicamento não pode ir para o lixo comum ou para a pia?', o:['É resíduo químico: contamina solo e água e pode ser reaproveitado indevidamente','Porque ocupa espaço','Porque o lixo comum é só para papel','Pode, se estiver vencido'], e:'Medicamento descartado errado é risco ambiental e de saúde pública.' },
        { p:'Onde guardar as caixas mais pesadas (como soro)?', o:['Nas prateleiras de baixo e do meio, entre joelho e ombro','No alto, para liberar espaço embaixo','Em cima da estante','No chão do corredor'], e:'Peso no alto cai e obriga a erguer acima dos ombros.' },
        { p:'Na farmácia há caixa de perfurocortante para o dia a dia?', o:['Não há perfurocortantes na rotina; o risco é o medicamento quebrado, que vai na caixa laranja','Sim, para ampolas','Sim, para papelão','Sim, para receitas'], e:'Na farmácia o cuidado é com vidros quebrados, medicamentos e peso.' }
      ] }
    ] },
  { id:'f4', nome:'Almoxarifado', hora:'15:00', ic:'📦', cor:'#4a4a4a',
    resumo:'Produtos químicos, estantes e peso. Derramamento? Kit de derramamento nível I. Jogo: ⚡ Risco Ninja.',
    etapas:[
      { tipo:'cena', cena:'almox' },
      { tipo:'ninja', tempo:60, meta:300, riscos:['quimico','poca','fio','benjamim','cilindro','pilha','frasco'], protecoes:['kit','extintor','oculos','mascara','placa','gel'] },
      { tipo:'ordem', titulo:'Derramamento químico — kit nível I', contexto:'Um galão de produto de limpeza caiu e vazou no almoxarifado. Use o kit de derramamento nível I: coloque as ações na ordem.',
        passos:[
          { t:'Avisar as pessoas próximas, isolar e sinalizar a área', e:'Primeiro proteger as pessoas: ninguém pisa no produto.' },
          { t:'Identificar o produto e consultar a FDS (Ficha de Dados de Segurança)', e:'A FDS (antiga FISPQ) diz os perigos e os EPIs necessários.' },
          { t:'Pegar a bolsa do kit de derramamento nível I e vestir os EPIs do kit (luvas, óculos, máscara, avental)', e:'O kit fica em local sinalizado e lacrado.' },
          { t:'Conter o vazamento com as barreiras absorventes, de fora para dentro', e:'A barreira impede que o produto se espalhe e chegue a ralos.' },
          { t:'Absorver o produto com as mantas ou o pó absorvente do kit', e:'Não use água para "lavar" o produto.' },
          { t:'Recolher com a pá do kit, colocar no saco de resíduo e identificar como resíduo químico', e:'O material usado também é resíduo químico.' },
          { t:'Comunicar a liderança/SESMT, registrar a ocorrência e pedir a reposição do kit', e:'Kit usado é kit vazio: reponha para a próxima emergência.' }
        ] },
      { tipo:'cartas', itens:[
        { ic:'🧴', t:'Passar desinfetante para uma garrafa de refrigerante, sem rótulo, para facilitar o uso.', ok:false, e:'Embalagem de bebida engana e sem rótulo ninguém sabe o risco. Use frasco próprio rotulado.' },
        { ic:'👜', t:'Depois de usar o kit de derramamento, solicitar a reposição dos itens.', ok:true, e:'Correto! O kit precisa estar completo para a próxima vez.' },
        { ic:'🪣', t:'Jogar água e puxar o produto químico derramado para o ralo.', ok:false, e:'Isso espalha o produto e contamina a rede de esgoto. Contenha e absorva com o kit.' },
        { ic:'📄', t:'Consultar a FDS antes de manusear um produto novo.', ok:true, e:'Correto! A FDS informa perigos, EPIs e primeiros socorros.' },
        { ic:'🧯', t:'Encostar caixas na frente do extintor só até terminar a conferência.', ok:false, e:'Extintor deve ficar sempre livre, nem que seja por pouco tempo.' },
        { ic:'🏋️', t:'Pedir ajuda ou usar carrinho para mover a caixa de 30 kg de soro.', ok:true, e:'Correto! Divida o peso e poupe a coluna.' }
      ] },
      { tipo:'quiz', perguntas:[
        { p:'Qual o primeiro passo diante de um derramamento químico?', o:['Avisar as pessoas, isolar e sinalizar a área','Limpar com pano molhado','Jogar água','Esperar secar sozinho'], e:'Proteja as pessoas antes de qualquer outra ação.' },
        { p:'Para que servem as barreiras (meias) absorventes do kit de derramamento?', o:['Conter o produto para ele não se espalhar, aplicadas de fora para dentro','Secar as mãos','Forrar a prateleira','Proteger os sapatos'], e:'Contenção primeiro, absorção depois.' },
        { p:'Onde encontrar os perigos e os EPIs indicados para um produto químico?', o:['Na FDS (Ficha de Dados de Segurança) e no rótulo','No cupom fiscal','No crachá','Em nenhum lugar'], e:'A FDS (antiga FISPQ) deve estar disponível no local de uso.' },
        { p:'O material absorvente usado no derramamento deve ser descartado como…', o:['Resíduo químico, em saco identificado','Lixo comum','Reciclável','Pode ser reaproveitado'], e:'O que absorveu o produto carrega o mesmo perigo dele.' }
      ] }
    ] },
  { id:'f5', nome:'Administrativo', hora:'17:00', ic:'🗂️', cor:'#B81C14',
    resumo:'Dados sensíveis dos pacientes, papel e plástico no lugar certo, ergonomia e elétrica. Jogo: 🗑️ Descarte em Movimento.',
    etapas:[
      { tipo:'cena', cena:'adm' },
      { tipo:'mov', tempo:60, meta:250, lixeiras:['dados','papel','plast','comum'], itens:['relatorio','pulseira','guia','receita','etiqueta','rascunho','papelao','copo','pet','guardanapo','resto'] },
      { tipo:'cartas', itens:[
        { ic:'🔒', t:'Bloquear a tela do computador (Windows + L) antes de ir ao café.', ok:true, e:'Correto! Tela aberta expõe dados de pacientes.' },
        { ic:'📑', t:'Rasgar ao meio o relatório de pacientes e jogar na lixeira de papel.', ok:false, e:'Rasgado ainda dá para ler. Documento de paciente vai inteiro para a lixeira de dados sensíveis.' },
        { ic:'🖨️', t:'Deixar as impressões de prontuário na impressora para buscar mais tarde.', ok:false, e:'Retire na hora: qualquer um pode ler ou levar.' },
        { ic:'🥤', t:'Copo plástico na lixeira vermelha e papel limpo na azul.', ok:true, e:'Correto! Assim a reciclagem funciona.' },
        { ic:'🔌', t:'Ligar aquecedor, cafeteira e carregador no mesmo benjamim.', ok:false, e:'Sobrecarga esquenta a fiação e pode causar incêndio.' },
        { ic:'🪑', t:'Ajustar a cadeira e deixar a tela na altura dos olhos, com os pés apoiados.', ok:true, e:'Correto! Ergonomia (NR-17) evita dores e lesões.' }
      ] },
      { tipo:'quiz', perguntas:[
        { p:'Onde descartar um papel com nome e diagnóstico de um paciente?', o:['Somente na lixeira de dados sensíveis','Na lixeira de papel (reciclável)','No lixo comum, amassado','Na gaveta, para descartar depois'], e:'Dados de saúde são dados sensíveis (LGPD).' },
        { p:'Qual lei protege os dados pessoais dos pacientes?', o:['LGPD — Lei Geral de Proteção de Dados (Lei 13.709/2018)','CLT','Código de Trânsito','NR-35'], e:'Pela LGPD, dados de saúde são dados pessoais sensíveis e exigem proteção maior.' },
        { p:'Vai sair da mesa por 5 minutos. O que fazer com o computador?', o:['Bloquear a tela (Windows + L)','Deixar aberto, é rápido','Desligar o monitor só','Pedir para alguém olhar'], e:'Bloquear leva um segundo e protege os dados.' },
        { p:'Copo plástico de água vai para qual lixeira?', o:['Vermelha — plástico','Azul — papel','Dados sensíveis','Caixa laranja'], e:'Vermelho = plástico, azul = papel.' }
      ] }
    ] },
  { id:'f6', nome:'Ronda Final do Plantão', hora:'19:00', ic:'🏆', cor:'#b7800b',
    resumo:'Desafio final com tudo misturado: ⚡ Risco Ninja, 🗑️ Descarte em Movimento e perguntas de todos os setores contra o relógio.',
    etapas:[
      { tipo:'ninja', tempo:60, meta:400 },
      { tipo:'mov', tempo:60, meta:300 },
      { tipo:'quiz', aleatorio:10, tempo:20 }
    ] }
];
var EXTRAS = [
  { p:'O que é uma CONDIÇÃO insegura?', o:['Uma falha no ambiente, na estrutura ou no equipamento que pode causar acidente','Uma atitude errada da pessoa','Um acidente que já aconteceu','Um tipo de EPI'], e:'Exemplos: caixa de perfurocortante cheia demais, piso molhado sem placa, extintor bloqueado.' },
  { p:'O que é um COMPORTAMENTO inseguro?', o:['Uma atitude da pessoa que a expõe (ou expõe outros) ao risco','Um defeito no equipamento','Uma placa de sinalização','Um treinamento'], e:'Exemplos: reencapar agulha, comer no posto de enfermagem, recolher cacos com a mão.' },
  { p:'Qual norma trata da segurança e saúde no trabalho em serviços de saúde?', o:['NR-32','NR-35','NR-12','NR-18'], e:'A NR-32 traz as regras para riscos biológicos, químicos, perfurocortantes e resíduos no hospital.' },
  { p:'Pela NR-32, o uso de adornos (anéis, pulseiras, relógio, colares) na assistência é…', o:['Proibido para quem está exposto a agentes biológicos','Permitido se for pequeno','Permitido com luva por cima','Obrigatório para identificação'], e:'Adornos acumulam microrganismos e rasgam luvas.' },
  { p:'Qual vacina o trabalhador da saúde deve receber gratuitamente pela NR-32?', o:['Hepatite B (além de tétano e difteria e outras indicadas)','Nenhuma','Só a da gripe, paga pelo trabalhador','Febre amarela, obrigatória para todos'], e:'O empregador deve fornecer gratuitamente as vacinas, com destaque para hepatite B, tétano e difteria.' },
  { p:'Você viu um risco que não consegue resolver sozinho. O que fazer?', o:['Comunicar a liderança/SESMT e registrar o relato','Esperar alguém resolver','Comentar no grupo e seguir','Nada, não é do meu setor'], e:'Todo risco relatado é um acidente evitado.' },
  { p:'Quando você pode exercer o direito de recusa?', o:['Diante de risco grave e iminente à vida ou à saúde, comunicando a liderança','Quando não gostar da tarefa','Quando estiver cansado','Quando um colega faltar'], e:'A NR-1 garante interromper a atividade em risco grave e iminente.' },
  { p:'Qual cor identifica a caixa de perfurocortante?', o:['Amarela, com o símbolo de risco biológico','Azul','Verde','Preta'], e:'A caixa amarela (rígida e resistente a perfuração) recebe agulhas, lâminas, scalps e lancetas.' }
];

/* ============================================================
   NÍVEIS
   ============================================================ */
var NIVEIS = [
  { min:0, nome:'Iniciante', ic:'🟢' },
  { min:1500, nome:'Atento', ic:'👀' },
  { min:3500, nome:'Prevencionista', ic:'🛡️' },
  { min:5500, nome:'Guardião do Plantão', ic:'🩺' },
  { min:7500, nome:'Mestre da Segurança Hospitalar', ic:'🏆' }
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
  var s = '<svg viewBox="0 120 1000 440" aria-hidden="true">' + bg({});
  s += monitorMed(70, 190) + cama(40, 490) + soro(318, 488) + placaLogo(420, 170, 64);
  s += carrinhoPeq(214, 522) + caixaPerf(252, 522) + P(190, 542, o2(ENF, { pose:'drop', mao:'seringaBaixo' }));
  s += placaPiso(380, 530);
  s += caixaLar(470, 548) + lixeira(550, 548, 'infect') + lixeira(625, 548, 'comum') + lixeira(700, 548, 'papel') + lixeira(775, 548, 'plast') + lixeira(850, 548, 'dados');
  s += P(935, 542, { pose:'maos', shirt:'#2f9e63', espuma:true, flip:true, cracha:true }) + dispenserGel(960, 300);
  return s + '</svg>';
}
function telaInicio(){
  clearAll();
  var p = atual();
  var h = '<div class="hero"><div class="txt"><div class="hlogo"><img src="' + document.getElementById('logoImg').src + '" alt="Hospital Beneficência Portuguesa — São José do Rio Preto"></div><h1>Hospital Seguro</h1><p>Um plantão inteiro de segurança do trabalho: UTI e internação, centro cirúrgico, farmácia, almoxarifado e administrativo. Descarte certo de agulhas, ampolas e dados de pacientes, kit de derramamento e muito mais. <span class="tag-mud">Os riscos mudam a cada partida!</span></p></div>' + heroSvg() + '</div>';
  if (p){
    h += '<div class="card quem"><div class="av">' + esc(iniciais(p.nome)) + '</div><div style="flex:1"><b>' + esc(p.nome) + '</b><div class="muted">Matrícula ' + esc(p.matricula) + ' · ' + fmt(total(p)) + ' pontos · ' + nivel(total(p)).n.ic + ' ' + nivel(total(p)).n.nome + '</div></div><button class="btn sm ghost" data-act="trocar">Trocar</button></div>';
  }
  h += '<div class="area"><div class="area-h">👤 Área do colaborador</div><div class="menu">';
  if (p){
    h += '<button class="btn ok" data-act="jogar"><span>▶️</span>Continuar plantão<small>Ir para a rotina do dia</small></button>';
    h += '<button class="btn red" data-act="meuPainel"><span>📊</span>Meu painel<small>Pontos, estrelas, posição e certificado</small></button>';
    h += '<button class="btn" data-act="trocar"><span>🔄</span>Não é você?<small>Entrar com outra matrícula</small></button>';
  } else {
    h += '<button class="btn ok" data-act="inscricao"><span>📝</span>Cadastrar e jogar<small>Primeira vez? Comece aqui</small></button>';
    h += '<button class="btn" data-act="entrarMat"><span>🔑</span>Já tenho cadastro<small>Entrar com a matrícula</small></button>';
  }
  h += '</div></div>';
  h += '<div class="area adm"><div><div class="area-h">🛠️ Área do administrador (SST)</div><div class="muted" style="font-size:14px">Painel, desempenho por fase e setor, ranking, planilha, backup e certificados. Acesso somente com PIN.</div></div><button class="btn ghost" data-act="painel">🔒 Entrar como administrador</button></div>';
  h += '<div class="card" style="margin-top:14px"><h2>Como funciona</h2><div class="como">' +
       '<div><div class="ci" style="background:var(--okbg)">🔍</div><b>Caça aos Riscos</b>Toque no que está errado na cena e diga se é condição ou comportamento inseguro. O que está certo é exemplo: tocar nele custa pontos, mas mostra o jeito correto.</div>' +
       '<div><div class="ci" style="background:var(--badbg)">🗑️</div><b>Descarte Certo</b>Cada resíduo no seu lugar: perfurocortante, caixa laranja, infectante, comum, reciclável e dados sensíveis.</div>' +
       '<div><div class="ci" style="background:#eef0ef">🔢</div><b>Passo a Passo</b>Monte a sequência correta: acidente com agulha, limpeza da sala cirúrgica, medicamento quebrado e kit de derramamento.</div>' +
       '<div><div class="ci" style="background:var(--warnbg)">❓</div><b>Seguro ou Inseguro? e Quiz</b>Situações do dia a dia e perguntas com a explicação de cada resposta.</div>' +
       '<div><div class="ci" style="background:#e8f5ec">🕹️</div><b>Jogos de habilidade nas fases</b>⚡ <b>Risco Ninja</b>: deslize para cortar os riscos sem cortar as proteções. 🗑️ <b>Descarte em Movimento</b>: arraste cada resíduo que cai para a lixeira certa.</div>' +
       '</div><div class="defs"><div class="dc"><span class="tag c">CONDIÇÃO INSEGURA</span> falha no ambiente ou equipamento. Ex.: caixa de perfurocortante cheia demais.</div><div class="db"><span class="tag b">COMPORTAMENTO INSEGURO</span> atitude da pessoa. Ex.: reencapar agulha.</div></div></div>';
  h += '<div class="card"><h2>🗑️ Onde descartar no hospital</h2><div class="lixleg">' + Object.keys(LIX).map(function(k){ return '<div><span class="li">' + iconeLix(k) + '</span><div><b>' + LIX[k].n + '</b><small>' + LIX[k].s + '</small></div></div>'; }).join('') + '</div>' +
       '<p class="muted" style="margin:10px 0 0;font-size:14px">🧪 Derramamento de produto químico: use o <b>kit de derramamento nível I</b> (bolsa com barreiras, mantas, EPIs e saco para resíduo) para fazer a contenção.</p></div>';
  h += '<div class="card credito"><div class="cav">LT</div><div><small>Idealização, conteúdo e criação</small><b>Luan Tavarez</b><span>Técnico em Segurança do Trabalho</span><p>Jogo criado para o treinamento de Segurança e Saúde do Trabalho do Hospital Beneficência Portuguesa de São José do Rio Preto, com a rotina real dos setores: UTI e internação, centro cirúrgico, farmácia, almoxarifado e administrativo.</p></div></div>';
  h += '<div class="foot"><b>Hospital Beneficência Portuguesa</b> · São José do Rio Preto · Segurança e Saúde do Trabalho<br>Criado por Luan Tavarez · Técnico em Segurança do Trabalho<br>Os dados de inscrição e pontuação ficam salvos somente neste aparelho/navegador.</div>';
  app.innerHTML = h; scrollTo(0,0);
}

var SETORES = ['UTI','Internação / Enfermaria','Centro Cirúrgico','CME','Pronto-Socorro','Farmácia','Almoxarifado','Administrativo','Faturamento','Recepção','Higienização / Limpeza','Nutrição','Laboratório','Manutenção','Liderança','Terceiro','Outro'];
var TURNOS = ['Diurno (12x36)','Noturno (12x36)','Manhã','Tarde','Comercial'];
function telaInscricao(foco){
  clearAll();
  var h = '<div class="grid2"><div class="card"><h2>📝 Cadastro</h2><p class="muted" style="margin-top:-4px">Primeira vez? Preencha com o seu <b>nome completo</b>: é ele que sai no certificado.</p><form id="fIns" autocomplete="off">' +
    '<label class="f">Nome completo *<input name="nome" required maxlength="80" placeholder="Ex.: Maria da Silva"></label>' +
    '<label class="f">Matrícula *<input name="matricula" required maxlength="20" placeholder="Ex.: 12345"></label>' +
    '<label class="f">Setor<select name="setor"><option value="">Selecione…</option>' + SETORES.map(function(s){ return '<option>' + s + '</option>'; }).join('') + '</select></label>' +
    '<label class="f">Turno<select name="turno"><option value="">Selecione…</option>' + TURNOS.map(function(t){ return '<option>' + t + '</option>'; }).join('') + '</select></label>' +
    '<label class="f">Função<input name="funcao" maxlength="50" placeholder="Ex.: Técnico(a) de enfermagem"></label>' +
    '<button class="btn ok big" type="submit">✅ Cadastrar e jogar</button></form></div>';
  h += '<div class="card" id="cardEntrar"><h2>🔑 Já tenho cadastro</h2><p class="muted" style="margin-top:-4px">Digite a sua matrícula para continuar de onde parou.</p><form id="fEnt" autocomplete="off">' +
    '<label class="f">Matrícula<input name="mat" required maxlength="20" placeholder="Ex.: 12345"></label>' +
    '<button class="btn big" type="submit">▶ Entrar</button></form><p class="muted" style="font-size:13px;margin:12px 0 0">🔒 Por privacidade, a lista de colaboradores fica só com a equipe de SST.</p></div></div>';
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
    if (nome.length < 3 || nome.indexOf(' ') < 0) { toast('Informe o nome completo (nome e sobrenome).'); return; }
    if (!mat) { toast('Informe a matrícula.'); return; }
    var ex = DB.players[mat];
    if (ex && ex.nome.toLowerCase() !== nome.toLowerCase()) { toast('Esta matrícula já tem cadastro. Use “Já tenho cadastro” para entrar.'); SND.bad(); return; }
    if (!ex) DB.players[mat] = { id:mat, nome:nome, matricula:mat, setor:String(fd.get('setor')||''), turno:String(fd.get('turno')||''), funcao:String(fd.get('funcao')||'').trim(), criado:hoje(), fases:{} };
    DB.atual = mat; save(); SND.ok(); toast('Bem-vindo(a), ' + DB.players[mat].nome.split(' ')[0] + '!'); telaMapa();
  });
}

/* ---------- PAINEL DO COLABORADOR ---------- */
function posicao(p, filtroSetor){
  var l = Object.keys(DB.players).map(function(k){ return DB.players[k]; }).filter(function(q){ return !filtroSetor || q.setor === p.setor; })
    .sort(function(a, b){ return total(b) - total(a) || estrelasTot(b) - estrelasTot(a); });
  var i = l.findIndex(function(q){ return q.id === p.id; });
  return { pos:i + 1, de:l.length };
}
function telaMeuPainel(){
  clearAll();
  var p = atual(); if (!p) { telaInscricao(true); return; }
  var t = total(p), nv = nivel(t), pct = nv.prox ? Math.min(100, (t - nv.n.min) / (nv.prox.min - nv.n.min) * 100) : 100;
  var conc = concluidas(p), est = estrelasTot(p), rk = posicao(p), rs = p.setor ? posicao(p, true) : null, tent = 0;
  FASES.forEach(function(f){ var r = p.fases[f.id]; if (r) tent += r.tentativas || 0; });
  var h = '<div class="card perfil"><div class="av" style="width:64px;height:64px;font-size:24px">' + esc(iniciais(p.nome)) + '</div><div class="dados"><small class="muted" style="text-transform:uppercase;letter-spacing:.06em;font-weight:800">📊 Meu painel</small><b style="display:block;font-size:21px">' + esc(p.nome) + '</b>' +
    '<div class="muted" style="font-size:14px">Mat. ' + esc(p.matricula) + (p.setor ? ' · ' + esc(p.setor) : '') + (p.turno ? ' · ' + esc(p.turno) : '') + (p.funcao ? ' · ' + esc(p.funcao) : '') + '</div>' +
    '<div class="muted" style="font-size:13px">Cadastro em ' + dataBR(p.criado) + ' · Última atividade ' + dataBR(p.ultima || p.criado) + '</div></div>' +
    '<div class="row"><button class="btn ok" data-act="mapa">▶ Jogar</button><button class="btn ghost sm" data-act="trocar">Não é você?</button></div></div>';
  h += '<div class="kpis">' +
    '<div><small>Pontos</small><b>' + fmt(t) + '</b><span>' + nv.n.ic + ' ' + nv.n.nome + '</span><div class="prog"><i style="width:' + pct + '%"></i></div><span>' + (nv.prox ? 'Faltam ' + fmt(nv.prox.min - t) + ' para ' + nv.prox.ic + ' ' + nv.prox.nome : 'Nível máximo!') + '</span></div>' +
    '<div><small>Fases concluídas</small><b>' + conc + '/' + FASES.length + '</b><div class="prog"><i style="width:' + (conc / FASES.length * 100) + '%"></i></div><span>' + (conc === FASES.length ? '🎓 Certificado liberado' : 'Faltam ' + (FASES.length - conc) + ' para o certificado') + '</span></div>' +
    '<div><small>Estrelas</small><b>' + est + '/' + (FASES.length * 3) + ' ★</b><div class="prog"><i style="width:' + (est / (FASES.length * 3) * 100) + '%"></i></div><span>' + tent + ' partida(s) jogada(s)</span></div>' +
    '<div><small>Posição no ranking</small><b>' + (t ? rk.pos + 'º' : '—') + '</b><span>de ' + rk.de + ' colaborador(es) neste aparelho</span>' + (rs && t ? '<span>' + rs.pos + 'º de ' + rs.de + ' no setor ' + esc(p.setor) + '</span>' : '') + '</div></div>';
  h += '<div class="card"><h2>🗺️ Meu desempenho por fase</h2><div class="tabwrap"><table><thead><tr><th>Fase</th><th>Estrelas</th><th class="num">Recorde</th><th class="num">Partidas</th><th>Última vez</th><th></th></tr></thead><tbody>';
  FASES.forEach(function(f, i){
    var r = p.fases[f.id], lib = liberada(p, i);
    h += '<tr><td><b>' + f.ic + ' ' + (i + 1) + '. ' + f.nome + '</b></td><td class="estrelas" style="font-size:17px">' + stars(r ? r.stars : 0) + '</td><td class="num">' + (r ? fmt(r.best) : '—') + '</td><td class="num">' + (r ? r.tentativas || 0 : 0) + '</td><td><small>' + (r ? dataBR(r.ultima) : '—') + '</small></td>' +
      '<td style="white-space:nowrap">' + (lib ? '<button class="btn sm ' + (r && r.stars >= 1 ? 'ghost' : 'ok') + '" data-act="fase" data-i="' + i + '">' + (r && r.stars >= 1 ? '🔁 De novo' : '▶ Jogar') + '</button>' : '<span class="muted">🔒</span>') + '</td></tr>';
  });
  h += '</tbody></table></div></div>';
  var dicas = [];
  FASES.forEach(function(f, i){ var r = p.fases[f.id]; if (liberada(p, i) && (!r || r.stars < 1)) dicas.push('▶ Conclua <b>' + f.nome + '</b> para liberar a próxima fase.'); });
  FASES.forEach(function(f){ var r = p.fases[f.id]; if (r && r.stars >= 1 && r.stars < 3) dicas.push('⭐ Jogue de novo <b>' + f.nome + '</b>: você tem ' + r.stars + ' de 3 estrelas.'); });
  h += '<div class="grid2"><div class="card"><h2>💡 Próximos passos</h2>' + (dicas.length ? '<ul class="dicas">' + dicas.slice(0, 4).map(function(d){ return '<li>' + d + '</li>'; }).join('') + '</ul>' : '<p>🏆 Todas as fases com 3 estrelas. Você é exemplo de segurança!</p>') + '</div>' +
    '<div class="card"><h2>🎓 Meu certificado</h2>' + (conc === FASES.length ? '<p>Concluído em <b>' + dataBR(p.concluido || p.ultima) + '</b>.<br>Código de verificação: <b>' + codigoCert(Object.assign({}, p, { concluido:p.concluido || p.ultima })) + '</b></p><button class="btn gold" data-act="certificado" data-id="' + esc(p.id) + '">🎓 Ver e baixar em PDF</button>' : '<p class="muted">O certificado é liberado ao concluir as ' + FASES.length + ' fases. Você já concluiu <b>' + conc + '</b>.</p><div class="prog"><i style="width:' + (conc / FASES.length * 100) + '%"></i></div>') + '</div></div>';
  h += '<div class="foot">Seus dados ficam salvos só neste aparelho. O ranking completo e os relatórios ficam com a equipe de SST.</div>';
  app.innerHTML = h; scrollTo(0,0);
}

/* ---------- ÁREA DO SST (PIN) — painel do administrador ---------- */
var SST_OK = false;
function hashPin(p){ var h = 5381, t = 'hospital-seguro:' + p; for (var i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) >>> 0; return 'h' + h.toString(36); }
function sstGate(cb){
  if (SST_OK) { cb(); return; }
  var novo = !DB.pin;
  modal('<h3>🔒 Área do SST</h3><p class="muted" style="margin:0 0 10px">' + (novo ? 'Primeiro acesso neste aparelho: crie um PIN (4 a 8 números) para proteger o painel do administrador, o ranking e as exportações.' : 'Digite o PIN do SST para acessar o painel do administrador.') + '</p>' +
    '<form id="fPin" autocomplete="off"><label class="f">PIN<input name="p1" type="password" inputmode="numeric" maxlength="8" required></label>' +
    (novo ? '<label class="f">Repita o PIN<input name="p2" type="password" inputmode="numeric" maxlength="8" required></label>' : '') +
    '<div class="opts"><button class="btn ok" type="submit">' + (novo ? 'Criar PIN e entrar' : 'Entrar') + '</button><button class="btn ghost" type="button" id="pinX">Cancelar</button></div></form>' +
    (novo ? '' : '<p class="muted" style="font-size:12px;margin:12px 0 0">O PIN fica salvo só neste aparelho. Se esquecer, procure quem configurou o aparelho.</p>'));
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
  return '<div class="sst-tabs"><b>🔒 Área do SST · Administrador</b><button class="btn sm' + (on === 'painel' ? ' on' : '') + '" data-act="painel">📋 Painel</button><button class="btn sm' + (on === 'ranking' ? ' on' : '') + '" data-act="ranking">🏆 Ranking</button><button class="btn sm bad" data-act="sstSair">🔒 Bloquear e sair</button></div>';
}
function indicadores(lista){
  var tot = lista.length, h = '';
  var fases = FASES.map(function(f){
    var jog = 0, ok = 0, soma = 0, est = 0, tent = 0;
    lista.forEach(function(p){ var r = p.fases[f.id]; if (r){ jog++; soma += r.best || 0; est += r.stars || 0; tent += r.tentativas || 0; if (r.stars >= 1) ok++; } });
    return { f:f, jog:jog, ok:ok, media:jog ? soma / jog : 0, est:jog ? est / jog : 0, tent:tent };
  });
  var jogadas = fases.filter(function(x){ return x.jog; }), dificil = jogadas.length ? jogadas.slice().sort(function(a, b){ return a.est - b.est; })[0] : null;
  h += '<div class="card"><h2>📈 Desempenho por fase</h2>' + (dificil && dificil.est < 2.5 ? '<p class="alerta">⚠️ Fase com menor desempenho: <b>' + dificil.f.ic + ' ' + dificil.f.nome + '</b> (média de ' + dificil.est.toFixed(1) + ' estrela(s)). Vale reforçar esse tema no treinamento.</p>' : '') +
    '<div class="tabwrap"><table><thead><tr><th>Fase</th><th>Concluíram</th><th class="num">Jogaram</th><th class="num">Média de pontos</th><th class="num">Média ★</th><th class="num">Partidas</th></tr></thead><tbody>' +
    fases.map(function(x){ var pc = tot ? Math.round(x.ok / tot * 100) : 0; return '<tr><td><b>' + x.f.ic + ' ' + x.f.nome + '</b></td><td style="min-width:150px"><div class="barra"><i style="width:' + pc + '%"></i><span>' + x.ok + ' (' + pc + '%)</span></div></td><td class="num">' + x.jog + '</td><td class="num">' + (x.jog ? fmt(x.media) : '—') + '</td><td class="num">' + (x.jog ? x.est.toFixed(1) : '—') + '</td><td class="num">' + x.tent + '</td></tr>'; }).join('') +
    '</tbody></table></div></div>';
  var set = {};
  lista.forEach(function(p){ var k = p.setor || 'Sem setor'; var s = set[k] || (set[k] = { n:0, c:0, pts:0 }); s.n++; s.pts += total(p); if (concluidas(p) === FASES.length) s.c++; });
  var ks = Object.keys(set).sort(function(a, b){ return set[b].n - set[a].n; });
  h += '<div class="card"><h2>🏥 Participação por setor</h2>' + (ks.length ? '<div class="tabwrap"><table><thead><tr><th>Setor</th><th class="num">Inscritos</th><th>Concluíram tudo</th><th class="num">Média de pontos</th></tr></thead><tbody>' +
    ks.map(function(k){ var s = set[k], pc = Math.round(s.c / s.n * 100); return '<tr><td><b>' + esc(k) + '</b></td><td class="num">' + s.n + '</td><td style="min-width:150px"><div class="barra"><i style="width:' + pc + '%"></i><span>' + s.c + ' (' + pc + '%)</span></div></td><td class="num">' + fmt(s.pts / s.n) + '</td></tr>'; }).join('') +
    '</tbody></table></div>' : '<p class="muted">Sem dados ainda.</p>') + '</div>';
  return h;
}

function telaMapa(){
  clearAll();
  var p = atual(); if (!p) { telaInscricao(); return; }
  var t = total(p), nv = nivel(t), pct = nv.prox ? Math.min(100, (t - nv.n.min) / (nv.prox.min - nv.n.min) * 100) : 100;
  var todas = concluidas(p) === FASES.length;
  var h = '<div class="card perfil"><div class="av" style="width:60px;height:60px;font-size:22px">' + esc(iniciais(p.nome)) + '</div><div class="dados"><b style="font-size:19px">' + esc(p.nome) + '</b><div class="muted" style="font-size:14px">Mat. ' + esc(p.matricula) + (p.setor ? ' · ' + esc(p.setor) : '') + (p.turno ? ' · ' + esc(p.turno) : '') + '</div>' +
    '<div style="margin-top:6px" class="row"><span class="badge">' + nv.n.ic + ' ' + nv.n.nome + '</span><button class="btn sm ghost" data-act="meuPainel">📊 Meu painel</button></div>' +
    '<div class="prog"><i style="width:' + pct + '%"></i></div><small class="muted">' + (nv.prox ? 'Faltam ' + fmt(nv.prox.min - t) + ' pontos para ' + nv.prox.ic + ' ' + nv.prox.nome : 'Nível máximo alcançado!') + '</small></div>' +
    '<div style="text-align:right"><div class="pts">' + fmt(t) + '</div><div class="muted">pontos · ' + concluidas(p) + '/' + FASES.length + ' fases · ' + estrelasTot(p) + '★</div>' + (todas ? '<button class="btn sm gold" style="margin-top:8px" data-act="certificado" data-id="' + esc(p.id) + '">🎓 Meu certificado</button>' : '') + '</div></div>';
  h += '<div class="fases">';
  FASES.forEach(function(f, i){
    var r = (p.fases && p.fases[f.id]) || null, lib = liberada(p, i), st = r ? r.stars : 0;
    h += '<div class="fase' + (lib ? '' : ' lock') + (st >= 1 ? ' done' : '') + '"><span class="num">' + (i+1) + '</span><div class="ic" style="background:' + f.cor + '">' + (lib ? f.ic : '🔒') + '</div><div class="hr">🕒 ' + f.hora + '</div><h3>' + f.nome + '</h3><p>' + f.resumo + '</p>' +
      '<div class="row" style="justify-content:space-between"><span class="estrelas">' + stars(st) + '</span><small class="muted">' + (r ? 'Recorde: <b>' + fmt(r.best) + '</b>' : '') + '</small></div>' +
      (lib ? '<button class="btn ' + (st >= 1 ? 'ghost' : 'ok') + '" data-act="fase" data-i="' + i + '">' + (st >= 1 ? '🔁 Jogar de novo' : '▶ Jogar') + '</button>' : '<button class="btn" disabled>🔒 Conclua a fase ' + i + '</button>') + '</div>';
  });
  h += '</div><div class="foot">Faça pelo menos ★ (1 estrela) para liberar a próxima fase. Seus pontos são a soma dos seus recordes em cada fase. Veja sua posição em 📊 Meu painel.</div>';
  app.innerHTML = h; scrollTo(0,0);
}

/* ============================================================
   MOTOR DAS FASES
   ============================================================ */
var RUN = null, stage = null;
var NOMES_ETAPA = { ninja:'Risco Ninja', mov:'Descarte em Movimento', cena:'Caça aos Riscos', descarte:'Descarte Certo', ordem:'Passo a Passo', cartas:'Seguro ou Inseguro?', quiz:'Quiz' };
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
    cena: ['🔍','Caça aos Riscos', CENAS[et.cena] ? CENAS[et.cena].titulo + '. ' + CENAS[et.cena].instr : '', ['Toque no que estiver <b>errado</b> e diga se é <span class="tag c">CONDIÇÃO INSEGURA</span> (ambiente/equipamento) ou <span class="tag b">COMPORTAMENTO INSEGURO</span> (atitude da pessoa).','Classificação certa: <b>+100</b>. Errada: <b>+40</b>.','Tocou em algo que está <b>certo</b>? Você vê o jeito correto, mas perde <b>10</b> pontos. Toque no vazio: <b>−10</b>.','<b>Os riscos mudam a cada partida</b>: jogue de novo e encontre outros!']],
    descarte: ['🗑️','Descarte Certo', et.aleatorio ? 'Descarte relâmpago: itens de todos os setores. Você tem ' + et.tempo + ' segundos por item!' : 'Cada resíduo no seu lugar. Leia o item e toque na lixeira ou caixa correta.', ['Cada acerto vale <b>+50</b>.'].concat(et.tempo ? ['Responda rápido: bônus de até <b>+25</b> por item!'] : ['Leia a explicação para aprender o porquê.'])],
    ordem: ['🔢','Passo a Passo', '<b>' + (et.titulo || '') + '</b> — ' + (et.contexto || ''), ['Toque nos passos <b>na ordem correta</b>, um de cada vez.','De primeira: <b>+50</b> por passo. Depois de um erro: <b>+25</b>; depois de dois: <b>+10</b> (e mostramos o passo certo).','No final, revise o procedimento completo.']],
    cartas: ['👍','Seguro ou Inseguro?','Leia cada situação e decida se ela é segura ou insegura.',['Cada acerto vale <b>+50</b> pontos.','Leia a explicação para aprender o porquê.']],
    ninja: ['⚡','Risco Ninja','Jogo de habilidade! Os itens voam pela tela: <b>deslize o dedo (ou arraste o mouse) para CORTAR os riscos</b> e <b>NÃO corte as proteções</b>.',['🔪 Corte os riscos: ' + NJ.risco.filter(function(i){ return !et.riscos || et.riscos.indexOf(i.k) >= 0; }).map(function(i){ return i.n; }).join(', ') + '.','🛡️ Não corte as proteções: ' + NJ.protecao.filter(function(i){ return !et.protecoes || et.protecoes.indexOf(i.k) >= 0; }).map(function(i){ return i.n; }).join(', ') + '.','3 vidas ❤️: perde uma ao cortar uma proteção ou ao deixar um risco cair.','Cada risco: <b>+10</b>. Corte 3 ou mais num só movimento para fazer <b>COMBO</b>. Meta: <b>' + (et.meta || 400) + '</b> pontos em ' + (et.tempo || 60) + ' segundos.']],
    mov: ['🗑️','Descarte em Movimento','Jogo de habilidade! Os resíduos caem do alto: <b>segure e arraste cada um até a lixeira certa</b> antes que chegue embaixo.',['Lixeiras desta fase: ' + (et.lixeiras || MOV_LIX).map(function(k){ return '<b>' + LIX[k].n + '</b>'; }).join(', ') + '.','Se você não arrastar, o resíduo cai na lixeira que estiver abaixo dele.','3 vidas ❤️: perde uma a cada resíduo na lixeira errada.','Cada acerto: <b>+10</b>. Acertos seguidos dão bônus de <b>sequência 🔥</b>. Meta: <b>' + (et.meta || 300) + '</b> pontos em ' + (et.tempo || 60) + ' segundos.']],
    quiz: ['❓', et.aleatorio ? 'Desafio Final' : 'Quiz', et.aleatorio ? 'Perguntas de todos os setores. Você tem ' + (et.tempo||20) + ' segundos por pergunta.' : 'Responda às perguntas sobre o setor.',['Cada acerto vale <b>+100</b> pontos.'].concat(et.tempo ? ['Responda rápido: bônus de até <b>+50</b> por pergunta!'] : [])]
  }[et.tipo];
  stage.innerHTML = '<div class="card intro"><div class="hora">🕒 ' + RUN.f.hora + ' · ' + RUN.f.nome + '</div><div class="big">' + I[0] + '</div><h2>' + I[1] + '</h2><p>' + I[2] + '</p><ul>' + I[3].map(function(l){ return '<li>' + l + '</li>'; }).join('') + '</ul><button class="btn ok big" id="goEt" style="max-width:360px">Começar ▶</button></div>';
  document.getElementById('goEt').onclick = function(){ SND.click(); go(); };
}

var ETAPAS = {};

/* ---------- CAÇA AOS RISCOS (riscos sorteados a cada partida) ---------- */
ETAPAS.cena = function(et, done){
  var c = CENAS[et.cena], mapa = sortearCena(c), RS = [], OKS = [], arte = c.base();
  c.slots.forEach(function(sl, i){ if (mapa[i]) { arte += sl.bad(); RS.push(sl); } else { arte += sl.good(); OKS.push(sl); } });
  if (DEBUG) window.__LAST = RS.map(function(r){ return { x:r.x, y:r.y }; });
  var total = RS.length, found = {}, vistos = {}, nF = 0, nV = 0, pts = 0, left = c.tempo || 100, paused = false, ended = false;
  function area(r){ return r.w ? '<rect x="'+(r.x-r.w/2)+'" y="'+(r.y-r.h/2)+'" width="'+r.w+'" height="'+r.h+'" fill="#f0f" opacity=".3"/>' : '<circle cx="'+r.x+'" cy="'+r.y+'" r="'+r.r+'" fill="#f0f" opacity=".3"/>'; }
  stage.innerHTML = '<div class="bar"><span class="pill">🔍 <b id="cf">0</b>/' + total + ' riscos</span><span class="pill" id="ctp">⏱️ <b id="ct">' + left + '</b>s</span><button class="btn sm" id="dica">💡 Dica (−30)</button><span class="lg c"><i></i>Condição</span><span class="lg b"><i></i>Comportamento</span><span class="lg k"><i></i>Correto</span></div><div class="rot">↔️ Arraste a cena para os lados para ver tudo (ou gire o celular na horizontal).</div>' +
    '<div class="scene-wrap"><svg id="scene" viewBox="0 0 1000 560">' + arte + (DEBUG ? c.slots.map(area).join('') : '') + '<g id="marks"></g></svg></div>' +
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
  function raio(r){ return r.w ? Math.max(Math.min(r.w, r.h)/2, 40) : r.r; }
  function marca(r, n, cls){
    var col = r.tipo === 'c' ? '#e67e22' : '#c0392b', rr = raio(r);
    marks.insertAdjacentHTML('beforeend', '<g class="' + (cls || 'mk') + '"><circle cx="'+r.x+'" cy="'+r.y+'" r="'+rr+'" fill="'+col+'" fill-opacity=".14" stroke="'+col+'" stroke-width="5"' + (cls === 'missed' ? ' stroke-dasharray="10 7"' : '') + '/><circle cx="'+R(r.x+rr*0.72)+'" cy="'+R(r.y-rr*0.72)+'" r="15" fill="'+(cls === 'missed' ? '#6b7280' : col)+'"/>' + txt(R(r.x+rr*0.72), R(r.y-rr*0.72+6), n, 17, '#fff') + '</g>');
  }
  function marcaOk(r){
    var rr = raio(r);
    marks.insertAdjacentHTML('beforeend', '<g class="mk"><circle cx="'+r.x+'" cy="'+r.y+'" r="'+rr+'" fill="#16a34a" fill-opacity=".1" stroke="#16a34a" stroke-width="4"/><circle cx="'+R(r.x+rr*0.72)+'" cy="'+R(r.y-rr*0.72)+'" r="15" fill="#16a34a"/>' + txt(R(r.x+rr*0.72), R(r.y-rr*0.72+6), '✔', 16, '#fff') + '</g>');
  }
  svg.addEventListener('click', function(ev){
    if (paused || ended) return;
    var pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
    var p = pt.matrixTransform(svg.getScreenCTM().inverse()), hit = null, i;
    for (i = 0; i < RS.length; i++){ if (!found[i] && hitTest(RS[i], p)) { hit = i; break; } }
    if (hit === null){
      for (i = 0; i < RS.length; i++) if (found[i] && hitTest(RS[i], p)) return;
      for (i = 0; i < OKS.length; i++) if (hitTest(OKS[i], p)) {
        if (vistos[i]) return;
        vistos[i] = true; nV++; pts = Math.max(0, pts - 10); upd(); marcaOk(OKS[i]); SND.click(); paused = true;
        var g = OKS[i];
        modal('<div class="fb ok"><b class="h">👍 Isto está CERTO! (−10)</b><b>' + g.okT + '</b><br>' + g.ok + '</div><p class="muted" style="margin:10px 0 0">Esse é o jeito correto. Continue procurando o que está <b>errado</b> na cena.</p><div class="opts"><button class="btn ok" id="contK">Continuar ▶</button></div>');
        document.getElementById('contK').onclick = function(){ closeModal(); paused = false; };
        return;
      }
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
        '<b>' + r.t + '</b><br>' + r.e + '</div><div class="certo"><b>✔ Jeito certo:</b> ' + r.ok + '</div><div class="opts"><button class="btn ok" id="contC">Continuar ▶</button></div>');
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
    marks.insertAdjacentHTML('beforeend', '<g class="hint"><circle cx="'+R(x)+'" cy="'+R(y)+'" r="'+(raio(r)+40)+'" fill="#facc15" fill-opacity=".25" stroke="#facc15" stroke-width="6"/></g>');
    var g = marks.lastChild; TIMERS.push(setTimeout(function(){ if (g && g.parentNode) g.parentNode.removeChild(g); }, 2200));
  };
  function fim(todos){
    if (ended) return; ended = true; clearInterval(tm); closeModal();
    var bonus = todos ? left * 2 : 0; pts += bonus; upd();
    var n = nF;
    RS.forEach(function(r, i){ if (!found[i]) marca(r, ++n, 'missed'); });
    if (todos) SND.win(); else SND.bad();
    var lista = RS.map(function(r, i){ return { r:r, f:found[i] }; }).sort(function(a, b){ return (a.f ? a.f.n : 99) - (b.f ? b.f.n : 99); });
    var h = '<div class="card resumo"><h2>' + (todos ? '🎉 Você encontrou todos os riscos!' : '⏰ O tempo acabou!') + '</h2><p class="muted" style="margin-top:-6px">' + nF + ' de ' + total + ' riscos encontrados' + (bonus ? ' · Bônus de tempo: <b>+' + bonus + '</b>' : '') + ' · Pontos da etapa: <b>' + fmt(pts) + '</b></p>';
    var k = nF;
    lista.forEach(function(o){
      var num = o.f ? o.f.n : ++k, col = o.f ? (o.r.tipo === 'c' ? 'var(--cond)' : 'var(--comp)') : '#9aa3ad';
      h += '<div class="rz"><div class="n" style="background:' + col + '">' + num + '</div><div><div class="tt">' + o.r.t + ' <span class="tag ' + o.r.tipo + '">' + (o.r.tipo === 'c' ? 'CONDIÇÃO' : 'COMPORTAMENTO') + '</span>' + (o.f ? (o.f.ok ? ' ✅' : ' ⚠️ classificação errada') : ' <span class="tag miss">NÃO ENCONTRADO</span>') + '</div><div class="ex">' + o.r.e + '</div><div class="ex ok">✔ <b>Jeito certo:</b> ' + o.r.ok + '</div></div></div>';
    });
    if (OKS.length){
      h += '<h3 style="margin:16px 0 4px">👍 Estava certo nesta cena (exemplos a seguir)</h3>';
      OKS.forEach(function(g){ h += '<div class="rz"><div class="n" style="background:var(--ok)">✔</div><div><div class="tt">' + g.okT + '</div><div class="ex">' + g.ok + '</div></div></div>'; });
    }
    h += '<p class="muted" style="font-size:14px">🔄 Na próxima partida os riscos desta cena mudam de lugar.</p><button class="btn ok big" id="cenaOk" style="margin-top:6px">Próxima etapa ▶</button></div>';
    document.getElementById('cenaFim').innerHTML = h;
    document.getElementById('cenaOk').onclick = function(){ done(pts, total * 100, bonus); };
    TIMERS.push(setTimeout(function(){ var el = document.getElementById('cenaFim'); if (el) el.scrollIntoView({ behavior:'smooth' }); }, todos ? 900 : 300));
  }
};

/* ---------- DESCARTE CERTO ---------- */
ETAPAS.descarte = function(et, done){
  var keys = et.itens ? shuffle(et.itens.slice()) : shuffle(Object.keys(ITENS).filter(function(k){ return et.lixeiras.indexOf(ITENS[k].l) >= 0; })).slice(0, et.aleatorio);
  var i = 0, pts = 0, bon = 0, acertos = 0, T = et.tempo || 0;
  function render(){
    var it = ITENS[keys[i]], left = T, answered = false, tm = null, vis = svgItem(it.svg || keys[i]);
    stage.innerHTML = '<div class="bar"><span class="pill">Item ' + (i+1) + ' de ' + keys.length + '</span><span class="pill">✅ ' + acertos + ' acertos</span>' + (T ? '<span class="pill" id="dtp">⏱️ <b id="dt">' + T + '</b>s</span>' : '') + '</div>' + (T ? '<div class="tbar" style="margin:0 0 8px"><i id="dbar"></i></div>' : '') +
      '<div class="cardq item" id="cq"><div class="vis">' + (vis || '<span class="emo">' + it.ic + '</span>') + '</div><div class="txt">' + it.n + '</div><div class="cnt">Onde descartar?</div></div>' +
      '<div class="lixs" id="lixs">' + et.lixeiras.map(function(k){ var L = LIX[k]; return '<button class="lx" data-l="' + k + '"><span class="li">' + iconeLix(k) + '</span><b>' + L.n + '</b><small>' + L.s + '</small></button>'; }).join('') + '</div><div id="dfb"></div>';
    if (T){
      tm = setInterval(function(){
        left--; var el = document.getElementById('dt'); if (el) el.textContent = left;
        var b = document.getElementById('dbar'); if (b){ b.style.width = (left / T * 100) + '%'; if (left <= 3) b.style.background = 'var(--bad)'; }
        if (left <= 0) { clearInterval(tm); responder(null); }
      }, 1000);
      TIMERS.push(tm);
    }
    function responder(k){
      if (answered) return; answered = true; if (tm) clearInterval(tm);
      var ok = k === it.l, bonus = ok && T ? Math.round(left / T * 25) : 0, g = ok ? 50 + bonus : 0;
      if (ok) acertos++;
      pts += g; bon += bonus; hud(pts); ok ? SND.ok() : SND.bad();
      document.getElementById('cq').classList.add(ok ? 'ok' : 'bad');
      stage.querySelectorAll('.lx').forEach(function(b){ b.disabled = true; var l = b.getAttribute('data-l'); if (l === it.l) b.classList.add('cert'); else if (l === k) b.classList.add('err'); });
      document.getElementById('dfb').innerHTML = '<div class="fb ' + (ok ? 'ok' : 'bad') + '"><b class="h">' + (ok ? '✅ Lugar certo! +' + g + (bonus ? ' (bônus ' + bonus + ')' : '') : (k === null ? '⏰ Tempo esgotado!' : '❌ Lugar errado!')) + '</b>' + (ok ? '' : 'O certo é: <b>' + LIX[it.l].n + '</b>. ') + it.e + '<br><button class="btn ' + (ok ? 'ok' : '') + '" id="dnx">' + (i + 1 < keys.length ? 'Próximo item ▶' : 'Concluir etapa ▶') + '</button></div>';
      document.getElementById('dnx').onclick = function(){ i++; if (i < keys.length) render(); else done(pts, keys.length * 50, bon); };
      document.getElementById('dfb').scrollIntoView({ behavior:'smooth', block:'nearest' });
    }
    stage.querySelectorAll('.lx').forEach(function(b){ b.onclick = function(){ responder(b.getAttribute('data-l')); }; });
  }
  render();
};

/* ---------- PASSO A PASSO (ordem do procedimento) ---------- */
ETAPAS.ordem = function(et, done){
  var N = et.passos.length, rest = shuffle(et.passos.map(function(_, k){ return k; })), prox = 0, errosPasso = 0, erros = 0, pts = 0, feitos = [], errados = {};
  function render(msg, cls){
    var h = '<div class="card ordem"><h2>🔢 ' + et.titulo + '</h2><p class="muted" style="margin:-4px 0 12px">' + et.contexto + '</p>';
    h += '<ol class="seq">' + feitos.map(function(f){ var p = et.passos[f.k]; return '<li class="' + (f.pen ? 'pen' : '') + '"><b>' + p.t + '</b><small>' + p.e + '</small></li>'; }).join('') + (prox < N ? '<li class="vaz">Qual é o passo ' + (prox+1) + '?</li>' : '') + '</ol>';
    if (msg) h += '<div class="msg ' + (cls || '') + '">' + msg + '</div>';
    if (prox < N){
      h += '<div class="psel">' + rest.map(function(k){ return '<button class="op ps' + (errosPasso >= 2 && k === prox ? ' dica' : '') + (errados[k] ? ' err' : '') + '" data-k="' + k + '"' + (errados[k] ? ' disabled' : '') + '>' + et.passos[k].t + '</button>'; }).join('') + '</div>';
    } else {
      h += '<div class="fb ok" style="max-width:none;margin-top:12px"><b class="h">' + (erros ? '👍 Procedimento montado! ' : '🏆 Perfeito, sem nenhum erro! ') + '+' + pts + '</b>Revise acima a sequência completa: é assim que se faz no dia a dia.<br><button class="btn ok" id="oOk">Concluir etapa ▶</button></div>';
    }
    h += '</div>';
    stage.innerHTML = h;
    stage.querySelectorAll('.ps').forEach(function(b){ b.onclick = function(){ escolher(+b.getAttribute('data-k'), b); }; });
    var ok = document.getElementById('oOk'); if (ok) ok.onclick = function(){ done(pts, N * 50); };
  }
  function escolher(k, b){
    if (k === prox){
      var g = errosPasso === 0 ? 50 : errosPasso === 1 ? 25 : 10;
      pts += g; hud(pts); SND.ok();
      feitos.push({ k:k, pen:errosPasso > 0 }); rest.splice(rest.indexOf(k), 1); prox++; errosPasso = 0; errados = {};
      if (prox >= N) SND.win();
      render(prox < N ? '✅ Certo! +' + g : '', 'ok');
    } else {
      if (errados[k]) return;
      errosPasso++; erros++; errados[k] = true; SND.bad();
      render(errosPasso >= 2 ? '💡 O passo certo agora está destacado em amarelo.' : '❌ Ainda não. Pense no que precisa acontecer <b>antes</b>.', 'bad');
    }
  }
  render();
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


/* ============================================================
   RISCO NINJA — jogo de habilidade: corte os riscos, poupe as proteções
   ============================================================ */
function njEscala(inner, s, tx, ty){ return '<g transform="translate(' + tx + ',' + ty + ') scale(' + s + ')">' + inner + '</g>'; }
var NJ = {
  risco: [
    { k:'agulha', n:'Agulha solta', e:'Agulha fora da caixa de perfurocortante fura quem passa. Descarte na hora, sem reencapar.', svg:function(){ return njEscala(seringa(0, 0, -35), 2, 50, 50); } },
    { k:'ampola', n:'Ampola quebrada', e:'Ampola quebrada largada corta. O lugar dela é a caixa laranja.', svg:function(){ return njEscala(ampola(0, 14, { quebrada:true }), 2.6, 50, 50); } },
    { k:'frasco', n:'Remédio quebrado no chão', e:'Medicamento quebrado: recolher com luvas, pá e vassoura e descartar na caixa laranja.', svg:function(){ return njEscala(ICO.frascoQ, 1, 0, 10); } },
    { k:'bisturi', n:'Bisturi esquecido', e:'Quem usa o bisturi descarta a lâmina na caixa de perfurocortante (NR-32).', svg:function(){ return njEscala(bisturi(0, 0, -30), 2.2, 50, 50); } },
    { k:'sutura', n:'Agulha de sutura caída', e:'Agulha caída no chão atravessa luva e calçado. Recolher com pinça.', svg:function(){ return njEscala(agulhaSut(0, 0), 2.4, 56, 60); } },
    { k:'poca', n:'Piso molhado sem placa', e:'Piso molhado sem sinalização é a principal causa de queda no hospital.', svg:function(){ return poca(50, 58, 44) + '<path d="M38,30 q-8,12 0,16 q8,-4 0,-16 z M60,22 q-6,9 0,12 q6,-3 0,-12 z" fill="#38bdf8"/>'; } },
    { k:'quimico', n:'Químico sem rótulo', e:'Produto químico sem rótulo, em garrafa de bebida, pode ser ingerido por engano.', svg:function(){ return njEscala(frascoQ(0, 0, { pet:true }), 1.8, 50, 88) + '<text x="72" y="40" font-size="30" font-weight="900" fill="#E1251B" font-family="Arial">?</text>'; } },
    { k:'fio', n:'Fio solto na passagem', e:'Cabo atravessando o corredor derruba quem passa. Use canaleta.', svg:function(){ return '<path d="M8,60 C20,20 40,90 52,50 S80,20 92,48" fill="none" stroke="#111827" stroke-width="6" stroke-linecap="round"/><rect x="84" y="40" width="14" height="16" rx="3" fill="#111827"/><path d="M98,44 h6 M98,52 h6" stroke="#9ca3af" stroke-width="3"/>'; } },
    { k:'lanche', n:'Lanche ao lado do leito', e:'Comer na área assistencial é proibido pela NR-32: risco de contaminação.', svg:function(){ return '<ellipse cx="50" cy="40" rx="36" ry="16" fill="#e7b46a" stroke="#a16207" stroke-width="2"/><rect x="14" y="46" width="72" height="8" rx="4" fill="#4ade80"/><rect x="16" y="54" width="68" height="7" rx="3" fill="#dc2626"/><ellipse cx="50" cy="66" rx="36" ry="10" fill="#e7b46a" stroke="#a16207" stroke-width="2"/><path d="M38,32 l2,-2 M52,30 l2,-2 M64,33 l2,-2" stroke="#fff7" stroke-width="2"/>'; } },
    { k:'prontuario', n:'Prontuário esquecido', e:'Dados de paciente expostos são vazamento de dados (LGPD). Guarde ou use a lixeira de dados sensíveis.', svg:function(){ return njEscala(ICO.relatorio, 1, 0, 10); } },
    { k:'benjamim', n:'Benjamim sobrecarregado', e:'Vários aparelhos num só benjamim esquentam a fiação e podem causar incêndio.', svg:function(){ return njEscala(tomada(0, 0, { benjamim:true }), 1.3, 50, 34); } },
    { k:'pilha', n:'Pilha de caixas torta', e:'Pilha alta e desalinhada desaba sobre quem passa. Alinhe as caixas e respeite a altura máxima.', svg:function(){ return '<g transform="rotate(10 50 60)">' + caixote(24, 96, 52, 26) + caixote(30, 70, 46, 24) + caixote(20, 46, 50, 22) + '</g>'; } },
    { k:'cilindro', n:'Cilindro de O₂ solto', e:'Cilindro sem corrente pode cair, romper a válvula e virar um projétil.', svg:function(){ return '<g transform="rotate(-62 50 50)">' + njEscala(cilindro(0, 0, {}), 0.62, 50, 88) + '</g>'; } }
  ],
  protecao: [
    { k:'caixaPerf', n:'Caixa de perfurocortante', e:'É ela que protege todo mundo das agulhas. Nunca destrua a proteção!', svg:function(){ return njEscala(caixaPerf(0, 0), 1.25, 50, 88); } },
    { k:'caixaLar', n:'Caixa laranja', e:'A caixa laranja recebe ampolas e medicamentos: é proteção.', svg:function(){ return njEscala(caixaLar(0, 0), 1.25, 50, 84); } },
    { k:'placa', n:'Placa de piso molhado', e:'A placa avisa do piso molhado e evita quedas: é proteção.', svg:function(){ return njEscala(placaPiso(0, 0), 1.35, 50, 92); } },
    { k:'extintor', n:'Extintor', e:'O extintor combate o princípio de incêndio: é proteção.', svg:function(){ return '<rect x="34" y="26" width="32" height="66" rx="12" fill="#d62828" stroke="#7f1d1d" stroke-width="3"/><rect x="42" y="12" width="16" height="16" fill="#1f2937"/><path d="M58,18 q24,0 22,44" fill="none" stroke="#1f2937" stroke-width="5"/><rect x="38" y="46" width="24" height="16" rx="2" fill="#fff"/><text x="50" y="58" text-anchor="middle" font-size="10" font-weight="900" fill="#d62828" font-family="Arial">PQS</text>'; } },
    { k:'kit', n:'Kit de derramamento', e:'O kit de derramamento nível I contém o vazamento químico: é proteção.', svg:function(){ return '<path d="M38,24 q12,-14 24,0" fill="none" stroke="#7f1d1d" stroke-width="6"/><rect x="18" y="24" width="64" height="62" rx="10" fill="#dc2626" stroke="#7f1d1d" stroke-width="3"/><rect x="18" y="46" width="64" height="10" fill="#facc15"/><text x="50" y="78" text-anchor="middle" font-size="15" font-weight="900" fill="#fff" font-family="Arial">KIT</text>'; } },
    { k:'gel', n:'Álcool gel', e:'Higienizar as mãos protege você e o paciente: é proteção.', svg:function(){ return '<rect x="30" y="34" width="40" height="56" rx="10" fill="#e0f2fe" stroke="#0284c7" stroke-width="3"/><rect x="44" y="16" width="12" height="18" fill="#0284c7"/><path d="M56,20 h16" stroke="#0284c7" stroke-width="5"/><text x="50" y="68" text-anchor="middle" font-size="13" font-weight="900" fill="#0369a1" font-family="Arial">70%</text>'; } },
    { k:'oculos', n:'Óculos de proteção', e:'Óculos protegem os olhos de respingos de sangue e químicos: é EPI.', svg:function(){ return '<path d="M10,44 q40,-14 80,0 v14 q-4,18 -24,18 q-12,0 -16,-12 q-4,12 -16,12 q-20,0 -24,-18 z" fill="#bae6fd" fill-opacity=".8" stroke="#334155" stroke-width="4"/><path d="M10,46 l-6,-6 M90,46 l6,-6" stroke="#334155" stroke-width="4"/>'; } },
    { k:'mascara', n:'Máscara N95', e:'A máscara protege contra agentes biológicos no ar: é EPI.', svg:function(){ return '<path d="M16,42 q34,-26 68,0 q-4,36 -34,40 q-30,-4 -34,-40 z" fill="#f8fafc" stroke="#64748b" stroke-width="3"/><path d="M16,46 q-10,4 -10,16 M84,46 q10,4 10,16" fill="none" stroke="#64748b" stroke-width="3"/><path d="M30,52 q20,8 40,0" fill="none" stroke="#cbd5e1" stroke-width="3"/>'; } },
    { k:'dados', n:'Lixeira de dados sensíveis', e:'Documentos de pacientes vão para ela: é proteção de dados (LGPD).', svg:function(){ return njEscala(lixeira(0, 0, 'dados'), 1.05, 50, 92); } }
  ]
};
var NJ_IMG = null;
function njCarregar(){
  if (NJ_IMG) return NJ_IMG;
  NJ_IMG = {};
  NJ.risco.concat(NJ.protecao).forEach(function(it){
    var im = new Image();
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="160" height="160">' + it.svg() + '</svg>');
    NJ_IMG[it.k] = im;
  });
  return NJ_IMG;
}
SND.corte = function(){ beep(1200, .06, 'triangle', .05); setTimeout(function(){ beep(700, .08, 'triangle', .04); }, 40); };

/* motor do jogo: box = onde desenhar; op = { tempo, vidas }; fim(resultado) */
function rodarNinja(box, op, fim){
  var IMG = njCarregar(), tempoTotal = op.tempo || 60, vidas = op.vidas || 3;
  var RISCOS = op.riscos ? NJ.risco.filter(function(i){ return op.riscos.indexOf(i.k) >= 0; }) : NJ.risco, PROTS = op.protecoes ? NJ.protecao.filter(function(i){ return op.protecoes.indexOf(i.k) >= 0; }) : NJ.protecao;
  box.innerHTML = '<div class="nj"><canvas></canvas><button class="nj-pausa" title="Pausar">⏸</button><div class="nj-msg"></div></div>';
  var wrap = box.querySelector('.nj'), cv = box.querySelector('canvas'), ctx = cv.getContext('2d'), msg = box.querySelector('.nj-msg'), btP = box.querySelector('.nj-pausa');
  var W = 0, H = 0, R = 40, G = 1000, objs = [], metades = [], parts = [], pops = [], rastro = [], vivo = true, pausado = false, raf = 0;
  var pts = 0, cortados = 0, protAtingidas = 0, perdidos = 0, combos = 0, melhorCombo = 0, log = {}, t = -3.2, prox = 0, ult = 0, tremer = 0, flash = 0, flashCor = '', golpe = null, apertado = false;
  function medir(){
    var w = wrap.clientWidth, h = w < 640 ? Math.min(Math.max(innerHeight - 190, 420), w * 1.5) : Math.min(w * 0.56, 620);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = w; H = h; cv.style.height = h + 'px'; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    R = Math.max(30, Math.min(52, Math.min(W, H) / 9)); G = H * 1.15;
  }
  medir();
  function rnd(a, b){ return a + Math.random() * (b - a); }
  function registra(it, tipo){ var l = log[it.k] || (log[it.k] = { n:it.n, e:it.e, prot:tipo === 'prot', c:0, x:0, p:0 }); return l; }
  function lancar(){
    var dif = Math.min(1, Math.max(0, t) / tempoTotal), n = 1 + (Math.random() < 0.35 + dif * 0.4 ? 1 : 0) + (Math.random() < dif * 0.45 ? 1 : 0);
    for (var i = 0; i < n; i++){
      var prot = Math.random() < 0.26 + dif * 0.08, lista = prot ? PROTS : RISCOS, it = lista[Math.floor(Math.random() * lista.length)];
      var x0 = rnd(W * 0.12, W * 0.88), alt = rnd(H * 0.5, H * 0.86), vy = -Math.sqrt(2 * G * alt), tVoo = 2 * -vy / G;
      var alvo = rnd(W * 0.2, W * 0.8), vx = (alvo - x0) / tVoo;
      objs.push({ it:it, prot:prot, x:x0, y:H + R, vx:vx, vy:vy * rnd(1, 1.04), rot:rnd(0, 6.28), vr:rnd(-3, 3), cut:false });
    }
    prox = t + Math.max(0.5, 1.25 - dif * 0.75) * rnd(0.8, 1.2);
  }
  function popup(txt, x, y, cor, grande){ pops.push({ txt:txt, x:x, y:y, cor:cor, vida:1.1, g:grande }); }
  function aviso(html, cls){ msg.innerHTML = html; msg.className = 'nj-msg on ' + (cls || ''); clearTimeout(aviso.tm); aviso.tm = setTimeout(function(){ msg.className = 'nj-msg'; }, 1700); }
  function corta(o){
    o.cut = true;
    var esp = 120;
    metades.push({ img:IMG[o.it.k], x:o.x, y:o.y, vx:o.vx - esp, vy:o.vy - 60, rot:o.rot, vr:o.vr - 4, lado:0, vida:1.4 });
    metades.push({ img:IMG[o.it.k], x:o.x, y:o.y, vx:o.vx + esp, vy:o.vy - 60, rot:o.rot, vr:o.vr + 4, lado:1, vida:1.4 });
    var cor = o.prot ? '#22c55e' : ['#E1251B','#f97316','#facc15'][Math.floor(Math.random() * 3)];
    for (var i = 0; i < 16; i++) parts.push({ x:o.x, y:o.y, vx:rnd(-260, 260), vy:rnd(-320, 120), vida:rnd(0.4, 0.8), cor:cor, r:rnd(2, 5) });
    var l = registra(o.it, o.prot ? 'prot' : 'risco');
    if (o.prot){
      l.x++; protAtingidas++; vidas--; tremer = 0.35; flash = 0.35; flashCor = 'rgba(225,37,27,.35)'; SND.hit();
      popup('NÃO! É PROTEÇÃO', o.x, o.y - R, '#E1251B', true);
      aviso('⚠️ <b>' + o.it.n + '</b> é proteção! ' + o.it.e, 'bad');
    } else {
      l.c++; cortados++; golpe.n++; pts += 10; SND.corte();
      popup('+10', o.x, o.y - R * 0.6, '#fde047');
      if (golpe.n >= 3){ var b = 5 * (golpe.n - 2); pts += b; if (golpe.n === 3) combos++; melhorCombo = Math.max(melhorCombo, golpe.n); popup('COMBO x' + golpe.n + '  +' + b, o.x, o.y - R * 1.6, '#4ade80', true); }
    }
  }
  function distSeg(px, py, ax, ay, bx, by){
    var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, u = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    u = Math.max(0, Math.min(1, u)); var qx = ax + u * dx - px, qy = ay + u * dy - py; return Math.sqrt(qx * qx + qy * qy);
  }
  function ponto(ev){ var r = cv.getBoundingClientRect(); return { x:ev.clientX - r.left, y:ev.clientY - r.top, t:performance.now() }; }
  function down(ev){ if (!vivo) return; ev.preventDefault(); apertado = true; golpe = { n:0 }; rastro = [ponto(ev)]; try { cv.setPointerCapture(ev.pointerId); } catch (e) {} }
  function move(ev){
    if (!apertado || !vivo) return; ev.preventDefault();
    var p = ponto(ev), a = rastro[rastro.length - 1]; rastro.push(p); if (rastro.length > 24) rastro.shift();
    if (pausado || t < 0 || !a) return;
    var dl = Math.hypot(p.x - a.x, p.y - a.y); if (dl < 3) return;
    objs.forEach(function(o){ if (!o.cut && distSeg(o.x, o.y, a.x, a.y, p.x, p.y) < R * 0.82) corta(o); });
  }
  function up(){ apertado = false; golpe = null; }
  cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('pointerleave', up);
  function pausa(v){ pausado = v; btP.textContent = v ? '▶' : '⏸'; if (v) aviso('⏸ Pausado — toque em ▶ para continuar'); }
  btP.onclick = function(){ if (vivo) pausa(!pausado); };
  function vis(){ if (document.hidden && vivo) pausa(true); }
  function rs(){ medir(); }
  document.addEventListener('visibilitychange', vis); window.addEventListener('resize', rs);
  CLEAN.push(function(){ vivo = false; cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', vis); window.removeEventListener('resize', rs); });
  if (DEBUG) window.__NJ = { objs:function(){ return objs; }, rect:function(){ return cv.getBoundingClientRect(); }, R:function(){ return R; }, t:function(){ return t; } };

  function fundo(){
    var g = ctx.createRadialGradient(W * 0.5, H * 0.35, 20, W * 0.5, H * 0.5, Math.max(W, H) * 0.8);
    g.addColorStop(0, '#0f5132'); g.addColorStop(1, '#04241a'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 1;
    for (var x = 0; x < W; x += 46){ ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (var y = 0; y < H; y += 46){ ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  }
  function rotulo(txt, x, y, cor){
    ctx.font = '800 ' + Math.max(11, Math.round(R * 0.3)) + 'px Barlow, Arial, sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.strokeText(txt, x, y); ctx.fillStyle = cor || '#fff'; ctx.fillText(txt, x, y);
  }
  function hudDesenho(){
    ctx.textAlign = 'left'; ctx.font = '800 ' + Math.round(Math.max(22, R * 0.62)) + 'px Barlow, Arial, sans-serif';
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.strokeText('⭐ ' + pts, 14, 38); ctx.fillStyle = '#fde047'; ctx.fillText('⭐ ' + pts, 14, 38);
    ctx.textAlign = 'right'; ctx.font = Math.round(Math.max(20, R * 0.55)) + 'px Arial'; var c = ''; for (var i = 0; i < (op.vidas || 3); i++) c += i < vidas ? '❤️' : '🖤'; ctx.fillText(c, W - 56, 36);
    var rest = Math.max(0, tempoTotal - Math.max(0, t)), estreito = W < 560, bw = estreito ? W - 90 : Math.min(260, W * 0.4), bx = estreito ? 14 : W / 2 - bw / 2, by = estreito ? 56 : 16;
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(bx, by, bw, 10);
    ctx.fillStyle = rest < 10 ? '#E1251B' : '#22c55e'; ctx.fillRect(bx, by, bw * rest / tempoTotal, 10);
    ctx.font = '700 14px Barlow, Arial, sans-serif'; ctx.fillStyle = '#fff';
    if (estreito) { ctx.textAlign = 'left'; ctx.fillText(Math.ceil(rest) + 's', bx + bw + 10, by + 10); } else { ctx.textAlign = 'center'; ctx.fillText(Math.ceil(rest) + 's', W / 2, 44); }
  }
  function quadro(agora){
    if (!vivo) return;
    raf = requestAnimationFrame(quadro);
    var dt = Math.min(0.033, (agora - (ult || agora)) / 1000); ult = agora;
    if (pausado) dt = 0;
    t += dt;
    if (t >= 0 && t >= prox && t < tempoTotal) lancar();
    objs.forEach(function(o){
      o.vy += G * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.rot += o.vr * dt;
      if (!o.cut && o.vy > 0 && o.y > H + R * 1.2){
        o.fora = true;
        if (!o.prot){ perdidos++; vidas--; registra(o.it, 'risco').p++; flash = 0.3; flashCor = 'rgba(225,37,27,.25)'; SND.bad(); popup('Deixou passar!', Math.max(80, Math.min(W - 80, o.x)), H - 30, '#fca5a5', true); aviso('😬 Deixou passar: <b>' + o.it.n + '</b>. ' + o.it.e, 'bad'); }
      }
    });
    objs = objs.filter(function(o){ return !o.cut && !o.fora; });
    metades.forEach(function(m){ m.vy += G * dt; m.x += m.vx * dt; m.y += m.vy * dt; m.rot += m.vr * dt; m.vida -= dt; });
    metades = metades.filter(function(m){ return m.vida > 0 && m.y < H + R * 2; });
    parts.forEach(function(p){ p.vy += G * 0.8 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vida -= dt; });
    parts = parts.filter(function(p){ return p.vida > 0; });
    pops.forEach(function(p){ p.y -= 40 * dt; p.vida -= dt; });
    pops = pops.filter(function(p){ return p.vida > 0; });
    var agoraMs = performance.now(); rastro = rastro.filter(function(p){ return agoraMs - p.t < 140; });
    tremer = Math.max(0, tremer - dt); flash = Math.max(0, flash - dt);
    // desenho
    ctx.save();
    if (tremer > 0) ctx.translate(rnd(-8, 8) * tremer * 3, rnd(-8, 8) * tremer * 3);
    fundo();
    objs.forEach(function(o){
      ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.rot);
      ctx.beginPath(); ctx.arc(0, 0, R * 0.95, 0, 6.29); ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fill();
      var im = IMG[o.it.k]; if (im.complete && im.naturalWidth) ctx.drawImage(im, -R * 0.85, -R * 0.85, R * 1.7, R * 1.7);
      ctx.restore();
      rotulo(o.it.n, o.x, o.y + R + 16);
    });
    metades.forEach(function(m){
      ctx.save(); ctx.globalAlpha = Math.min(1, m.vida); ctx.translate(m.x, m.y); ctx.rotate(m.rot);
      ctx.beginPath(); ctx.rect(m.lado ? 0 : -R, -R, R, R * 2); ctx.clip();
      ctx.beginPath(); ctx.arc(0, 0, R * 0.95, 0, 6.29); ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fill();
      if (m.img.complete && m.img.naturalWidth) ctx.drawImage(m.img, -R * 0.85, -R * 0.85, R * 1.7, R * 1.7);
      ctx.restore();
    });
    parts.forEach(function(p){ ctx.globalAlpha = Math.min(1, p.vida * 2); ctx.fillStyle = p.cor; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.29); ctx.fill(); });
    ctx.globalAlpha = 1;
    if (rastro.length > 1){
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (var i = 1; i < rastro.length; i++){
        var f = i / rastro.length; ctx.strokeStyle = 'rgba(255,255,255,' + (0.25 + f * 0.75) + ')'; ctx.lineWidth = 2 + f * 9;
        ctx.shadowColor = '#4ade80'; ctx.shadowBlur = 14; ctx.beginPath(); ctx.moveTo(rastro[i - 1].x, rastro[i - 1].y); ctx.lineTo(rastro[i].x, rastro[i].y); ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }
    pops.forEach(function(p){ ctx.globalAlpha = Math.min(1, p.vida * 1.6); ctx.font = '900 ' + (p.g ? 26 : 22) + 'px Barlow, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.strokeText(p.txt, p.x, p.y); ctx.fillStyle = p.cor; ctx.fillText(p.txt, p.x, p.y); });
    ctx.globalAlpha = 1;
    if (flash > 0){ ctx.fillStyle = flashCor; ctx.fillRect(-20, -20, W + 40, H + 40); }
    ctx.restore();
    hudDesenho();
    if (t < 0){
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, W, H);
      var n = Math.ceil(-t); ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '900 ' + Math.round(Math.min(W, H) / 4) + 'px Barlow, Arial, sans-serif'; ctx.fillText(n > 3 ? 3 : n, W / 2, H / 2 + 20);
      ctx.font = '700 ' + Math.max(16, Math.round(R * 0.42)) + 'px Barlow, Arial, sans-serif'; ctx.fillText('Corte os RISCOS · poupe as PROTEÇÕES', W / 2, H / 2 + 70);
    }
    if (pausado){ ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '900 40px Barlow, Arial, sans-serif'; ctx.fillText('PAUSADO', W / 2, H / 2); }
    if (vidas <= 0 || t >= tempoTotal + (objs.length ? 3 : 0) || (t >= tempoTotal && !objs.length)) terminar(vidas <= 0 ? 'vidas' : 'tempo');
  }
  function terminar(motivo){
    if (!vivo) return; vivo = false; cancelAnimationFrame(raf);
    document.removeEventListener('visibilitychange', vis); window.removeEventListener('resize', rs);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H); ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '900 ' + Math.round(Math.min(W, H) / 9) + 'px Barlow, Arial, sans-serif';
    ctx.fillText(motivo === 'vidas' ? 'FIM DE JOGO' : 'TEMPO!', W / 2, H / 2); ctx.font = '800 28px Barlow, Arial, sans-serif'; ctx.fillStyle = '#fde047'; ctx.fillText('⭐ ' + pts + ' pontos', W / 2, H / 2 + 48);
    motivo === 'vidas' ? SND.bad() : SND.win();
    setTimeout(function(){ box.innerHTML = ''; fim({ pts:pts, cortados:cortados, protAtingidas:protAtingidas, perdidos:perdidos, combos:combos, melhorCombo:melhorCombo, motivo:motivo, log:log }); }, 900);
  }
  raf = requestAnimationFrame(quadro);
}
function resumoNinja(r){
  var itens = Object.keys(r.log).map(function(k){ return r.log[k]; });
  var erros = itens.filter(function(l){ return l.x || l.p; }), bons = itens.filter(function(l){ return !l.prot && l.c && !l.p; });
  var h = '<div class="nj-res"><div class="grid4"><div><b>' + r.cortados + '</b><small>riscos cortados</small></div><div><b>' + r.perdidos + '</b><small>riscos que passaram</small></div><div><b>' + r.protAtingidas + '</b><small>proteções atingidas</small></div><div><b>' + (r.melhorCombo >= 3 ? 'x' + r.melhorCombo : '—') + '</b><small>melhor combo</small></div></div>';
  if (erros.length){ h += '<h3>📌 Para revisar</h3>'; erros.forEach(function(l){ h += '<div class="rz"><div class="n" style="background:' + (l.prot ? 'var(--ok)' : 'var(--bad)') + '">' + (l.prot ? '🛡️' : '⚠️') + '</div><div><div class="tt">' + l.n + ' <span class="tag ' + (l.prot ? 'k' : 'b') + '">' + (l.prot ? 'PROTEÇÃO' : 'RISCO') + '</span></div><div class="ex">' + l.e + '</div></div></div>'; }); }
  if (bons.length){ h += '<h3>✅ Riscos que você eliminou</h3><p class="muted" style="margin:0 0 6px">' + bons.map(function(l){ return l.n; }).join(' · ') + '</p>'; }
  return h + '</div>';
}
ETAPAS.ninja = function(et, done){
  var meta = et.meta || 400;
  stage.innerHTML = '<div id="njBox"></div><div id="njFim"></div>';
  rodarNinja(document.getElementById('njBox'), { tempo:et.tempo || 60, vidas:3, riscos:et.riscos, protecoes:et.protecoes }, function(r){
    hud(r.pts);
    var el = document.getElementById('njFim'); if (!el) return;
    el.innerHTML = '<div class="card resumo"><h2>' + (r.motivo === 'vidas' ? '💔 Acabaram as vidas' : '⏰ Tempo esgotado!') + '</h2><p class="muted" style="margin-top:-6px">Pontos da etapa: <b>' + fmt(r.pts) + '</b> (meta: ' + meta + ')</p>' + resumoNinja(r) + '<button class="btn ok big" id="njOk" style="margin-top:10px">Próxima etapa ▶</button></div>';
    document.getElementById('njOk').onclick = function(){ done(r.pts, meta, Math.max(0, r.pts - meta)); };
    el.scrollIntoView({ behavior:'smooth' });
  });
};

/* ============================================================
   DESCARTE EM MOVIMENTO — arraste cada resíduo para a lixeira certa
   ============================================================ */
var MOV_CURTO = { agulha:'Seringa com agulha', scalp:'Scalp / cateter', bisturi:'Lâmina de bisturi', sutura:'Agulha de sutura', lanceta:'Lanceta (HGT)', ampola:'Ampola vazia', ampolaQ:'Ampola quebrada', frascoQ:'Frasco quebrado', vencido:'Comprimido vencido', extraviado:'Remédio extraviado', gaze:'Gaze com sangue', luva:'Luva com sangue', equipo:'Equipo com sangue', toalha:'Papel toalha', resto:'Resto de lanche', guardanapo:'Guardanapo sujo', papelao:'Caixa de papelão', rascunho:'Rascunho sem dados', bula:'Bula / cartucho', copo:'Copo plástico', embalagem:'Embalagem plástica', pet:'Garrafa PET', bolha:'Plástico bolha', pulseira:'Pulseira do paciente', receita:'Receita do paciente', relatorio:'Relatório de pacientes', etiqueta:'Etiqueta de soro', guia:'Guia do convênio' };
var MOV_LIX = ['perfuro','laranja','infect','comum','papel','plast','dados'];
var MOV_LCURTO = { perfuro:'Perfuro', laranja:'Laranja', infect:'Infectante', comum:'Comum', papel:'Papel', plast:'Plástico', dados:'Dados' };
var MOV_IMG = null;
function svgImg(svg){ var im = new Image(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')); return im; }
function movCarregar(){
  if (MOV_IMG) return MOV_IMG;
  MOV_IMG = { it:{}, lx:{} };
  Object.keys(ITENS).forEach(function(k){ var s = svgItem(ITENS[k].svg || k); MOV_IMG.it[k] = s ? svgImg(s.replace('<svg ', '<svg width="160" height="128" ')) : null; });
  MOV_LIX.forEach(function(k){ MOV_IMG.lx[k] = svgImg(iconeLix(k).replace('<svg ', '<svg width="120" height="128" ')); });
  return MOV_IMG;
}
function rodarMov(box, op, fim){
  var IMG = movCarregar(), tempoTotal = op.tempo || 60, vidas = op.vidas || 3, LXS = op.lixeiras || MOV_LIX;
  var chaves = (op.itens || Object.keys(ITENS)).filter(function(k){ return ITENS[k] && LXS.indexOf(ITENS[k].l) >= 0; });
  box.innerHTML = '<div class="nj mov"><canvas></canvas><button class="nj-pausa" title="Pausar">⏸</button><div class="nj-msg"></div></div>';
  var wrap = box.querySelector('.nj'), cv = box.querySelector('canvas'), ctx = cv.getContext('2d'), msg = box.querySelector('.nj-msg'), btP = box.querySelector('.nj-pausa');
  var W = 0, H = 0, R = 34, BH = 90, BW = 0, objs = [], parts = [], pops = [], brilho = {}, vivo = true, pausado = false, raf = 0, preso = null;
  var pts = 0, certos = 0, errados = 0, seq = 0, melhorSeq = 0, log = [], t = -3.2, prox = 0, ult = 0, tremer = 0, flash = 0, ultimaK = '';
  function medir(){
    var w = wrap.clientWidth, h = w < 640 ? Math.min(Math.max(innerHeight - 190, 460), w * 1.6) : Math.min(w * 0.6, 640), dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = w; H = h; cv.style.height = h + 'px'; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    R = Math.max(26, Math.min(44, Math.min(W, H) / 11)); BH = Math.max(86, Math.min(128, H * 0.19)); BW = W / LXS.length;
  }
  medir();
  function rnd(a, b){ return a + Math.random() * (b - a); }
  function topoLix(){ return H - BH; }
  function lixEm(x){ return LXS[Math.max(0, Math.min(LXS.length - 1, Math.floor(x / BW)))]; }
  function lancar(){
    var dif = Math.min(1, Math.max(0, t) / tempoTotal), k;
    do { k = chaves[Math.floor(Math.random() * chaves.length)]; } while (k === ultimaK && chaves.length > 1);
    ultimaK = k;
    objs.push({ k:k, it:ITENS[k], x:rnd(R + 8, W - R - 8), y:-R, vy:H * rnd(0.11, 0.15) * (1 + dif * 1.3), sw:rnd(0, 6.28) });
    prox = t + Math.max(0.85, 2.1 - dif * 1.3) * rnd(0.85, 1.15);
  }
  function popup(txt, x, y, cor, g){ pops.push({ txt:txt, x:x, y:y, cor:cor, vida:1.1, g:g }); }
  function aviso(html, cls){ msg.innerHTML = html; msg.className = 'nj-msg on ' + (cls || ''); clearTimeout(aviso.tm); aviso.tm = setTimeout(function(){ msg.className = 'nj-msg'; }, 2300); }
  function avaliar(o, k){
    o.fim = true;
    var ok = k === o.it.l, i = LXS.indexOf(k), cx = (i + 0.5) * BW;
    brilho[k] = { ok:ok, v:0.6 };
    for (var n = 0; n < 14; n++) parts.push({ x:cx, y:topoLix(), vx:rnd(-180, 180), vy:rnd(-340, -80), vida:rnd(0.4, 0.8), cor:ok ? ['#22c55e','#fde047','#fff'][n % 3] : '#E1251B', r:rnd(2, 5) });
    log.push({ k:o.k, ok:ok, foi:k });
    if (ok){
      certos++; seq++; melhorSeq = Math.max(melhorSeq, seq);
      var b = seq >= 3 ? Math.min(10, 2 * (seq - 2)) : 0; pts += 10 + b; SND.ok();
      popup('+' + (10 + b) + (seq >= 3 ? '  🔥x' + seq : ''), cx, topoLix() - 16, '#fde047', seq >= 3);
    } else {
      errados++; seq = 0; vidas--; tremer = 0.3; flash = 0.3; SND.bad();
      popup('✖', cx, topoLix() - 16, '#E1251B', true);
      aviso('❌ <b>' + (MOV_CURTO[o.k] || o.it.n) + '</b> não vai em <b>' + LIX[k].n + '</b>. Lugar certo: <b>' + LIX[o.it.l].n + '</b>. ' + o.it.e, 'bad');
    }
  }
  function ponto(ev){ var r = cv.getBoundingClientRect(); return { x:ev.clientX - r.left, y:ev.clientY - r.top }; }
  function down(ev){
    if (!vivo || pausado || t < 0) return; ev.preventDefault();
    var p = ponto(ev), alvo = null, d = 1e9;
    objs.forEach(function(o){ if (o.fim) return; var dd = Math.hypot(o.x - p.x, o.y - p.y); if (dd < R * 1.35 && dd < d){ d = dd; alvo = o; } });
    if (alvo){ preso = alvo; alvo.preso = true; alvo.dx = alvo.x - p.x; alvo.dy = alvo.y - p.y; try { cv.setPointerCapture(ev.pointerId); } catch (e) {} SND.click(); }
  }
  function move(ev){
    if (!preso) return; ev.preventDefault();
    var p = ponto(ev); preso.x = Math.max(R * 0.6, Math.min(W - R * 0.6, p.x + preso.dx)); preso.y = Math.max(R * 0.6, Math.min(H - R * 0.4, p.y + preso.dy));
  }
  function up(){
    if (!preso) return;
    var o = preso; preso = null; o.preso = false;
    if (o.y + R * 0.2 >= topoLix()) avaliar(o, lixEm(o.x));
    else o.vy = Math.max(o.vy * 0.6, H * 0.1);
  }
  cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  function pausa(v){ pausado = v; btP.textContent = v ? '▶' : '⏸'; if (v) aviso('⏸ Pausado — toque em ▶ para continuar'); }
  btP.onclick = function(){ if (vivo) pausa(!pausado); };
  function vis(){ if (document.hidden && vivo) pausa(true); }
  function rs(){ medir(); }
  document.addEventListener('visibilitychange', vis); window.addEventListener('resize', rs);
  CLEAN.push(function(){ vivo = false; cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', vis); window.removeEventListener('resize', rs); });
  if (DEBUG) window.__MOV = { objs:function(){ return objs; }, rect:function(){ return cv.getBoundingClientRect(); }, BW:function(){ return BW; }, topo:function(){ return topoLix(); }, lix:LXS };

  function desenhaLixeiras(){
    var ty = topoLix(), hov = preso ? lixEm(preso.x) : null;
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(0, ty, W, BH);
    LXS.forEach(function(k, i){
      var x = i * BW, L = LIX[k], br = brilho[k], m = 4;
      ctx.save();
      if (br && br.v > 0 && !br.ok) ctx.translate(rnd(-4, 4), 0);
      ctx.fillStyle = L.cor; ctx.strokeStyle = hov === k ? '#fde047' : 'rgba(0,0,0,.45)'; ctx.lineWidth = hov === k ? 4 : 2;
      ctx.beginPath(); ctx.moveTo(x + m, ty + 10); ctx.lineTo(x + BW - m, ty + 10); ctx.lineTo(x + BW - m - 4, ty + BH - 4); ctx.lineTo(x + m + 4, ty + BH - 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = k === 'dados' ? '#0f172a' : L.cor; ctx.fillRect(x + m - 2, ty + 4, BW - 2 * m + 4, 9); ctx.strokeRect(x + m - 2, ty + 4, BW - 2 * m + 4, 9);
      var im = IMG.lx[k], isz = Math.min(BW * 0.62, BH * 0.46); if (im.complete && im.naturalWidth) ctx.drawImage(im, x + BW / 2 - isz / 2, ty + 16, isz, isz * 1.06);
      ctx.textAlign = 'center'; ctx.font = '800 ' + Math.max(10, Math.min(14, BW / 6.2)) + 'px Barlow, Arial, sans-serif';
      ctx.fillStyle = L.tc; ctx.fillText(BW < 70 && k === 'infect' ? 'Infect.' : MOV_LCURTO[k], x + BW / 2, ty + BH - 12);
      if (br && br.v > 0){ ctx.globalAlpha = Math.min(1, br.v * 2); ctx.fillStyle = br.ok ? 'rgba(34,197,94,.45)' : 'rgba(225,37,27,.5)'; ctx.fillRect(x + m, ty + 4, BW - 2 * m, BH - 8); ctx.globalAlpha = 1; }
      if (hov === k){ ctx.fillStyle = 'rgba(253,224,71,.18)'; ctx.fillRect(x + m, ty + 4, BW - 2 * m, BH - 8); }
      ctx.restore();
    });
  }
  function hudDesenho(){
    ctx.textAlign = 'left'; ctx.font = '800 ' + Math.round(Math.max(22, R * 0.7)) + 'px Barlow, Arial, sans-serif';
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.strokeText('⭐ ' + pts, 14, 38); ctx.fillStyle = '#fde047'; ctx.fillText('⭐ ' + pts, 14, 38);
    ctx.textAlign = 'right'; ctx.font = Math.round(Math.max(20, R * 0.62)) + 'px Arial'; var c = ''; for (var i = 0; i < (op.vidas || 3); i++) c += i < vidas ? '❤️' : '🖤'; ctx.fillText(c, W - 56, 36);
    var rest = Math.max(0, tempoTotal - Math.max(0, t)), estreito = W < 560, bw = estreito ? W - 90 : Math.min(260, W * 0.4), bx = estreito ? 14 : W / 2 - bw / 2, by = estreito ? 56 : 16;
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(bx, by, bw, 10); ctx.fillStyle = rest < 10 ? '#E1251B' : '#22c55e'; ctx.fillRect(bx, by, bw * rest / tempoTotal, 10);
    ctx.font = '700 14px Barlow, Arial, sans-serif'; ctx.fillStyle = '#fff';
    if (estreito) { ctx.textAlign = 'left'; ctx.fillText(Math.ceil(rest) + 's', bx + bw + 10, by + 10); } else { ctx.textAlign = 'center'; ctx.fillText(Math.ceil(rest) + 's', W / 2, 44); }
    if (seq >= 3){ ctx.textAlign = 'left'; ctx.font = '800 16px Barlow, Arial, sans-serif'; ctx.fillStyle = '#fb923c'; ctx.fillText('🔥 Sequência x' + seq, 14, estreito ? 90 : 62); }
  }
  function quadro(agora){
    if (!vivo) return;
    raf = requestAnimationFrame(quadro);
    var dt = Math.min(0.033, (agora - (ult || agora)) / 1000); ult = agora; if (pausado) dt = 0;
    t += dt;
    if (t >= 0 && t >= prox && t < tempoTotal && objs.filter(function(o){ return !o.fim; }).length < 5) lancar();
    objs.forEach(function(o){
      if (o.fim || o.preso) return;
      o.y += o.vy * dt; o.sw += dt * 2; o.x += Math.sin(o.sw) * 12 * dt;
      if (o.y + R * 0.2 >= topoLix()) avaliar(o, lixEm(o.x));
    });
    objs = objs.filter(function(o){ return !o.fim; });
    parts.forEach(function(p){ p.vy += 700 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vida -= dt; }); parts = parts.filter(function(p){ return p.vida > 0; });
    pops.forEach(function(p){ p.y -= 40 * dt; p.vida -= dt; }); pops = pops.filter(function(p){ return p.vida > 0; });
    Object.keys(brilho).forEach(function(k){ brilho[k].v -= dt; });
    tremer = Math.max(0, tremer - dt); flash = Math.max(0, flash - dt);
    ctx.save();
    if (tremer > 0) ctx.translate(rnd(-6, 6) * tremer * 3, rnd(-6, 6) * tremer * 3);
    var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0f5132'); g.addColorStop(1, '#04241a'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.setLineDash([6, 8]); ctx.lineWidth = 1;
    for (var i = 1; i < LXS.length; i++){ ctx.beginPath(); ctx.moveTo(i * BW, 70); ctx.lineTo(i * BW, topoLix()); ctx.stroke(); }
    ctx.setLineDash([]);
    desenhaLixeiras();
    objs.forEach(function(o){
      var s = o.preso ? 1.12 : 1;
      ctx.save(); ctx.translate(o.x, o.y);
      if (o.preso){ ctx.shadowColor = '#fde047'; ctx.shadowBlur = 18; }
      ctx.beginPath(); ctx.arc(0, 0, R * s, 0, 6.29); ctx.fillStyle = '#fff'; ctx.fill(); ctx.shadowBlur = 0;
      ctx.lineWidth = 3; ctx.strokeStyle = o.preso ? '#fde047' : 'rgba(255,255,255,.4)'; ctx.stroke();
      var im = IMG.it[o.k];
      if (im && im.complete && im.naturalWidth) ctx.drawImage(im, -R * 0.9 * s, -R * 0.72 * s, R * 1.8 * s, R * 1.44 * s);
      else { ctx.font = Math.round(R) + 'px Arial'; ctx.textAlign = 'center'; ctx.fillText(o.it.ic, 0, R * 0.35); }
      ctx.restore();
      ctx.font = '800 ' + Math.max(11, Math.round(R * 0.34)) + 'px Barlow, Arial, sans-serif'; ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.8)'; var tx = MOV_CURTO[o.k] || o.it.n, lx = Math.max(60, Math.min(W - 60, o.x));
      ctx.strokeText(tx, lx, o.y + R + 15); ctx.fillStyle = '#fff'; ctx.fillText(tx, lx, o.y + R + 15);
    });
    parts.forEach(function(p){ ctx.globalAlpha = Math.min(1, p.vida * 2); ctx.fillStyle = p.cor; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.29); ctx.fill(); });
    ctx.globalAlpha = 1;
    pops.forEach(function(p){ ctx.globalAlpha = Math.min(1, p.vida * 1.6); ctx.font = '900 ' + (p.g ? 26 : 22) + 'px Barlow, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.strokeText(p.txt, p.x, p.y); ctx.fillStyle = p.cor; ctx.fillText(p.txt, p.x, p.y); });
    ctx.globalAlpha = 1;
    if (flash > 0){ ctx.fillStyle = 'rgba(225,37,27,.25)'; ctx.fillRect(-20, -20, W + 40, H + 40); }
    ctx.restore();
    hudDesenho();
    if (t < 0){
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, W, topoLix());
      var n = Math.ceil(-t); ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '900 ' + Math.round(Math.min(W, H) / 4) + 'px Barlow, Arial, sans-serif'; ctx.fillText(n > 3 ? 3 : n, W / 2, H * 0.42);
      ctx.font = '700 ' + Math.max(16, Math.round(R * 0.5)) + 'px Barlow, Arial, sans-serif'; ctx.fillText('Arraste cada resíduo para a lixeira certa', W / 2, H * 0.42 + 50);
    }
    if (pausado){ ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '900 40px Barlow, Arial, sans-serif'; ctx.fillText('PAUSADO', W / 2, H / 2); }
    if (vidas <= 0 || (t >= tempoTotal && !objs.length) || t >= tempoTotal + 8) terminar(vidas <= 0 ? 'vidas' : 'tempo');
  }
  function terminar(motivo){
    if (!vivo) return; vivo = false; cancelAnimationFrame(raf);
    document.removeEventListener('visibilitychange', vis); window.removeEventListener('resize', rs);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H); ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '900 ' + Math.round(Math.min(W, H) / 9) + 'px Barlow, Arial, sans-serif';
    ctx.fillText(motivo === 'vidas' ? 'FIM DE JOGO' : 'TEMPO!', W / 2, H / 2); ctx.font = '800 28px Barlow, Arial, sans-serif'; ctx.fillStyle = '#fde047'; ctx.fillText('⭐ ' + pts + ' pontos', W / 2, H / 2 + 48);
    motivo === 'vidas' ? SND.bad() : SND.win();
    setTimeout(function(){ box.innerHTML = ''; fim({ pts:pts, certos:certos, errados:errados, melhorSeq:melhorSeq, motivo:motivo, log:log }); }, 900);
  }
  raf = requestAnimationFrame(quadro);
}
function resumoMov(r){
  var erros = r.log.filter(function(l){ return !l.ok; }), vistos = {};
  var h = '<div class="nj-res"><div class="grid4"><div><b>' + r.certos + '</b><small>no lugar certo</small></div><div><b>' + r.errados + '</b><small>no lugar errado</small></div><div><b>' + (r.melhorSeq >= 3 ? 'x' + r.melhorSeq : r.melhorSeq || '—') + '</b><small>melhor sequência</small></div></div>';
  if (erros.length){
    h += '<h3>📌 Para revisar</h3>';
    erros.forEach(function(l){ if (vistos[l.k]) return; vistos[l.k] = 1; var it = ITENS[l.k];
      h += '<div class="rz"><div class="n" style="background:var(--bad)">✖</div><div><div class="tt">' + it.n + '</div><div class="ex">Foi para: <b>' + LIX[l.foi].n + '</b> · Lugar certo: <b style="color:var(--verde2)">' + LIX[it.l].n + '</b><br>' + it.e + '</div></div></div>'; });
  } else if (r.certos) h += '<p style="font-size:17px">🏆 Nenhum erro de descarte. Excelente!</p>';
  return h + '</div>';
}
ETAPAS.mov = function(et, done){
  var meta = et.meta || 300;
  stage.innerHTML = '<div id="njBox"></div><div id="njFim"></div>';
  rodarMov(document.getElementById('njBox'), { tempo:et.tempo || 60, vidas:3, lixeiras:et.lixeiras, itens:et.itens }, function(r){
    hud(r.pts);
    var el = document.getElementById('njFim'); if (!el) return;
    el.innerHTML = '<div class="card resumo"><h2>' + (r.motivo === 'vidas' ? '💔 Acabaram as vidas' : '⏰ Tempo esgotado!') + '</h2><p class="muted" style="margin-top:-6px">Pontos da etapa: <b>' + fmt(r.pts) + '</b> (meta: ' + meta + ')</p>' + resumoMov(r) + '<button class="btn ok big" id="njOk" style="margin-top:10px">Próxima etapa ▶</button></div>';
    document.getElementById('njOk').onclick = function(){ done(r.pts, meta, Math.max(0, r.pts - meta)); };
    el.scrollIntoView({ behavior:'smooth' });
  });
};

/* ---------- FIM DA FASE ---------- */
function finalizarFase(){
  clearAll();
  var p = atual(), f = RUN.f, pct = RUN.max ? Math.min(1, Math.max(0, RUN.pts - RUN.bonus) / RUN.max) : 0, st = pct >= 0.9 ? 3 : pct >= 0.7 ? 2 : pct >= 0.4 ? 1 : 0;
  var antes = concluidas(p), r = p.fases[f.id] || { best:0, stars:0, tentativas:0 };
  var recorde = RUN.pts > r.best;
  r.best = Math.max(r.best, Math.round(RUN.pts)); r.stars = Math.max(r.stars, st); r.tentativas = (r.tentativas || 0) + 1; r.ultima = hoje();
  p.fases[f.id] = r; p.ultima = hoje();
  var fechou = antes < FASES.length && concluidas(p) === FASES.length;
  if (fechou && !p.concluido) p.concluido = hoje();
  save();
  if (fechou) { var res = f.ic + ' ' + f.nome + ': ' + fmt(RUN.pts) + ' pontos.'; RUN = null; telaCertificado(p.id, true, res); return; }
  var prox = RUN.idx + 1 < FASES.length && liberada(p, RUN.idx + 1) ? RUN.idx + 1 : null;
  var msgs = ['Não desanime! Revise as explicações e tente de novo.', 'Bom começo! Dá para melhorar.', 'Muito bem! Você está atento aos riscos.', 'Excelente! Você é exemplo de segurança!'];
  var h = '<div class="card res"><div class="stars">' + stars(st) + '</div><h1>' + (st >= 1 ? 'Fase concluída!' : 'Fase não concluída') + '</h1><p class="muted">' + f.ic + ' ' + f.nome + '</p>' +
    '<div class="pp">' + fmt(RUN.pts) + '</div><div class="muted">pontos · aproveitamento de ' + Math.round(pct*100) + '%' + (RUN.bonus ? ' + ' + fmt(RUN.bonus) + ' de bônus de tempo' : '') + (recorde ? ' · <b style="color:var(--ok)">Novo recorde! 🎉</b>' : ' · Recorde: ' + fmt(r.best)) + '</div>' +
    '<p style="font-size:18px">' + msgs[st] + '</p>' + (st < 1 ? '<p class="muted">Faça pelo menos 40% de aproveitamento para ganhar ★ e liberar a próxima fase.</p>' : '') +
    '<div class="row" style="justify-content:center;margin-top:10px">' + (prox !== null ? '<button class="btn ok" data-act="fase" data-i="' + prox + '">▶ Próxima fase: ' + FASES[prox].nome + '</button>' : '') +
    '<button class="btn ghost" data-act="fase" data-i="' + RUN.idx + '">🔁 Jogar de novo</button><button class="btn" data-act="mapa">🗺️ Mapa de fases</button></div>' +
    (concluidas(p) === FASES.length ? '<p style="margin-top:16px"><button class="btn gold" data-act="certificado" data-id="' + esc(p.id) + '">🎓 Ver meu certificado</button></p>' : '') +
    '<p class="muted" style="margin-top:14px">Total acumulado: <b>' + fmt(total(p)) + '</b> pontos · ' + nivel(total(p)).n.ic + ' ' + nivel(total(p)).n.nome + '</p></div>';
  app.innerHTML = h; scrollTo(0,0);
  if (st >= 1) { SND.win(); confete(); }
  RUN = null;
}

/* ---------- RANKING ---------- */
function telaRanking(filtro){
  clearAll();
  filtro = filtro || '';
  var lista = Object.keys(DB.players).map(function(k){ return DB.players[k]; }).filter(function(p){ return !filtro || p.setor === filtro || p.turno === filtro; })
    .sort(function(a, b){ return total(b) - total(a) || estrelasTot(b) - estrelasTot(a) || a.nome.localeCompare(b.nome); });
  var opts = SETORES.concat(TURNOS);
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
  var partidas = 0, ativos7 = 0, lim = Date.now() - 7 * 864e5;
  lista.forEach(function(p){ FASES.forEach(function(f){ var r = p.fases[f.id]; if (r) partidas += r.tentativas || 0; }); if (p.ultima && new Date(p.ultima).getTime() >= lim) ativos7++; });
  var h = sstTabs('painel') + '<div class="kpis">' +
    '<div><small>Inscritos</small><b>' + tot + '</b><span>' + ativos7 + ' ativo(s) nos últimos 7 dias</span></div>' +
    '<div><small>Concluíram as ' + FASES.length + ' fases</small><b>' + conc + '</b><div class="prog"><i style="width:' + (tot ? conc / tot * 100 : 0) + '%"></i></div><span>' + (tot ? Math.round(conc / tot * 100) : 0) + '% de conclusão</span></div>' +
    '<div><small>Média de pontos</small><b>' + (tot ? fmt(lista.reduce(function(s, p){ return s + total(p); }, 0) / tot) : 0) + '</b><span>por colaborador</span></div>' +
    '<div><small>Partidas jogadas</small><b>' + fmt(partidas) + '</b><span>somando todas as fases</span></div></div>' +
    indicadores(lista) +
    '<div class="card"><h2>📋 Colaboradores e gestão</h2>' +
    '<div class="row" style="margin-bottom:12px"><button class="btn ok" data-act="csv">⬇️ Exportar planilha (CSV)</button><button class="btn" data-act="backup">💾 Salvar backup</button><label class="btn ghost" style="cursor:pointer">📂 Importar backup<input type="file" id="impBk" accept=".json,application/json" hidden></label><button class="btn ghost" data-act="trocarPin">🔑 Trocar PIN</button><button class="btn bad" data-act="zerar">🗑️ Apagar tudo</button></div>' +
    '<p class="muted" style="font-size:14px;margin-top:0">Os dados ficam somente neste aparelho. Para juntar resultados de vários tablets/computadores, salve o backup em cada um e importe aqui (o maior recorde de cada fase é mantido).</p>' +
    '<label class="f" style="max-width:520px">Nome da instituição (aparece no certificado)<input id="inst" maxlength="80" placeholder="Hospital Beneficência Portuguesa · São José do Rio Preto" value="' + esc(DB.inst || '') + '"></label>';
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
  document.getElementById('inst').onchange = function(){ DB.inst = this.value.trim(); save(); toast('Instituição salva.'); };
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
  var cab = ['Nome','Matrícula','Setor','Turno','Função'].concat(FASES.map(function(f, i){ return 'F' + (i+1) + ' ' + f.nome + ' (pontos)'; }), FASES.map(function(f, i){ return 'F' + (i+1) + ' estrelas'; }), ['Fases concluídas','Total de pontos','Nível','Inscrição','Última atividade','Concluído em','Código do certificado']);
  var linhas = [cab.map(q).join(';')];
  lista.sort(function(a, b){ return total(b) - total(a); }).forEach(function(p){
    linhas.push([p.nome, p.matricula, p.setor, p.turno, p.funcao].concat(
      FASES.map(function(f){ var r = p.fases[f.id]; return r ? r.best : ''; }),
      FASES.map(function(f){ var r = p.fases[f.id]; return r ? r.stars : ''; }),
      [concluidas(p), total(p), nivel(total(p)).n.nome, dataBR(p.criado), dataBR(p.ultima), p.concluido ? dataBR(p.concluido) : '', p.concluido ? codigoCert(p) : '']).map(q).join(';'));
  });
  baixar('hospital-seguro-participacao-' + new Date().toISOString().slice(0,10) + '.csv', '﻿' + linhas.join('\r\n'), 'text/csv;charset=utf-8');
}
/* ---------- CERTIFICADO (gerado como imagem, com o nome da inscrição) ---------- */
function codigoCert(p){
  var s = String(p.matricula) + '|' + p.nome + '|' + (p.concluido || ''), h = 2166136261;
  for (var i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  var c = (h >>> 0).toString(36).toUpperCase(); while (c.length < 7) c = '0' + c;
  return 'HS-' + c.slice(0, 4) + '-' + c.slice(4);
}
function dataExtenso(iso){ var d = new Date(iso || Date.now()); if (isNaN(d)) d = new Date(); return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' }); }
function slug(t){ return String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function desenharCert(p){
  var W = 1754, H = 1240, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  var x = cv.getContext('2d'), F1 = '"Barlow", "Segoe UI", Arial, sans-serif', F2 = 'Georgia, "Times New Roman", serif';
  var VERDE = '#00983A', VERDE2 = '#007A2F', VERM = '#E1251B', CINZA = '#444444';
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
  x.strokeStyle = VERDE; x.lineWidth = 16; x.strokeRect(34, 34, W - 68, H - 68);
  x.lineWidth = 3; x.strokeRect(62, 62, W - 124, H - 124);
  x.fillStyle = VERM; x.fillRect(62, 62, (W - 124) / 2, 14); x.fillStyle = VERDE; x.fillRect(W / 2, 62, (W - 124) / 2, 14);
  var logo = document.getElementById('logoImg');
  if (logo && logo.naturalWidth){ var lh = 150, lw = lh * logo.naturalWidth / logo.naturalHeight; x.drawImage(logo, (W - lw) / 2, 112, lw, lh); }
  x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  function t(s, y, font, cor){ x.font = font; x.fillStyle = cor; x.fillText(s, W / 2, y); }
  t((DB.inst ? DB.inst.toUpperCase() + '  ·  ' : '') + 'S E G U R A N Ç A   E   S A Ú D E   D O   T R A B A L H O', 318, '600 24px ' + F1, '#6b7280');
  t('CERTIFICADO', 432, '800 118px ' + F1, VERDE2);
  t('DE CONCLUSÃO · HOSPITAL SEGURO', 480, '700 30px ' + F1, VERM);
  t('Certificamos que', 552, 'italic 34px ' + F2, CINZA);
  var tam = 84; x.font = '700 ' + tam + 'px ' + F2; while (x.measureText(p.nome).width > W - 360 && tam > 40){ tam -= 4; x.font = '700 ' + tam + 'px ' + F2; }
  t(p.nome, 644, '700 ' + tam + 'px ' + F2, '#1f2937');
  var nw = Math.min(W - 300, Math.max(620, x.measureText(p.nome).width + 120)); x.fillStyle = CINZA; x.fillRect((W - nw) / 2, 666, nw, 3);
  t('Matrícula ' + p.matricula + (p.setor ? '  ·  ' + p.setor : '') + (p.funcao ? '  ·  ' + p.funcao : ''), 716, '30px ' + F2, CINZA);
  var txtc = 'concluiu as ' + FASES.length + ' fases do programa Hospital Seguro — Jogos de Segurança do Trabalho em Serviços de Saúde, abordando UTI e internação, centro cirúrgico, farmácia, almoxarifado e administrativo: descarte de perfurocortantes, ampolas, medicamentos e dados sensíveis, kit de derramamento nível I e procedimentos seguros (NR-32).';
  x.font = '30px ' + F2; x.fillStyle = '#1f2937';
  var pal = txtc.split(' '), linha = '', y = 776, maxW = W - 340;
  pal.forEach(function(w){ var tst = linha ? linha + ' ' + w : w; if (x.measureText(tst).width > maxW){ x.fillText(linha, W / 2, y); y += 46; linha = w; } else linha = tst; });
  if (linha) { x.fillText(linha, W / 2, y); y += 46; }
  t('Pontuação: ' + fmt(total(p)) + ' pontos  ·  Nível ' + nivel(total(p)).n.nome + '  ·  ' + estrelasTot(p) + ' de ' + (FASES.length * 3) + ' estrelas', y + 24, '700 28px ' + F1, VERDE2);
  t('São José do Rio Preto, ' + dataExtenso(p.concluido) + '.', y + 84, '30px ' + F2, CINZA);
  x.fillStyle = '#e5e7eb'; x.fillRect(W / 2 - 300, H - 186, 600, 2);
  t('Programa criado por Luan Tavarez — Técnico em Segurança do Trabalho', H - 140, '600 26px ' + F1, CINZA);
  t('Código de verificação: ' + codigoCert(p), H - 96, '600 22px ' + F1, '#9ca3af');
  return cv;
}
/* PDF de uma página (A4 paisagem) com a imagem do certificado — sem bibliotecas, funciona offline */
function pdfDoCanvas(cv){
  var jpg = atob(cv.toDataURL('image/jpeg', 0.92).split(',')[1]), img = new Uint8Array(jpg.length);
  for (var i = 0; i < jpg.length; i++) img[i] = jpg.charCodeAt(i);
  var PW = 841.89, PH = 595.28, partes = [], tam = 0, offs = [];
  function add(d){ var u = typeof d === 'string' ? new Uint8Array(d.split('').map(function(c){ return c.charCodeAt(0) & 255; })) : d; partes.push(u); tam += u.length; }
  function obj(n, corpo){ offs[n] = tam; add(n + ' 0 obj\n'); corpo.forEach(add); add('\nendobj\n'); }
  var cont = 'q ' + PW + ' 0 0 ' + PH + ' 0 0 cm /Im0 Do Q';
  add('%PDF-1.4\n'); add(new Uint8Array([37, 226, 227, 207, 211, 10]));
  obj(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
  obj(2, ['<< /Type /Pages /Kids [3 0 R] /Count 1 >>']);
  obj(3, ['<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>']);
  obj(4, ['<< /Type /XObject /Subtype /Image /Width ' + cv.width + ' /Height ' + cv.height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + img.length + ' >>\nstream\n', img, '\nendstream']);
  obj(5, ['<< /Length ' + cont.length + ' >>\nstream\n' + cont + '\nendstream']);
  obj(6, ['<< /Title (Certificado - Hospital Seguro) /Author (Luan Tavarez - Tecnico em Seguranca do Trabalho) /Creator (Hospital Seguro) >>']);
  var xref = tam, x = 'xref\n0 7\n0000000000 65535 f \n';
  for (var n = 1; n <= 6; n++) x += ('0000000000' + offs[n]).slice(-10) + ' 00000 n \n';
  add(x + 'trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
  return new Blob(partes, { type:'application/pdf' });
}
function telaCertificado(id, novo, resumo){
  clearAll();
  var p = DB.players[id]; if (!p) { telaInicio(); return; }
  if (concluidas(p) < FASES.length) { toast('O certificado é liberado ao concluir as ' + FASES.length + ' fases.'); telaMapa(); return; }
  if (!p.concluido) { p.concluido = p.ultima || hoje(); save(); }
  var volta = SST_OK ? 'painel' : 'mapa', pode = !!(navigator.share && navigator.canShare);
  var h = novo ? '<div class="card parabens"><div class="big">🎓</div><h1>Parabéns, ' + esc(p.nome.split(' ')[0]) + '!</h1><p>Você concluiu todas as fases do <b>Hospital Seguro</b>.' + (resumo ? ' ' + resumo : '') + ' Seu certificado já está pronto:</p></div>'
               : '<div class="card"><h2 style="margin:0">🎓 Certificado de ' + esc(p.nome) + '</h2></div>';
  h += '<div class="certwrap"><img id="certImg" alt="Certificado de conclusão de ' + esc(p.nome) + '" hidden><div class="muted" id="certLoad" style="padding:40px;text-align:center">Gerando certificado…</div></div>';
  h += '<div class="row" style="justify-content:center;margin:14px 0"><button class="btn ok" id="cBaixar" disabled>📄 Baixar certificado em PDF</button>' + (pode ? '<button class="btn red" id="cShare" disabled>📤 Compartilhar PDF</button>' : '') + '<button class="btn" id="cPrint" disabled>🖨️ Imprimir</button><button class="btn ghost" data-act="' + volta + '">↩ Voltar</button></div>';
  h += '<p class="muted" style="text-align:center;font-size:14px;margin:0 0 20px">O certificado sai com o nome usado na inscrição: <b>' + esc(p.nome) + '</b> (matrícula ' + esc(p.matricula) + ').<br>Código de verificação <b>' + codigoCert(p) + '</b> — fica registrado no Painel SST.</p>';
  app.innerHTML = h; scrollTo(0,0);
  if (novo) { SND.win(); confete(); }
  var fontes = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('800 118px "Barlow"'), document.fonts.load('700 30px "Barlow"')]).catch(function(){}) : Promise.resolve();
  var tempo = new Promise(function(r){ setTimeout(r, 1500); });
  Promise.race([fontes, tempo]).then(function(){
    var img = document.getElementById('certImg'); if (!img) return;
    var cv = desenharCert(p), url = cv.toDataURL('image/png'), nomeArq = 'certificado-hospital-seguro-' + (slug(p.nome) || p.matricula) + '.pdf', pdf = null;
    function obterPdf(){ return pdf || (pdf = pdfDoCanvas(cv)); }
    img.src = url; img.hidden = false; document.getElementById('certLoad').remove();
    ['cBaixar','cShare','cPrint'].forEach(function(k){ var b = document.getElementById(k); if (b) b.disabled = false; });
    document.getElementById('cBaixar').onclick = function(){ baixar(nomeArq, obterPdf(), 'application/pdf'); toast('Certificado em PDF baixado!'); };
    document.getElementById('cPrint').onclick = function(){ document.getElementById('cert').innerHTML = '<img src="' + url + '" alt="">'; setTimeout(function(){ window.print(); }, 150); };
    var sh = document.getElementById('cShare');
    if (sh) sh.onclick = function(){
      var arq = new File([obterPdf()], nomeArq, { type:'application/pdf' });
      if (navigator.canShare({ files:[arq] })) navigator.share({ files:[arq], title:'Certificado Hospital Seguro', text:'Concluí o Hospital Seguro — Jogos de Segurança do Trabalho! 🎓' }).catch(function(){});
      else toast('Este aparelho não permite compartilhar arquivos. Use "Baixar certificado em PDF".');
    };
  });
}

/* ============================================================
   AÇÕES
   ============================================================ */
var ACT = {
  inicio: function(){ if (RUN && !confirm('Sair da fase? O progresso desta tentativa será perdido.')) return; RUN = null; if (SST_OK) { SST_OK = false; toast('Área do administrador bloqueada.'); } telaInicio(); },
  som: function(){ DB.som = !DB.som; save(); updSom(); if (DB.som) SND.ok(); },
  jogar: function(){ atual() ? telaMapa() : telaInscricao(); },
  inscricao: function(){ telaInscricao(false); },
  entrarMat: function(){ telaInscricao(true); },
  trocar: function(){ DB.atual = null; save(); telaInscricao(true); },
  mapa: telaMapa,
  meuPainel: telaMeuPainel,
  ranking: function(){ sstGate(function(){ telaRanking(''); }); },
  painel: function(){ sstGate(telaPainel); },
  sst: function(){ sstGate(telaPainel); },
  sstSair: function(){ SST_OK = false; toast('Área do administrador bloqueada.'); telaInicio(); },
  trocarPin: function(){ if (!SST_OK) return; if (confirm('Criar um novo PIN para a Área do SST?')) { DB.pin = null; save(); SST_OK = false; sstGate(telaPainel); } },
  fase: function(d){ var p = atual(); if (!p) { telaInscricao(); return; } var i = +d.i; if (!liberada(p, i)) return; iniciarFase(i); },
  sair: function(){ if (confirm('Sair da fase? O progresso desta tentativa será perdido.')) { RUN = null; telaMapa(); } },
  csv: function(){ if (SST_OK) exportarCSV(); },
  backup: function(){ if (!SST_OK) return; baixar('hospital-seguro-backup-' + new Date().toISOString().slice(0,10) + '.json', JSON.stringify({ app:'hospital-seguro', versao:1, exportado:hoje(), players:DB.players }, null, 1), 'application/json'); },
  zerar: function(){ if (!SST_OK) return; if (confirm('Apagar TODOS os inscritos e pontuações deste aparelho? Esta ação não pode ser desfeita.') && confirm('Tem certeza? Recomendamos salvar um backup antes.')) { DB = { players:{}, atual:null, som:DB.som, inst:DB.inst, pin:DB.pin }; save(); telaPainel(); } },
  excluir: function(d){ if (!SST_OK) return; var p = DB.players[d.id]; if (p && confirm('Excluir ' + p.nome + ' e toda a sua pontuação?')) { delete DB.players[d.id]; if (DB.atual === d.id) DB.atual = null; save(); telaPainel(); } },
  certificado: function(d){ if (SST_OK || d.id === DB.atual) telaCertificado(d.id, false); }
};
// administração: só com PIN (painel/ranking pedem o PIN; as demais ações exigem a área desbloqueada)
// bloqueio automático após 5 minutos sem uso
var ultimoUso = Date.now();
['click','keydown','touchstart'].forEach(function(t){ document.addEventListener(t, function(){ ultimoUso = Date.now(); }, true); });
setInterval(function(){ if (SST_OK && Date.now() - ultimoUso > 5*60*1000) { SST_OK = false; closeModal(); toast('Área do administrador bloqueada por inatividade.'); telaInicio(); } }, 20000);
document.addEventListener('click', function(ev){
  var b = ev.target.closest('[data-act]'); if (!b) return;
  var a = ACT[b.getAttribute('data-act')]; if (!a) return;
  ev.preventDefault(); a({ id:b.getAttribute('data-id'), i:b.getAttribute('data-i') });
});

if (DEBUG) window.__G = { ACT:ACT, DB:function(){ return DB; }, FASES:FASES, CENAS:CENAS, iniciarFase:iniciarFase, sortear:sortearCena, ITENS:ITENS, EXTRAS:EXTRAS, svgItem:svgItem };
telaInicio();
if (location.hash === '#admin') sstGate(telaPainel);
})();

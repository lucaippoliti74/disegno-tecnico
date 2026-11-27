{
const CT=window.CT,{POS,ESITO,clamp,fmt,dataIt,str,arr,PRESETS,PROFILI,DIC,STELLE,calc,votoR,notaz}=CT;
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const lsGet=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch(e){return null}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}};
const lsDel=k=>{try{localStorage.removeItem(k)}catch(e){}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const toBlob=(c,q)=>new Promise((ok,ko)=>c.toBlob(b=>b?ok(b):ko(new Error('blob')),'image/jpeg',q));
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const beh=()=>reduce?'auto':'smooth';
const RED='#e8263e';
const ERR={not_granted:'Codice di accesso non valido. Controllalo e riprova.',rate_limited:'Limite di utilizzo raggiunto: riprova più tardi.',image_rejected:'Immagine non accettata: prova con un’altra foto.',refused:'Il modello non ha valutato la tavola.',invalid_json:'La risposta non era una scheda leggibile: riprova.',prompt_too_large:'Richiesta troppo grande: riduci le immagini o le note.',upstream_error:'Il servizio di valutazione non è raggiungibile. Riprova.'};
const PROF0=()=>({tipo:'classe',es:'classe',scritte:false,calcolo:false,cad:false,noTetto:false,consegna:'',altro:'',pesi:null,pp:''});
const S={set:{gv:2,preset:'tracciamenti',compl:'media',tier:'complex',zoom:true,cont:true,uni:true,open:true,consegna:'',pesi:{},note:{}},prof:PROF0(),
 mode:'vuoto',src:null,srcData:null,disp:null,vs:1,q:null,rot:0,warp:null,proc:null,out:null,photoId:0,drag:null,raf:0,lastW:0,ref:null,
 res:null,saveK:'',reg:[],regList:[],regMode:'attesa',regOpen:new Set(),
 sample:null,lim:null,sampleMsg:'',ctl:null,tick:0,t0:0,tpdf:null,rpdf:null,lastSrc:'cam'};
const store={
 newId(){return crypto.randomUUID()},
 write(rows){if(!lsSet('ct.reg',rows))throw {code:'quota_exceeded'};loadLocalReg()},
 put(id,rec){this.write([{...rec,id},...localRows().filter(r=>r.id!==id)])},
 del(id){this.write(localRows().filter(r=>r.id!==id))}
};

/* ---------- impostazioni */
function crit(p=S.set.preset){const w=S.set.pesi[p]||{};return PRESETS[p].criteri.map(c=>({...c,peso:isFinite(w[c.id])?w[c.id]:c.peso}))}
function applySet(d){if(!d||typeof d!=='object')return;const s=S.set;
 if(PRESETS[d.preset])s.preset=d.preset;if(['bassa','media','alta'].includes(d.compl))s.compl=d.compl;if(['complex','default'].includes(d.tier))s.tier=d.tier;
 for(const k of['zoom','cont','uni','open'])if(typeof d[k]==='boolean')s[k]=d[k];
 if(typeof d.consegna==='string')s.consegna=d.consegna.slice(0,400);
 if(d.gv===2&&d.pesi&&typeof d.pesi==='object'){s.pesi={};for(const k of Object.keys(PRESETS)){const w=d.pesi[k];if(!w||typeof w!=='object')continue;s.pesi[k]={};for(const c of PRESETS[k].criteri){const n=Number(w[c.id]);if(w[c.id]!=null&&isFinite(n))s.pesi[k][c.id]=clamp(n,0,100)}}}
 if(d.note&&typeof d.note==='object'){s.note={};for(const k of Object.keys(PRESETS))if(typeof d.note[k]==='string')s.note[k]=d.note[k].slice(0,1500)}}
function saveSet(){lsSet('ct.set',S.set);$('#anonimo').checked=false}
function renderSettings(){const s=S.set,P=PRESETS[s.preset],ks=Object.keys(PRESETS),opt=k=>`<option value="${k}"${k===s.preset?' selected':''}>${esc(PRESETS[k].nome)}</option>`;
 $('#preset').innerHTML=[[1,'Classi prime'],[2,'Classi seconde']].map(([c,l])=>`<optgroup label="${l}">${ks.filter(k=>PRESETS[k].classe===c).map(opt).join('')}</optgroup>`).join('');
 $('#consegna').value=s.consegna;$('#compl').value=s.compl;$('#tier').value=s.tier;$('#zoom').checked=s.zoom;if($('#exDet').open!==s.open)$('#exDet').open=s.open;
 $('#note').value=s.note[s.preset]||'';$('#note').placeholder=P.nota;$('#tettoNote').textContent=P.tetto?'Con un errore grave di metodo il voto non supera 5,5.':'In questa tipologia nessun errore blocca il voto.';
 renderPesi();renderRef();renderProf();exSum()}
const pesoRow=(c,k)=>`<div class="peso"><label for="${k}-${c.id}">${esc(c.nome)}<span class="small mute">${esc(c.b)}</span></label><span class="wv"><input id="${k}-${c.id}" data-id="${c.id}" type="number" inputmode="numeric" min="0" max="100" step="5" value="${c.peso}"> %</span></div>`;
function renderPesi(){$('#pesi').innerHTML=crit().map(c=>pesoRow(c,'w')).join('');updTot()}
const totTxt=t=>Math.abs(t-100)<.01?'Totale 100%':`Totale ${fmt(t,1)}%: il voto usa i pesi in proporzione`;
function updTot(){const t=crit().reduce((s,c)=>s+c.peso,0);$('#tot').textContent=totTxt(t);$('#tot').classList.toggle('bad',Math.abs(t-100)>=.01)}
function syncPesi(){const r=S.res;if(!r||r.esempio||r.profilo||r.preset!==S.set.preset)return;const cr=crit();for(const c of r.criteri){const m=cr.find(x=>x.id===c.id);if(m)c.peso=m.peso}renderScheda();persist()}
function exSum(){const P=PRESETS[S.set.preset];$('#exSum').textContent=`${P.breve} · complessità ${STELLE[S.set.compl]||S.set.compl}${S.ref?' · con riferimento':''}`;updValuta()}

/* ---------- profilo PDP / PEI: vale per la tavola in corso, «Nuova tavola» torna alla griglia della classe */
const profAttivo=()=>S.prof.tipo!=='classe'&&!PROFILI[S.prof.tipo].noVoto;
function profPesi(){const p=S.prof;if(!p.pesi||p.pp!==S.set.preset){const w={};for(const c of CT.pesiProfilo(crit(),p.es))w[c.id]=c.peso;p.pesi=w;p.pp=S.set.preset}return p.pesi}
function critEff(){if(!profAttivo())return crit();const w=profPesi();return crit().map(c=>({...c,peso:isFinite(w[c.id])?w[c.id]:c.peso}))}
const MIS=[['scritte','Scritte non valutate per la forma delle lettere e per l’ortografia'],['calcolo','Errori di calcolo o di trascrizione delle misure senza effetto sul metodo, se il procedimento è corretto'],['cad','Tavola svolta al CAD']];
function renderProf(){const p=S.prof,b=$('#profBox'),P=PRESETS[S.set.preset],sel=$('#prof');
 if(!sel.options.length)sel.innerHTML=Object.entries(PROFILI).map(([k,v])=>`<option value="${k}">${esc(v.nome)}</option>`).join('');
 sel.value=p.tipo;$('#profWrap').classList.toggle('on',p.tipo!=='classe');
 if(p.tipo==='classe'){b.hidden=true;b.innerHTML='';updValuta();return}
 b.hidden=false;
 if(PROFILI[p.tipo].noVoto){b.innerHTML='<p class="warn">Con il percorso differenziato il voto si riferisce agli obiettivi del PEI, con la griglia personale concordata con il docente di sostegno: l’app non propone un voto.</p>';updValuta();return}
 const mis=[...MIS,...(P.tetto?[['noTetto','Nessun tetto di 5,5 per gli errori gravi']]:[])];
 b.innerHTML=`<p class="small mute" style="margin-top:10px">Imposta solo le misure scritte nel piano. Al servizio di valutazione arrivano queste indicazioni di correzione, mai il piano o una diagnosi. Con «Nuova tavola» l’app torna alla griglia della classe.</p>
 <div class="fld"><label for="pEs">Qualità esecutiva</label><select id="pEs"><option value="classe">Come per la classe</option><option value="ridotta">Peso ridotto</option><option value="dispensata">Dispensata</option></select><span class="small mute">Il peso tolto alla qualità esecutiva passa al metodo.</span></div>
 <fieldset class="pesi"><legend>Pesi per questa tavola</legend><div id="pPesi">${critEff().map(c=>pesoRow(c,'pw')).join('')}</div><div class="tot"><span id="pTot"></span></div></fieldset>
 ${mis.map(([k,t])=>`<label class="chk"><input type="checkbox" data-m="${k}"${p[k]?' checked':''}> ${esc(t)}</label>`).join('')}
 <div class="fld"><label for="pCons">Consegna per questo studente</label><textarea id="pCons" rows="2" placeholder="Solo se ridotta o equipollente, es. solo vista di fronte e dall’alto">${esc(p.consegna)}</textarea></div>
 <div class="fld"><label for="pAltro">Altre indicazioni per la correzione</label><textarea id="pAltro" rows="2" placeholder="Solo la misura da applicare, mai la diagnosi">${esc(p.altro)}</textarea></div>`;
 $('#pEs').value=p.es;updPTot();updValuta()}
function updPTot(){const el=$('#pTot');if(!el)return;const t=critEff().reduce((s,c)=>s+c.peso,0);el.textContent=totTxt(t);el.classList.toggle('bad',Math.abs(t-100)>=.01)}
function syncProf(){const r=S.res;if(!r||r.esempio||!r.profilo||r.photo!==S.photoId||r.preset!==S.set.preset||!profAttivo())return;const cr=critEff();for(const c of r.criteri){const m=cr.find(x=>x.id===c.id);if(m)c.peso=m.peso}renderScheda();persist()}
function resetProf(){S.prof=PROF0();renderProf()}
function renderRef(){const r=S.ref;$('#refImg').hidden=!r;if(r)$('#refImg').src=r.url;$('#refName').textContent=r?r.name:'Nessun riferimento';$('#refDel').hidden=!r;$('#refPg').hidden=!S.rpdf;$('#refBtn').textContent=r?'Sostituisci':'Carica file'}
function d2b(d){const[h,b]=d.split(','),m=/data:([^;,]+)/.exec(h),bin=atob(b),a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return new Blob([a],{type:m?m[1]:'image/jpeg'})}

/* ---------- foto */
async function loadImg(f){
 const blob=new Blob([await f.arrayBuffer()],{type:f.type});
 const url=URL.createObjectURL(blob),image=new Image();
 try{image.src=url;await image.decode();return image}
 finally{URL.revokeObjectURL(url)}
}
const PDFJS='./vendor/';
const isPdf=f=>!!f&&(f.type==='application/pdf'||/\.pdf$/i.test(f.name||''));
let pdfjsP=null;
function loadPdfjs(){
 if(!pdfjsP)pdfjsP=import(PDFJS+'pdf.min.mjs').then(lib=>{lib.GlobalWorkerOptions.workerSrc=PDFJS+'pdf.worker.min.mjs';return lib}).catch(()=>{pdfjsP=null;throw new Error('pdfjs')});
 return pdfjsP}
async function openPdf(f){const L=await loadPdfjs();return L.getDocument({data:new Uint8Array(await f.arrayBuffer()),isEvalSupported:false,cMapUrl:PDFJS+'cmaps/',cMapPacked:true,standardFontDataUrl:PDFJS+'standard_fonts/'}).promise}
async function renderPage(pdf,n,side){const page=await pdf.getPage(n),v1=page.getViewport({scale:1}),vp=page.getViewport({scale:side/Math.max(v1.width,v1.height)}),c=document.createElement('canvas');c.width=Math.max(1,Math.round(vp.width));c.height=Math.max(1,Math.round(vp.height));
 const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);await page.render({canvasContext:x,viewport:vp}).promise;page.cleanup();return c}
function choosePage(pdf,title,name){return new Promise(res=>{const M=$('#pg'),G=$('#pgGrid'),n=Math.min(pdf.numPages,60);let over=false;
 const key=e=>{if(e.key==='Escape')done(null)},done=p=>{if(over)return;over=true;M.hidden=true;G.innerHTML='';document.removeEventListener('keydown',key);res(p)};
 $('#pgT').textContent=title;$('#pgN').textContent=`${name} · ${pdf.numPages} pagine${pdf.numPages>n?', mostro le prime '+n:''}`;
 G.innerHTML=Array.from({length:n},(_,i)=>`<button type="button" class="pgi" data-p="${i+1}"><span class="pgc"></span>Pagina ${i+1}</button>`).join('');
 G.onclick=e=>{const b=e.target.closest('[data-p]');if(b)done(+b.dataset.p)};$('#pgX').onclick=()=>done(null);M.onclick=e=>{if(e.target===M)done(null)};document.addEventListener('keydown',key);
 M.hidden=false;const first=G.querySelector('button');if(first)first.focus();
 (async()=>{for(let i=1;i<=n&&!over;i++){try{const c=await renderPage(pdf,i,320),slot=!over&&G.querySelector(`[data-p="${i}"] .pgc`);if(slot)slot.replaceChildren(c)}catch(e){}}})()})}
const pdfErr=e=>e&&e.message==='pdfjs'?'Non riesco a caricare il lettore PDF: controlla la connessione o usa un’immagine':'Non riesco ad aprire questo PDF: prova a esportare la pagina in PNG o JPG';
function closePdf(k){if(S[k]){const pdf=S[k].pdf;S[k]=null;void pdf.destroy().catch(()=>{})}}
function imgCanvas(im,side,white){const k=Math.min(1,side/Math.max(im.naturalWidth,im.naturalHeight)),c=document.createElement('canvas');c.width=Math.round(im.naturalWidth*k);c.height=Math.round(im.naturalHeight*k);
 const x=c.getContext('2d',{willReadFrequently:!white});if(white){x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height)}x.drawImage(im,0,0,c.width,c.height);return c}
async function pdfPage(f,k,title,side,msg){let pdf=f?null:S[k]&&S[k].pdf;if(!f&&!pdf)return null;const name=f?str(f.name)||'documento.pdf':S[k].name;
 try{if(!pdf){msg('Apro il PDF…');pdf=await openPdf(f)}let p=1;if(pdf.numPages>1){msg('');p=await choosePage(pdf,title,name);if(!p){if(f)pdf.destroy();return null}}
  msg(`Preparo la pagina ${p}…`);const c=await renderPage(pdf,p,side);if(f){closePdf(k);if(pdf.numPages>1)S[k]={pdf,name};else pdf.destroy()}if(S[k])S[k].page=p;
  return{c,label:pdf.numPages>1?`${name} · pagina ${p}`:name}}
 catch(e){if(f&&pdf&&!(S[k]&&S[k].pdf===pdf))try{pdf.destroy()}catch(_){}throw e}}
function refMsg(m){$('#refBtn').disabled=$('#refPg').disabled=!!m;if(m)$('#refName').textContent=m}
async function onRef(f,again){$('#anonimo').checked=false;if(!f&&!again)return;
 try{let c,label;if(again||isPdf(f)){const r=await pdfPage(again?null:f,'rpdf','Pagina del riferimento',1600,refMsg);if(!r)return;({c,label}=r)}
  else{refMsg('Apro l’immagine…');c=imgCanvas(await loadImg(f),1600,true);label=str(f.name)||'riferimento';closePdf('rpdf')}
  const url=c.toDataURL('image/jpeg',.9);S.ref={blob:d2b(url),url,name:label};$('#anonimo').checked=false;if(!lsSet('ct.ref',{name:label,d:url}))toast('Riferimento caricato, ma non salvato su questo dispositivo')}
 catch(e){toast(again||isPdf(f)?pdfErr(e):'Non riesco a leggere questa immagine')}
 finally{refMsg('');renderRef();exSum()}}
function setSource(c){S.src=c;S.srcData=null;S.disp=null;const w=c.width,h=c.height,m=Math.round(Math.min(w,h)*.08);S.q=[[m,m],[w-m,m],[w-m,h-m],[m,h-m]];S.warp=S.proc=S.out=null;S.rot=0;S.photoId++;$('#anonimo').checked=false;S.mode='angoli';renderSheet()}
async function onPhoto(f,again){if(!f&&!again)return;
 try{if(again||isPdf(f)){const r=await pdfPage(again?null:f,'tpdf','Pagina della tavola',3200,m=>busy(m||false));if(r)setSource(r.c)}
  else{busy('Carico la foto…');const c=imgCanvas(await loadImg(f),3200,false);closePdf('tpdf');setSource(c)}}
 catch(e){toast(again||isPdf(f)?pdfErr(e):'Non riesco ad aprire questa immagine: prova con una foto JPG')}
 finally{busy(false)}}
function resetFoto(){S.src=S.srcData=S.disp=S.q=S.warp=S.proc=S.out=null;S.rot=0;S.photoId++;$('#anonimo').checked=false;S.mode='vuoto';renderSheet()}
function busy(m){$('#busy').hidden=!m;if(m)$('#busyT').textContent=m}
function renderSheet(){const m=S.mode;$('#empty').hidden=m!=='vuoto';$('#vbox').hidden=m!=='angoli';$('#pbox').hidden=m!=='anteprima';
 $('#tools').innerHTML={vuoto:`<button type="button" class="btn pri" data-t="cam">Scatta foto</button><button type="button" class="btn" data-t="gal">Dalla galleria</button><button type="button" class="btn" data-t="file">Da file</button>${S.tpdf?'<button type="button" class="btn" data-t="pagina">Altra pagina del PDF</button>':''}`,
  angoli:`<button type="button" class="btn pri" data-t="ok">Conferma ritaglio</button><button type="button" class="btn" data-t="intera">Foto intera</button><button type="button" class="btn" data-t="ruotaFoto">Ruota foglio</button><button type="button" class="btn" data-t="uni" aria-pressed="${S.set.uni}">Proporzioni 1:√2</button><button type="button" class="btn ghost" data-t="cambia">Cambia tavola</button>`,
  anteprima:`<button type="button" class="btn" data-t="angoli">Modifica angoli</button><button type="button" class="btn" data-t="ruota">Ruota 90°</button><button type="button" class="btn" data-t="cont" aria-pressed="${S.set.cont}">Contrasto</button><button type="button" class="btn ghost" data-t="cambia">Cambia tavola</button>`}[m];
 $('#help').textContent={vuoto:'Inquadra tutta la tavola dall’alto, con luce uniforme e senza l’ombra del telefono, oppure apri un PDF o un’immagine «Da file», anche da Drive o Dropbox. Dal computer puoi anche incollare un’immagine con Ctrl+V, per esempio copiata da Google Foto, o trascinarla qui. Poi porterai i quattro mirini rossi sugli angoli della squadratura: il cartiglio con nome e classe resta fuori e non viene inviato.',
  angoli:'Se la foto è girata, usa «Ruota foglio». Trascina i quattro mirini sugli angoli della squadratura: la lente ti aiuta a centrarli. La parte scura viene tagliata. Con «Proporzioni 1:√2» la tavola torna al formato UNI della squadratura (A4 o A3).',
  anteprima:'Questa è l’immagine che riceverà il servizio di valutazione: controlla che il cartiglio non si veda e che la tavola sia dritta.'+(S.set.zoom?' Le linee tratteggiate dividono i quattro quarti che vengono inviati anche ingranditi.':'')}[m];
 const st={vuoto:'Scatta o scegli la tavola',angoli:'Sistema gli angoli',anteprima:'Controlla l’anteprima'}[m],pg=m!=='vuoto'&&S.tpdf&&S.tpdf.page;$('#stepNote').textContent=pg?`Pagina ${pg} · ${st.charAt(0).toLowerCase()+st.slice(1)}`:st;
 $('#pbox').classList.toggle('q4',S.set.zoom);if(m==='angoli')layoutView();if(m==='anteprima')layoutPrev();updValuta()}
function fitBox(box,iw,ih){const W=$('#stage').clientWidth||320,ar=ih/iw,mh=Math.max(260,innerHeight*.7);let w=W,h=W*ar;if(h>mh){h=mh;w=h/ar}w=Math.round(w);h=Math.round(h);box.style.width=w+'px';box.style.height=h+'px';return[w,h]}
function layoutView(){if(!S.src)return;const[w,h]=fitBox($('#vbox'),S.src.width,S.src.height),d=Math.min(2,devicePixelRatio||1),v=$('#view');v.width=Math.round(w*d);v.height=Math.round(h*d);S.vs=w/S.src.width;
 const c=S.disp||document.createElement('canvas');c.width=v.width;c.height=v.height;const x=c.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(S.src,0,0,c.width,c.height);S.disp=c;drawView();placeH()}
function drawView(){if(!S.disp)return;const v=$('#view'),x=v.getContext('2d'),k=v.width/S.src.width,q=S.q,path=()=>{x.moveTo(q[0][0],q[0][1]);for(let i=1;i<4;i++)x.lineTo(q[i][0],q[i][1]);x.closePath()};
 x.setTransform(1,0,0,1,0,0);x.drawImage(S.disp,0,0);x.setTransform(k,0,0,k,0,0);x.beginPath();x.rect(0,0,S.src.width,S.src.height);path();x.fillStyle='rgba(12,14,16,.58)';x.fill('evenodd');
 x.beginPath();path();x.lineWidth=2*Math.min(2,devicePixelRatio||1)/k;x.strokeStyle=RED;x.stroke();x.setTransform(1,0,0,1,0,0)}
function placeH(){document.querySelectorAll('.hnd').forEach((h,i)=>{h.style.transform=`translate(${S.q[i][0]*S.vs}px,${S.q[i][1]*S.vs}px)`})}
function moveH(i,x,y){S.q[i]=[clamp(x,0,S.src.width),clamp(y,0,S.src.height)];placeH();if(!S.raf)S.raf=requestAnimationFrame(()=>{S.raf=0;drawView();if(S.drag)drawLoupe(S.drag.i)})}
function drawLoupe(i){const L=$('#loupe'),x=L.getContext('2d'),Ls=132,d=Math.min(2,devicePixelRatio||1);if(L.width!==Ls*d){L.width=Ls*d;L.height=Ls*d}
 const[qx,qy]=S.q[i],r=Ls/2/(3*S.vs),c=L.width/2;x.fillStyle='#fff';x.fillRect(0,0,L.width,L.height);x.imageSmoothingQuality='high';x.drawImage(S.src,qx-r,qy-r,2*r,2*r,0,0,L.width,L.height);
 x.strokeStyle=RED;x.lineWidth=1.5*d;x.beginPath();for(const[a,b,e,f]of[[0,-18,0,-5],[0,5,0,18],[-18,0,-5,0],[5,0,18,0]]){x.moveTo(c+a*d,c+b*d);x.lineTo(c+e*d,c+f*d)}x.stroke();
 const vb=$('#vbox'),px=qx*S.vs,py=qy*S.vs;let lx=clamp(px-Ls/2,4,vb.clientWidth-Ls-4),ly=py-Ls-36;if(ly<4)ly=py+36;ly=clamp(ly,4,Math.max(4,vb.clientHeight-Ls-4));L.style.transform=`translate(${lx}px,${ly}px)`}
async function conferma(){$('#anonimo').checked=false;busy('Raddrizzo la tavola…');await sleep(40);try{const q=CT.orderQ(S.q),[tl,tr,br,bl]=q,D=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]),w=(D(tl,tr)+D(bl,br))/2,h=(D(tl,bl)+D(tr,br))/2;if(w<40||h<40)throw new Error('piccolo');
 const L=clamp(Math.round(Math.max(w,h)),1200,2400);let W,H;if(S.set.uni){if(w>=h){W=L;H=Math.round(L/Math.SQRT2)}else{H=L;W=Math.round(L/Math.SQRT2)}}else{const k=L/Math.max(w,h);W=Math.round(w*k);H=Math.round(h*k)}
 if(!S.srcData)S.srcData=S.src.getContext('2d',{willReadFrequently:true}).getImageData(0,0,S.src.width,S.src.height).data;S.warp=CT.warp(S.srcData,S.src.width,S.src.height,q,W,H);S.rot=0;buildOut();S.mode='anteprima';renderSheet()}
 catch(e){toast('Non riesco a raddrizzare: controlla i quattro mirini')}finally{busy(false)}}
function buildOut(){const im=S.set.cont?CT.levels(S.warp):S.warp,c=document.createElement('canvas');c.width=im.width;c.height=im.height;c.getContext('2d').putImageData(im,0,0);S.proc=c;S.out=rotC(c,S.rot)}
function rotC(c,r){if(!r)return c;const o=document.createElement('canvas'),odd=r%2;o.width=odd?c.height:c.width;o.height=odd?c.width:c.height;const x=o.getContext('2d');x.translate(o.width/2,o.height/2);x.rotate(r*Math.PI/2);x.drawImage(c,-c.width/2,-c.height/2);return o}
function layoutPrev(){if(!S.out)return;const[w,h]=fitBox($('#pbox'),S.out.width,S.out.height),d=Math.min(2,devicePixelRatio||1),p=$('#pv');p.width=Math.round(w*d);p.height=Math.round(h*d);const x=p.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(S.out,0,0,p.width,p.height)}

/* ---------- valutazione */
function updValuta(){const b=$('#valuta'),again=S.res&&!S.res.esempio&&S.res.photo===S.photoId,pr=PROFILI[S.prof.tipo],diff=!!pr.noVoto;b.textContent=again?'Rivaluta la tavola':'Valuta la tavola';b.disabled=!(S.mode==='anteprima'&&S.out&&S.sample&&!S.ctl&&!diff);
 const P=PRESETS[S.set.preset],tetto=P.tetto&&!(profAttivo()&&S.prof.noTetto),n=critEff().filter(c=>c.peso>0).length||crit().length;
 const hint=diff?'Percorso differenziato: l’app non propone un voto.':(S.sampleMsg||(S.mode!=='anteprima'?'Scatta la foto e conferma il ritaglio per attivare la valutazione.':''));
 $('#come').innerHTML=`Griglia <b>${esc(P.breve)}</b> · ${n} criteri${tetto?' · tetto 5,5':''}${pr.breve?' · <b>'+esc(pr.breve)+'</b>':''}${S.ref?' · con riferimento':''} · <button type="button" class="link" data-x="ex">cambia</button>${hint?'<br>'+esc(hint):''}`}
function run(m){const R=$('#run');if(m===false){R.hidden=true;clearInterval(S.tick);return}if(R.hidden){R.hidden=false;S.t0=Date.now();$('#runS').textContent='0 s';clearInterval(S.tick);S.tick=setInterval(()=>{$('#runS').textContent=Math.round((Date.now()-S.t0)/1000)+' s'},1000)}$('#runT').textContent=m}
function err(m,retry){const E=$('#err');E.hidden=!m;if(m)E.innerHTML=`<p>${esc(m)}</p>${retry?'<button type="button" class="btn" data-x="retry">Riprova</button>':''}`}
async function fit(c,lim){let q=.88,b=await toBlob(c,q);while(lim.maxInputBytes&&b.size>lim.maxInputBytes&&q>.4){q-=.16;b=await toBlob(c,q)}return b}
async function quarters(c,lim){const W=c.width,H=c.height,w2=Math.round(W/2),h2=Math.round(H/2),ox=Math.round(W*.03),oy=Math.round(H*.03),out=[];
 for(const[x,y,w,h]of[[0,0,w2+ox,h2+oy],[w2-ox,0,W-w2+ox,h2+oy],[0,h2-oy,w2+ox,H-h2+oy],[w2-ox,h2-oy,W-w2+ox,H-h2+oy]]){const t=document.createElement('canvas');t.width=w;t.height=h;t.getContext('2d').drawImage(c,x,y,w,h,0,0,w,h);out.push(await fit(t,lim))}return out}
/* Copia della tavola con un reticolo numerato, solo per le misure: celle quadrate, stesse unità in orizzontale e in verticale
   (1000 unità sul lato lungo), origine in alto a sinistra, linee ogni 50 unità e più scure ogni 100, numeri sui bordi e nei nodi ogni 200. */
function griglia(src){const W=src.width,H=src.height,u=Math.max(W,H)/1000,c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');g.drawImage(src,0,0);
 const wU=W/u,hU=H/u,fs=Math.round(Math.max(11,u*12)),ln=(x1,y1,x2,y2,m)=>{g.strokeStyle=m?'rgba(0,100,255,.6)':'rgba(0,100,255,.3)';g.lineWidth=m?Math.max(1,u*1.4):Math.max(1,u*.8);g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke()};
 for(let k=1;k*50<wU;k++)ln(k*50*u,0,k*50*u,H,k%2===0);
 for(let k=1;k*50<hU;k++)ln(0,k*50*u,W,k*50*u,k%2===0);
 const t=(s,x,y,al,bl,f)=>{g.font='bold '+f+'px sans-serif';g.textAlign=al;g.textBaseline=bl;g.lineJoin='round';g.lineWidth=f/3;g.strokeStyle='rgba(255,255,255,.92)';g.strokeText(s,x,y);g.fillStyle='#0050d8';g.fillText(s,x,y)};
 for(let x=100;x<wU;x+=100){t(String(x),x*u,2,'center','top',fs);t(String(x),x*u,H-2,'center','bottom',fs)}
 for(let y=100;y<hU;y+=100){t(String(y),2,y*u,'left','middle',fs);t(String(y),W-2,y*u,'right','middle',fs)}
 for(let x=200;x<wU;x+=200)for(let y=200;y<hU;y+=200)t(x+','+y,x*u+3,y*u-2,'left','bottom',Math.round(fs*.8));
 return c}
const unitaGr=c=>{const u=Math.max(c.width,c.height)/1000;return[Math.round(c.width/u),Math.round(c.height/u)]};
function refCanvas(){return new Promise((ok,ko)=>{const i=new Image();i.onload=()=>{const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;c.getContext('2d').drawImage(i,0,0);ok(c)};i.onerror=ko;i.src=S.ref.url})}
/* Sovrapposizione esatta del riferimento alla tavola. Si ritagliano attorno all’assonometria le zone di tratto dei due disegni
   (griglie di inchiostro, circa 2 pixel per unità del reticolo), poi il motore aggancia origine, assi e vertici alle linee (CT.sovrapponiFine). */
const estU=c=>{const u=Math.max(c.width,c.height)/1000;return[c.width/u,c.height/u]};
function gridDa(c,roi,modo){const u=Math.max(c.width,c.height)/1000,k=Math.min(2,Math.sqrt(2.4e6/Math.max(1,(roi[2]-roi[0])*(roi[3]-roi[1])))),w=Math.max(8,Math.round((roi[2]-roi[0])*k)),h=Math.max(8,Math.round((roi[3]-roi[1])*k));
 const t=document.createElement('canvas');t.width=w;t.height=h;const g=t.getContext('2d',{willReadFrequently:true});g.fillStyle='#fff';g.fillRect(0,0,w,h);g.imageSmoothingQuality='high';
 g.drawImage(c,roi[0]*u,roi[1]*u,w/k*u,h/k*u,0,0,w,h);return{w,h,k,x0:roi[0],y0:roi[1],b:CT.binario(CT.inchiostro(g.getImageData(0,0,w,h).data,w,h,modo),.5)}}
function prepSovr(m,tav,ref){const a=CT.ancora(m);if(!a)return null;const z=CT.areeSovr(a,m,estU(ref),estU(tav));if(!z)return null;
 return CT.sovrapponiFine(m,a,gridDa(ref,z.roiR,'cad'),gridDa(tav,z.roiS,'foto'))}
/* Immagine della controprova: il tratto della tavola in blu e quello del riferimento, portato sulla tavola con la trasformazione calcolata,
   in rosso; dove coincidono i due colori danno il nero. Origine O segnata; frecce arancioni dal vertice del riferimento a quello della tavola,
   solo per i vertici spostati. */
function sovrapponi(tav,ref,im){const ut=Math.max(tav.width,tav.height)/1000,ur=Math.max(ref.width,ref.height)/1000,T=im.T,P=[];
 if(im.Os)P.push(im.Os);for(const v of arr(im.vert))P.push(v.s,CT.aT(T,v.r));if(!P.length)throw new Error('vuoto');
 let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const p of P){x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1])}
 const mg=Math.max(x1-x0,y1-y0)*.45+30,ex=estU(tav),mx=ex[0]/2,my=ex[1]/2,sx=x1<=mx,dx=x0>=mx,sy=y1<=my,dy=y0>=my;x0=Math.max(dx?mx:0,x0-mg);y0=Math.max(dy?my:0,y0-mg);x1=Math.min(sx?mx:ex[0],x1+mg);y1=Math.min(sy?my:ex[1],y1+mg);
 const w=x1-x0,h=y1-y0,sc=Math.min(3,1100/Math.max(w,h)),W=Math.max(1,Math.round(w*sc)),H=Math.max(1,Math.round(h*sc));
 const mk=()=>{const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d',{willReadFrequently:true});g.fillStyle='#fff';g.fillRect(0,0,W,H);g.imageSmoothingQuality='high';return[c,g]};
 const[ca,ga]=mk(),[,gb]=mk();ga.drawImage(tav,x0*ut,y0*ut,w*ut,h*ut,0,0,W,H);
 gb.setTransform(sc*T.ar/ur,sc*T.ai/ur,-sc*T.ai/ur,sc*T.ar/ur,sc*(T.cx-x0),sc*(T.cy-y0));gb.drawImage(ref,0,0);gb.setTransform(1,0,0,1,0,0);
 const A=ga.getImageData(0,0,W,H),B=gb.getImageData(0,0,W,H),sa=CT.inchiostro(A.data,W,H,'foto'),sb=CT.inchiostro(B.data,W,H,'cad'),o=A.data,BL=[37,99,235],RD=[220,38,38];
 for(let i=0,j=0;i<W*H;i++,j+=4){const p=sa[i],q=sb[i];for(let c=0;c<3;c++)o[j+c]=(255+(BL[c]-255)*p)*(255+(RD[c]-255)*q)/255;o[j+3]=255}
 ga.putImageData(A,0,0);
 const X=p=>[(p[0]-x0)*sc,(p[1]-y0)*sc],fs=Math.round(clamp(W/45,13,22));ga.lineJoin='round';ga.lineCap='round';
 const lab=(t,p,col)=>{ga.font=`bold ${fs}px system-ui,sans-serif`;ga.lineWidth=4;ga.strokeStyle='rgba(255,255,255,.95)';ga.strokeText(t,p[0],p[1]);ga.fillStyle=col;ga.fillText(t,p[0],p[1])};
 for(const v of arr(im.vert)){if(!v.sp)continue;const a=X(CT.aT(T,v.r)),b=X(v.s),dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy);if(L<8)continue;
  const ux=dx/L,uy=dy/L,hd=Math.min(14,L*.4);ga.strokeStyle='#d97706';ga.fillStyle='#d97706';ga.lineWidth=2.5;ga.beginPath();ga.moveTo(a[0],a[1]);ga.lineTo(b[0]-ux*hd*.8,b[1]-uy*hd*.8);ga.stroke();
  ga.beginPath();ga.moveTo(b[0],b[1]);ga.lineTo(b[0]-ux*hd-uy*hd*.45,b[1]-uy*hd+ux*hd*.45);ga.lineTo(b[0]-ux*hd+uy*hd*.45,b[1]-uy*hd-ux*hd*.45);ga.closePath();ga.fill();
  if(v.nome)lab(v.nome,[b[0]+7,b[1]-7],'#b45309')}
 if(im.Os){const p=X(im.Os),r=7;ga.strokeStyle='#111';ga.lineWidth=2;ga.beginPath();ga.arc(p[0],p[1],r,0,7);ga.stroke();ga.beginPath();ga.moveTo(p[0]-r*1.8,p[1]);ga.lineTo(p[0]+r*1.8,p[1]);ga.moveTo(p[0],p[1]-r*1.8);ga.lineTo(p[0],p[1]+r*1.8);ga.stroke();lab('O',[p[0]-r-fs,p[1]-r-3],'#111')}
 return ca.toDataURL('image/jpeg',.85)}
async function valuta(fase){if(!S.sample||!S.out||S.ctl||PROFILI[S.prof.tipo].noVoto)return;
 const again=S.res&&!S.res.esempio&&S.res.photo===S.photoId,prev=again?S.res:null,P=PRESETS[S.set.preset],photo=S.photoId,preset=S.set.preset;
 const pers=profAttivo(),prof={...S.prof},all=critEff(),cr=all.some(c=>c.peso>0)?all.filter(c=>c.peso>0):all;
 const consP=pers?str(prof.consegna).slice(0,400):'',noTetto=pers&&prof.noTetto,tetto=!!P.tetto&&!noTetto;
 if(!$('#anonimo').checked||!$('#token').value.trim()){err('Inserisci il codice docente e verifica i dati da inviare.',false);$('#accesso').open=true;return}
 if(!fase&&P.asso&&S.ref&&!provaOk())return valuta('prova');const prova=fase==='prova';
 const lim=(S.lim&&S.lim.images)||{maxCount:1,maxInputBytes:0},max=lim.maxCount||1,notes=[];let zoom=S.set.zoom&&!prova,ref=!!S.ref;
 let gr=!!P.asso;const need=()=>1+(zoom?4:0)+(ref?1:0)+(gr?(ref?2:1):0);
 if(need()>max&&zoom){zoom=false;notes.push('ingrandimenti non inviati')}if(need()>max&&gr){gr=false;notes.push('reticolo di misura non inviato')}if(need()>max&&ref){ref=false;notes.push('riferimento non inviato')}
 const out=S.out,reference=S.ref,token=$('#token').value.trim();
 const stillCurrent=()=>!ctl.signal.aborted&&out===S.out&&reference===S.ref&&$('#anonimo').checked&&token===$('#token').value.trim();
 err('');const ctl=new AbortController();S.ctl=ctl;run('Preparo le immagini…');updValuta();
 try{const imgs=[await fit(out,lim)];if(zoom)imgs.push(...await quarters(out,lim));if(ref)imgs.push(reference.blob);
  let gw=0,gh=0,rw=0,rh=0,grRif=false,rcan=null;
  if(gr){try{const gc=griglia(S.out),gb=await fit(gc,lim);imgs.push(gb);[gw,gh]=unitaGr(gc);
    if(ref){try{const rc=await refCanvas();imgs.push(await fit(griglia(rc),lim));[rw,rh]=unitaGr(rc);grRif=true;rcan=rc}catch(e){notes.push('reticolo del riferimento non inviato')}}}catch(e){gr=false;notes.push('reticolo di misura non inviato')}}
  const consegna=consP||S.set.consegna.trim().slice(0,400),p=(prova?DIRETTIVA_PROVA:'')+CT.prompt(P,cr,{zoom,ref,cont:S.set.cont,consegna,consegnaPers:!!consP,compl:S.set.compl,note:(S.set.note[preset]||'').trim().slice(0,1500),noTetto,misure:pers?CT.misure(prof):[],griglia:gr,gw,gh,grigliaRif:grRif,rw,rh});
  let tier=S.set.tier;const mt=S.lim&&S.lim.modelTiers;if(mt&&!mt.includes(tier))tier='default';
  if(!stillCurrent())return;
  run('Il modello sta esaminando la tavola…');
  const j=await S.sample(p,{images:imgs,tier,signal:ctl.signal,token});
  if(!stillCurrent())return;
  if(!j||typeof j!=='object'||!Array.isArray(prova?j.misure:j.criteri))throw{code:'invalid_json'};
  if(prova){run('Sovrappongo il riferimento alla tavola…');await sleep(30);if(stillCurrent())finisciProva(j,rcan,grRif,consegna,preset);return}
  const last=S.res&&!S.res.esempio?S.res.codice:(S.reg[0]&&S.reg[0].codice);
  const pv=provaOk()?S.prova:null;if(pv){j.misure=pv.misure;if(!rcan)rcan=pv.rcan}const fine=pv?pv.fine.slice():[];if(!pv&&rcan&&grRif&&P.asso&&Array.isArray(j.misure)){run('Sovrappongo il riferimento alla tavola…');await sleep(30);if(!stillCurrent())return;
   for(let i=0;i<Math.min(4,j.misure.length);i++){try{fine[i]=prepSovr(j.misure[i],S.out,rcan)}catch(e){fine[i]=null}}}
  const r=CT.adopt(j,cr,{tetto,asso:!!P.asso,fine,reali:/\d/.test(consegna+' '+(S.set.note[preset]||''))});Object.assign(r,{preset,tipo:P.nome,consegna,compl:S.set.compl,ts:Date.now(),photo,rif:ref,modello:tier,savedId:prev?prev.savedId:store.newId(),codice:prev?prev.codice:CT.nextCode(last),profilo:PROFILI[prof.tipo].rec});
  if(rcan&&arr(r.sovrapp).length){REFC=rcan;r.sovrImgs=[];for(const x of r.sovrapp){try{r.sovrImgs.push({tipo:x.tipo,esito:x.esito,img:x.img,url:sovrapponi(S.out,rcan,x.img)})}catch(e){}}}
  const v=votoR(r);if(v&&v.capped)notes.unshift('errore grave, tetto 5,5');
  S.res=r;S.saveK='';if(pv)pv.items.forEach((it,k)=>{if(it.T2)applicaSov(k,it.T2);else if(it.conf&&S.res.sovrImgs&&S.res.sovrImgs[k])S.res.sovrImgs[k].conf=it.conf});renderScheda();persist();toast(`Scheda pronta: voto ${v?fmt(v.voto):'—'}${notes.length?' ('+notes.join(', ')+')':''}`);
  if(innerWidth<900)$('#scheda').scrollIntoView({behavior:beh(),block:'start'})}
 catch(e){const c=e&&e.code;if(!ctl.signal.aborted)err(ERR[c]||ERR.upstream_error,true)}
 finally{S.ctl=null;run(false);updValuta()}}

/* ---------- scheda */
function calcHtml(r){const cr=r.criteri,v=votoR(r);if(!v)return 'Assegna almeno un punteggio per calcolare il voto.';const used=cr.filter(c=>c.punteggio!=null&&c.peso>0),tw=used.reduce((s,c)=>s+c.peso,0),sum=used.map(c=>`${fmt(c.punteggio)} × ${fmt(c.peso,1)}%`).join(' + ');
 const base=esc(`${Math.abs(tw-100)>.01?'('+sum+') ÷ '+fmt(tw,1)+'%':sum} = ${fmt(v.raw)}`);
 return v.capped?base+` → ${esc(fmt(v.base))}; con l’errore grave il voto non supera 5,5 → <b>${esc(fmt(v.voto))}</b>`:base+` → <b>${esc(fmt(v.voto))}</b>, arrotondato al quarto di punto`}
function tettoBlock(r,ex){const eg=arr(r.erroriGravi),ch=!!r.tetto!==!!r.tettoAi;
 return `<div class="tetto"><h3>Errori gravi</h3>${eg.length?`<ul class="eg">${eg.map(e=>`<li>${esc(e.errore)}${e.dove?` <span class="mute">· ${esc(e.dove)}</span>`:''}</li>`).join('')}</ul>`:'<p class="small mute">Il modello non ha segnalato errori gravi.</p>'}
 <label class="chk"><input type="checkbox" id="tetto"${r.tetto?' checked':''}${ex?' disabled':''}> Errore grave di metodo: il voto non supera 5,5</label><span class="mod" id="tettoMod"${ch?'':' hidden'}>${ch?(r.tettoAi?'tolto dal docente, il modello lo aveva segnalato':'aggiunto dal docente'):''}</span></div>`}
const DIRETTIVA_PROVA='FASE PRELIMINARE DI SOVRAPPOSIZIONE: non valutare la tavola e non compilare i criteri. Rispondi solo con un oggetto JSON che contiene la chiave misure, nel formato descritto per le misure sulle assonometrie, e nessun’altra chiave.\n\n';
const provaOk=()=>!!(S.prova&&S.prova.conf&&S.prova.out===S.out&&S.prova.ref===S.ref&&S.prova.preset===S.set.preset);
function chiudiProva(){S.provaAperta=false;const m=document.querySelector('.provamod');if(m)m.remove()}
function finisciProva(j,rcan,grRif,consegna,preset){const fine=[],items=[],misure=arr(j.misure).slice(0,4);
 if(rcan&&grRif)for(let i=0;i<misure.length;i++){try{fine[i]=prepSovr(misure[i],S.out,rcan)}catch(e){fine[i]=null}}
 if(rcan&&grRif&&misure.length){REFC=rcan;const reali=/\d/.test(consegna+' '+(S.set.note[preset]||'')),ver=CT.verificaAsso(misure,fine,reali);for(const v of ver.filter(x=>x.img)){try{items.push({tipo:v.tipo,esito:v.esito,img:v.img,url:sovrapponi(S.out,rcan,v.img),conf:null,T2:null})}catch(e){}}}
 S.prova={out:S.out,ref:S.ref,preset,misure,fine,rcan,items,conf:false};mostraProva()}
function mostraProva(){const p=S.prova;chiudiProva();S.provaAperta=true;const m=document.createElement('div');m.className='sovmod provamod';
 const fig=p.items.map((it,k)=>{const dub=it.esito==='dubbio'&&!it.conf;return `<figure style='margin:0'><img src='${it.url}' alt='Prova di sovrapposizione' style='max-width:100%;height:auto'><figcaption class='small'>${capSov(it)}</figcaption><div class='sovbar'><span class='st${dub?' dub':''}'>${it.conf==='manuale'?'✓ Allineata a mano':dub?'⚠ Sovrapposizione incerta: controlla o allinea a mano':'Sovrapposizione automatica'}</span><button type='button' class='${dub?'pri':''}' data-pv='man' data-k='${k}'>${it.conf==='manuale'?'Rifai a mano':'Allinea a mano'}</button></div></figure>`}).join('');
 m.innerHTML=`<b>Prova di sovrapposizione</b><span class='small'>Controlla che il riferimento (rosso) sia sovrapposto correttamente alla tavola (blu); se non lo è, allinealo a mano. La valutazione parte solo dopo la tua conferma.</span>${fig||`<p>Non sono riuscito a sovrapporre il riferimento alla tavola. Puoi annullare oppure avviare comunque la valutazione senza sovrapposizione.</p>`}<div class='sovbar'><button type='button' class='pri' data-pv='go'>${p.items.length?'Conferma sovrapposizione e avvia la valutazione':'Avvia la valutazione senza sovrapposizione'}</button><button type='button' data-pv='x'>Annulla</button></div>`;document.body.appendChild(m)}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-pv]');if(!b||!S.prova)return;const a=b.dataset.pv;
 if(a==='x')chiudiProva();else if(a==='man')allineaSov(+b.dataset.k);else if(a==='go'){S.prova.conf=true;S.prova.items.forEach(it=>{if(!it.conf)it.conf='confermata'});chiudiProva();valuta()}});
let REFC=null;
(()=>{const st=document.createElement('style');st.textContent='.sovbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0 2px}.sovbar button,.sovmod button{font:inherit;padding:8px 12px;border-radius:8px;border:1px solid #8886;background:transparent;color:inherit;cursor:pointer}.sovbar button.pri,.sovmod button.pri{background:#2563eb;color:#fff;border-color:#2563eb}.sovbar .st{font-size:14px}.sovbar .st.dub{color:#b45309;font-weight:600}.sovmod{position:fixed;inset:0;z-index:99;background:Canvas;color:CanvasText;display:flex;flex-direction:column;padding:10px;gap:8px;overflow:auto}.sovmod canvas{max-width:100%;touch-action:none;border:1px solid #8886;align-self:center}.sovmod label{display:flex;gap:8px;align-items:center;font-size:14px}.sovmod input[type=range]{flex:1}';document.head.appendChild(st)})();
function sovBar(i,k){const c=i.conf,dub=i.esito==='dubbio'||!(i.img&&i.img.esatta),st=c==='manuale'?'✓ Allineata a mano e confermata':c==='confermata'?'✓ Sovrapposizione confermata':dub?'⚠ Sovrapposizione incerta: controlla l’immagine e conferma, oppure allineala tu a mano.':'Sovrapposizione automatica: controlla l’immagine e conferma.';
 return `<div class='sovbar'><span class='st${dub&&!c?' dub':''}'>${st}</span>${c?'':`<button type='button' class='${dub?'':'pri'}' data-sov='ok' data-k='${k}'>Conferma sovrapposizione</button>`}<button type='button' class='${dub&&!c?'pri':''}' data-sov='man' data-k='${k}'>${c==='manuale'?'Rifai a mano':'Allinea a mano'}</button></div>`}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-sov]');if(!b||!S.res)return;const k=+b.dataset.k,x=arr(S.res.sovrImgs)[k];if(!x)return;
 if(b.dataset.sov==='ok'){x.conf='confermata';const r=S.res,j=arr(r.verifiche).findIndex(v=>v.testo.startsWith('Assonometria '+x.tipo+', controprova'));if(j>=0)r.verifiche[j].testo+=' Sovrapposizione confermata dal docente.';renderScheda();persist()}else allineaSov(k)});
function allineaSov(k){const pv=!!S.provaAperta,r=pv?S.prova:S.res,x=(pv?r.items:r.sovrImgs)[k],im=x.img,tav=S.out,ref=REFC;if(!tav||!ref||!im)return toast('Per allineare a mano servono la tavola e il riferimento caricati.');
 const ut=Math.max(tav.width,tav.height)/1000,ur=Math.max(ref.width,ref.height)/1000,V=arr(im.vert),P=[];if(im.Os)P.push(im.Os);for(const v of V)P.push(v.s,CT.aT(im.T,v.r));if(!P.length)return;
 const O=im.Os||[P.reduce((u,p)=>u+p[0],0)/P.length,P.reduce((u,p)=>u+p[1],0)/P.length];
 let x0=Math.min(...P.map(p=>p[0])),x1=Math.max(...P.map(p=>p[0])),y0=Math.min(...P.map(p=>p[1])),y1=Math.max(...P.map(p=>p[1]));
 const mg=Math.max(x1-x0,y1-y0)*.45+30,ex=estU(tav),mx=ex[0]/2,my=ex[1]/2,sx=x1<=mx,dx=x0>=mx,sy=y1<=my,dy=y0>=my;x0=Math.max(dx?mx:0,x0-mg);y0=Math.max(dy?my:0,y0-mg);x1=Math.min(sx?mx:ex[0],x1+mg);y1=Math.min(sy?my:ex[1],y1+mg);
 const w=x1-x0,h=y1-y0,sc=Math.min(2.5,Math.min(900,innerWidth-24)/w),W=Math.round(w*sc),H=Math.round(h*sc);
 const ink=(cv,sx,sy,sw,sh,cw,ch,modo,rgb)=>{const c=document.createElement('canvas');c.width=cw;c.height=ch;const q=c.getContext('2d',{willReadFrequently:true});q.fillStyle='#fff';q.fillRect(0,0,cw,ch);q.imageSmoothingQuality='high';q.drawImage(cv,sx,sy,sw,sh,0,0,cw,ch);const d=q.getImageData(0,0,cw,ch),a=CT.inchiostro(d.data,cw,ch,modo),o=q.createImageData(cw,ch);for(let i=0,j=0;i<cw*ch;i++,j+=4){o.data[j]=rgb[0];o.data[j+1]=rgb[1];o.data[j+2]=rgb[2];o.data[j+3]=Math.round(255*a[i])}q.putImageData(o,0,0);return c};
 const LS=ink(tav,x0*ut,y0*ut,w*ut,h*ut,W,H,'foto',[37,99,235]),LR=ink(ref,0,0,ref.width,ref.height,ref.width,ref.height,'cad',[220,38,38]);let kk=1,rot=0,tx=0,ty=0;
 const comp=()=>{const c=Math.cos(rot),s=Math.sin(rot),a=im.T.ar,b=im.T.ai,R=p=>[kk*(c*p[0]-s*p[1]),kk*(s*p[0]+c*p[1])],q=R([im.T.cx,im.T.cy]),o=R(O);return{ar:kk*(c*a-s*b),ai:kk*(s*a+c*b),cx:q[0]+O[0]-o[0]+tx,cy:q[1]+O[1]-o[1]+ty}};
 const m=document.createElement('div');m.className='sovmod';m.innerHTML=`<b>Allinea a mano il riferimento (rosso) alla tavola (blu)</b><span class='small'>Trascina il disegno per spostarlo; usa i cursori per scala e rotazione. Le linee che coincidono diventano nere.</span><canvas></canvas><label>Scala <input type='range' id='sk' min='0.8' max='1.25' step='0.002' value='1'></label><label>Rotazione <input type='range' id='sr' min='-10' max='10' step='0.05' value='0'></label><div class='sovbar'><button type='button' class='pri' id='sa'>Applica</button><button type='button' id='sx'>Annulla</button></div>`;
 document.body.appendChild(m);const cv=m.querySelector('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d');
 const draw=()=>{const T=comp();g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';g.fillStyle='#fff';g.fillRect(0,0,W,H);g.drawImage(LS,0,0);g.globalCompositeOperation='multiply';g.setTransform(sc*T.ar/ur,sc*T.ai/ur,-sc*T.ai/ur,sc*T.ar/ur,sc*(T.cx-x0),sc*(T.cy-y0));g.drawImage(LR,0,0);g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over'};
 let d0=null;cv.onpointerdown=e=>{d0={x:e.clientX,y:e.clientY,tx,ty};cv.setPointerCapture(e.pointerId)};cv.onpointermove=e=>{if(!d0)return;const f=W/cv.getBoundingClientRect().width/sc;tx=d0.tx+(e.clientX-d0.x)*f;ty=d0.ty+(e.clientY-d0.y)*f;draw()};cv.onpointerup=()=>{d0=null};
 m.querySelector('#sk').oninput=e=>{kk=+e.target.value;draw()};m.querySelector('#sr').oninput=e=>{rot=+e.target.value*Math.PI/180;draw()};m.querySelector('#sx').onclick=()=>m.remove();m.querySelector('#sa').onclick=()=>{const T2=comp();m.remove();applicaSov(k,T2,pv)};draw()}
function applicaSov(k,T2,pv){const r=pv?S.prova:S.res,x=(pv?r.items:r.sovrImgs)[k],c=CT.controprova(null,{T:T2,Os:x.img.Os,anc:true,come:'allineata a mano',vert:arr(x.img.vert),assi:[],modo:'affinata',okO:true,okX:true,q:0,affid:true});
 if(!c)return toast('Vertici insufficienti per ricalcolare: sovrapposizione non aggiornata.');
 const es=c.m>=c.soglie.e?'errato':c.m>=c.soglie.d?'dubbio':'ok',pc=Math.round(c.m*100)+'%',nome='assonometria '+x.tipo;
 if(pv){Object.assign(c.img,{manuale:true});r.items[k]={...x,img:c.img,esito:es,conf:'manuale',T2,url:sovrapponi(S.out,REFC,c.img)};mostraProva();return}
 const testo=`Assonometria ${x.tipo}, controprova: riferimento allineato a mano dal docente. Scarto ${pc} della dimensione del disegno (${c.n} vertici).${es==='ok'?' Le proporzioni coincidono.':c.spostati.length?' Vertici spostati: '+c.spostati.join(', ')+'.':''}`;
 const j=arr(r.verifiche).findIndex(v=>v.testo.startsWith('Assonometria '+x.tipo+', controprova'));if(j>=0)r.verifiche[j]={testo,esito:es};else r.verifiche=arr(r.verifiche).concat([{testo,esito:es}]);
 const prima=arr(r.erroriGravi).length;r.erroriGravi=arr(r.erroriGravi).filter(e=>!(/^Il disegno si discosta molto dal riferimento/.test(e.errore)&&String(e.dove).startsWith(nome+':')));
 if(es==='errato'&&r.tettoPrev)r.erroriGravi.push({errore:`Il disegno si discosta molto dal riferimento (sovrapposizione allineata a mano): scarto ${pc} della dimensione`,dove:`${nome}: scarto ${pc}`});
 r.tettoAi=r.tetto=r.erroriGravi.length>0;Object.assign(c.img,{manuale:true});r.sovrImgs[k]={...x,img:c.img,esito:es,conf:'manuale',url:sovrapponi(S.out,REFC,c.img)};
 renderScheda();persist();toast('Sovrapposizione aggiornata: scarto '+pc+(prima>r.erroriGravi.length?'. Se il metodo era stato limitato a 5,5, correggilo a mano':''))}
function capSov(i){const g=i.img||{};return `Assonometria ${esc(i.tipo)}. ${g.manuale?'Il riferimento è stato allineato a mano dal docente.':g.anc?`L’origine O dei due disegni coincide${g.come?' (nella tavola: '+esc(g.come)+')':''}, l’asse x è allineato e la scala è presa sull’asse x.`:'Il riferimento è sovrapposto ai vertici, perché l’origine non è stata indicata.'} In nero le linee che coincidono, in rosso quelle che ci sono solo nel riferimento, in blu quelle solo nella tavola; le frecce arancioni vanno dal vertice del riferimento a quello della tavola.${g.esatta?'':' <b>Sovrapposizione approssimata</b>: i punti non si sono agganciati bene alle linee del disegno, usala con cautela.'}`}
function verBlock(r){const v=arr(r.verifiche);return v.length?`<div class="ver"><h3>Misure sulle assonometrie</h3><ul>${v.map(x=>`<li class="${esc(x.esito)}">${esc(x.testo)}</li>`).join('')}</ul>${arr(r.sovrImgs).map((i,k)=>`<figure class="sov"><img src="${i.url}" alt="Riferimento sovrapposto alla tavola"><figcaption class="small mute">${capSov(i)}</figcaption>${sovBar(i,k)}</figure>`).join('')}<p class="small mute">Misure prese da il modello sul reticolo e agganciate dal programma alle linee del disegno: se un esito ti sembra dubbio controlla con il righello o con l’immagine sovrapposta. L’immagine non viene conservata nel registro.</p></div>`:''}
function critRow(c,i,ex){const p=c.punteggio,ch=c.ai!=null&&p!==c.ai;return `<li class="cr" data-i="${i}"><div><span class="nm">${esc(c.nome)}</span><span class="w">${esc(fmt(c.peso,1))}%</span><span class="mod"${ch?'':' hidden'}>${ch?'modificato, il modello aveva dato '+esc(fmt(c.ai)):''}</span></div>
 <div class="step">${ex?'':`<button type="button" data-a="meno" aria-label="Diminuisci ${esc(c.nome)}">−</button>`}<output>${p==null?'—':esc(fmt(p))}</output>${ex?'':`<button type="button" data-a="piu" aria-label="Aumenta ${esc(c.nome)}">+</button>`}</div>
 <div class="bar"><i class="${p!=null&&p<6?'lo':''}" style="width:${p==null?0:p*10}%"></i></div>${c.commento?`<p class="cm">${esc(c.commento)}</p>`:''}</li>`}
function quadMap(z){const by={};for(const q of z)by[q.posizione]=q;return `<div class="quad">${POS.map(p=>{const q=by[p];return `<div class="qz"><div><b>${esc(q.nome)}</b><span class="es ${q.esito}">${ESITO[q.esito]}</span></div>${q.note?`<p>${esc(q.note)}</p>`:''}</div>`}).join('')}</div>`}
function zoneList(z){return `<ul class="zl">${z.map(q=>`<li><b>${esc(q.nome)}</b> <span class="es ${q.esito}">${ESITO[q.esito]}</span>${q.note?`<p>${esc(q.note)}</p>`:''}</li>`).join('')}</ul>`}
const lis=a=>a.length?a.map(s=>`<li>${esc(s)}</li>`).join(''):'<li class="mute">—</li>';
function renderScheda(){const r=S.res,el=$('#scheda');
 if(!r){el.innerHTML='<div class="vbar"><h2>Scheda</h2></div><p class="vuota">La scheda della prossima tavola comparirà qui dopo la valutazione.</p>';return}
 const ex=r.esempio,quad=r.zone.length===4&&new Set(r.zone.map(q=>q.posizione)).size===4&&r.zone.every(q=>POS.includes(q.posizione));
 el.innerHTML=`<div class="vbar"><h2>Scheda</h2><span id="vMini" class="vmini"></span><span id="saveSt" class="small mute"></span></div>
 <div class="cart"><div class="cell c-cod"><label for="codice">Codice elaborato</label><input id="codice" type="text" value="${esc(r.codice)}" placeholder="es. 1B-07" autocomplete="off"${ex?' disabled':''}></div>
  <div class="cell c-ex"><span class="lab">Esercizio</span><span>${esc(r.tipo)}${r.consegna?' · '+esc(r.consegna):''}${DIC[r.profilo]?`<span class="dic">${esc(DIC[r.profilo])}</span>`:''}</span></div>
  <div class="cell c-dt"><span class="lab">Data</span><span>${esc(dataIt(r.ts))}</span></div>
  <div class="cell c-voto"><span class="lab">Voto</span><div class="gw"><span class="hand" id="vHand"></span><svg class="ring" viewBox="0 0 120 70" aria-hidden="true"><path d="M20 40C13 20 46 8 74 10c28 2 42 17 34 33-7 15-44 20-70 14C20 53 10 42 18 28c5-8 16-13 28-15"/></svg></div><span class="vnum" id="vNum"></span></div></div>
 ${ex?'<p class="sample">Esempio di scheda con dati dimostrativi: scatta una foto per valutare una tavola vera.</p>':''}
 <div class="sbody">${!r.leggibile||r.problemiFoto?`<p class="warn">${!r.leggibile?'<b>Foto poco valutabile.</b> ':''}${esc(r.problemiFoto)}</p>`:''}
  <h3>Griglia</h3><ol class="crit">${r.criteri.map((c,i)=>critRow(c,i,ex)).join('')}</ol><p class="calc" id="calc"></p>
  ${r.tettoPrev?tettoBlock(r,ex):''}
  ${verBlock(r)}
  ${r.completezza?`<p class="small" style="margin-top:8px"><b>Completezza:</b> ${esc(r.completezza)}</p>`:''}
  ${r.zone.length?`<h3>${quad?'Quadranti':'Zone del foglio'}</h3>${quad?quadMap(r.zone):zoneList(r.zone)}`:''}
  <div class="two"><div><h3>Punti di forza</h3><ul>${lis(r.puntiForza)}</ul></div><div><h3>Da migliorare</h3><ul>${lis(r.daMigliorare)}</ul></div></div>
  <h3><label for="giud">Giudizio</label></h3><textarea id="giud" rows="5"${ex?' disabled':''}>${esc(r.giudizio)}</textarea>
  <div class="acts"><button type="button" class="btn" data-a="copia"${ex?' disabled':''}>Copia scheda</button><button type="button" class="btn" data-a="riga"${ex?' disabled':''}>Copia riga per Excel</button><button type="button" class="btn ghost" data-a="elimina"${ex?' disabled':''}>Elimina</button><button type="button" class="btn pri" data-a="nuova">Nuova tavola</button></div>
  ${ex?'':`<p class="meta">Analisi ${r.modello==='default'?'rapida':'accurata'}${r.rif?' · con riferimento':''} · ${esc(new Date(r.ts).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}))}</p>`}</div>`;
 updVoto();saveState(ex?'':S.saveK)}
function updVoto(){const r=S.res;if(!r)return;const v=votoR(r),h=$('#vHand'),n=$('#vNum'),c=$('#calc'),m=$('#vMini');if(h)h.textContent=notaz(v&&v.voto);if(n)n.textContent=v?fmt(v.voto)+' / 10'+(v.capped?' · tetto':''):'—';if(c)c.innerHTML=calcHtml(r);
 if(m)m.innerHTML=v?`Voto <b>${esc(fmt(v.voto))}</b>${notaz(v.voto)!==fmt(v.voto)?' · '+esc(notaz(v.voto)):''}`:'Voto —'}
function updRow(i){const c=S.res.criteri[i],li=document.querySelector(`.cr[data-i="${i}"]`);if(!li)return;li.querySelector('output').textContent=c.punteggio==null?'—':fmt(c.punteggio);
 const b=li.querySelector('.bar i');b.style.width=(c.punteggio==null?0:c.punteggio*10)+'%';b.classList.toggle('lo',c.punteggio!=null&&c.punteggio<6);
 const m=li.querySelector('.mod'),ch=c.ai!=null&&c.punteggio!==c.ai;m.hidden=!ch;m.textContent=ch?'modificato, il modello aveva dato '+fmt(c.ai):''}
function saveState(k){S.saveK=k;const el=$('#saveSt');if(!el)return;el.textContent={wait:'Salvataggio…',ok:'Salvata su questo dispositivo',err:'Non salvata: riprova più tardi',full:'Registro pieno: elimina qualche voce'}[k]||'';el.classList.toggle('bad',k==='err'||k==='full')}
function persist(){const r=S.res;if(!r||r.esempio)return;
 try{store.put(r.savedId,CT.toRec(r));saveState('ok')}catch(e){saveState(e&&e.code==='quota_exceeded'?'full':'err')}}
function twoStep(b,label,fn){if(b.dataset.c!=='1'){b.dataset.c='1';b.textContent='Conferma eliminazione';setTimeout(()=>{if(b.isConnected){b.dataset.c='';b.textContent=label}},4000);return}fn()}
function eliminaVoce(id){if(!id)return;
 try{store.del(id)}catch(e){toast('Non riesco a eliminarla: riprova');return}
 if(S.res&&S.res.savedId===id){S.res=null;renderScheda();updValuta()}
 toast('Eliminata dal registro')}

/* ---------- registro */
function regItem(r){const v=r.voto;return `<li><details data-id="${esc(r.id)}"${S.regOpen.has(r.id)?' open':''}><summary><span class="hand">${esc(notaz(Number(v)))}</span><span class="rm"><b>${esc(r.codice||'senza codice')}</b><span class="mute">${esc(r.tipo)}${r.consegna?' · '+esc(r.consegna):''}${DIC[r.profilo]?' · '+esc(DIC[r.profilo].replace('Valutazione ','')):''}</span></span><span class="rd"><b>${esc(fmt(v))}</b><time class="mute">${esc(dataIt(r.ts,true))}</time></span></summary>
 <div class="rbody"><ul class="rcr">${arr(r.criteri).map(c=>`<li><span>${esc(c&&c.nome)} <span class="mute">${esc(fmt(c&&c.peso,1))}%</span></span><b>${esc(fmt(c&&c.punteggio))}</b></li>`).join('')}</ul>${r.tettoPrevisto&&r.tetto?'<p class="small bad" style="margin-bottom:8px">Errore grave: il voto non supera 5,5.</p>':''}${r.giudizio?`<p>${esc(r.giudizio)}</p>`:''}
 <div class="acts"><button type="button" class="btn" data-r="apri">Apri nella scheda</button><button type="button" class="btn" data-r="copia">Copia scheda</button><button type="button" class="btn ghost" data-r="del">Elimina</button></div></div></details></li>`}
function renderReg(){const f=$('#rf').value.trim().toLowerCase(),all=S.reg,list=f?all.filter(r=>[r.codice,r.tipo,r.consegna].map(str).join(' ').toLowerCase().includes(f)):all;S.regList=list;
 const vot=a=>a.map(r=>Number(r.voto)).filter(v=>isFinite(v)&&v>0),va=vot(all),vl=vot(list),avg=a=>a.reduce((s,v)=>s+v,0)/a.length,today=dataIt(Date.now());
 $('#stN').textContent=all.length;$('#stO').textContent=all.filter(r=>dataIt(r.ts)===today).length;$('#stM').textContent=va.length?fmt(avg(va)):'—';
 $('#rStats').textContent=list.length?`${list.length} ${list.length===1?'tavola':'tavole'}${vl.length?` · media ${fmt(avg(vl))} · sotto il 6: ${vl.filter(v=>v<6).length}`:''}`:'';
 $('#rlist').innerHTML=list.length?list.map(regItem).join(''):`<li class="rempty">${S.regMode==='attesa'?'Carico il registro…':f?'Nessuna tavola trovata.':'Ancora nessuna tavola: ogni valutazione si salva qui da sola.'}</li>`;
 $('#rCopy').disabled=!list.length;$('#rCsv').disabled=!list.length}
function regNote(m){$('#rNote').textContent=m}
const localRows=()=>arr(lsGet('ct.reg')).filter(r=>r&&typeof r.id==='string').sort((a,b)=>(b.ts||0)-(a.ts||0));
function loadLocalReg(){S.reg=localRows();S.regMode='locale';regNote('Registro salvato solo su questo dispositivo.');renderReg()}
function scaricaCSV(){if(!S.regList.length)return;
 const url=URL.createObjectURL(new Blob([CT.csv(CT.table(S.regList))],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download='registro-tavole-'+new Date().toISOString().slice(0,10)+'.csv';
 document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}

/* ---------- servizi */
let toastT=0;function toast(m){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>{t.hidden=true},2800)}
function banner(m){const b=$('#banner');b.textContent=m||'';b.hidden=!m}
async function copyText(t,okMsg){try{await navigator.clipboard.writeText(t);toast(okMsg||'Copiato')}catch(e){const ta=$('#cboxT');ta.value=t;$('#cbox').hidden=false;ta.focus();ta.select()}}
function initCaps(){loadLocalReg();
 window.addEventListener('storage',e=>{if(e.key==='ct.reg'||e.key===null)loadLocalReg()});
 S.sample=window.CTApi;
 S.lim={images:{maxCount:8,maxInputBytes:1024*1024},modelTiers:['default','complex']};
 $('#accesso').hidden=$('#privacy').hidden=!S.sample;
 if(!S.sample){S.sampleMsg='Valutazione automatica disponibile dopo la configurazione del servizio.';banner(S.sampleMsg)}
 updValuta()}

/* ---------- eventi */
function bind(){const pick=(fn,src)=>async e=>{const input=e.target,f=input.files&&input.files[0];if(!f)return;if(src)S.lastSrc=src;
 try{await fn(f)}finally{if(input.files?.[0]===f)input.value=''}};
 $('#fCam').addEventListener('change',pick(onPhoto,'cam'));$('#fGal').addEventListener('change',pick(onPhoto,'gal'));$('#fFile').addEventListener('change',pick(onPhoto,'file'));$('#fRef').addEventListener('change',pick(onRef));
 $('#refPg').addEventListener('click',()=>onRef(null,true));
 /* incolla (Ctrl+V) e trascina: tavola nel riquadro Tavola, riferimento nel suo campo */
 const accetta=f=>!!f&&(/^image\//.test(f.type)||isPdf(f));
 const fileDa=dt=>{if(!dt)return null;for(const f of dt.files||[])if(accetta(f))return f;for(const it of dt.items||[])if(it.kind==='file'){const f=it.getAsFile();if(accetta(f))return f}return null};
 const tav=$('#help').closest('.panel'),rifZ=$('#refBtn').closest('.fld');
 const arriva=(f,rif)=>{if(rif){onRef(f);return}S.lastSrc='file';onPhoto(f)};
 document.addEventListener('paste',e=>{const f=fileDa(e.clipboardData);if(!f)return;e.preventDefault();arriva(f,false);toast(isPdf(f)?'PDF incollato come tavola':'Immagine incollata come tavola')});
 const zona=e=>rifZ&&e.target instanceof Node&&rifZ.contains(e.target)?rifZ:tav,pulisci=()=>{tav.classList.remove('drop');if(rifZ)rifZ.classList.remove('drop')};
 const trascina=e=>{const t=e.dataTransfer&&[...(e.dataTransfer.types||[])];return !!t&&(t.includes('Files')||t.includes('text/uri-list'))};
 window.addEventListener('dragover',e=>{if(!trascina(e))return;e.preventDefault();e.dataTransfer.dropEffect='copy';const z=zona(e);if(!z.classList.contains('drop')){pulisci();z.classList.add('drop')}});
 window.addEventListener('dragleave',e=>{if(!e.relatedTarget)pulisci()});
 window.addEventListener('drop',e=>{if(!e.dataTransfer)return;e.preventDefault();const z=zona(e);pulisci();const f=fileDa(e.dataTransfer);if(f){arriva(f,z===rifZ);return}
  toast([...(e.dataTransfer.types||[])].some(x=>x==='text/uri-list'||x==='text/html')?'Da quella pagina non arriva il file. In Google Foto apri la foto, tasto destro «Copia immagine», poi Ctrl+V qui.':'Trascina qui un’immagine o un PDF.')});
 $('#refBtn').addEventListener('click',()=>$('#fRef').click());
 $('#refDel').addEventListener('click',()=>{$('#anonimo').checked=false;S.ref=null;closePdf('rpdf');lsDel('ct.ref');renderRef();exSum()});
 $('#preset').addEventListener('change',e=>{S.set.preset=e.target.value;saveSet();renderSettings()});
 $('#consegna').addEventListener('input',e=>{S.set.consegna=e.target.value;saveSet()});
 $('#compl').addEventListener('change',e=>{S.set.compl=e.target.value;saveSet();exSum()});
 $('#tier').addEventListener('change',e=>{S.set.tier=e.target.value;saveSet()});
 $('#zoom').addEventListener('change',e=>{S.set.zoom=e.target.checked;saveSet();renderSheet()});
 $('#note').addEventListener('input',e=>{S.set.note[S.set.preset]=e.target.value;saveSet()});
 $('#exDet').addEventListener('toggle',()=>{const o=$('#exDet').open;if(o!==S.set.open){S.set.open=o;saveSet()}});
 $('#pesi').addEventListener('input',e=>{const id=e.target.dataset.id,n=Number(e.target.value);if(!id||e.target.value===''||!isFinite(n))return;const p=S.set.preset;S.set.pesi[p]={...(S.set.pesi[p]||{}),[id]:clamp(n,0,100)};saveSet();updTot();syncPesi()});
 $('#pReset').addEventListener('click',()=>{delete S.set.pesi[S.set.preset];saveSet();renderPesi();syncPesi()});
 $('#prof').addEventListener('change',e=>{const t=PROFILI[e.target.value]?e.target.value:'classe';S.prof=t==='classe'?PROF0():{...S.prof,tipo:t};renderProf()});
 const pb=$('#profBox');
 pb.addEventListener('change',e=>{const t=e.target;if(t.id==='pEs'){S.prof.es=t.value;S.prof.pesi=null;renderProf();syncProf()}else if(t.dataset.m){S.prof[t.dataset.m]=t.checked;updValuta()}});
 pb.addEventListener('input',e=>{const t=e.target;if(t.id==='pCons')S.prof.consegna=t.value;else if(t.id==='pAltro')S.prof.altro=t.value;
  else if(t.closest('#pPesi')){const id=t.dataset.id,n=Number(t.value);if(!id||t.value===''||!isFinite(n))return;profPesi()[id]=clamp(n,0,100);updPTot();updValuta();syncProf()}});
 $('#tools').addEventListener('click',e=>{const b=e.target.closest('[data-t]');if(!b)return;const t=b.dataset.t;
  if(t==='cam')$('#fCam').click();else if(t==='gal')$('#fGal').click();else if(t==='file')$('#fFile').click();else if(t==='pagina')onPhoto(null,true);else if(t==='cambia')resetFoto();else if(t==='ok')conferma();
  else if(t==='intera'){const w=S.src.width,h=S.src.height;S.q=[[0,0],[w,0],[w,h],[0,h]];placeH();drawView()}
  else if(t==='ruotaFoto'){const w=S.src.width,h=S.src.height,o=document.createElement('canvas');o.width=h;o.height=w;const x=o.getContext('2d',{willReadFrequently:true});x.translate(h,0);x.rotate(Math.PI/2);x.drawImage(S.src,0,0);const m=p=>[h-p[1],p[0]],q=S.q;S.src=o;S.srcData=null;S.disp=null;S.q=[m(q[3]),m(q[0]),m(q[1]),m(q[2])];layoutView()}
  else if(t==='uni'){S.set.uni=!S.set.uni;b.setAttribute('aria-pressed',S.set.uni);saveSet()}
  else if(t==='angoli'){S.mode='angoli';renderSheet()}
  else if(t==='ruota'){$('#anonimo').checked=false;S.rot=(S.rot+1)%4;S.out=rotC(S.proc,S.rot);layoutPrev()}
  else if(t==='cont'){S.set.cont=!S.set.cont;b.setAttribute('aria-pressed',S.set.cont);saveSet();busy('Aggiorno il contrasto…');setTimeout(()=>{buildOut();layoutPrev();busy(false)},40)}});
 document.querySelectorAll('.hnd').forEach((h,i)=>{
  h.addEventListener('pointerdown',e=>{e.preventDefault();try{h.setPointerCapture(e.pointerId)}catch(_){}S.drag={i,id:e.pointerId,x:e.clientX,y:e.clientY,qx:S.q[i][0],qy:S.q[i][1]};h.classList.add('drag');$('#loupe').hidden=false;drawLoupe(i)});
  h.addEventListener('pointermove',e=>{const d=S.drag;if(!d||d.id!==e.pointerId)return;moveH(i,d.qx+(e.clientX-d.x)/S.vs,d.qy+(e.clientY-d.y)/S.vs)});
  const end=e=>{if(S.drag&&S.drag.id===e.pointerId){S.drag=null;h.classList.remove('drag');$('#loupe').hidden=true}};h.addEventListener('pointerup',end);h.addEventListener('pointercancel',end);
  h.addEventListener('keydown',e=>{const s=(e.shiftKey?10:1)/S.vs,m={ArrowLeft:[-s,0],ArrowRight:[s,0],ArrowUp:[0,-s],ArrowDown:[0,s]}[e.key];if(!m)return;e.preventDefault();moveH(i,S.q[i][0]+m[0],S.q[i][1]+m[1])})});
 $('#token').addEventListener('input',()=>{$('#anonimo').checked=false});
 $('#disconnetti').addEventListener('click',()=>{$('#token').value='';$('#anonimo').checked=false});
 $('#prof').addEventListener('change',()=>{$('#anonimo').checked=false});
 $('#profBox').addEventListener('input',()=>{$('#anonimo').checked=false});
 $('#valuta').addEventListener('click',()=>valuta());$('#stop').addEventListener('click',()=>{if(S.ctl)S.ctl.abort()});
 $('#err').addEventListener('click',e=>{if(e.target.closest('[data-x="retry"]'))valuta()});
 $('#come').addEventListener('click',e=>{if(e.target.closest('[data-x="ex"]')){$('#exDet').open=true;$('#exDet').scrollIntoView({behavior:beh(),block:'start'})}});
 $('#scheda').addEventListener('click',e=>{const b=e.target.closest('[data-a]');if(!b||!S.res&&b.dataset.a!=='nuova')return;const a=b.dataset.a,r=S.res;
  if(a==='meno'||a==='piu'){const i=+b.closest('.cr').dataset.i,c=r.criteri[i];c.punteggio=c.punteggio==null?6:clamp(c.punteggio+(a==='piu'?.25:-.25),1,10);updRow(i);updVoto();persist()}
  else if(a==='copia')copyText(CT.schedaText(r),'Scheda copiata');
  else if(a==='riga')copyText(CT.tsv(CT.table([{...CT.toRec(r),id:r.savedId||''}]),false),'Riga copiata: incollala in Excel o in Fogli');
  else if(a==='elimina')twoStep(b,'Elimina',()=>eliminaVoce(r.savedId));
  else if(a==='nuova'){S.res=null;resetProf();renderScheda();resetFoto();$('.sheet').scrollIntoView({behavior:beh(),block:'start'});if(S.lastSrc==='file'&&S.tpdf)onPhoto(null,true);else $({gal:'#fGal',file:'#fFile'}[S.lastSrc]||'#fCam').click()}});
 $('#scheda').addEventListener('input',e=>{const r=S.res;if(!r||r.esempio)return;if(e.target.id==='codice'){r.codice=e.target.value;persist()}else if(e.target.id==='giud'){r.giudizio=e.target.value;persist()}});
 $('#scheda').addEventListener('change',e=>{const r=S.res;if(!r||r.esempio||e.target.id!=='tetto')return;r.tetto=e.target.checked;const m=$('#tettoMod'),ch=!!r.tetto!==!!r.tettoAi;if(m){m.hidden=!ch;m.textContent=ch?(r.tettoAi?'tolto dal docente, il modello lo aveva segnalato':'aggiunto dal docente'):''}updVoto();persist()});
 $('#rlist').addEventListener('click',e=>{const b=e.target.closest('[data-r]');if(!b)return;const id=b.closest('details').dataset.id,rec=S.reg.find(r=>r.id===id);if(!rec)return;const a=b.dataset.r;
  if(a==='apri'){S.res=CT.fromRec(rec);S.saveK='ok';renderScheda();updValuta();$('#scheda').scrollIntoView({behavior:beh(),block:'start'})}
  else if(a==='copia')copyText(CT.schedaText(CT.fromRec(rec)),'Scheda copiata');
  else if(a==='del')twoStep(b,'Elimina',()=>eliminaVoce(id))});
 $('#rlist').addEventListener('toggle',e=>{const d=e.target;if(d.tagName!=='DETAILS')return;if(d.open)S.regOpen.add(d.dataset.id);else S.regOpen.delete(d.dataset.id)},true);
 $('#rf').addEventListener('input',renderReg);
 $('#rCopy').addEventListener('click',()=>copyText(CT.tsv(CT.table(S.regList),true),'Registro copiato: incollalo in Excel o in Fogli'));
 $('#rCsv').addEventListener('click',scaricaCSV);
 $('#cboxX').addEventListener('click',()=>{$('#cbox').hidden=true})}

/* ---------- avvio */
function start(){applySet(lsGet('ct.set'));const rf=lsGet('ct.ref');if(rf&&typeof rf.d==='string'&&rf.d.startsWith('data:image/')){try{S.ref={blob:d2b(rf.d),url:rf.d,name:str(rf.name)||'riferimento'}}catch(e){}}
 S.res=CT.esempio();
 bind();renderSettings();renderSheet();renderScheda();renderReg();
 const ro=new ResizeObserver(()=>{const w=$('#stage').clientWidth;if(w===S.lastW)return;S.lastW=w;if(S.mode==='angoli')layoutView();else if(S.mode==='anteprima')layoutPrev()});ro.observe($('#stage'));
 initCaps()}
start();
}

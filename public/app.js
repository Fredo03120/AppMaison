const CATS=['Plats','Salades','Soupes & entrées','Desserts','Petit-déj & goûter','Bases'];
const SHOP_ORDER=['Fruits & légumes','Viandes & poissons','Crèmerie & fromages','Épicerie','Placard','Divers'];
const S={recipes:{},menu:{},checked:{},extras:{},view:'recettes',detail:null,edit:null,q:'',cat:'',ready:false,offline:false,confirmDel:false,photo:null};
let db=null, assets=null;
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(t){const el=$('#toast');el.textContent=t;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>el.hidden=true,2200)}

/* ---------- Quantités ---------- */
const FR={'½':.5,'¼':.25,'¾':.75,'⅓':1/3,'⅔':2/3};
function num(s){return s in FR?FR[s]:parseFloat(String(s).replace(',','.'))}
function fmtNum(x){
  const w=Math.floor(x+1e-9), f=x-w;
  const fr=Math.abs(f-.5)<.01?'½':Math.abs(f-.25)<.01?'¼':Math.abs(f-.75)<.01?'¾':null;
  if(fr) return (w?w:'')+fr;
  return (Math.round(x*10)/10).toString().replace('.',',');
}
function niceRound(x,unit){
  if(unit==='g'||unit==='ml') return x>=50?Math.round(x/5)*5:Math.round(x);
  if(/^c\. à/.test(unit||'')) return Math.max(.5,Math.round(x*2)/2);
  return x<=.5+1e-9?.5:Math.ceil(x-.05); // on achète des oignons, des gousses, des sachets entiers
}
function scaleText(t,f){
  if(Math.abs(f-1)<1e-9) return t;
  return t.replace(/^(\d+(?:[.,]\d+)?|[½¼¾⅓⅔])(\s*(?:à|-)\s*)?(\d+(?:[.,]\d+)?)?/,(m,a,sep,b)=>{
    const rest=t.slice(m.length).trim(), u=(rest.match(/^(kg|g|cl|ml|l)\b/)||[])[1]||'';
    const r=v=>fmtNum(niceRound(num(v)*f,u?'g':/^c\. à/.test(rest)?'c. à':''));
    return r(a)+(b?sep+r(b):'');
  });
}
const UNITS=['kg','g','mg','cl','ml','dl','l','c. à soupe','c. à café','cuillères à soupe','cuillère à soupe','cuillères à café','cuillère à café','sachets','sachet','pincées','pincée','gousses','gousse','tranches','tranche','pots','pot','boîtes','boîte','bouteilles','bouteille','cubes','cube','feuilles','feuille','branches','branche','brins','brin','bottes','botte','verres','verre','poignées','poignée','noix','filet','morceaux','morceau','paquets','paquet','plaques','plaque','bâtonnets','bâtonnet'].sort((a,b)=>b.length-a.length);
const CATW=[
 ['Placard',null,['sel','gros sel','poivre','huile',"huile d'olive",'huile de friture','eau','sucre','sucre en poudre','farine','vinaigre']],
 ['Fruits & légumes','banane,carotte,oignon,échalote,ail,pomme de terre,pommes de terre,patate,courgette,aubergine,tomate,concombre,poireau,champignon,cèpe,brocoli,chou,butternut,courge,citron,avocat,cerise,mirabelle,salade,poivron,persil,coriandre,menthe,basilic,cerfeuil,ciboulette,thym,laurier,romarin,bouquet garni,épinard,navet,céleri,fruits,framboise,fraise,pomme,poire,piment,gingembre,herbes,estragon,sauge,potiron,radis,haricot,petits pois,courge'.split(',')],
 ['Viandes & poissons','bœuf,boeuf,veau,porc,poulet,lardon,jambon,saucisse,viande,dinde,canard,chorizo,poisson,saumon,thon,crevette,cabillaud,osso bucco,os à moelle,gîte,paleron,agneau,merguez'.split(',')],
 ['Crèmerie & fromages','beurre,lait,crème,œuf,oeuf,jaune,fromage,emmental,gruyère,comté,parmesan,mozzarella,reblochon,mascarpone,ricotta,yaourt,feta,chèvre,pecorino,gorgonzola,cheddar,faisselle,margarine,levure fraîche,gnocchis frais,pâte brisée,pâte feuilletée,raclette,camembert'.split(',')],
];
function category(name){
  const n=name.toLowerCase();
  if(/^(lait de coco|lait d'avoine|tomates concassées|pulpe|coulis|concentré|bouillon|noix de muscade|cerneaux|noix de pécan)/.test(n)) return 'Épicerie';
  for(const [c,,words] of CATW.filter(x=>x[0]==='Placard')) if(words.includes(n)) return c;
  for(const [c,words] of CATW.slice(1)) for(const w of words){ if(new RegExp("(^|[\\s'-])"+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).test(n)) return c; }
  return 'Épicerie';
}
function parseLine(line){
  const t=line.trim().replace(/\s+/g,' ');
  const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
  let m=t.match(/^(\d+(?:[.,]\d+)?|[½¼¾⅓⅔])(?:\s*(?:à|-)\s*(\d+(?:[.,]\d+)?))?\s*(.*)$/);
  let q=null,u='',rest=t;
  if(m){q=num(m[2]||m[1]);rest=m[3];const low=rest.toLowerCase();for(const un of UNITS){if(low===un||low.startsWith(un+' ')||low.startsWith(un+"'")){u=un;rest=rest.slice(un.length).trim();break}}}
  rest=rest.replace(/^(de la |de l'|du |des |de |d'|d’)/i,'');
  let name=rest.split(/[(,]| ou /)[0].trim();
  const pair=name.match(/^(\w[\wéèêàç]*) et (\w[\wéèêàç]*)$/i);
  if(q===null&&pair) return {t,items:[pair[1],pair[2]].map(n=>({q:null,u:'',n:cap(n),c:category(n)}))};
  name=name.replace(/^facultatif ?: ?/i,'');
  return {t,items:[{q,u,n:cap(name||t),c:category(name||t)}]};
}

/* ---------- Liste de courses ---------- */
function keyOf(n){return n.toLowerCase().replace(/[’]/g,"'").split(/\s+/).map(w=>w.length>3?w.replace(/[sx]$/,''):w).join(' ')}
function unitFam(u){
  if(['g','kg','mg'].includes(u)) return ['g',{g:1,kg:1000,mg:.001}[u]];
  if(['ml','cl','dl','l'].includes(u)) return ['ml',{ml:1,cl:10,dl:100,l:1000}[u]];
  let s=u.replace(/^cuillères? à soupe$/,'c. à soupe').replace(/^cuillères? à café$/,'c. à café');
  if(!s.startsWith('c. à')) s=s.replace(/(x|s)$/,(m)=>s==='noix'?m:'');
  return [s,1];
}
function plural(u,x){if(!u||u.startsWith('c. à')||x<2||/[sx]$/.test(u))return u;return u==='morceau'?'morceaux':u+'s'}
function fmtQty(fam,x){
  if(fam==='g') return x>=1000?fmtNum(Math.round(x/100)/10)+' kg':fmtNum(niceRound(x,'g'))+' g';
  if(fam==='ml'){ if(x>=1000) return fmtNum(Math.round(x/100)/10)+' l'; const r=niceRound(x,'ml'); return r%10===0&&r>=50?fmtNum(r/10)+' cl':fmtNum(r)+' ml'}
  const r=niceRound(x,fam); return fmtNum(r)+(fam?' '+plural(fam,r):'');
}
function factor(r,serv){return r.portions?serv/r.portions:serv}
function shoppingList(){
  const map=new Map();
  for(const [id,serv] of Object.entries(S.menu)){
    const r=S.recipes[id]; if(!r||!serv) continue;
    const f=factor(r,serv);
    for(const g of r.groups||[]) for(const ing of g.ing||[]) for(const it of ing.items||[]){
      if(/^eau\b/i.test(it.n)) continue;
      const k=keyOf(it.n);
      let e=map.get(k); if(!e){e={k,n:it.n,c:it.c||category(it.n),qs:{},bare:false,from:new Set()};map.set(k,e)}
      if(it.n.length>e.n.length&&keyOf(it.n)===k) e.n=it.n;
      e.from.add(r.title.split(/ (au|aux|à la|à l'|et|de) /)[0]);
      if(it.q==null) e.bare=true; else {const [fam,mul]=unitFam(it.u||'');e.qs[fam]=(e.qs[fam]||0)+it.q*mul*f}
    }
  }
  for(const [id,x] of Object.entries(S.extras)) if(x&&!x.gone) map.set('x:'+id,{k:'x:'+id,n:x.t,c:'Divers',qs:{},bare:true,from:new Set(['Ajouté à la main']),extra:id});
  return [...map.values()].map(e=>({...e,qty:Object.entries(e.qs).map(([f,x])=>fmtQty(f,x)).join(' + '),from:[...e.from].join(', ')}));
}

/* ---------- Données partagées ---------- */
async function boot(){
  render();
  db=await claude.use('db').catch(()=>null);
  if(!db){S.offline=true;render();return}
  assets=await claude.use('assets').catch(()=>null);
  db.collection('recipes').onSnapshot(snap=>{const o={};snap.docs.forEach(d=>o[d.id]=d.data());S.recipes=o;S.ready=true;render()},()=>{S.offline=true;render()});
  db.doc('state/menu').onSnapshot(d=>{const it=keepPending(PEND.menu,{...((d.exists&&d.data().items)||{})});S.menu=Object.fromEntries(Object.entries(it).filter(([,v])=>v>0));render()});
  db.doc('state/courses').onSnapshot(d=>{const x=d.exists?d.data():{};S.checked=keepPending(PEND.checked,{...(x.checked||{})});S.extras=x.extras||{};render()});
}
async function upd(path,patch){
  try{await db.doc(path).update(patch)} // doc_merge crée le document s'il n'existe pas
  catch(e){toast(e&&e.code==='quota_exceeded'?'Le carnet est plein, supprimez quelques recettes.':'Enregistrement impossible, réessayez.')}
}
// Un clic local garde la main tant que le serveur ne l'a pas confirmé : sinon l'écho d'un clic
// précédent (ou de l'autre téléphone) décoche la case une fraction de seconde après.
const PEND={menu:{},checked:{}};
function keepPending(pend,data){
  const now=Date.now();
  for(const [k,p] of Object.entries(pend)){
    if(now-p.t>10000||(data[k]??null)===p.v||(!data[k]&&!p.v)) delete pend[k]; else data[k]=p.v;
  }
  return data;
}
function setServ(id,n){PEND.menu[id]={v:n,t:Date.now()};S.menu={...S.menu};if(n>0)S.menu[id]=n;else delete S.menu[id];render();if(db)upd('state/menu',{items:{[id]:n}})}
function toggleCheck(k,v){PEND.checked[k]={v,t:Date.now()};S.checked={...S.checked,[k]:v};render();if(db)upd('state/courses',{checked:{[k]:v}})}

/* ---------- Rendu ---------- */
const ICON={
 plus:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
 check:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
 back:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
 search:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>',
};
function thumb(r){return r.img?`<img src="${esc(r.img)}" alt="" loading="lazy">`:`<span class="ph" aria-hidden="true">${esc((r.title||'?')[0])}</span>`}
function metaLine(r){const m=(r.meta||[]).filter(x=>!/^Portion/.test(x[0])).map(x=>x[1]);return [r.ptxt,...m.slice(0,1)].filter(Boolean).join(' · ')}
function servLabel(r,n){if(!r.portions) return n===1?'1 fournée':n+' fournées';return (r.ptxt||'').match(/\d/)?r.ptxt.replace(/\d+(\s*à\s*\d+)?/,n):n+' personnes'}

function vRecettes(){
  if(S.offline) return `<div class="empty"><h2>Carnet hors ligne</h2><p>Connexion au carnet impossible. Vérifiez le réseau, puis rouvrez l'appli.</p></div>`;
  if(!S.ready) return `<div class="empty"><h2>Ouverture du carnet…</h2><p>Vos recettes arrivent. Vous pourrez en ajouter avec le bouton « Nouvelle recette ».</p></div>`;
  const q=S.q.trim().toLowerCase();
  const list=Object.entries(S.recipes).filter(([,r])=>(!S.cat||r.cat===S.cat)&&(!q||(r.title+' '+(r.sub||'')+' '+(r.groups||[]).flatMap(g=>g.ing.map(i=>i.t)).join(' ')).toLowerCase().includes(q)))
    .sort((a,b)=>a[1].title.localeCompare(b[1].title,'fr'));
  const counts={};Object.values(S.recipes).forEach(r=>counts[r.cat]=(counts[r.cat]||0)+1);
  return `<div class="toolbar"><div class="search">${ICON.search}<input id="q" type="search" placeholder="Chercher une recette ou un ingrédient" aria-label="Chercher" value="${esc(S.q)}"></div>
   <button class="btn primary" data-act="new">${ICON.plus}Nouvelle recette</button></div>
   <div class="chips" role="group" aria-label="Catégories"><button class="chip" data-cat="" aria-pressed="${!S.cat}">Toutes · ${Object.keys(S.recipes).length}</button>${CATS.filter(c=>counts[c]).map(c=>`<button class="chip" data-cat="${esc(c)}" aria-pressed="${S.cat===c}">${esc(c)} · ${counts[c]}</button>`).join('')}</div>
   ${list.length?(!S.cat&&!q?CATS.concat(['Autres']).map(c=>{const l=list.filter(([,r])=>(CATS.includes(r.cat)?r.cat:'Autres')===c);return l.length?`<section class="sect"><h2>${esc(c)}<small>${l.length} recette${l.length>1?'s':''}</small></h2><div class="grid">${l.map(card).join('')}</div></section>`:''}).join(''):`<div class="grid">${list.map(card).join('')}</div>`)
     :`<div class="empty"><h2>Aucune recette trouvée</h2><p>Essayez un autre mot, ou ajoutez-la avec « Nouvelle recette ».</p></div>`}`;
}
function card([id,r]){return `<article class="card"><button class="open" data-open="${esc(id)}"><div class="thumb">${thumb(r)}</div><div class="txt"><h3>${esc(r.title)}</h3><span class="meta">${esc(metaLine(r))}</span></div></button>
     <button class="add" data-toggle="${esc(id)}" aria-pressed="${!!S.menu[id]}" aria-label="${S.menu[id]?'Retirer du menu':'Ajouter au menu'} : ${esc(r.title)}">${S.menu[id]?ICON.check:ICON.plus}</button></article>`;
}
function vDetail(){
  const id=S.detail, r=S.recipes[id];
  if(!r) return `<button class="btn ghost back" data-act="home">${ICON.back}Recettes</button><div class="empty"><h2>Recette introuvable</h2></div>`;
  const inMenu=!!S.menu[id]; const serv=S.menu[id]||S.preview?.[id]||(r.portions||1); const f=factor(r,serv);
  const ings=(r.groups||[]).map(g=>`${g.g?`<h4>${esc(g.g)}</h4>`:''}<ul>${g.ing.map(i=>`<li>${esc(scaleText(i.t,f))}</li>`).join('')}</ul>`).join('');
  let steps='',buf=[];const flush=()=>{if(buf.length){steps+=`<ol>${buf.join('')}</ol>`;buf=[]}};
  (r.steps||[]).forEach(s=>{if(s.startsWith('## ')){flush();steps+=`<h4>${esc(s.slice(3))}</h4>`}else buf.push(`<li><span>${esc(s)}</span></li>`)});flush();
  return `<button class="btn ghost back" data-act="home">${ICON.back}Recettes</button>
  <div class="detail"><div class="ings">
    ${r.img?`<div class="hero"><img src="${esc(r.img)}" alt="${esc(r.alt||r.title)}"></div>`:''}
    <div class="servings" aria-label="Quantité"><button data-serv="-1" aria-label="Moins">−</button><span>${esc(servLabel(r,serv))}</span><button data-serv="1" aria-label="Plus">+</button></div>
    <div class="actions"><button class="btn ${inMenu?'':'primary'}" data-toggle="${esc(id)}">${inMenu?ICON.check+'Dans le menu':ICON.plus+'Ajouter au menu'}</button></div>
    <h2 style="margin-top:22px">Ingrédients</h2>${ings||'<p class="status">Pas d’ingrédients notés.</p>'}
  </div>
  <div class="steps">
    <span class="status">${esc(r.cat||'')}</span>
    <h1 class="dtitle">${esc(r.title)}</h1>${r.sub&&!r.title.toLowerCase().includes(r.sub.toLowerCase())?`<p class="dsub">${esc(r.sub)}</p>`:''}
    <div class="facts">${(r.meta||[]).map(m=>`<div><b>${esc(m[0])}</b>${esc(m[1])}</div>`).join('')}</div>
    <h2>Préparation</h2>${steps||'<p class="status">Pas d’étapes notées.</p>'}
    ${(r.notes||[]).map(n=>`<p class="note">${esc(n)}</p>`).join('')}${r.source?`<p class="note">${esc(r.source)}</p>`:''}
    <div class="actions" style="margin-top:28px"><button class="btn" data-act="editr">Modifier</button>${window.Social&&Social.canCopy()?'<button class="btn" data-act="copyto">Copier vers un autre groupe</button>':''}<button class="btn danger" data-act="askdel">Supprimer</button></div>
    ${S.confirmDel?`<div class="confirm" style="margin-top:12px"><span>Supprimer « ${esc(r.title)} » pour tout le groupe ?</span><button class="btn danger" data-act="del">Oui, supprimer</button><button class="btn ghost" data-act="nodel">Annuler</button></div>`:''}
  </div></div>`;
}
function vMenu(){
  const ids=Object.keys(S.menu).filter(id=>S.recipes[id]);
  if(!ids.length) return `<h2 style="font-size:28px;margin-bottom:14px">Le menu</h2><div class="empty"><h2>Rien au menu pour l’instant</h2><p>Touchez le + sur une recette pour l’ajouter. La liste de courses se remplit toute seule.</p><p><button class="btn primary" data-view="recettes">Choisir des recettes</button></p></div>`;
  return `<div class="toolbar"><h2 style="font-size:28px;flex:1">Le menu</h2><button class="btn ghost" data-act="clearmenu">Vider le menu</button><button class="btn primary" data-view="courses">Voir la liste de courses</button></div>
  <div class="menu-list">${ids.map(id=>{const r=S.recipes[id],n=S.menu[id];return `<div class="mrow"><div class="thumb">${thumb(r)}</div>
   <button class="linkbtn" data-open="${esc(id)}"><h3>${esc(r.title)}</h3><span class="status">${esc(r.cat||'')}</span></button>
   <div class="ctl"><div class="servings"><button data-mserv="${esc(id)}" data-d="-1" aria-label="Moins">−</button><span>${esc(servLabel(r,n))}</span><button data-mserv="${esc(id)}" data-d="1" aria-label="Plus">+</button></div>
   <button class="iconbtn" data-toggle="${esc(id)}" aria-label="Retirer du menu">✕</button></div></div>`}).join('')}</div>`;
}
function vCourses(){
  const items=shoppingList();
  const add=`<form class="addrow" id="addx"><input id="xt" placeholder="Ajouter un article (ex. papier toilette, 6 yaourts)" aria-label="Article à ajouter"><button class="btn">${ICON.plus}Ajouter</button></form>`;
  if(!items.length) return `<h2 style="font-size:28px;margin-bottom:14px">Liste de courses</h2>${add}<div class="empty"><h2>La liste est vide</h2><p>Ajoutez des recettes au menu : leurs ingrédients s’additionnent ici, rangés par rayon.</p><p><button class="btn primary" data-view="recettes">Choisir des recettes</button></p></div>`;
  const done=items.filter(i=>S.checked[i.k]).length;
  const byCat={};items.forEach(i=>(byCat[i.c]=byCat[i.c]||[]).push(i));
  return `<div class="toolbar"><h2 style="font-size:28px;flex:1">Liste de courses</h2>${done?`<button class="btn ghost" data-act="uncheck">Tout décocher</button>`:''}</div>
  <p class="progress">${done} sur ${items.length} dans le panier · pour ${Object.keys(S.menu).filter(id=>S.recipes[id]).length} recette(s)</p>${add}
  <div class="shop">${SHOP_ORDER.filter(c=>byCat[c]).map(c=>{const l=byCat[c].sort((a,b)=>(!!S.checked[a.k]-!!S.checked[b.k])||a.n.localeCompare(b.n,'fr'));
   return `<section><h2>${esc(c==='Placard'?'Placard':c)}<small>${l.filter(i=>!S.checked[i.k]).length} restant(s)</small></h2>${c==='Placard'?'<p class="hint">À vérifier, vous en avez sûrement déjà.</p>':''}
   ${l.map(i=>`<label class="item ${S.checked[i.k]?'done':''}"><input type="checkbox" data-k="${esc(i.k)}" ${S.checked[i.k]?'checked':''}><span><span class="n">${esc(i.n)}</span>${i.qty?` <span class="q">· ${esc(i.qty)}</span>`:''}<span class="from">${esc(i.from)}</span></span></label>`).join('')}</section>`}).join('')}</div>`;
}
function vEdit(){
  const r=S.edit.id?S.recipes[S.edit.id]:{};const g=r.groups||[];
  const ingTxt=g.map(x=>(x.g?x.g+' :\n':'')+x.ing.map(i=>i.t).join('\n')).join('\n\n');
  const m=Object.fromEntries((r.meta||[]).map(x=>[x[0],x[1]]));
  const stepsTxt=(r.steps||[]).map(s=>s.startsWith('## ')?s.slice(3)+' :':s).join('\n');
  return `<button class="btn ghost back" data-act="${S.edit.id?'canceledit':'home'}">${ICON.back}${S.edit.id?'Retour à la recette':'Recettes'}</button>
  <h2 style="font-size:28px;margin-bottom:16px">${S.edit.id?'Modifier la recette':'Nouvelle recette'}</h2>
  <form class="edit" id="ef">
   <label>Nom de la recette<input id="f-title" required value="${esc(r.title||'')}"></label>
   <div class="row2"><label>Catégorie<select id="f-cat">${CATS.map(c=>`<option ${r.cat===c?'selected':''}>${esc(c)}</option>`).join('')}</select></label>
   <label>Pour combien<input id="f-ptxt" placeholder="4 personnes" value="${esc(r.ptxt||'')}"></label></div>
   <div class="row2"><label>Préparation<input id="f-prep" placeholder="20 min" value="${esc(m['Préparation']||'')}"></label><label>Cuisson<input id="f-cuis" placeholder="45 min" value="${esc(m['Cuisson']||'')}"></label></div>
   <label>Ingrédients <span class="help">Un par ligne, quantité en premier : « 200 g de farine », « 3 œufs ». Une ligne qui finit par « : » fait un sous-titre (ex. « Béchamel : »).</span><textarea id="f-ing">${esc(ingTxt)}</textarea></label>
   <label>Étapes <span class="help">Une étape par ligne.</span><textarea id="f-steps">${esc(stepsTxt)}</textarea></label>
   <label>Notes<textarea id="f-notes" style="min-height:90px">${esc((r.notes||[]).join('\n'))}</textarea></label>
   ${assets?`<label>Photo <span class="help">${r.img?'Choisissez un fichier pour remplacer la photo actuelle.':'Facultatif.'}</span><input id="f-photo" type="file" accept="image/*"></label>`:''}
   <div class="actions"><button class="btn primary" id="f-save">Enregistrer</button><button type="button" class="btn ghost" data-act="${S.edit.id?'canceledit':'home'}">Annuler</button></div>
  </form>`;
}
function render(){
  const v=S.edit?'edit':S.detail?'detail':S.view;
  document.querySelectorAll('nav.tabs button').forEach(b=>b.setAttribute('aria-current',b.dataset.view===S.view?'page':'false'));
  const mc=Object.keys(S.menu).filter(id=>S.recipes[id]).length; $('#b-menu').textContent=mc||'';
  const sl=S.ready?shoppingList():[]; const left=sl.filter(i=>!S.checked[i.k]).length; $('#b-courses').textContent=left||'';
  if(window.Social) $('#b-social').textContent=Social.badge();
  const ae=document.activeElement, fid=ae&&ae.id, sel=fid&&ae.selectionStart, val=ae&&ae.value;
  if(v==='edit'&&$('#ef')) return; // ne pas effacer un formulaire en cours
  if(v==='social'&&$('#s-newgroup')&&Social.busy()) return;
  $('#app').innerHTML=v==='edit'?vEdit():v==='detail'?vDetail():v==='menu'?vMenu():v==='courses'?vCourses():v==='social'?Social.html():vRecettes();
  if(['q','xt','msg','s-add-in'].includes(fid)){const el=document.getElementById(fid);if(el){if(fid!=='q'&&fid!=='msg')el.value=val;el.focus();try{el.setSelectionRange(sel,sel)}catch(e){}}}
  if(v==='social') Social.after();
}
function go(view){if(view==='social'&&window.Social)Social.reset();S.view=view;S.detail=null;S.edit=null;S.confirmDel=false;render();scrollTo(0,0)}

/* ---------- Événements ---------- */
document.addEventListener('click',async e=>{
  const b=e.target.closest('button,[data-k]'); if(!b) return;
  if(b.dataset.view){go(b.dataset.view);return}
  if(b.dataset.cat!==undefined){S.cat=b.dataset.cat;render();return}
  if(b.dataset.open){S.detail=b.dataset.open;S.edit=null;S.confirmDel=false;render();scrollTo(0,0);return}
  if(b.dataset.toggle){const id=b.dataset.toggle,r=S.recipes[id];if(S.menu[id]){setServ(id,0);toast('Retiré du menu')}else{setServ(id,(S.preview&&S.preview[id])||r.portions||1);toast('Ajouté au menu')}return}
  if(b.dataset.serv){const id=S.detail,r=S.recipes[id];const cur=S.menu[id]||(S.preview&&S.preview[id])||r.portions||1;const n=Math.max(1,cur+ +b.dataset.serv);
    if(S.menu[id]) setServ(id,n); else {S.preview={...(S.preview||{}),[id]:n};render()} return}
  if(b.dataset.mserv){const id=b.dataset.mserv;const n=S.menu[id]+ +b.dataset.d;if(n>=1)setServ(id,n);return}
  const a=b.dataset.act;
  if(a==='home'){go('recettes');return}
  if(a==='new'){S.edit={id:null};S.detail=null;render();scrollTo(0,0);return}
  if(a==='editr'){S.edit={id:S.detail};render();scrollTo(0,0);return}
  if(a==='canceledit'){S.edit=null;render();return}
  if(a==='copyto'){Social.copyTo(S.detail,S.recipes[S.detail]);return}
  if(a==='askdel'){S.confirmDel=true;render();return}
  if(a==='nodel'){S.confirmDel=false;render();return}
  if(a==='del'){const id=S.detail;try{await db.doc('recipes/'+id).delete();if(S.menu[id])setServ(id,0);toast('Recette supprimée');go('recettes')}catch(err){toast('Suppression impossible, réessayez.')}return}
  if(a==='clearmenu'){S.menu={};PEND.menu={};PEND.checked={};render();if(db){try{await db.doc('state/menu').set({items:{}});await db.doc('state/courses').set({checked:{},extras:S.extras})}catch(err){toast('Enregistrement impossible, réessayez.')}}return}
  if(a==='uncheck'){S.checked={};PEND.checked={};render();if(db)try{await db.doc('state/courses').set({checked:{},extras:Object.fromEntries(Object.entries(S.extras).filter(([,x])=>x&&!x.gone))})}catch(err){toast('Enregistrement impossible, réessayez.')}return}
});
document.addEventListener('change',e=>{
  const k=e.target.dataset&&e.target.dataset.k; if(!k) return;
  const v=e.target.checked; toggleCheck(k,v);
  if(v&&k.startsWith('x:')){const id=k.slice(2);setTimeout(()=>{if(S.checked[k])upd('state/courses',{extras:{[id]:{...S.extras[id],gone:true}},checked:{[k]:false}})},4000)}
});
document.addEventListener('input',e=>{if(e.target.id==='q'){S.q=e.target.value;render()}});
document.addEventListener('submit',async e=>{
  e.preventDefault();
  if(e.target.id==='addx'){const t=$('#xt').value.trim();if(!t)return;const id='x'+Date.now().toString(36);S.extras={...S.extras,[id]:{t}};$('#xt').value='';render();if(db)upd('state/courses',{extras:{[id]:{t}}});return}
  if(e.target.id==='ef'){
    if(!db){toast('Carnet indisponible ici.');return}
    const old=S.edit.id?S.recipes[S.edit.id]:null; const oldT=new Map();(old?.groups||[]).forEach(g=>g.ing.forEach(i=>oldT.set(i.t,i)));
    const groups=[];let cur=null;
    $('#f-ing').value.split('\n').forEach(l=>{l=l.trim();if(!l){return}
      if(/:$/.test(l)&&!/^\d/.test(l)){cur={g:l.replace(/\s*:$/,''),ing:[]};groups.push(cur);return}
      if(!cur){cur={g:'',ing:[]};groups.push(cur)} cur.ing.push(oldT.get(l)||parseLine(l))});
    const steps=$('#f-steps').value.split('\n').map(s=>s.trim()).filter(Boolean).map(s=>/:$/.test(s)&&s.length<40?'## '+s.replace(/\s*:$/,''):s);
    const ptxt=$('#f-ptxt').value.trim();const pm=ptxt.match(/\d+/);
    const meta=[['Préparation',$('#f-prep').value.trim()],['Cuisson',$('#f-cuis').value.trim()],['Portions',ptxt]].filter(x=>x[1]);
    const keep=(old?.meta||[]).filter(x=>!['Préparation','Cuisson','Portions'].includes(x[0]));
    const title=$('#f-title').value.trim();
    const doc={...(old||{}),title,cat:$('#f-cat').value,ptxt,portions:pm?+pm[0]:null,meta:[...meta.slice(0,1),...keep,...meta.slice(1)],groups,steps,notes:$('#f-notes').value.split('\n').map(s=>s.trim()).filter(Boolean)};
    const file=$('#f-photo')&&$('#f-photo').files[0];
    const btn=$('#f-save');btn.disabled=true;btn.textContent='Enregistrement…';
    try{
      if(file&&assets){const up=await assets.upload(file);doc.img=up.url;doc.alt=title}
      const id=S.edit.id||(title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'recette')+'-'+Date.now().toString(36).slice(-4);
      await db.doc('recipes/'+id).set(doc);
      S.edit=null;S.detail=id;toast('Recette enregistrée');render();scrollTo(0,0);
    }catch(err){btn.disabled=false;btn.textContent='Enregistrer';toast(err&&err.code==='quota_exceeded'?'Le carnet est plein.':'Enregistrement impossible, réessayez.')}
  }
});
window.startApp=boot;

const CATS=['Plats','Salades','Soupes & entrées','Desserts','Petit-déj & goûter','Bases'];
const SHOP_ORDER=['Boulangerie','Fruits & légumes','Viandes & poissons','Crèmerie & fromages','Épicerie','Boissons','Surgelés','Hygiène & beauté','Entretien & maison','Bébé & animaux','Placard','Divers'];
const S={adj:{},recipes:{},menu:{},plan:{},week:{},done:{},weekOff:0,selDay:null,checked:{},extras:{},hidden:{},always:{},habits:{},rayons:null,trash:{},trashView:false,confirmClear:false,view:'recettes',detail:null,edit:null,q:'',cat:'',ready:false,offline:false,confirmDel:false,photo:null,cf:null,cfAddr:'',net:navigator.onLine!==false,pend:0,menuTab:(()=>{try{return localStorage.getItem('menuTab')||'semaine'}catch(e){return 'semaine'}})()};
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
// Rayons surtout utiles pour les articles ajoutés à la main ; testés après les rayons ci-dessus.
const CATW2=[
 ['Boulangerie','pain,baguette,brioche,croissant,pain au chocolat,chocolatine,viennoiserie,biscotte,pain de mie,ficelle,tradition,galette des rois,fougasse,wrap,tortilla'.split(',')],
 ['Surgelés','surgelé,surgelée,glaces,crème glacée,glace vanille,glace au chocolat,frites,poisson pané,pizza surgelée,bâtonnets de poisson,nuggets'.split(',')],
 ['Boissons','eau,eaux,jus,soda,coca,limonade,sirop,bière,vin,cidre,champagne,whisky,rhum,apéritif,lait d\'amande'.split(',')],
 ['Hygiène & beauté','gel douche,savon,shampoing,shampooing,après-shampoing,dentifrice,brosse à dents,brosses à dents,déodorant,coton,cotons,rasoir,mousse à raser,crème hydratante,protections,tampons,serviettes hygiéniques,mouchoirs,crème solaire,maquillage,démaquillant'.split(',')],
 ['Entretien & maison','papier toilette,pq,essuie-tout,sopalin,liquide vaisselle,pastilles,tablettes lave-vaisselle,lessive,adoucissant,éponge,sacs poubelle,sac poubelle,papier alu,papier aluminium,film étirable,papier cuisson,javel,nettoyant,produit,désodorisant,ampoule,piles,pile,allumettes,bougies,sacs congélation,lingettes ménagères,serpillère'.split(',')],
 ['Bébé & animaux','couches,lingettes,lait infantile,petits pots,croquettes,pâtée,litière,friandises chien,friandises chat'.split(',')],
 ['Viandes & poissons','steak,escalope,côte,côtes,rôti,filet mignon,cordon bleu,saucisson,pâté,rillettes,knacki,blanc de poulet,cuisse,cuisses,moules,surimi'.split(',')],
 ['Épicerie','vinaigre,pâtes,spaghetti,tagliatelle,penne,riz,semoule,lentilles,pois chiches,quinoa,café,thé,tisane,chocolat,cacao,céréales,muesli,confiture,miel,pâte à tartiner,nutella,biscuit,gâteaux,compote,sauce,conserve,moutarde,mayonnaise,ketchup,cornichons,olives,chips,apéro,bonbons,épices,levure,maïs,thon'.split(',')],
];
// Article tapé à la main : « 6 yaourts » → rayon des yaourts ; le sel ajouté exprès s'achète en épicerie.
function extraCat(t){const it=parseLine(t).items[0];const c=category(it.n.toLowerCase(),'Divers');return c==='Placard'?'Épicerie':c}
function category(name,fallback='Épicerie'){
  const n=name.toLowerCase();
  if(/^(lait de coco|lait d'avoine|tomates concassées|pulpe|coulis|concentré|bouillon|noix de muscade|cerneaux|noix de pécan)/.test(n)) return 'Épicerie';
  for(const [c,,words] of CATW.filter(x=>x[0]==='Placard')) if(words.includes(n)) return c;
  for(const [c,words] of CATW.slice(1)) for(const w of words){ if(new RegExp("(^|[\\s'-])"+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).test(n)) return c; }
  // Mots entiers ici (au pluriel près) : « vin » ne doit pas attraper « vinaigre ».
  for(const [c,words] of CATW2) for(const w of words){ if(new RegExp("(^|[\\s'-])"+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+"[sx]?($|[\\s'-,])").test(n)) return c; }
  return fallback;
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
// Poids moyen d'une pièce, pour additionner « 2 kg » d'une recette et « 8 » d'une autre.
const PIECE_G=[['pomme de terre',150],['patate',150],['oignon',100],['oignon rouge',100],['échalote',30],['carotte',100],['tomate',120],['tomate cerise',15],['courgette',250],['aubergine',300],['poivron',180],
  ['concombre',350],['poireau',200],['pomme',150],['poire',170],['banane',120],['citron',100],['orange',200],['avocat',200],['navet',150],['patate douce',250],['champignon',20],['gousse',5],['ail',5],
  ['œuf',55],['oeuf',55],['butternut',1200],['courge',1200],['potiron',1500],['brocoli',400],['chou-fleur',800],['céleri',600],['fenouil',250],['betterave',150],['mangue',350],['kiwi',80]];
function pieceG(n){const k=n.toLowerCase();let best=null;for(const [w,g] of PIECE_G) if((k===w||k.startsWith(w+' ')||k.startsWith(w+'s'))&&(!best||w.length>best[0].length)) best=[w,g];return best&&best[1]}
// Quantité affichée : un seul total quand c'est possible, « ≈ » si on a converti des pièces ou des cuillères.
function qtyText(e){
  const qs={...e.qs}; let approx=false;
  const spoon={'c. à soupe':15,'c. à café':5};
  const mass=qs.g!=null?'g':qs.ml!=null?'ml':null;
  if(mass) for(const [f,ml] of Object.entries(spoon)) if(qs[f]!=null){qs[mass]+=qs[f]*ml;delete qs[f];approx=true}
  const pg=pieceG(e.n);
  if(qs['']!=null&&pg&&qs.g!=null){
    if(e.qs.g>=qs['']*pg){qs.g+=qs['']*pg;delete qs['']} // on garde l'unité qui pèse le plus
    else{qs['']+=Math.ceil(qs.g/pg-.2);delete qs.g}
    approx=true;
  }
  const parts=Object.entries(qs).map(([f,x])=>fmtQty(f,x)+(f===''&&Object.keys(qs).length>1?' pièce'+(x>1?'s':''):''));
  return (approx&&parts.length===1?'≈ ':'')+parts.join(' + ');
}
/* ---------- Conditionnements du commerce ----------
   Ce qu'on achète vraiment : 30 g de beurre → 1 plaquette de 250 g ; 3 œufs → 1 boîte de 6.
   [mots, unité de mesure (g, ml, '' pour les pièces), contenance, nom, pluriel, contenance écrite] */
const PACKS=[
 [['beurre'],'g',250,'plaquette','plaquettes','250 g'],
 [['farine'],'g',1000,'paquet','paquets','1 kg'],
 [['sucre glace'],'g',500,'paquet','paquets','500 g'],
 [['sucre','sucre en poudre','sucre roux','cassonade','sucre de canne'],'g',1000,'paquet','paquets','1 kg'],
 [['maïzena','fécule'],'g',250,'boîte','boîtes','250 g'],
 [['poudre d\'amande','amande en poudre','amandes en poudre','poudre de noisette'],'g',125,'sachet','sachets','125 g'],
 [['amande','noisette','noix','cerneaux de noix','pignon','noix de pécan','raisins secs'],'g',125,'sachet','sachets','125 g'],
 [['cacao','cacao en poudre'],'g',250,'boîte','boîtes','250 g'],
 [['chocolat','chocolat noir','chocolat au lait','chocolat blanc','chocolat pâtissier'],'g',200,'tablette','tablettes','200 g'],
 [['pépites de chocolat'],'g',100,'sachet','sachets','100 g'],
 [['riz','riz basmati','riz rond','riz arborio'],'g',1000,'paquet','paquets','1 kg'],
 [['pâtes','spaghetti','tagliatelle','penne','coquillettes','fusilli','macaroni','linguine','farfalle','lasagnes'],'g',500,'paquet','paquets','500 g'],
 [['semoule','couscous','boulgour','quinoa','polenta'],'g',500,'paquet','paquets','500 g'],
 [['lentilles','lentilles corail','pois chiches secs','haricots secs'],'g',500,'paquet','paquets','500 g'],
 [['pois chiches','haricots rouges','haricots blancs','maïs'],'g',400,'boîte','boîtes','400 g'],
 [['tomates concassées','pulpe de tomate','tomates pelées'],'g',400,'boîte','boîtes','400 g'],
 [['coulis de tomate','passata','sauce tomate'],'g',500,'bocal','bocaux','500 g'],
 [['concentré de tomate'],'g',140,'tube','tubes','140 g'],
 [['lait de coco','crème de coco'],'ml',400,'boîte','boîtes','40 cl'],
 [['lait','lait entier','lait demi-écrémé'],'ml',1000,'bouteille','bouteilles','1 l'],
 [['crème liquide','crème fleurette','crème liquide entière','crème entière'],'ml',200,'brique','briques','20 cl'],
 [['crème fraîche','crème fraîche épaisse','crème épaisse','crème'],'ml',200,'pot','pots','20 cl'],
 [['mascarpone'],'g',250,'pot','pots','250 g'],
 [['ricotta'],'g',250,'pot','pots','250 g'],
 [['fromage blanc','faisselle'],'g',500,'pot','pots','500 g'],
 [['yaourt grec','yaourt nature'],'g',500,'pot','pots','500 g'],
 [['gruyère râpé','emmental râpé','fromage râpé','gruyère','emmental'],'g',200,'sachet','sachets','200 g'],
 [['parmesan'],'g',100,'morceau','morceaux','100 g'],
 [['comté'],'g',250,'morceau','morceaux','250 g'],
 [['mozzarella'],'g',125,'boule','boules','125 g'],
 [['feta'],'g',200,'paquet','paquets','200 g'],
 [['chèvre','bûche de chèvre'],'g',180,'bûche','bûches','180 g'],
 [['lardons','lardons fumés','allumettes de lardons'],'g',200,'barquette','barquettes','200 g'],
 [['chorizo'],'g',250,'chorizo','chorizos','250 g'],
 [['œuf','oeuf','œufs','oeufs'],'',6,'boîte','boîtes','6'],
 [['huile d\'olive','huile','huile de tournesol','huile neutre'],'ml',1000,'bouteille','bouteilles','1 l'],
 [['vinaigre','vinaigre balsamique','vinaigre de vin'],'ml',500,'bouteille','bouteilles','50 cl'],
 [['sauce soja'],'ml',250,'bouteille','bouteilles','25 cl'],
 [['vin blanc','vin rouge','vin'],'ml',750,'bouteille','bouteilles','75 cl'],
 [['bière'],'ml',330,'bouteille','bouteilles','33 cl'],
 [['miel'],'g',250,'pot','pots','250 g'],
 [['confiture'],'g',350,'pot','pots','350 g'],
 [['moutarde'],'g',200,'pot','pots','200 g'],
 [['mayonnaise'],'g',235,'pot','pots','235 g'],
 [['flocons d\'avoine'],'g',500,'paquet','paquets','500 g'],
 [['chapelure'],'g',250,'paquet','paquets','250 g'],
 [['champignons de paris','champignons'],'g',250,'barquette','barquettes','250 g'],
 [['tomates cerises'],'g',250,'barquette','barquettes','250 g'],
 [['épinards','pousses d\'épinard','roquette','mâche'],'g',125,'sachet','sachets','125 g'],
 [['framboises','myrtilles','mûres'],'g',125,'barquette','barquettes','125 g'],
 [['fraises'],'g',250,'barquette','barquettes','250 g'],
];
const SPOON_G={'c. à soupe':15,'c. à café':5,'noix':10,'pincée':0.5,'pincées':0.5};
function packOf(e){
  const raw=e.n.toLowerCase(),k=keyOf(raw);let best=null;
  for(const P of PACKS) for(const w of P[0]){const kw=keyOf(w);if((raw===w||k===kw||raw.startsWith(w+' ')||k.startsWith(kw+' '))&&(!best||w.length>best[1]))best=[P,w.length]}
  return best&&best[0];
}
// Nombre de conditionnements pour la recette (et ce qui a été ajouté à la main, compté en conditionnements).
function packCalc(e){
  const P=packOf(e);if(!P)return null;const [,fam,size]=P;let need=0,extra=0;
  const take=(f,x,hand)=>{
    if(f===fam||(fam!==''&&(f==='g'||f==='ml')))need+=x;
    else if(fam!==''&&f in SPOON_G)need+=x*SPOON_G[f];
    else if(f===''&&hand)extra+=x;
    else return false;
    return true};
  for(const [f,x] of Object.entries(e.qs)) if(!take(f,x,false)) return null;
  for(const h of e.hand||[]){const [f,m]=unitFam(h.u);if(!take(f,h.q*m,true))return null}
  return {P,n:(need>0?Math.max(1,Math.ceil(need/size-.05)):0)+extra};
}
function packLabel(P,n){return n+' '+(n>1?P[4]:P[3])+' de '+P[5]}

// « En plus » d'un ingrédient de recette : la quantité de la recette reste affichée à côté.
function adjStep(e){if(packCalc(e))return ['#',1];const f=e.qs.g!=null?'g':e.qs.ml!=null?'ml':e.qs['']!=null||!Object.keys(e.qs).length?'':Object.keys(e.qs)[0];
  return [f,f==='g'||f==='ml'?100:1]}
function handQs(e,qs={}){qs={...qs};for(const h of e.hand||[]){const [f,m]=unitFam(h.u);qs[f]=(qs[f]||0)+h.q*m}return qs}
function totalText(e,n){const pc=packCalc(e);if(pc)return packLabel(pc.P,pc.n+(n||0));const [f,st]=adjStep(e);const qs=handQs(e,e.qs);if(n)qs[f]=(qs[f]||0)+n*st;return qtyText({...e,qs}).replace(/^≈ /,'')}
// « 1 dans la recette · 3 ajoutés à la main · Bœuf »
function detailLine(i){
  const parts=[i.qty?i.qty+' dans la recette':'Dans la recette'];
  if(i.hand){const t=qtyText({...i,qs:handQs(i)}).replace(/^≈ /,'');parts.push((t||'')+(t?' ':'')+'ajouté'+(i.hand.length>1||/^[2-9]|^\d{2}/.test(t)?'s':'')+' à la main')}
  if(S.adj[i.k]>0) parts.push('+ '+adjText(i,S.adj[i.k])+' en plus');
  return parts.concat(i.from).join(' · ');
}
function adjText(e,n){const pc=packCalc(e);if(pc)return n+' '+(n>1?pc.P[4]:pc.P[3]);const [f,st]=adjStep(e);const x=n*st;return f==='g'||f==='ml'?fmtQty(f,x):fmtNum(x)+(f?' '+plural(f,x):'')}
// Icône de chaque rayon.
const AISLE_ICON={'Boulangerie':'🥖','Fruits & légumes':'🥬','Viandes & poissons':'🥩','Crèmerie & fromages':'🧀','Épicerie':'🥫','Boissons':'🧃','Surgelés':'🧊','Hygiène & beauté':'🧴','Entretien & maison':'🧽','Bébé & animaux':'🐾','Placard':'🧂','Divers':'🛒'};
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
  for(const [id,x] of Object.entries(S.extras)) if(x&&!x.gone){
    // Même article qu'une recette (« Oignon » tapé à la main, oignon dans le bœuf) : une seule ligne avec le total.
    const it=parseLine(x.t).items[0], e=map.get(keyOf(it.n));
    if(e&&!e.extra){(e.hand=e.hand||[]).push({id,q:(it.q??1)*(x.q||1),u:it.u||''});continue}
    map.set('x:'+id,{k:'x:'+id,n:x.t,c:extraCat(x.t),qs:{},bare:true,from:new Set(['Ajouté à la main']),extra:id,xq:x.q||1})}
  // Un article retiré revient seulement si sa quantité change (nouvelle recette au menu).
  // Ce qu'on a toujours (sel, huile…) reste caché, sauf si on l'a ajouté à la main exprès.
  return [...map.values()].map(e=>({...e,qty:qtyText(e),from:[...e.from].join(', ')})).filter(e=>e.extra||e.hand||(S.hidden[e.k]!==e.qty&&!S.always[e.k]));
}
// Rayons dans l'ordre du parcours en magasin, choisi par le groupe ; les rayons nouveaux vont à la fin.
function aisleOrder(){const o=((S.rayons&&S.rayons.order)||[]).filter(c=>SHOP_ORDER.includes(c));return o.concat(SHOP_ORDER.filter(c=>!o.includes(c)))}
const nameKey=t=>keyOf(parseLine(t).items[0].n);
// Un article habituel est-il déjà dans la liste (pas encore coché) ?
function onList(t){const k=nameKey(t);return shoppingList().some(i=>!S.checked[i.k]&&(i.extra?nameKey(i.n):i.k)===k)}
function habitsList(){return Object.entries(S.habits).filter(([,h])=>h&&h.t).sort((a,b)=>a[1].t.localeCompare(b[1].t,'fr'))}
function alwaysList(){return Object.entries(S.always).filter(([,v])=>v&&v.n).sort((a,b)=>a[1].n.localeCompare(b[1].n,'fr'))}

/* ---------- Suggestions à la saisie d'un article ---------- */
const COMMON=('Pain,Pain de mie,Pain complet,Baguette,Brioche,Biscottes,Croissants,Lait,Lait demi-écrémé,Beurre,Œufs,Crème fraîche,Yaourts,Yaourts nature,Fromage râpé,Emmental,Comté,Mozzarella,Parmesan,Jambon,Jambon blanc,Lardons,Poulet,Steak haché,Saumon,Thon en boîte,Pâtes,Spaghetti,Riz,Semoule,Lentilles,Farine,Sucre,Sel,Poivre,Huile d\'olive,Huile de tournesol,Vinaigre,Moutarde,Mayonnaise,Ketchup,Sauce tomate,Tomates concassées,Bouillon cube,Café,Thé,Chocolat,Chocolat noir,Céréales,Confiture,Miel,Pâte à tartiner,Biscuits,Compote,Jus d\'orange,Eau,Eau gazeuse,Bière,Vin rouge,Vin blanc,Pommes,Bananes,Oranges,Citrons,Clémentines,Poires,Fraises,Raisin,Tomates,Salade,Concombre,Carottes,Pommes de terre,Oignons,Échalotes,Ail,Courgettes,Poivrons,Champignons,Avocats,Brocoli,Haricots verts,Persil,Basilic,Surgelés,Glace,Frites surgelées,Petits pois,Maïs,Papier toilette,Essuie-tout,Mouchoirs,Liquide vaisselle,Pastilles lave-vaisselle,Lessive,Adoucissant,Éponges,Sacs poubelle,Papier aluminium,Film étirable,Gel douche,Shampoing,Dentifrice,Brosses à dents,Déodorant,Coton,Couches,Lingettes,Croquettes,Litière,Piles,Ampoules').split(',');
const plain=t=>t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/œ/g,'oe');
function suggestions(q){
  q=plain(q.trim()); if(q.length<2) return [];
  const seen=new Set(), out=[];
  const add=n=>{n=n.trim();const k=plain(n);if(!n||seen.has(k))return;seen.add(k);
    const i=k.startsWith(q)?0:k.includes(' '+q)?1:-1; if(i>=0&&k!==q) out.push([i,k.length,n])};
  Object.values(S.extras).forEach(x=>x&&add(x.t)); // déjà ajoutés à la main : d'abord
  Object.values(S.recipes).forEach(r=>(r.groups||[]).forEach(g=>(g.ing||[]).forEach(i=>(i.items||[]).forEach(it=>add(it.n)))));
  COMMON.forEach(add);
  return out.sort((a,b)=>a[0]-b[0]||a[1]-b[1]).slice(0,6).map(x=>x[2]);
}
function addExtra(t){addExtras([t])}
function addExtras(ts){const patch={};ts.forEach((t,i)=>{patch['x'+(Date.now()+i).toString(36)]={t}});S.extras={...S.extras,...patch};S.xq='';render();if(db)upd('state/courses',{extras:patch})}

/* ---------- Données partagées ---------- */
async function boot(){
  render();
  db=await claude.use('db').catch(()=>null);
  if(!db){S.offline=true;render();return}
  assets=await claude.use('assets').catch(()=>null);
  // Sans réseau, la copie gardée sur le téléphone s'affiche ; « hors ligne » seulement s'il n'y a rien du tout.
  db.collection('recipes').onSnapshot(snap=>{const o={};snap.docs.forEach(d=>o[d.id]=d.data());S.recipes=o;S.ready=true;S.offline=false;render();remindBackup()},()=>{if(!S.ready){S.offline=true;render()}});
  db.doc('state/menu').onSnapshot(d=>{const x=d.exists?d.data():{},loc=d.metadata.fromCache;const it=keepPending(PEND.menu,{...(x.items||{})},loc);S.menu=Object.fromEntries(Object.entries(it).filter(([,v])=>v>0));
    // Ancien format : le créneau était rangé dans le menu (plan). On le déplace une fois vers la semaine.
    const old=Object.entries(x.plan||{}).filter(([,v])=>v);if(old.length){const slots={},clr={};old.forEach(([id,v])=>{(slots[v]=slots[v]||{})[id]=true;clr[id]=''});upd('state/semaine',{slots});upd('state/menu',{plan:clr})}
    render()});
  db.doc('state/semaine').onSnapshot(d=>{const x=d.exists?d.data():{};S.week={};const mig={};
    Object.entries(x.slots||{}).forEach(([slot,ids])=>{const l=Object.keys(ids||{}).filter(id=>ids[id]);if(!l.length)return;
      const o=slot.match(/^(\d)-(midi|soir)$/);if(o){const k=slotKey(+o[1],o[2],0);mig[slot]=Object.fromEntries(l.map(id=>[id,false]));mig[k]={...(mig[k]||{}),...Object.fromEntries(l.map(id=>[id,true]))};slot=k}
      S.week[slot]={...(S.week[slot]||{}),...Object.fromEntries(l.map(id=>[id,true]))}});
    if(Object.keys(mig).length)upd('state/semaine',{slots:mig});
    S.done={};Object.entries(x.done||{}).forEach(([slot,ids])=>{const l=Object.keys(ids||{}).filter(id=>ids[id]);if(l.length)S.done[slot]=Object.fromEntries(l.map(id=>[id,true]))});
    S.plan=planIndex();render()});
  db.doc('state/courses').onSnapshot(d=>{const x=d.exists?d.data():{},loc=d.metadata.fromCache;S.checked=keepPending(PEND.checked,{...(x.checked||{})},loc);S.extras=keepPending(PEND.extras,{...(x.extras||{})},loc);S.hidden=x.hidden||{};S.adj=keepPending(PEND.adj,{...(x.adj||{})},loc);S.always=x.always||{};render()});
  db.doc('state/carrefour').onSnapshot(d=>{S.cfAddr=(d.exists&&d.data().address)||'';render()});
  db.doc('state/rayons').onSnapshot(d=>{S.rayons=d.exists?d.data():null;render();renderRayons()});
  db.doc('state/habituels').onSnapshot(d=>{S.habits=(d.exists&&d.data().items)||{};renderHabits()});
  db.collection('trash').onSnapshot(snap=>{const o={};snap.docs.forEach(d=>o[d.id]=d.data());S.trash=o;render();purgeTrash()});
}
// La corbeille se vide toute seule au bout de 30 jours.
let purged=false;
function purgeTrash(){if(purged||!navigator.onLine)return;purged=true;const lim=Date.now()-30*864e5;
  for(const [id,r] of Object.entries(S.trash)) if(r.deletedAt&&Date.parse(r.deletedAt)<lim) db.doc('trash/'+id).delete().catch(()=>{})}
/* ---------- Hors ligne ---------- */
function netBanner(){
  if(S.net&&!S.pend) return '';
  return `<div class="offline" role="status">${S.net?'Réseau revenu : envoi en cours…':'Hors ligne : la liste reste utilisable.'}${S.pend?` ${S.pend} modification${S.pend>1?'s':''} en attente d’être envoyée${S.pend>1?'s':''}.`:' Vos modifications partiront au retour du réseau.'}</div>`;
}
window.addEventListener('online',()=>{S.net=true;render()});
window.addEventListener('offline',()=>{S.net=false;render()});
window.addEventListener('pendingchange',e=>{S.pend=e.detail;render()});
// En courses, l'écran reste allumé.
let lock=null;
async function wakeLock(on){
  try{
    if(on&&!lock&&navigator.wakeLock&&document.visibilityState==='visible'){lock=await navigator.wakeLock.request('screen');lock.addEventListener('release',()=>{lock=null})}
    else if(!on&&lock){const l=lock;lock=null;await l.release()}
  }catch(e){lock=null}
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&S.view==='courses'&&!S.detail&&!S.edit)wakeLock(true)});
async function upd(path,patch){
  try{await db.doc(path).update(patch)} // doc_merge crée le document s'il n'existe pas
  catch(e){toast(e&&e.code==='quota_exceeded'?'Le carnet est plein, supprimez quelques recettes.':'Enregistrement impossible, réessayez.')}
}
// Un clic local garde la main tant que le serveur ne l'a pas confirmé : sinon l'écho d'un clic
// précédent (ou de l'autre téléphone) décoche la case une fraction de seconde après.
const PEND={menu:{},checked:{},adj:{},extras:{}};
const same=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
// Clics rapides sur − / + : on n'envoie que la dernière valeur, un court instant après le dernier clic.
const LATER={};
function sendLater(key,fn){if(LATER[key])clearTimeout(LATER[key].t);LATER[key]={fn,t:setTimeout(()=>{delete LATER[key];fn()},350)}}
function cancelLater(){for(const k in LATER){clearTimeout(LATER[k].t);delete LATER[k]}}
// L'appli passe en arrière-plan : on envoie tout de suite ce qui attendait.
document.addEventListener('visibilitychange',()=>{if(document.hidden)for(const k in LATER){const {fn,t}=LATER[k];clearTimeout(t);delete LATER[k];fn()}});
// local : la valeur vient de la copie locale, pas du serveur ; on ne lâche alors pas le clic en attente,
// sinon l'écho (plus vieux) d'un clic précédent peut effacer le suivant pendant une seconde.
function keepPending(pend,data,local){
  const now=Date.now();
  for(const [k,p] of Object.entries(pend)){
    if(!local&&(now-p.t>10000||same(data[k],p.v)||(!data[k]&&!p.v))) delete pend[k]; else data[k]=p.v;
  }
  return data;
}
function setServ(id,n){PEND.menu[id]={v:n,t:Date.now()};S.menu={...S.menu};if(n>0)S.menu[id]=n;else delete S.menu[id];render();if(db)sendLater('m:'+id,()=>{PEND.menu[id]&&(PEND.menu[id].t=Date.now());upd('state/menu',{items:{[id]:n>0?n:0}})})}
// Index dérivé : pour chaque recette, le premier créneau de la semaine où elle est posée.
function planIndex(){const p={};Object.keys(S.week).sort().forEach(slot=>Object.keys(S.week[slot]).forEach(id=>{if(!p[id])p[id]=slot}));return p}
// Les cases cochées descendent en bas du rayon, mais seulement 1,5 s après le dernier clic :
// sinon la liste bouge sous le doigt et le clic suivant tombe sur la mauvaise ligne.
function toggleCheck(k,v){if(!S.sortChecked)S.sortChecked={...S.checked};clearTimeout(toggleCheck.t);toggleCheck.t=setTimeout(()=>{S.sortChecked=null;render()},1500);
  PEND.checked[k]={v,t:Date.now()};S.checked={...S.checked,[k]:v};render();if(db)upd('state/courses',{checked:{[k]:v}})}

/* ---------- Rendu ---------- */
const ICON={
 sun:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
 moon:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
 spark:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 4l1.8 4.7L16.5 10.5l-4.7 1.8L10 17l-1.8-4.7L3.5 10.5l4.7-1.8z"/><path d="M18 14l.9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9z"/></svg>',
 cart:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/><circle cx="10" cy="20.5" r="1"/><circle cx="17" cy="20.5" r="1"/></svg>',
 leaf:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19C5 10 10 5 20 4c-1 10-6 15-15 15z"/><path d="M5 19l7-7"/></svg>',
 plus:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
 check:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
 back:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
 link:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
 user:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/></svg>',
 clock:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4.5l3 2"/></svg>',
 chev:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
 search:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>',
 star:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8z"/></svg>',
 sort:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M4 12h10M4 17h6"/><path d="M18 11v8m0 0l-3-3m3 3l3-3"/></svg>',
 up:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>',
 down:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
};
const CAT_ICON={
 '':'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></svg>',
 'Plats':'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17h18M5 17a7 7 0 0 1 14 0M12 8V6.5M10.5 6.5h3"/></svg>',
 'Salades':'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19C5 10 10 5 19 5c0 9-5 14-14 14z"/><path d="M5 19l8-8"/></svg>',
 'Soupes & entrées':'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11h18a9 9 0 0 1-18 0zM8 7c0-1 1-1.5 1-2.5M12 7c0-1 1-1.5 1-2.5M16 7c0-1 1-1.5 1-2.5"/></svg>',
 'Desserts':'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h16v-7H4zM4 15.5c1.3 1 2.7 1 4 0s2.7-1 4 0 2.7 1 4 0 2.7-1 4 0M12 13V9M12 6.5c-.8-.8-.8-1.7 0-2.5.8.8.8 1.7 0 2.5z"/></svg>',
 'Petit-déj & goûter':'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5v2.5M12 3.5v2.5"/></svg>',
 'Bases':'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h10M8 3v3l-2 3v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9l-2-3V3M6 12h12"/></svg>',
};
const HOME_MAX=6; // recettes montrées par rayon sur l'accueil, « Voir tout » ouvre le rayon
function thumb(r){return r.img?`<img src="${esc(r.img)}" alt="" loading="lazy">`:`<span class="ph" aria-hidden="true">${esc((r.title||'?')[0])}</span>`}
function metaLine(r){const m=(r.meta||[]).filter(x=>!/^Portion/.test(x[0])).map(x=>x[1]);
  return (r.ptxt?`<span>${ICON.user}${esc(r.ptxt)}</span>`:'')+(m[0]?`<span>${ICON.clock}${esc(m[0])}</span>`:'')}
function servLabel(r,n){if(!r.portions) return n===1?'1 fournée':n+' fournées';return (r.ptxt||'').match(/\d/)?r.ptxt.replace(/\d+(\s*à\s*\d+)?/,n):n+' personnes'}
/* ---------- Planning de la semaine ----------
   Le menu de la semaine (state/semaine) est indépendant du panier de recettes (state/menu) qui remplit les courses.
   Une case = une date et un repas (« 2026-10-20-soir ») ; une recette y reste, ✓ la marque « faite », ✕ l'enlève. */
const DAYS=['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'], MEALS=[['midi','midi'],['soir','soir']];
function iso(d){const z=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())}
function monday(d){const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-(x.getDay()+6)%7);return x}
function weekDates(off){const m=monday(new Date());m.setDate(m.getDate()+7*(off||0));return DAYS.map((_,i)=>{const d=new Date(m);d.setDate(m.getDate()+i);return d})}
function slotKey(i,m,off){return iso(weekDates(off===undefined?S.weekOff:off)[i])+'-'+m}
function slotParts(k){const m=/^(\d{4})-(\d{2})-(\d{2})-(midi|soir)$/.exec(k||'');return m?{date:new Date(+m[1],m[2]-1,+m[3]),meal:m[4]}:null}
function slotLabel(k){const p=slotParts(k);return p?DAYS[(p.date.getDay()+6)%7]+' '+p.date.getDate()+' '+p.meal:k}
function weekLabel(ds){const a=ds[0],b=ds[6],mo=(d,f)=>d.toLocaleDateString('fr-FR',{month:f});return a.getMonth()===b.getMonth()?a.getDate()+' – '+b.getDate()+' '+mo(a,'long'):a.getDate()+' '+mo(a,'short')+' – '+b.getDate()+' '+mo(b,'short')}
function slotSelect(id){const cur=S.plan[id]||'',ds=weekDates(S.weekOff),keys=[];
  const opts=ds.map((d,i)=>MEALS.map(([m])=>{const k=iso(d)+'-'+m;keys.push(k);return `<option value="${k}"${cur===k?' selected':''}>${DAYS[i]} ${d.getDate()} ${m}</option>`}).join('')).join('');
  return `<select class="slot" data-slot="${esc(id)}" aria-label="Jour et repas"><option value=""${cur?'':' selected'}>Pas dans la semaine</option>${cur&&!keys.includes(cur)?`<option value="${esc(cur)}" selected>${esc(slotLabel(cur))}</option>`:''}${opts}</select>`}
function dateLabel(iso){return new Date(iso).toLocaleDateString('fr-FR',{day:'numeric',month:'long'})}

function vRecettes(){
  if(S.offline) return `<div class="empty"><h2>Carnet hors ligne</h2><p>Connexion au carnet impossible. Vérifiez le réseau, puis rouvrez l'appli.</p></div>`;
  if(!S.ready) return `<div class="empty"><h2>Ouverture du carnet…</h2><p>Vos recettes arrivent. Vous pourrez en ajouter avec le bouton « Nouvelle recette ».</p></div>`;
  const q=S.q.trim().toLowerCase();
  const list=Object.entries(S.recipes).filter(([,r])=>(!S.cat||r.cat===S.cat)&&(!q||(r.title+' '+(r.sub||'')+' '+(r.groups||[]).flatMap(g=>g.ing.map(i=>i.t)).join(' ')).toLowerCase().includes(q)))
    .sort((a,b)=>a[1].title.localeCompare(b[1].title,'fr'));
  const counts={};Object.values(S.recipes).forEach(r=>counts[r.cat]=(counts[r.cat]||0)+1);
  const chip=(c,label,n)=>`<button class="chip" data-cat="${esc(c)}" aria-pressed="${S.cat===c}">${CAT_ICON[c]||''}${esc(label)} · ${n}</button>`;
  return `<div class="toolbar"><div class="search">${ICON.search}<input id="q" type="search" placeholder="Chercher une recette ou un ingrédient" aria-label="Chercher" value="${esc(S.q)}"></div>
   <div class="tb-actions"><button class="btn soft" data-act="import">${ICON.link}Importer</button><button class="btn primary" data-act="new">${ICON.plus}Nouvelle recette</button></div></div>
   <div class="chips" role="group" aria-label="Catégories">${chip('','Toutes',Object.keys(S.recipes).length)}${CATS.filter(c=>counts[c]).map(c=>chip(c,c.split(' ')[0],counts[c])).join('')}</div>
   ${S.cat?`<div class="sect-h"><h2>${esc(S.cat)}<small>${list.length} recette${list.length>1?'s':''}</small></h2><button class="more" data-cat="">Toutes les recettes</button></div>`:''}
   ${list.length?(!S.cat&&!q?CATS.concat(['Autres']).map(c=>{const l=list.filter(([,r])=>(CATS.includes(r.cat)?r.cat:'Autres')===c);if(!l.length)return '';const cut=c!=='Autres'&&l.length>HOME_MAX;
     return `<section class="sect"><div class="sect-h"><h2>${esc(c)}<small>${l.length} recette${l.length>1?'s':''}</small></h2>${cut?`<button class="more" data-cat="${esc(c)}">Voir tout${ICON.chev}</button>`:''}</div><div class="grid">${(cut?l.slice(0,HOME_MAX):l).map(card).join('')}</div></section>`}).join(''):`<div class="grid">${list.map(card).join('')}</div>`)
     :`<div class="empty"><h2>Aucune recette trouvée</h2><p>Essayez un autre mot, ou ajoutez-la avec « Nouvelle recette ».</p></div>`}
   ${!q&&!S.cat&&Object.keys(S.trash).length?`<p class="status trash-link"><button class="linkbtn s-inline" data-act="trash">Corbeille · ${Object.keys(S.trash).length} recette${Object.keys(S.trash).length>1?'s':''}</button></p>`:''}`;
}
function vTrash(){
  const l=Object.entries(S.trash).sort((a,b)=>(b[1].deletedAt||'').localeCompare(a[1].deletedAt||''));
  return `<button class="btn ghost back" data-act="home">${ICON.back}Recettes</button>
  <h2 style="font-size:28px;margin-bottom:6px">Corbeille</h2><p class="hint" style="margin:0 0 16px">Une recette supprimée reste ici 30 jours, puis disparaît pour de bon.</p>
  ${l.length?`<div class="menu-list">${l.map(([id,r])=>`<div class="mrow" data-key="t:${esc(id)}"><div class="thumb">${thumb(r)}</div>
   <div style="min-width:0"><h3>${esc(r.title)}</h3><span class="status">Supprimée le ${r.deletedAt?esc(dateLabel(r.deletedAt)):'?'}${r.deletedBy?' par '+esc(r.deletedBy):''}</span></div>
   <div class="ctl"><button class="btn" data-restore="${esc(id)}">Restaurer</button></div></div>`).join('')}</div>`:'<div class="empty"><h2>La corbeille est vide</h2></div>'}`;
}
function card([id,r]){return `<article class="card" data-key="${esc(id)}"><button class="open" data-open="${esc(id)}"><div class="thumb">${thumb(r)}</div><div class="txt"><h3>${esc(r.title)}</h3><span class="meta">${metaLine(r)}</span></div></button>
     <button class="add" data-toggle="${esc(id)}" aria-pressed="${!!S.menu[id]}" aria-label="${S.menu[id]?'Retirer du panier':'Ajouter au panier'} : ${esc(r.title)}">${S.menu[id]?ICON.check:ICON.plus}</button></article>`;
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
    <div class="actions"><button class="btn ${inMenu?'':'primary'}" data-toggle="${esc(id)}">${inMenu?ICON.check+'Dans le panier':ICON.plus+'Ajouter au panier'}</button></div>
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
const qin=(key,v,label)=>`<input class="qin" type="text" inputmode="numeric" pattern="[0-9]*" enterkeyhint="done" data-qin="${esc(key)}" value="${esc(v)}" aria-label="${esc(label)}" style="width:${Math.max(2,String(v).length)+1}ch">`;
function vMenu(){
  const ids=Object.keys(S.menu).filter(id=>S.recipes[id]);
  const row=id=>{const r=S.recipes[id],n=S.menu[id];return `<div class="mrow" data-key="${esc(id)}"><div class="thumb">${thumb(r)}</div>
   <button class="linkbtn" data-open="${esc(id)}"><h3>${esc(r.title)}</h3><span class="status">${esc(r.cat||'')}</span></button>
   <div class="ctl">${slotSelect(id)}<div class="servings"><button data-mserv="${esc(id)}" data-d="-1" aria-label="Moins">−</button><span class="sv">${qin('m:'+id,n,'Nombre')} ${esc(servLabel(r,n).replace(String(n),'').trim())}</span><button data-mserv="${esc(id)}" data-d="1" aria-label="Plus">+</button></div>
   <button class="iconbtn" data-toggle="${esc(id)}" aria-label="Retirer du panier">✕</button></div></div>`};
  const ds=weekDates(S.weekOff), today=iso(new Date()), sel=S.selDay||(ds.some(d=>iso(d)===today)?today:iso(ds[0]));
  const timeOf=r=>{const m=(r.meta||[]).filter(x=>!/^Portion/.test(x[0])).map(x=>x[1]);return m[0]||''};
  // Une tuile par recette posée sur un repas : toucher ouvre la recette, ✓ marque le repas fait, ✕ l'enlève.
  const tile=(slot,id)=>{const r=S.recipes[id],done=!!(S.done[slot]&&S.done[slot][id]),t=timeOf(r);
    return `<div class="tile${done?' done':''}" data-key="p:${slot}:${esc(id)}"><button class="tile-open" data-open="${esc(id)}"><span class="thumb">${thumb(r)}</span><span class="tile-body"><span class="tile-t">${esc(r.title)}</span><span class="tile-n">${t?ICON.clock+esc(t):S.menu[id]?esc(servLabel(r,S.menu[id])):''}</span></span></button><button class="tile-ok" data-cooked="${esc(id)}" data-s="${slot}" aria-pressed="${done}" aria-label="${done?'Repas fait, annuler':'Repas fait'} : ${esc(r.title)}" title="${done?'Fait':'Repas fait'}">${ICON.check}</button><button class="tile-x" data-unslot="${esc(id)}" data-s="${slot}" aria-label="Enlever ${esc(r.title)} de ce repas" title="Enlever">✕</button></div>`};
  const cell=(d,i,m)=>{const slot=iso(d)+'-'+m,l=Object.keys(S.week[slot]||{}).filter(id=>S.recipes[id]).sort((a,b)=>S.recipes[a].title.localeCompare(S.recipes[b].title,'fr'));
    const head=`<span class="cell-m">${m==='midi'?ICON.sun+'Midi':ICON.moon+'Soir'}</span>`,lab=`Ajouter un plat ${DAYS[i].toLowerCase()} ${d.getDate()} ${m}`;
    if(!l.length)return `<button type="button" class="cell free" data-key="s:${slot}" data-pick="${slot}" aria-label="${lab}">${head}<span class="cell-plus" aria-hidden="true">${ICON.plus}</span><b>Ajouter un plat</b><small>Choisissez une recette ou importez la vôtre</small></button>`;
    return `<div class="cell" data-key="s:${slot}">${head}${l.map(id=>tile(slot,id)).join('')}<button type="button" class="cell-more" data-pick="${slot}" aria-label="${lab}">${ICON.plus}Un autre plat</button></div>`};
  const dayN=d=>MEALS.reduce((n,[m])=>n+Object.keys(S.week[iso(d)+'-'+m]||{}).filter(id=>S.recipes[id]).length,0);
  const strip=`<div class="daystrip" role="tablist" aria-label="Jours de la semaine">${ds.map((d,i)=>`<button type="button" role="tab" data-day="${iso(d)}" aria-pressed="${sel===iso(d)}" class="${iso(d)===today?'today':''}"><span>${'LMMJVSD'[i]}</span><b>${d.getDate()}</b></button>`).join('')}</div>`;
  const days=`<div class="week">${ds.map((d,i)=>{const n=dayN(d);return `<section class="day${iso(d)===today?' today':''}" id="day-${iso(d)}" data-key="d:${iso(d)}"><div class="day-h"><h3>${DAYS[i]}</h3><span class="day-n">${ICON.leaf}${n?n+' repas':'rien de prévu'}</span></div><div class="cells">${cell(d,i,'midi')}${cell(d,i,'soir')}</div></section>`}).join('')}</div>`;
  const tab=S.menuTab==='liste'?'liste':'semaine';
  const tabs=`<div class="seg mtabs" role="tablist" aria-label="Affichage du menu"><button type="button" role="tab" data-mtab="semaine" aria-pressed="${tab==='semaine'}">Semaine</button><button type="button" role="tab" data-mtab="liste" aria-pressed="${tab==='liste'}">Liste${ids.length?` <span class="cnt">${ids.length}</span>`:''}</button></div>`;
  const nav=`<div class="wkgroup"><div class="wknav"><button type="button" class="wk-btn" data-act="wkprev" aria-label="Semaine précédente">${ICON.back}</button><span class="wk-lab">${esc(weekLabel(ds))}</span><button type="button" class="wk-btn next" data-act="wknext" aria-label="Semaine suivante">${ICON.back}</button></div><button type="button" class="btn ghost wk-today" data-act="wktoday"${S.weekOff?'':' disabled'}>Aujourd’hui</button></div>`;
  const sorted=ids.slice().sort((a,b)=>((S.plan[a]||'~')).localeCompare(S.plan[b]||'~')||S.recipes[a].title.localeCompare(S.recipes[b].title,'fr'));
  const empty=`<div class="empty" style="margin-top:18px"><h2>Le panier est vide</h2><p>Touchez le + sur une recette : ses ingrédients s’ajoutent à la liste de courses. Le panier est indépendant de la semaine.</p><p><button class="btn primary" data-view="recettes">Choisir des recettes</button></p></div>`;
  return `<div class="menu-actions"><button type="button" class="btn soft" data-act="genweek">${ICON.spark}Générer ma semaine</button><button type="button" class="btn" data-view="courses">${ICON.cart}Liste de courses</button></div>
  <div class="menu-row2">${tabs}${tab==='semaine'?nav:ids.length?`<button type="button" class="btn ghost wk-today" data-act="clearmenu">Vider le panier</button>`:''}</div>
  ${tab==='semaine'?`${strip}${days}`
   :`<p class="hint zone-hint">Les recettes de cette liste remplissent la liste de courses. Elle se vide avec les courses ; la semaine, elle, reste.</p>${ids.length?`<div class="menu-list" data-key="mlist">${sorted.map(row).join('')}</div>`:empty}`}`;
}
/* ---------- Choisir une recette pour un repas (fenêtre) ---------- */
function renderPick(){
  const el=$('#pick-list'); if(!el||!S.pick) return;
  const q=plain(($('#pick-q')&&$('#pick-q').value)||'').trim();
  const all=Object.entries(S.recipes).filter(([,r])=>!q||plain(r.title).includes(q)).sort((a,b)=>a[1].title.localeCompare(b[1].title,'fr'));
  const loose=all.filter(([id])=>S.menu[id]&&!S.plan[id]), rest=all.filter(([id])=>!(S.menu[id]&&!S.plan[id]));
  const rowOf=([id,r])=>`<button type="button" class="s-row" data-pickr="${esc(id)}"><span class="thumb pick-th">${thumb(r)}</span><div class="s-txt"><b>${esc(r.title)}</b><span>${S.plan[id]?'Déjà '+esc(slotLabel(S.plan[id]).toLowerCase()):S.menu[id]?'Dans le panier, pas encore dans la semaine':esc(r.cat||'')}</span></div></button>`;
  el.innerHTML=(loose.length?`<p class="status pick-h">Dans le panier</p>${loose.map(rowOf).join('')}`:'')+(rest.length?`${loose.length?'<p class="status pick-h">Toutes les recettes</p>':''}${rest.map(rowOf).join('')}`:'')||'<p class="hint">Aucune recette ne correspond.</p>';
}
function openPick(slot){S.pick=slot;$('#pick-title').textContent=slotLabel(slot);const q=$('#pick-q');if(q)q.value='';renderPick();$('#pick').showModal();setTimeout(()=>q&&q.focus(),0)}
// Déplace une recette vers un créneau (v vide = elle sort de la semaine). from : n'enlever que de ce créneau-là.
function setSlot(id,v,from){const patch={};const w={};Object.entries(S.week).forEach(([slot,ids])=>{if(ids[id]&&(!from||from===slot)){patch[slot]={[id]:false};const o={...ids};delete o[id];if(Object.keys(o).length)w[slot]=o}else w[slot]=ids});
  if(v){w[v]={...(w[v]||{}),[id]:true};patch[v]={...(patch[v]||{}),[id]:true}}S.week=w;S.plan=planIndex();render();if(db&&Object.keys(patch).length)upd('state/semaine',{slots:patch})}
function addToSlot(id,v){if(S.week[v]&&S.week[v][id])return;const w={...S.week,[v]:{...(S.week[v]||{}),[id]:true}};S.week=w;S.plan=planIndex();render();if(db)upd('state/semaine',{slots:{[v]:{[id]:true}}})}
/* ---------- Panier Carrefour ----------
   Claude remplit le panier avec le connecteur officiel Carrefour (à ajouter une fois dans Claude) :
   l'appli ouvre Claude avec la demande toute prête, ce qui reste à acheter et l'adresse de livraison. */
function cfItems(){
  return shoppingList().filter(i=>!S.checked[i.k]&&i.c!=='Placard').map(i=>({n:i.n,
    q:i.extra?(i.xq>1?String(i.xq):''):(S.adj[i.k]>0||i.hand||packCalc(i))?totalText(i,S.adj[i.k]||0):i.qty}));
}
function cfPrompt(items){
  return `Avec le connecteur Carrefour, remplis mon panier en livraison à domicile au ${S.cfAddr}.
Pour chaque article, choisis le produit le plus courant (marque Carrefour ou marque connue, prix raisonnable) dans le format le plus proche de la quantité, et ajoute tout au panier en une fois sans me redemander. Ne commande pas : je vérifie et je paie sur carrefour.fr. À la fin, donne-moi le lien du panier, le total et ce que tu n'as pas trouvé.

Liste de courses :
${items.map(i=>'- '+i.n+(i.q?' : '+i.q:'')).join('\n')}`;
}
function openClaude(){
  const items=cfItems(); if(!items.length){toast('Rien à envoyer : tout est coché.');return}
  const t=cfPrompt(items);
  // Si Claude s'ouvre sans le texte, il est aussi dans le presse-papiers.
  try{navigator.clipboard&&navigator.clipboard.writeText(t).catch(()=>{})}catch(e){}
  window.open('https://claude.ai/new?q='+encodeURIComponent(t),'_blank','noopener');
  S.cf={step:'sent',n:items.length};render();
}
function vCarrefour(){
  const c=S.cf; if(!c) return '';
  const close='<button class="btn ghost" data-act="cfclose">Fermer</button>';
  if(c.step==='addr') return `<form class="confirm cf" id="cfaddr" style="margin-bottom:14px"><span style="flex-basis:100%">Livraison Carrefour à domicile : à quelle adresse ? Elle sera gardée pour tout le groupe.</span><input id="cfa" autocomplete="street-address" value="${esc(c.v??S.cfAddr)}" placeholder="Rue, code postal, ville" aria-label="Adresse de livraison" style="flex:1;min-width:200px"><button class="btn primary">Continuer</button>${close}</form>`;
  if(c.step==='sent') return `<div class="confirm cf" style="margin-bottom:14px" role="status"><span style="flex-basis:100%">Claude s’est ouvert avec ${c.n} article(s) : envoyez le message, il remplit le panier puis donne le lien carrefour.fr pour vérifier et payer. Si le message est vide, collez-le : il est copié.</span><button class="btn" data-act="cfgo">Rouvrir Claude</button>${close}</div>`;
  const n=cfItems().length;
  return `<div class="confirm cf" style="margin-bottom:14px"><span style="flex-basis:100%">Claude va remplir le panier Carrefour avec ${n} article(s), livré au ${esc(S.cfAddr)}. Le placard (sel, huile, farine…) n’est pas envoyé.</span><button class="btn primary" data-act="cfgo">Ouvrir Claude</button><button class="btn ghost" data-act="cfaddr">Changer d’adresse</button>${close}</div>`;
}
// Articles qu'on a toujours à la maison, retirés de la liste : un toucher les remet quand il n'y en a plus.
function vAlways(){
  const al=alwaysList(); if(!al.length) return '';
  return `<section class="always" data-key="always"><h3>On en a toujours</h3><p class="hint">Ces articles ne sont plus dans la liste. Touchez-en un quand il n’y en a plus.</p>
  <div class="sugg">${al.map(([k,v])=>`<button type="button" class="chip" data-noalways="${esc(k)}">${esc(v.n)}<small>· il n’y en a plus</small></button>`).join('')}</div></section>`;
}
/* Liste de courses d'après la maquette de Fred (25 oct.) : en-tête clair, carte Panier Carrefour, rayons repliables. */
const LC={
 okc:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M7.5 12.3l3 3 6-6.3" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
 trash:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 3.5h4M6 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h7a1.5 1.5 0 0 0 1.5-1.5L18 7M10 11v6M14 11v6"/></svg>',
 bag:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 10V6.5a3 3 0 0 1 6 0V10"/></svg>',
 art:'<svg class="cf-art" viewBox="0 0 130 100" aria-hidden="true"><circle cx="62" cy="50" r="40" class="cf-blob"/><path class="cf-leaf" d="M96 100c-4-26 8-44 34-52 4 28-10 46-34 52z"/><path class="cf-rib" d="M98 98c6-14 14-26 28-42"/><path class="cf-leaf l2" d="M8 22c10-2 18 2 22 10-10 2-18-2-22-10z"/><g class="cf-cart"><path d="M24 26h10l8 36h40l8-26H38"/><path d="M40 44h46M39 36l5 26M54 36v26M68 36l-1.5 26"/><circle cx="48" cy="72" r="4.5"/><circle cx="76" cy="72" r="4.5"/></g></svg>',
};
S.fold=(()=>{try{return JSON.parse(localStorage.getItem('fold')||'{}')}catch(e){return {}}})();
function vCourses(){
  const items=shoppingList();
  const sug=suggestions(S.xq||'');
  const nh=habitsList().length;
  const add=`<form class="addrow" id="addx"><label class="addfield"><span class="addplus" aria-hidden="true">${ICON.plus}</span><input id="xt" autocomplete="off" placeholder="Ajouter un article (ex. papier toilette, 6 yaourts)" aria-label="Article à ajouter"></label><button class="btn addgo">${ICON.plus}Ajouter</button>
    ${sug.length?`<div class="sugg" role="group" aria-label="Suggestions">${sug.map(n=>`<button type="button" class="chip" data-sugg="${esc(n)}">${ICON.plus}${esc(n)}</button>`).join('')}</div>`:''}</form>
    <div class="quick"><button type="button" class="btn pill" data-act="habits">${ICON.star}Habituels${nh?` <span class="cnt">${nh}</span>`:''}</button><button type="button" class="btn pill" data-act="rayons">${ICON.sort}Ordre des rayons</button></div>`;
  const title='<h2 class="lc-title">Liste de courses</h2>';
  if(!items.length) return `<div class="lc-head">${title}</div>${add}<div class="empty"><h2>La liste est vide</h2><p>Ajoutez des recettes au menu : leurs ingrédients s’additionnent ici, rangés par rayon.</p><p><button class="btn primary" data-view="recettes">Choisir des recettes</button></p></div>${vAlways()}`;
  const done=items.filter(i=>S.checked[i.k]).length, pct=Math.round(100*done/items.length);
  const nrec=Object.keys(S.menu).filter(id=>S.recipes[id]).length;
  const byCat={};items.forEach(i=>(byCat[i.c]=byCat[i.c]||[]).push(i));
  return `<div class="lc-head">${title}${done?'<button class="btn pill" data-act="uncheck"><span class="ring" aria-hidden="true"></span>Tout décocher</button>':''}</div>
  <div class="lc-acts">${done?`<button class="btn pill ok" data-act="rmchecked">${LC.okc}Retirer les cochés</button>`:''}<button class="btn pill mute" data-act="askclear">${LC.trash}Tout vider</button></div>
  ${S.confirmClear?`<div class="confirm" style="margin-bottom:14px"><span>Vider toute la liste ? Le panier de recettes sera vidé aussi, pour tout le groupe. Le menu de la semaine reste.</span><button class="btn danger" data-act="clearall">Oui, tout vider</button><button class="btn ghost" data-act="noclear">Annuler</button></div>`:''}
  <button type="button" class="cf-card" data-act="carrefour" aria-label="Panier Carrefour : ${done} sur ${items.length} dans le panier, pour ${nrec} recette(s). Envoyer la liste à Claude."><span class="cf-ico" aria-hidden="true">${LC.bag}</span><span class="cf-t" aria-hidden="true">Panier Carrefour</span><span class="cf-chev" aria-hidden="true">${ICON.chev}</span><span class="cf-n" aria-hidden="true">${done} sur ${items.length} dans le panier</span><span class="cf-row" aria-hidden="true"><span class="cf-bar"><i style="width:${pct}%"></i></span><span class="cf-rec">pour ${nrec} recette(s)</span></span>${LC.art}</button>
  ${vCarrefour()}${add}
  <div class="shop">${aisleOrder().filter(c=>byCat[c]).map(c=>{const sc=S.sortChecked||S.checked,l=byCat[c].sort((a,b)=>(!!sc[a.k]-!!sc[b.k])||a.n.localeCompare(b.n,'fr'));
   const fold=!!S.fold[c], left=l.filter(i=>!S.checked[i.k]).length;
   return `<section data-key="c:${esc(c)}" class="${fold?'fold':''}"><h2><button type="button" class="aisle-h" data-fold="${esc(c)}" aria-expanded="${!fold}"><span class="aico" aria-hidden="true">${AISLE_ICON[c]||''}</span><span class="aname">${esc(c)}</span><small>${left} restant(s)</small><span class="achev" aria-hidden="true">${ICON.chev}</span></button></h2>${fold?'':`${c==='Placard'?'<p class="hint">À vérifier, vous en avez sûrement déjà.</p>':''}
   ${l.map(i=>`<label class="item ${S.checked[i.k]?'done':''}" data-key="${esc(i.k)}"><input type="checkbox" data-k="${esc(i.k)}" ${S.checked[i.k]?'checked':''}><span><span class="n">${esc(i.n)}</span>${!i.extra&&(S.adj[i.k]>0||i.hand||packCalc(i))?` <span class="q tot">· ${esc(totalText(i,S.adj[i.k]||0))}</span><span class="from">${esc(detailLine(i))}</span>`
     :`${i.qty?` <span class="q">· ${esc(i.qty)}</span>`:''}<span class="from">${esc(i.from)}</span>`}${!i.extra&&!i.hand&&(c==='Placard'||c==='Épicerie')?`<button type="button" class="linkbtn always-btn" data-always="${esc(i.k)}" data-n="${esc(i.n)}">On en a toujours</button>`:''}</span>${!i.extra?`<span class="xstep${S.adj[i.k]>0?'':' solo'}" aria-label="En plus de la recette">${S.adj[i.k]>0?`<button type="button" data-adj="${esc(i.k)}" data-d="-1" aria-label="Moins">−</button><span class="plusin">+${(adjStep(i)[0]===''||adjStep(i)[0]==='#')?qin('a:'+i.k,S.adj[i.k],'En plus'):`<b>${esc(adjText(i,S.adj[i.k]))}</b>`}</span>`:''}<button type="button" data-adj="${esc(i.k)}" data-d="1" aria-label="En prendre plus que la recette">+</button></span>${i.hand?`<button class="iconbtn delx" data-delx="${esc(i.hand.map(h=>h.id).join(','))}" aria-label="Retirer ce qui a été ajouté à la main">✕</button>`:''}`:''}${i.extra?`<span class="xstep" aria-label="Quantité"><button type="button" data-xq="${esc(i.extra)}" data-d="-1" aria-label="Moins" aria-disabled="${i.xq<=1}">−</button>${qin('x:'+i.extra,i.xq,'Quantité')}<button type="button" data-xq="${esc(i.extra)}" data-d="1" aria-label="Plus">+</button></span><button class="iconbtn delx" data-delx="${esc(i.extra)}" aria-label="Supprimer ${esc(i.n)}">✕</button>`:''}</label>`).join('')}`}</section>`}).join('')}</div>${vAlways()}`;
}
/* ---------- Ordre des rayons (fenêtre) ---------- */
function renderRayons(){
  const el=$('#rayons-list'); if(!el) return;
  const o=aisleOrder();
  el.innerHTML=o.map((c,i)=>`<div class="s-row ray"><span class="av grp" aria-hidden="true">${AISLE_ICON[c]||''}</span><div class="s-txt"><b>${esc(c)}</b></div>
    <button type="button" class="iconbtn" data-ray="${esc(c)}" data-d="-1" aria-label="Monter ${esc(c)}"${i===0?' disabled':''}>${ICON.up}</button><button type="button" class="iconbtn" data-ray="${esc(c)}" data-d="1" aria-label="Descendre ${esc(c)}"${i===o.length-1?' disabled':''}>${ICON.down}</button></div>`).join('');
}
function moveAisle(c,d){
  const o=aisleOrder(), i=o.indexOf(c), j=i+d; if(i<0||j<0||j>=o.length) return;
  o.splice(i,1); o.splice(j,0,c); S.rayons={order:o}; renderRayons(); render();
  if(db) sendLater('rayons',()=>db.doc('state/rayons').set({order:o}).catch(()=>toast('Enregistrement impossible, réessayez.')));
}
/* ---------- Articles habituels (fenêtre) ---------- */
function renderHabits(){
  const el=$('#hab-list'); if(!el) return;
  const l=habitsList();
  el.innerHTML=l.length?l.map(([id,h])=>{const on=onList(h.t);return `<label class="item hab${on?' done':''}"><input type="checkbox" data-hab="${esc(id)}"${on?' checked disabled':''}><span><span class="n">${esc(h.t)}</span>${on?'<span class="from">Déjà dans la liste</span>':''}</span><button type="button" class="iconbtn delx" data-delhab="${esc(id)}" aria-label="Retirer ${esc(h.t)} des habituels">✕</button></label>`}).join('')
    :'<p class="hint">Rien pour l’instant. Ajoutez ci-dessus ce que vous rachetez souvent : lait, pain, papier toilette…</p>';
  habCount();
}
function habCount(){const n=document.querySelectorAll('#hab-list input:checked:not(:disabled)').length;const b=$('#hab-go');if(b){b.disabled=!n;b.textContent=n?`Ajouter ${n} article${n>1?'s':''} à la liste`:'Cochez ce qu’il faut racheter'}}
/* ---------- Sauvegarde du carnet ---------- */
const blobToDataUrl=b=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(b)});
async function exportCarnet(){
  const btn=$('#exp-btn'); btn.disabled=true; btn.textContent='Préparation…';
  try{
    const recipes={};
    for(const [id,r] of Object.entries(S.recipes)){
      const c={...r};
      // Les photos sont mises dans le fichier, pour que le carnet se suffise à lui-même.
      if(c.img&&!c.img.startsWith('data:')){try{const res=await fetch(c.img);if(res.ok){const b=await res.blob();if(b.size<3e6)c.img=await blobToDataUrl(b)}}catch(e){}}
      recipes[id]=c;
    }
    const out={app:'nos-recettes',version:1,carnet:(window.CARNET&&window.CARNET.name)||'',date:new Date().toISOString(),recipes,
      menu:{items:S.menu},semaine:{slots:S.week,done:S.done},courses:{extras:S.extras,checked:S.checked,adj:S.adj,always:S.always},habituels:S.habits,rayons:S.rayons};
    const blob=new Blob([JSON.stringify(out)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download=`nos-recettes-${(out.carnet||'carnet').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-')}-${out.date.slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},3000);
    try{localStorage.setItem('lastExport',String(Date.now()))}catch(e){}
    showLastExport(); toast('Carnet téléchargé');
  }catch(e){toast('Téléchargement impossible, réessayez.')}
  btn.disabled=false; btn.textContent='Télécharger le carnet';
}
async function importCarnet(file){
  let data=null; try{data=JSON.parse(await file.text())}catch(e){}
  if(!data||data.app!=='nos-recettes'||!data.recipes){toast('Ce fichier n’est pas une sauvegarde de Nos Recettes.');return}
  const ids=Object.keys(data.recipes).filter(id=>!S.recipes[id]);
  if(!ids.length){toast('Toutes ces recettes sont déjà dans le carnet.');return}
  const btn=$('#exp-btn'); btn.disabled=true; let n=0;
  for(const id of ids){
    const r={...data.recipes[id]};
    if(r.img&&r.img.startsWith('data:')){try{if(!assets)throw 0;const up=await assets.upload(await (await fetch(r.img)).blob());r.img=up.url}catch(e){delete r.img}}
    try{await db.doc('recipes/'+id).set(r);n++}catch(e){}
  }
  if(data.habituels&&!habitsList().length){S.habits=data.habituels;upd('state/habituels',{items:data.habituels})}
  btn.disabled=false; $('#acct').close();
  toast(n+' recette'+(n>1?'s':'')+' importée'+(n>1?'s':''));
}
function showLastExport(){
  const el=$('#exp-last'); if(!el) return;
  let t=0; try{t=+localStorage.getItem('lastExport')||0}catch(e){}
  el.textContent=t?'Dernière sauvegarde sur cet appareil : le '+dateLabel(new Date(t).toISOString())+'.':'Pas encore de sauvegarde sur cet appareil. Le fichier contient les recettes et leurs photos.';
}
// Une fois par mois, un rappel discret.
function remindBackup(){
  try{const t=+localStorage.getItem('lastExport')||0, r=+localStorage.getItem('lastRemind')||0, now=Date.now();
    if(now-t>30*864e5&&now-r>7*864e5&&Object.keys(S.recipes).length){localStorage.setItem('lastRemind',String(now));setTimeout(()=>toast('Pensez à télécharger une sauvegarde du carnet (Mon compte).'),1500)}}catch(e){}
}
// Recette importée (lien ou photo) : même forme que le carnet, le texte sera relu à l'enregistrement.
function fromDraft(d){
  return {title:d.title,cat:CATS.includes(d.cat)?d.cat:'Plats',ptxt:d.ptxt,img:d.img,
    meta:[['Préparation',d.prep],['Cuisson',d.cook]].filter(x=>x[1]),
    groups:(d.ingredients||[]).map(g=>({g:g.group||'',ing:(g.lines||[]).map(t=>({t}))})),
    steps:d.steps||[],notes:[...(d.notes||[]),d.source].filter(Boolean)};
}
function vEdit(){
  const r=S.edit.id?S.recipes[S.edit.id]:S.edit.draft?fromDraft(S.edit.draft):{};const g=r.groups||[];
  const ingTxt=g.map(x=>(x.g?x.g+' :\n':'')+x.ing.map(i=>i.t).join('\n')).join('\n\n');
  const m=Object.fromEntries((r.meta||[]).map(x=>[x[0],x[1]]));
  const stepsTxt=(r.steps||[]).map(s=>s.startsWith('## ')?s.slice(3)+' :':s).join('\n');
  return `<button class="btn ghost back" data-act="${S.edit.id?'canceledit':'home'}">${ICON.back}${S.edit.id?'Retour à la recette':'Recettes'}</button>
  <h2 style="font-size:28px;margin-bottom:${S.edit.draft?'6px':'16px'}">${S.edit.id?'Modifier la recette':S.edit.draft?'Recette importée':'Nouvelle recette'}</h2>
  ${S.edit.draft?'<p class="hint" style="margin:0 0 16px">Relisez et corrigez si besoin, puis enregistrez.</p>':''}
  <form class="edit" id="ef">
   <label>Nom de la recette<input id="f-title" required value="${esc(r.title||'')}"></label>
   <div class="row2"><label>Catégorie<select id="f-cat">${CATS.map(c=>`<option ${r.cat===c?'selected':''}>${esc(c)}</option>`).join('')}</select></label>
   <label>Pour combien<input id="f-ptxt" placeholder="4 personnes" value="${esc(r.ptxt||'')}"></label></div>
   <div class="row2"><label>Préparation<input id="f-prep" placeholder="20 min" value="${esc(m['Préparation']||'')}"></label><label>Cuisson<input id="f-cuis" placeholder="45 min" value="${esc(m['Cuisson']||'')}"></label></div>
   <label>Ingrédients <span class="help">Un par ligne, quantité en premier : « 200 g de farine », « 3 œufs ». Une ligne qui finit par « : » fait un sous-titre (ex. « Béchamel : »).</span><textarea id="f-ing">${esc(ingTxt)}</textarea></label>
   <label>Étapes <span class="help">Une étape par ligne.</span><textarea id="f-steps">${esc(stepsTxt)}</textarea></label>
   <label>Notes<textarea id="f-notes" style="min-height:90px">${esc((r.notes||[]).join('\n'))}</textarea></label>
   ${S.edit.draft&&r.img?`<div class="imp-prev"><img src="${esc(r.img)}" alt=""><span class="help">La photo du site sera gardée.</span></div>`:''}
   ${assets?`<label>Photo <span class="help">${r.img?'Choisissez un fichier pour remplacer la photo actuelle.':'Facultatif.'}</span><input id="f-photo" type="file" accept="image/*"></label>`:''}
   <div class="actions"><button class="btn primary" id="f-save">Enregistrer</button><button type="button" class="btn ghost" data-act="${S.edit.id?'canceledit':'home'}">Annuler</button></div>
  </form>`;
}
/* Mise à jour de la page : on compare avec ce qui est affiché et on ne touche qu'à ce qui a changé.
   Les photos, les champs en cours de saisie et la position de défilement restent en place. */
const keyOfNode=n=>n.nodeType===1?(n.id||n.getAttribute('data-key')||''):'';
let POOL=new Map(); // éléments identifiés de la page, réutilisables même s'ils changent de place (filtre par catégorie)
function morph(el,html){
  const t=document.createElement(el.tagName);t.innerHTML=html;
  POOL=new Map();el.querySelectorAll('[data-key],[id]').forEach(n=>POOL.set(keyOfNode(n),n));
  morphKids(el,t);
}
function morphKids(a,b){
  const keyed=new Map();
  for(const c of a.childNodes){const k=keyOfNode(c);if(k)keyed.set(k,c)}
  let cur=a.firstChild;
  for(const nb of [...b.childNodes]){
    const k=keyOfNode(nb);
    let old=k?keyed.get(k):cur;
    if(k&&!old){const p=POOL.get(k);if(p&&!p.contains(a)){old=p;POOL.delete(k)}}
    if(old&&k&&keyOfNode(old)!==k) old=null;
    if(old&&!k&&keyOfNode(old)) old=null; // ne pas réutiliser un élément identifié pour un autre
    if(old&&(old.nodeType!==nb.nodeType||old.nodeName!==nb.nodeName)) old=null;
    if(old){ if(old!==cur) a.insertBefore(old,cur); else cur=cur.nextSibling; if(k){keyed.delete(k);POOL.delete(k)} patch(old,nb); }
    else if(nb.nodeType===1&&nb.querySelector('[data-key]')){ // nouveau bloc : on y replace les éléments déjà affichés
      const n=document.createElement(nb.nodeName);for(const at of nb.attributes)n.setAttribute(at.name,at.value);
      a.insertBefore(n,cur);morphKids(n,nb);
    }
    else a.insertBefore(nb,cur);
  }
  while(cur){const n=cur.nextSibling;a.removeChild(cur);cur=n}
}
function patch(a,b){
  if(a.nodeType!==1){if(a.nodeValue!==b.nodeValue)a.nodeValue=b.nodeValue;return}
  const tag=a.nodeName;
  // Champs : on n'écrase ce que la personne tape que si l'appli change elle-même la valeur.
  if(tag==='INPUT'){
    if(b.getAttribute('value')!==a.getAttribute('value')||(a.dataset.qin&&a!==document.activeElement&&a.value!==(b.getAttribute('value')??'')))a.value=b.getAttribute('value')??'';
    if(a.type==='checkbox'||a.type==='radio')a.checked=b.hasAttribute('checked');
  }
  for(const at of [...a.attributes]) if(!b.hasAttribute(at.name)) a.removeAttribute(at.name);
  for(const at of b.attributes) if(a.getAttribute(at.name)!==at.value) a.setAttribute(at.name,at.value);
  if(tag==='TEXTAREA'){if(a.textContent!==b.textContent){a.textContent=b.textContent;a.value=b.textContent}return}
  if(a.innerHTML!==b.innerHTML) morphKids(a,b);
  // Un menu déroulant garde le choix affiché par l'appli (l'autre téléphone a pu changer le jour).
  if(tag==='SELECT'&&a!==document.activeElement){const o=b.querySelector('option[selected]');const v=o?o.value:'';if(a.value!==v)a.value=v}
}

function render(){
  const v=S.edit?'edit':S.detail?'detail':S.trashView?'trash':S.view;
  wakeLock(v==='courses');
  document.querySelectorAll('nav.tabs button').forEach(b=>b.setAttribute('aria-current',b.dataset.view===S.view?'page':'false'));
  const br=$('header.top .brand');if(br&&br.firstChild){const t=v==='menu'?'Mon planning':'Nos Recettes';if(br.firstChild.nodeValue!==t)br.firstChild.nodeValue=t}
  const mc=Object.keys(S.menu).filter(id=>S.recipes[id]).length; $('#b-menu').textContent=mc||'';
  const sl=S.ready?shoppingList():[]; const left=sl.filter(i=>!S.checked[i.k]).length; $('#b-courses').textContent=left||'';
  if(window.Social) $('#b-social').textContent=Social.badge();
  const ae=document.activeElement, fid=ae&&ae.id, sel=fid&&ae.selectionStart, val=ae&&ae.value;
  if(v==='edit'&&$('#ef')) return; // ne pas effacer un formulaire en cours
  if(v==='social'&&$('#s-newgroup')&&Social.busy()) return;
  const html=(v==='social'||v==='edit'?'':netBanner())+(v==='edit'?vEdit():v==='detail'?vDetail():v==='trash'?vTrash():v==='menu'?vMenu():v==='courses'?vCourses():v==='social'?Social.html():vRecettes());
  // Rien n'a changé : on garde la page telle quelle, sans recharger les photos.
  if(html!==render.last){
    const chips=$('#app .chips'), sx=chips?chips.scrollLeft:0;
    morph($('#app'),html); render.last=html;
    const nc=$('#app .chips'); if(nc){nc.scrollLeft=sx;
      const on=nc.querySelector('[aria-pressed="true"]');
      if(S.centerChip&&on) nc.scrollTo({left:nc.scrollLeft+on.getBoundingClientRect().left-nc.getBoundingClientRect().left-(nc.clientWidth-on.offsetWidth)/2,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
  }
  S.centerChip=false;
  if(fid==='cfa'&&S.cf&&S.cf.step==='addr')S.cf.v=val;
  if(['q','xt','msg','s-add-in','cfa'].includes(fid)){const el=document.getElementById(fid);if(el){if(fid!=='q'&&fid!=='msg')el.value=val;el.focus();try{el.setSelectionRange(sel,sel)}catch(e){}}}
  if(v==='social') Social.after();
}
function go(view){if(view==='social'&&window.Social)Social.reset();S.view=view;S.detail=null;S.edit=null;S.trashView=false;S.confirmDel=false;S.confirmClear=false;render();scrollTo(0,0)}

/* ---------- Événements ---------- */
document.addEventListener('click',async e=>{
  const dlg=e.target.closest('dialog');
  if(dlg&&e.target===dlg&&(dlg.id==='rayons'||dlg.id==='habituels'||dlg.id==='pick')){dlg.close();return}
  if(e.target.id==='exp-btn'){exportCarnet();return}
  const b=e.target.closest('button,[data-k]'); if(!b) return;
  if(b.dataset.fold!==undefined){const c=b.dataset.fold;S.fold={...S.fold,[c]:!S.fold[c]};try{localStorage.setItem('fold',JSON.stringify(S.fold))}catch(err){}render();return}
  if(b.dataset.always){e.preventDefault();const k=b.dataset.always,n=b.dataset.n;S.always={...S.always,[k]:{n}};render();if(db)upd('state/courses',{always:{[k]:{n}}});toast(n+' : retiré de la liste, on en a toujours');return}
  if(b.dataset.noalways){const k=b.dataset.noalways,a={...S.always};delete a[k];S.always=a;render();if(db)upd('state/courses',{always:{[k]:false}});return}
  if(b.dataset.ray){moveAisle(b.dataset.ray,+b.dataset.d);return}
  if(b.dataset.mtab){S.menuTab=b.dataset.mtab;try{localStorage.setItem('menuTab',S.menuTab)}catch(err){}render();return}
  if(b.dataset.pick){openPick(b.dataset.pick);return}
  if(b.dataset.pickr){const id=b.dataset.pickr,slot=S.pick;$('#pick').close();addToSlot(id,slot);toast(S.recipes[id].title+' : '+slotLabel(slot)+(S.menu[id]?'':' · pas dans le panier'));return}
  if(b.dataset.unslot){setSlot(b.dataset.unslot,'',b.dataset.s);return}
  if(b.dataset.cooked){const id=b.dataset.cooked,slot=b.dataset.s,v=!(S.done[slot]&&S.done[slot][id]);S.done={...S.done,[slot]:{...(S.done[slot]||{}),[id]:v}};render();if(db)upd('state/semaine',{done:{[slot]:{[id]:v}}});if(v)toast('Bon appétit ! '+S.recipes[id].title+' : fait.');return}
  if(b.dataset.day){S.selDay=b.dataset.day;render();const el=document.getElementById('day-'+b.dataset.day);if(el){const h=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--top-h'))||96;window.scrollTo({top:el.getBoundingClientRect().top+window.scrollY-h-10,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}return}
  if(b.dataset.delhab){e.preventDefault();const id=b.dataset.delhab,h={...S.habits};delete h[id];S.habits=h;renderHabits();render();if(db)upd('state/habituels',{items:{[id]:false}});return}
  if(b.dataset.restore){const id=b.dataset.restore,r={...S.trash[id]};if(!r.title)return;delete r.deletedAt;delete r.deletedBy;
    try{await db.doc('recipes/'+id).set(r);await db.doc('trash/'+id).delete();toast('Recette restaurée');S.trashView=false;S.detail=id;render();scrollTo(0,0)}catch(err){toast('Restauration impossible, réessayez.')}return}
  if(b.dataset.delx){e.preventDefault();const patch={extras:{},checked:{}};
    for(const id of b.dataset.delx.split(',')){const x=S.extras[id];if(!x)continue;patch.extras[id]={...x,gone:true};patch.checked['x:'+id]=false}
    S.extras={...S.extras,...patch.extras};render();if(db)upd('state/courses',patch);toast('Article supprimé');return}
  if(b.dataset.adj){e.preventDefault();const k=b.dataset.adj,n=Math.max(0,(S.adj[k]||0)+ +b.dataset.d);if(n===(S.adj[k]||0))return;
    S.adj={...S.adj,[k]:n};PEND.adj[k]={v:n,t:Date.now()};render();if(db)sendLater('a:'+k,()=>{PEND.adj[k]&&(PEND.adj[k].t=Date.now());upd('state/courses',{adj:{[k]:n}})});return}
  if(b.dataset.xq){e.preventDefault();const id=b.dataset.xq,x=S.extras[id];if(!x)return;const q=Math.max(1,(x.q||1)+ +b.dataset.d);if(q===(x.q||1))return;
    S.extras={...S.extras,[id]:{...x,q}};PEND.extras[id]={v:{...x,q},t:Date.now()};render();if(db)sendLater('x:'+id,()=>{PEND.extras[id]&&(PEND.extras[id].t=Date.now());upd('state/courses',{extras:{[id]:{...x,q}}})});return}
  if(b.dataset.sugg){const x=$('#xt');if(x){x.value='';x.focus()}addExtra(b.dataset.sugg);toast(b.dataset.sugg+' ajouté');return}
  if(b.dataset.view){go(b.dataset.view);return}
  if(b.dataset.cat!==undefined){if(S.cat===b.dataset.cat)return;S.cat=b.dataset.cat;S.centerChip=true;render();if(b.classList.contains('more'))scrollTo(0,0);return}
  if(b.dataset.open){S.detail=b.dataset.open;S.edit=null;S.confirmDel=false;render();scrollTo(0,0);return}
  if(b.dataset.toggle){const id=b.dataset.toggle,r=S.recipes[id];if(S.menu[id]){setServ(id,0);toast('Retiré du panier')}else{setServ(id,(S.preview&&S.preview[id])||r.portions||1);toast('Ajouté au panier : la liste de courses est à jour')}return}
  if(b.dataset.serv){const id=S.detail,r=S.recipes[id];const cur=S.menu[id]||(S.preview&&S.preview[id])||r.portions||1;const n=Math.max(1,cur+ +b.dataset.serv);
    if(S.menu[id]) setServ(id,n); else {S.preview={...(S.preview||{}),[id]:n};render()} return}
  if(b.dataset.mserv){const id=b.dataset.mserv;const n=S.menu[id]+ +b.dataset.d;if(n>=1)setServ(id,n);return}
  const a=b.dataset.act;
  if(a==='home'){go('recettes');return}
  if(a==='import'){window.Importer&&Importer.open();return}
  if(a==='new'){S.edit={id:null};S.detail=null;render();scrollTo(0,0);return}
  if(a==='editr'){S.edit={id:S.detail};render();scrollTo(0,0);return}
  if(a==='canceledit'){S.edit=null;render();return}
  if(a==='copyto'){Social.copyTo(S.detail,S.recipes[S.detail]);return}
  if(a==='askdel'){S.confirmDel=true;render();return}
  if(a==='nodel'){S.confirmDel=false;render();return}
  if(a==='del'){const id=S.detail,r=S.recipes[id];
    // La recette passe à la corbeille (30 jours) avant de disparaître pour de bon.
    try{await db.doc('trash/'+id).set({...r,deletedAt:new Date().toISOString(),deletedBy:(window.ME&&window.ME.profile&&window.ME.profile.name)||''});await db.doc('recipes/'+id).delete();if(S.menu[id])setServ(id,0);toast('Recette mise à la corbeille');go('recettes')}catch(err){toast('Suppression impossible, réessayez.')}return}
  if(a==='trash'){S.trashView=true;S.detail=null;render();scrollTo(0,0);return}
  if(a==='habits'){renderHabits();$('#habituels').showModal();setTimeout(()=>$('#hab-in')&&$('#hab-in').focus(),0);return}
  if(a==='rayons'){renderRayons();$('#rayons').showModal();return}
  if(a==='rayreset'){S.rayons={order:[]};renderRayons();render();if(db)db.doc('state/rayons').set({order:[]}).catch(()=>toast('Enregistrement impossible, réessayez.'));return}
  if(a==='habgo'){const ts=[...document.querySelectorAll('#hab-list input:checked:not(:disabled)')].map(i=>(S.habits[i.dataset.hab]||{}).t).filter(Boolean);if(!ts.length)return;addExtras(ts);$('#habituels').close();toast(ts.length+' article'+(ts.length>1?'s':'')+' ajouté'+(ts.length>1?'s':''));return}
  if(a==='wkprev'||a==='wknext'||a==='wktoday'){S.weekOff=a==='wktoday'?0:S.weekOff+(a==='wknext'?1:-1);S.selDay=null;render();return}
  if(a==='genweek'){const ds=weekDates(S.weekOff),pool=Object.keys(S.recipes);if(!pool.length){toast('Ajoutez d’abord des recettes au carnet.');return}
    const used=new Set();ds.forEach(d=>MEALS.forEach(([m])=>Object.keys(S.week[iso(d)+'-'+m]||{}).forEach(id=>used.add(id))));
    let avail=pool.filter(id=>!used.has(id)).sort(()=>Math.random()-.5);const patch={};let n=0;
    ds.forEach(d=>MEALS.forEach(([m])=>{const k=iso(d)+'-'+m;if(Object.keys(S.week[k]||{}).length)return;if(!avail.length)avail=pool.slice().sort(()=>Math.random()-.5);const id=avail.shift();patch[k]={[id]:true};n++}));
    if(!n){toast('La semaine est déjà complète.');return}
    S.week={...S.week};Object.entries(patch).forEach(([k,o])=>S.week[k]={...(S.week[k]||{}),...o});S.plan=planIndex();render();if(db)upd('state/semaine',{slots:patch});toast(n+' repas ajoutés au hasard. ✕ pour en changer.');return}
  if(a==='clearmenu'){S.menu={};PEND.menu={};PEND.checked={};cancelLater();render();if(db){try{await db.doc('state/menu').set({items:{}});await db.doc('state/courses').set({checked:{},extras:S.extras,hidden:{},always:S.always})}catch(err){toast('Enregistrement impossible, réessayez.')}}return}
  if(a==='rmchecked'){
    const patch={checked:{},extras:{},hidden:{},adj:{}};
    for(const i of shoppingList()) if(S.checked[i.k]){
      patch.checked[i.k]=false; PEND.checked[i.k]={v:false,t:Date.now()};
      if(i.extra) patch.extras[i.extra]={...S.extras[i.extra],gone:true}; else {patch.hidden[i.k]=i.qty;if(S.adj[i.k])patch.adj[i.k]=0;for(const h of i.hand||[])patch.extras[h.id]={...S.extras[h.id],gone:true}}
    }
    S.checked={...S.checked,...patch.checked};S.extras={...S.extras,...patch.extras};S.hidden={...S.hidden,...patch.hidden};S.adj={...S.adj,...patch.adj};render();
    if(db)upd('state/courses',patch);toast('Articles cochés retirés');return}
  if(a==='carrefour'){if(S.cfAddr){S.cf={step:'ready'};render()}else{S.cf={step:'addr'};render();setTimeout(()=>$('#cfa')&&$('#cfa').focus(),0)}return}
  if(a==='cfaddr'){S.cf={step:'addr'};render();setTimeout(()=>$('#cfa')&&$('#cfa').focus(),0);return}
  if(a==='cfclose'){S.cf=null;render();return}
  if(a==='cfgo'){openClaude();return}
  if(a==='askclear'){S.confirmClear=true;render();return}
  if(a==='noclear'){S.confirmClear=false;render();return}
  if(a==='clearall'){S.confirmClear=false;S.menu={};S.checked={};S.extras={};S.hidden={};S.adj={};PEND.menu={};PEND.checked={};cancelLater();PEND.adj={};PEND.extras={};render();
    if(db){try{await db.doc('state/menu').set({items:{}});await db.doc('state/courses').set({checked:{},extras:{},hidden:{},adj:{},always:S.always})}catch(err){toast('Enregistrement impossible, réessayez.')}}toast('Liste vidée');return}
  if(a==='uncheck'){S.checked={};PEND.checked={};render();if(db)try{await db.doc('state/courses').set({checked:{},extras:Object.fromEntries(Object.entries(S.extras).filter(([,x])=>x&&!x.gone)),hidden:S.hidden,adj:S.adj,always:S.always})}catch(err){toast('Enregistrement impossible, réessayez.')}return}
});
document.addEventListener('change',e=>{
  if(e.target.id==='imp-file'){const f=e.target.files[0];e.target.value='';if(f)importCarnet(f);return}
  if(e.target.dataset&&e.target.dataset.hab){habCount();return}
  if(e.target.dataset&&e.target.dataset.slot){setSlot(e.target.dataset.slot,e.target.value);return}
  const qk=e.target.dataset&&e.target.dataset.qin;
  if(qk){const v=Math.round(parseFloat(String(e.target.value).replace(',','.')));const kind=qk[0],id=qk.slice(2);
    const undo=()=>{e.target.value=e.target.getAttribute('value')};
    if(!(v>=0)){undo();return}
    if(kind==='x'){const x=S.extras[id];if(!x)return;if(v<1){undo();return}const q=Math.min(v,999);S.extras={...S.extras,[id]:{...x,q}};PEND.extras[id]={v:{...x,q},t:Date.now()};render();if(db)upd('state/courses',{extras:{[id]:{...x,q}}})}
    if(kind==='a'){const i=shoppingList().find(i=>i.k===id);if(!i)return;const n=Math.max(0,Math.min(999,v));S.adj={...S.adj,[id]:n};PEND.adj[id]={v:n,t:Date.now()};render.last=null;render();if(db)upd('state/courses',{adj:{[id]:n}})}
    if(kind==='m'){if(v<1){undo();return}setServ(id,Math.min(v,99))}
    return}
  const k=e.target.dataset&&e.target.dataset.k; if(!k) return;
  const v=e.target.checked; toggleCheck(k,v);
  if(v&&k.startsWith('x:')){const id=k.slice(2);setTimeout(()=>{if(S.checked[k])upd('state/courses',{extras:{[id]:{...S.extras[id],gone:true}},checked:{[k]:false}})},4000)}
});
// Toucher le nombre sélectionne tout : on tape directement la nouvelle valeur.
document.addEventListener('focusin',e=>{if(e.target.dataset&&e.target.dataset.qin)setTimeout(()=>e.target.select(),0)});
document.addEventListener('pointerup',e=>{if(e.target.dataset&&e.target.dataset.qin){e.preventDefault();e.target.select()}});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.dataset&&e.target.dataset.qin){e.preventDefault();e.target.blur()}});
document.addEventListener('input',e=>{if(e.target.id==='pick-q'){renderPick();return}if(e.target.id==='q'){S.q=e.target.value;render()}if(e.target.id==='xt'){S.xq=e.target.value;render()}});
document.addEventListener('submit',async e=>{
  e.preventDefault();
  if(e.target.id==='cfaddr'){const v=$('#cfa').value.trim();if(!v){toast('Indiquez l’adresse de livraison.');return}S.cfAddr=v;if(db)upd('state/carrefour',{address:v});S.cf={step:'ready'};render();return}
  if(e.target.id==='addx'){const t=$('#xt').value.trim();if(!t)return;$('#xt').value='';addExtra(t);return}
  if(e.target.id==='hab-add'){const t=$('#hab-in').value.trim();if(!t)return;$('#hab-in').value='';const id='h'+Date.now().toString(36);S.habits={...S.habits,[id]:{t}};renderHabits();render();if(db)upd('state/habituels',{items:{[id]:{t}}});return}
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
      if(!old&&S.edit.draft&&S.edit.draft.img){doc.img=S.edit.draft.img;doc.alt=title}
      if(file&&assets){const up=await assets.upload(file);doc.img=up.url;doc.alt=title}
      const id=S.edit.id||(title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'recette')+'-'+Date.now().toString(36).slice(-4);
      await db.doc('recipes/'+id).set(doc);
      S.edit=null;S.detail=id;toast('Recette enregistrée');render();scrollTo(0,0);
    }catch(err){btn.disabled=false;btn.textContent='Enregistrer';toast(err&&err.code==='quota_exceeded'?'Le carnet est plein.':'Enregistrement impossible, réessayez.')}
  }
});
window.startApp=boot;

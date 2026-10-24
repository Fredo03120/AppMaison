const CATS=['Plats','Salades','Soupes & entrées','Desserts','Petit-déj & goûter','Bases'];
const SHOP_ORDER=['Boulangerie','Fruits & légumes','Viandes & poissons','Crèmerie & fromages','Épicerie','Boissons','Surgelés','Hygiène & beauté','Entretien & maison','Bébé & animaux','Placard','Divers'];
const S={adj:{},recipes:{},menu:{},checked:{},extras:{},hidden:{},confirmClear:false,view:'recettes',detail:null,edit:null,q:'',cat:'',ready:false,offline:false,confirmDel:false,photo:null};
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
// « En plus » d'un ingrédient de recette : la quantité de la recette reste affichée à côté.
function adjStep(e){const f=e.qs.g!=null?'g':e.qs.ml!=null?'ml':e.qs['']!=null||!Object.keys(e.qs).length?'':Object.keys(e.qs)[0];
  return [f,f==='g'||f==='ml'?100:1]}
function handQs(e,qs={}){qs={...qs};for(const h of e.hand||[]){const [f,m]=unitFam(h.u);qs[f]=(qs[f]||0)+h.q*m}return qs}
function totalText(e,n){const [f,st]=adjStep(e);const qs=handQs(e,e.qs);if(n)qs[f]=(qs[f]||0)+n*st;return qtyText({...e,qs}).replace(/^≈ /,'')}
// « 1 dans la recette · 3 ajoutés à la main · Bœuf »
function detailLine(i){
  const parts=[i.qty?i.qty+' dans la recette':'Dans la recette'];
  if(i.hand){const t=qtyText({...i,qs:handQs(i)}).replace(/^≈ /,'');parts.push((t||'')+(t?' ':'')+'ajouté'+(i.hand.length>1||/^[2-9]|^\d{2}/.test(t)?'s':'')+' à la main')}
  if(S.adj[i.k]>0) parts.push('+ '+adjText(i,S.adj[i.k])+' en plus');
  return parts.concat(i.from).join(' · ');
}
function adjText(e,n){const [f,st]=adjStep(e);const x=n*st;return f==='g'||f==='ml'?fmtQty(f,x):fmtNum(x)+(f?' '+plural(f,x):'')}
// Petite icône devant chaque article : d'abord l'aliment, sinon celle du rayon.
const AISLE_ICON={'Boulangerie':'🥖','Fruits & légumes':'🥬','Viandes & poissons':'🥩','Crèmerie & fromages':'🧀','Épicerie':'🥫','Boissons':'🧃','Surgelés':'🧊','Hygiène & beauté':'🧴','Entretien & maison':'🧽','Bébé & animaux':'🐾','Placard':'🧂','Divers':'🛒'};
const ITEM_ICON=[['pomme de terre','🥔'],['patate','🥔'],['tomate','🍅'],['carotte','🥕'],['oignon','🧅'],['échalote','🧅'],['ail','🧄'],['champignon','🍄'],['brocoli','🥦'],['salade','🥬'],['épinard','🥬'],['chou','🥬'],['poireau','🥬'],['concombre','🥒'],['courgette','🥒'],['cornichon','🥒'],
 ['aubergine','🍆'],['poivron','🫑'],['piment','🌶️'],['maïs','🌽'],['avocat','🥑'],['citron','🍋'],['orange','🍊'],['clémentine','🍊'],['mandarine','🍊'],['banane','🍌'],['pomme','🍎'],['poire','🍐'],['fraise','🍓'],['framboise','🍓'],['cerise','🍒'],['raisin','🍇'],['pêche','🍑'],['ananas','🍍'],['mangue','🥭'],['kiwi','🥝'],['melon','🍈'],['pastèque','🍉'],['noix de coco','🥥'],['lait de coco','🥥'],['noix de muscade','🧂'],
 ['persil','🌿'],['basilic','🌿'],['coriandre','🌿'],['menthe','🌿'],['thym','🌿'],['romarin','🌿'],['ciboulette','🌿'],['cerfeuil','🌿'],['bouquet garni','🌿'],['laurier','🌿'],['herbes','🌿'],['gingembre','🫚'],['haricot','🫘'],['lentille','🫘'],['pois chiche','🫘'],['petits pois','🫛'],['olive','🫒'],['cacahuète','🥜'],['amande','🌰'],['noisette','🌰'],['noix','🌰'],['châtaigne','🌰'],
 ['pain','🍞'],['baguette','🥖'],['croissant','🥐'],['brioche','🍞'],['biscotte','🍞'],['wrap','🫓'],['tortilla','🫓'],['crêpe','🥞'],['gaufre','🧇'],
 ['bœuf','🥩'],['boeuf','🥩'],['steak','🥩'],['veau','🥩'],['agneau','🥩'],['porc','🥩'],['côte','🥩'],['rôti','🥩'],['poulet','🍗'],['dinde','🍗'],['canard','🍗'],['cuisse','🍗'],['lardon','🥓'],['bacon','🥓'],['jambon','🥓'],['saucisse','🌭'],['merguez','🌭'],['chorizo','🌭'],['saucisson','🌭'],
 ['saumon','🐟'],['thon','🐟'],['cabillaud','🐟'],['poisson','🐟'],['crevette','🦐'],['moule','🦪'],['huître','🦪'],['surimi','🦀'],
 ['œuf','🥚'],['oeuf','🥚'],['lait','🥛'],['crème','🥛'],['yaourt','🥛'],['beurre','🧈'],['fromage','🧀'],['emmental','🧀'],['gruyère','🧀'],['comté','🧀'],['parmesan','🧀'],['mozzarella','🧀'],['chèvre','🧀'],['feta','🧀'],['raclette','🧀'],['camembert','🧀'],['reblochon','🧀'],['mascarpone','🧀'],['ricotta','🧀'],
 ['pâtes','🍝'],['pâte brisée','🥧'],['pâte feuilletée','🥧'],['pâte sablée','🥧'],['spaghetti','🍝'],['tagliatelle','🍝'],['penne','🍝'],['lasagne','🍝'],['gnocchi','🍝'],['riz','🍚'],['semoule','🍚'],['quinoa','🍚'],['farine','🌾'],['sucre','🍬'],['sel','🧂'],['poivre','🧂'],['épice','🧂'],['cannelle','🧂'],['curry','🧂'],['paprika','🧂'],['cumin','🧂'],['muscade','🧂'],['vanille','🧂'],['levure','🧂'],
 ['huile','🫒'],['vinaigre','🍶'],['moutarde','🥫'],['mayonnaise','🥫'],['ketchup','🥫'],['sauce','🥫'],['bouillon','🥫'],['conserve','🥫'],['concassée','🥫'],['coulis','🥫'],['pulpe','🥫'],['miel','🍯'],['confiture','🍯'],['chocolat','🍫'],['cacao','🍫'],['pâte à tartiner','🍫'],['nutella','🍫'],['biscuit','🍪'],['gâteau','🍰'],['bonbon','🍬'],['céréale','🥣'],['muesli','🥣'],['compote','🥣'],['chips','🥔'],
 ['café','☕'],['thé','🍵'],['tisane','🍵'],['eau','💧'],['jus','🧃'],['soda','🥤'],['coca','🥤'],['limonade','🥤'],['sirop','🧃'],['bière','🍺'],['vin','🍷'],['cidre','🍺'],['champagne','🥂'],['rhum','🥃'],['whisky','🥃'],
 ['glace','🍦'],['frites','🍟'],['pizza','🍕'],['nuggets','🍗'],
 ['papier toilette','🧻'],['essuie-tout','🧻'],['sopalin','🧻'],['mouchoir','🤧'],['éponge','🧽'],['liquide vaisselle','🧼'],['savon','🧼'],['lessive','🧺'],['adoucissant','🧺'],['sac poubelle','🗑️'],['sacs poubelle','🗑️'],['pile','🔋'],['ampoule','💡'],['bougie','🕯️'],['allumette','🔥'],['papier alu','🧻'],['papier cuisson','🧻'],['film','🧻'],
 ['gel douche','🧴'],['shampoing','🧴'],['shampooing','🧴'],['crème solaire','🧴'],['déodorant','🧴'],['dentifrice','🪥'],['brosse à dents','🪥'],['rasoir','🪒'],['coton','☁️'],
 ['couche','👶'],['lingette','👶'],['croquette','🐾'],['pâtée','🐾'],['litière','🐾']];
function itemIcon(name,aisle){
  const raw=name.toLowerCase().replace(/^\d+\s*/,'');let best=null;
  for(const n of [raw,keyOf(raw)]) for(const [w,ic] of ITEM_ICON){const i=n.indexOf(w);if(i>=0&&(i===0||/[\s'’-]/.test(n[i-1]))&&(!best||i<best[1]||(i===best[1]&&w.length>best[2])))best=[ic,i,w.length]}
  return best?best[0]:AISLE_ICON[aisle]||'🛒';
}
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
  return [...map.values()].map(e=>({...e,qty:qtyText(e),from:[...e.from].join(', ')})).filter(e=>e.extra||e.hand||S.hidden[e.k]!==e.qty);
}

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
function addExtra(t){const id='x'+Date.now().toString(36);S.extras={...S.extras,[id]:{t}};S.xq='';render();if(db)upd('state/courses',{extras:{[id]:{t}}})}

/* ---------- Données partagées ---------- */
async function boot(){
  render();
  db=await claude.use('db').catch(()=>null);
  if(!db){S.offline=true;render();return}
  assets=await claude.use('assets').catch(()=>null);
  db.collection('recipes').onSnapshot(snap=>{const o={};snap.docs.forEach(d=>o[d.id]=d.data());S.recipes=o;S.ready=true;render()},()=>{S.offline=true;render()});
  db.doc('state/menu').onSnapshot(d=>{const it=keepPending(PEND.menu,{...((d.exists&&d.data().items)||{})});S.menu=Object.fromEntries(Object.entries(it).filter(([,v])=>v>0));render()});
  db.doc('state/courses').onSnapshot(d=>{const x=d.exists?d.data():{};S.checked=keepPending(PEND.checked,{...(x.checked||{})});S.extras=keepPending(PEND.extras,{...(x.extras||{})});S.hidden=x.hidden||{};S.adj=keepPending(PEND.adj,{...(x.adj||{})});render()});
}
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
function keepPending(pend,data){
  const now=Date.now();
  for(const [k,p] of Object.entries(pend)){
    if(now-p.t>10000||same(data[k],p.v)||(!data[k]&&!p.v)) delete pend[k]; else data[k]=p.v;
  }
  return data;
}
function setServ(id,n){PEND.menu[id]={v:n,t:Date.now()};S.menu={...S.menu};if(n>0)S.menu[id]=n;else delete S.menu[id];render();if(db)sendLater('m:'+id,()=>{PEND.menu[id]&&(PEND.menu[id].t=Date.now());upd('state/menu',{items:{[id]:n}})})}
function toggleCheck(k,v){PEND.checked[k]={v,t:Date.now()};S.checked={...S.checked,[k]:v};render();if(db)upd('state/courses',{checked:{[k]:v}})}

/* ---------- Rendu ---------- */
const ICON={
 plus:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
 check:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
 back:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
 link:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
 user:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/></svg>',
 clock:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4.5l3 2"/></svg>',
 chev:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
 search:'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>',
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
     :`<div class="empty"><h2>Aucune recette trouvée</h2><p>Essayez un autre mot, ou ajoutez-la avec « Nouvelle recette ».</p></div>`}`;
}
function card([id,r]){return `<article class="card" data-key="${esc(id)}"><button class="open" data-open="${esc(id)}"><div class="thumb">${thumb(r)}</div><div class="txt"><h3>${esc(r.title)}</h3><span class="meta">${metaLine(r)}</span></div></button>
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
const qin=(key,v,label)=>`<input class="qin" type="text" inputmode="numeric" pattern="[0-9]*" enterkeyhint="done" data-qin="${esc(key)}" value="${esc(v)}" aria-label="${esc(label)}" style="width:${Math.max(2,String(v).length)+1}ch">`;
function vMenu(){
  const ids=Object.keys(S.menu).filter(id=>S.recipes[id]);
  if(!ids.length) return `<h2 style="font-size:28px;margin-bottom:14px">Le menu</h2><div class="empty"><h2>Rien au menu pour l’instant</h2><p>Touchez le + sur une recette pour l’ajouter. La liste de courses se remplit toute seule.</p><p><button class="btn primary" data-view="recettes">Choisir des recettes</button></p></div>`;
  return `<div class="toolbar"><h2 style="font-size:28px;flex:1">Le menu</h2><button class="btn ghost" data-act="clearmenu">Vider le menu</button><button class="btn primary" data-view="courses">Voir la liste de courses</button></div>
  <div class="menu-list">${ids.map(id=>{const r=S.recipes[id],n=S.menu[id];return `<div class="mrow" data-key="${esc(id)}"><div class="thumb">${thumb(r)}</div>
   <button class="linkbtn" data-open="${esc(id)}"><h3>${esc(r.title)}</h3><span class="status">${esc(r.cat||'')}</span></button>
   <div class="ctl"><div class="servings"><button data-mserv="${esc(id)}" data-d="-1" aria-label="Moins">−</button><span class="sv">${qin('m:'+id,n,'Nombre')} ${esc(servLabel(r,n).replace(String(n),'').trim())}</span><button data-mserv="${esc(id)}" data-d="1" aria-label="Plus">+</button></div>
   <button class="iconbtn" data-toggle="${esc(id)}" aria-label="Retirer du menu">✕</button></div></div>`}).join('')}</div>`;
}
function vCourses(){
  const items=shoppingList();
  const sug=suggestions(S.xq||'');
  const add=`<form class="addrow" id="addx"><input id="xt" autocomplete="off" placeholder="Ajouter un article (ex. papier toilette, 6 yaourts)" aria-label="Article à ajouter"><button class="btn">${ICON.plus}Ajouter</button>
    ${sug.length?`<div class="sugg" role="group" aria-label="Suggestions">${sug.map(n=>`<button type="button" class="chip" data-sugg="${esc(n)}">${ICON.plus}${esc(n)}</button>`).join('')}</div>`:''}</form>`;
  if(!items.length) return `<h2 style="font-size:28px;margin-bottom:14px">Liste de courses</h2>${add}<div class="empty"><h2>La liste est vide</h2><p>Ajoutez des recettes au menu : leurs ingrédients s’additionnent ici, rangés par rayon.</p><p><button class="btn primary" data-view="recettes">Choisir des recettes</button></p></div>`;
  const done=items.filter(i=>S.checked[i.k]).length;
  const byCat={};items.forEach(i=>(byCat[i.c]=byCat[i.c]||[]).push(i));
  return `<div class="toolbar"><h2 style="font-size:28px;flex:1">Liste de courses</h2>${done?`<button class="btn ghost" data-act="uncheck">Tout décocher</button><button class="btn" data-act="rmchecked">Retirer les cochés</button>`:''}<button class="btn ghost danger-t" data-act="askclear">Tout vider</button></div>
  ${S.confirmClear?`<div class="confirm" style="margin-bottom:14px"><span>Vider toute la liste ? Le menu sera vidé aussi, pour tout le groupe.</span><button class="btn danger" data-act="clearall">Oui, tout vider</button><button class="btn ghost" data-act="noclear">Annuler</button></div>`:''}
  <p class="progress">${done} sur ${items.length} dans le panier · pour ${Object.keys(S.menu).filter(id=>S.recipes[id]).length} recette(s)</p>${add}
  <div class="shop">${SHOP_ORDER.filter(c=>byCat[c]).map(c=>{const l=byCat[c].sort((a,b)=>(!!S.checked[a.k]-!!S.checked[b.k])||a.n.localeCompare(b.n,'fr'));
   return `<section><h2><span><span class="aico" aria-hidden="true">${AISLE_ICON[c]||''}</span>${esc(c)}</span><small>${l.filter(i=>!S.checked[i.k]).length} restant(s)</small></h2>${c==='Placard'?'<p class="hint">À vérifier, vous en avez sûrement déjà.</p>':''}
   ${l.map(i=>`<label class="item ${S.checked[i.k]?'done':''}" data-key="${esc(i.k)}"><input type="checkbox" data-k="${esc(i.k)}" ${S.checked[i.k]?'checked':''}><span><span class="n">${esc(i.n)}</span>${!i.extra&&(S.adj[i.k]>0||i.hand)?` <span class="q tot">· ${esc(totalText(i,S.adj[i.k]||0))}</span><span class="from">${esc(detailLine(i))}</span>`
     :`${i.qty?` <span class="q">· ${esc(i.qty)}</span>`:''}<span class="from">${esc(i.from)}</span>`}</span>${!i.extra?`<span class="xstep${S.adj[i.k]>0?'':' solo'}" aria-label="En plus de la recette">${S.adj[i.k]>0?`<button type="button" data-adj="${esc(i.k)}" data-d="-1" aria-label="Moins">−</button><span class="plusin">+${adjStep(i)[0]===''?qin('a:'+i.k,S.adj[i.k],'En plus'):`<b>${esc(adjText(i,S.adj[i.k]))}</b>`}</span>`:''}<button type="button" data-adj="${esc(i.k)}" data-d="1" aria-label="En prendre plus que la recette">+</button></span>${i.hand?`<button class="iconbtn delx" data-delx="${esc(i.hand.map(h=>h.id).join(','))}" aria-label="Retirer ce qui a été ajouté à la main">✕</button>`:''}`:''}${i.extra?`<span class="xstep" aria-label="Quantité"><button type="button" data-xq="${esc(i.extra)}" data-d="-1" aria-label="Moins" aria-disabled="${i.xq<=1}">−</button>${qin('x:'+i.extra,i.xq,'Quantité')}<button type="button" data-xq="${esc(i.extra)}" data-d="1" aria-label="Plus">+</button></span><button class="iconbtn delx" data-delx="${esc(i.extra)}" aria-label="Supprimer ${esc(i.n)}">✕</button>`:''}</label>`).join('')}</section>`}).join('')}</div>`;
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
  const html=v==='edit'?vEdit():v==='detail'?vDetail():v==='menu'?vMenu():v==='courses'?vCourses():v==='social'?Social.html():vRecettes();
  // Rien n'a changé : on garde la page telle quelle, sans recharger les photos.
  if(html!==render.last){
    const chips=$('#app .chips'), sx=chips?chips.scrollLeft:0;
    morph($('#app'),html); render.last=html;
    const nc=$('#app .chips'); if(nc){nc.scrollLeft=sx;
      const on=nc.querySelector('[aria-pressed="true"]');
      if(S.centerChip&&on) nc.scrollTo({left:nc.scrollLeft+on.getBoundingClientRect().left-nc.getBoundingClientRect().left-(nc.clientWidth-on.offsetWidth)/2,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
  }
  S.centerChip=false;
  if(['q','xt','msg','s-add-in'].includes(fid)){const el=document.getElementById(fid);if(el){if(fid!=='q'&&fid!=='msg')el.value=val;el.focus();try{el.setSelectionRange(sel,sel)}catch(e){}}}
  if(v==='social') Social.after();
}
function go(view){if(view==='social'&&window.Social)Social.reset();S.view=view;S.detail=null;S.edit=null;S.confirmDel=false;S.confirmClear=false;render();scrollTo(0,0)}

/* ---------- Événements ---------- */
document.addEventListener('click',async e=>{
  const b=e.target.closest('button,[data-k]'); if(!b) return;
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
  if(b.dataset.toggle){const id=b.dataset.toggle,r=S.recipes[id];if(S.menu[id]){setServ(id,0);toast('Retiré du menu')}else{setServ(id,(S.preview&&S.preview[id])||r.portions||1);toast('Ajouté au menu')}return}
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
  if(a==='del'){const id=S.detail;try{await db.doc('recipes/'+id).delete();if(S.menu[id])setServ(id,0);toast('Recette supprimée');go('recettes')}catch(err){toast('Suppression impossible, réessayez.')}return}
  if(a==='clearmenu'){S.menu={};PEND.menu={};PEND.checked={};cancelLater();render();if(db){try{await db.doc('state/menu').set({items:{}});await db.doc('state/courses').set({checked:{},extras:S.extras,hidden:{}})}catch(err){toast('Enregistrement impossible, réessayez.')}}return}
  if(a==='rmchecked'){
    const patch={checked:{},extras:{},hidden:{},adj:{}};
    for(const i of shoppingList()) if(S.checked[i.k]){
      patch.checked[i.k]=false; PEND.checked[i.k]={v:false,t:Date.now()};
      if(i.extra) patch.extras[i.extra]={...S.extras[i.extra],gone:true}; else {patch.hidden[i.k]=i.qty;if(S.adj[i.k])patch.adj[i.k]=0;for(const h of i.hand||[])patch.extras[h.id]={...S.extras[h.id],gone:true}}
    }
    S.checked={...S.checked,...patch.checked};S.extras={...S.extras,...patch.extras};S.hidden={...S.hidden,...patch.hidden};S.adj={...S.adj,...patch.adj};render();
    if(db)upd('state/courses',patch);toast('Articles cochés retirés');return}
  if(a==='askclear'){S.confirmClear=true;render();return}
  if(a==='noclear'){S.confirmClear=false;render();return}
  if(a==='clearall'){S.confirmClear=false;S.menu={};S.checked={};S.extras={};S.hidden={};S.adj={};PEND.menu={};PEND.checked={};cancelLater();PEND.adj={};PEND.extras={};render();
    if(db){try{await db.doc('state/menu').set({items:{}});await db.doc('state/courses').set({checked:{},extras:{},hidden:{},adj:{}})}catch(err){toast('Enregistrement impossible, réessayez.')}}toast('Liste vidée');return}
  if(a==='uncheck'){S.checked={};PEND.checked={};render();if(db)try{await db.doc('state/courses').set({checked:{},extras:Object.fromEntries(Object.entries(S.extras).filter(([,x])=>x&&!x.gone)),hidden:S.hidden,adj:S.adj})}catch(err){toast('Enregistrement impossible, réessayez.')}return}
});
document.addEventListener('change',e=>{
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
document.addEventListener('input',e=>{if(e.target.id==='q'){S.q=e.target.value;render()}if(e.target.id==='xt'){S.xq=e.target.value;render()}});
document.addEventListener('submit',async e=>{
  e.preventDefault();
  if(e.target.id==='addx'){const t=$('#xt').value.trim();if(!t)return;$('#xt').value='';addExtra(t);return}
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

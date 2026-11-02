(()=>{
 'use strict';
 const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
 const root=document.documentElement,theme=$('.theme-button');
 const themeLabel=()=>theme.setAttribute('aria-label',root.dataset.theme==='dark'?'밝은 테마로 전환':'어두운 테마로 전환');
 themeLabel();theme.addEventListener('click',()=>{root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem('mine-wiki-theme',root.dataset.theme);}catch{}themeLabel();});
 const menu=$('.menu-button'),shade=$('.sidebar-shade');
 function setMenu(open){document.body.classList.toggle('menu-open',open);menu.setAttribute('aria-expanded',String(open));shade.hidden=!open;}
 menu.addEventListener('click',()=>setMenu(!document.body.classList.contains('menu-open')));shade.addEventListener('click',()=>setMenu(false));
 $$('.sidebar a').forEach(a=>{if(a.getAttribute('href')===document.body.dataset.page+'.html'||a.dataset.category&&a.dataset.category===document.body.dataset.type){a.classList.add('active');a.setAttribute('aria-current','page');}});
 const dialog=$('#search-dialog'),input=$('#search-input'),results=$('#search-results'),catalog=window.WIKI_CATALOG||[];
 let filter='all',lastFocus=null,searchTimer=0;
 const norm=s=>String(s).toLocaleLowerCase().replace(/\s+/g,' ').trim();
 const corpus=catalog.map(a=>({...a,normalized:norm(a.title+' '+a.intro+' '+a.text+' '+a.id),titleNorm:norm(a.title)}));
 function resultNode(a,q){
  const el=document.createElement('a');el.className='search-result';el.href=a.id+'.html';
  const small=document.createElement('small');small.textContent=a.category;
  const title=document.createElement('strong');title.textContent=a.title;
  const desc=document.createElement('p');let snippet=a.intro;
  if(q&&!norm(snippet).includes(q)&&!a.titleNorm.includes(q)){const text=a.text.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/\s+/g,' ');const at=norm(text).indexOf(q);if(at>=0)snippet=(at>30?'…':'')+text.slice(Math.max(0,at-30),at+110)+'…';}
  desc.textContent=snippet.length>145?snippet.slice(0,145)+'…':snippet;el.append(small,title,desc);return el;
 }
 function search(){
  const q=norm(input.value),tokens=q.split(' ').filter(Boolean);let matches=corpus.filter(a=>filter==='all'||a.type===filter);
  if(q)matches=matches.filter(a=>tokens.every(t=>a.normalized.includes(t))).map(a=>({a,score:(a.titleNorm===q?1000:0)+(a.titleNorm.startsWith(q)?300:0)+(a.titleNorm.includes(q)?150:0)+(norm(a.intro).includes(q)?30:0)+(a.type==='catalog'?-10:0)})).sort((a,b)=>b.score-a.score).map(x=>x.a);
  else{const picks=['weapon-axe','weapon-wand','weapon-twin','boss-star','system-parry','item-ember'];matches.sort((a,b)=>{const ai=picks.indexOf(a.id),bi=picks.indexOf(b.id);return(ai<0?999:ai)-(bi<0?999:bi);});}
  results.replaceChildren();
  if(!matches.length){const empty=document.createElement('p');empty.className='search-empty';empty.textContent='찾은 문서가 없습니다. 다른 이름이나 효과로 검색해보세요.';results.append(empty);}
  else{const status=document.createElement('p');status.className='search-empty';status.style.padding='7px 13px';status.textContent=q?`${matches.length}개 문서 · 상위 ${Math.min(24,matches.length)}개 표시`:'자주 찾는 문서 · 이름이나 효과를 입력하세요';results.append(status);matches.slice(0,24).forEach(a=>results.append(resultNode(a,q)));}
  results.scrollTop=0;
 }
 function openSearch(){lastFocus=document.activeElement;if(!dialog.open)dialog.showModal();search();input.focus();input.select();}
 $('.search-trigger').addEventListener('click',openSearch);$('.search-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>lastFocus?.focus());dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
 input.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(search,70);});
 $$('.search-facets button').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;$$('.search-facets button').forEach(x=>x.classList.toggle('selected',x===b));search();input.focus();}));
 document.addEventListener('keydown',e=>{const editing=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName);if((e.key==='/'&&!editing)||(e.key.toLowerCase()==='k'&&(e.ctrlKey||e.metaKey))){e.preventDefault();openSearch();}if(e.key==='Escape')setMenu(false);if(dialog.open&&e.key==='ArrowDown'&&document.activeElement===input){e.preventDefault();results.querySelector('a')?.focus();}if(dialog.open&&e.key==='Enter'&&document.activeElement===input){const first=results.querySelector('a');if(first){e.preventDefault();first.click();}}});
 results.addEventListener('keydown',e=>{const anchors=[...results.querySelectorAll('a')],i=anchors.indexOf(document.activeElement);if(e.key==='ArrowDown'){e.preventDefault();anchors[Math.min(i+1,anchors.length-1)]?.focus();}if(e.key==='ArrowUp'){e.preventDefault();if(i<=0)input.focus();else anchors[i-1].focus();}});
 const catalogFilter=$('.catalog-filter');
 if(catalogFilter){const cards=$$('.catalog-card'),count=$('.filter-count');const update=()=>{const q=norm(catalogFilter.value),tokens=q.split(' ').filter(Boolean);let shown=0;cards.forEach(card=>{card.hidden=!tokens.every(t=>norm(card.dataset.search).includes(t));if(!card.hidden)shown++;});count.textContent=`${shown} / ${cards.length} 문서`;};catalogFilter.addEventListener('input',update);update();}
 const tocLinks=$$('.toc>a');
 if(tocLinks.length&&'IntersectionObserver'in window){const visible=new Map();const observer=new IntersectionObserver(entries=>{entries.forEach(e=>visible.set(e.target.id,e.isIntersecting));const current=[...visible].find(([,v])=>v)?.[0];if(current)tocLinks.forEach(a=>a.classList.toggle('current',a.hash==='#'+current));},{rootMargin:'-90px 0px -55% 0px',threshold:0});$$('.article-section[id]').forEach(s=>observer.observe(s));}
 const form=$('#damage-calculator');
 if(form){const calculate=()=>{const d=Number(form.elements.difficulty.value),base=Math.max(0,Number(form.elements.damage.value)||0),guard=Number(form.elements.guard.value),mult=d<=1?1+.5*d:1.5*Math.pow(2/1.5,(d-1)/2);const result=Math.max(1,Math.round(base*mult*(1-Math.min(.45,guard*.1))*(form.elements.bronze.checked?.8:1)));form.querySelector('output').textContent=`예상 피격 피해 ${result.toLocaleString('ko-KR')}`;};form.addEventListener('input',calculate);form.addEventListener('submit',e=>e.preventDefault());calculate();}
})();

export const interfaceStyle = `
:root{color-scheme:dark;--bg:#111513;--surface:#191e1b;--line:#ffffff16;--ink:#edf1e9;--muted:#969e97;--accent:#c5ed9c;--primary-ink:#182117;--primary-hover:#d8f6bc;--control-bg:#0c100e;--hover:#ffffff09;--selected:#c5ed9c15;--accent-line:#c5ed9c35;--dots:#ffffff13;--font:"Inter","Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
:root[data-theme=light]{color-scheme:light;--bg:#f2f5ef;--surface:#ffffff;--line:#243d241c;--ink:#26332b;--muted:#637367;--accent:#426b34;--primary-ink:#fff;--primary-hover:#355a2a;--control-bg:#e8eee4;--hover:#24442a09;--selected:#dce9d4;--accent-line:#426b3440;--dots:#18362324}
:root[data-accent=rose]{--accent:#f0b6c7;--primary-hover:#f7cbd7;--selected:#f0b6c718;--accent-line:#f0b6c74a}
:root[data-theme=light][data-accent=rose]{--accent:#a34c68;--primary-hover:#8b3b55;--selected:#a34c6813;--accent-line:#a34c6840}
:root[data-accent=blue]{--accent:#a8cff0;--primary-hover:#c3def5;--selected:#a8cff018;--accent-line:#a8cff04a}
:root[data-theme=light][data-accent=blue]{--accent:#356c98;--primary-hover:#285b84;--selected:#356c9813;--accent-line:#356c9840}
:root[data-accent=amber]{--accent:#e9cc95;--primary-hover:#f2deb8;--selected:#e9cc9518;--accent-line:#e9cc954a}
:root[data-theme=light][data-accent=amber]{--accent:#8b651f;--primary-hover:#735118;--selected:#8b651f13;--accent-line:#8b651f40}
@keyframes loading-ui-spokes-spin{to{transform:rotate(360deg)}}
.startup-screen{position:fixed;inset:0;z-index:20000;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:20px;background:var(--bg);color:var(--accent);opacity:1;visibility:visible;transition:opacity .32s ease,visibility .32s;pointer-events:auto}
.startup-screen.is-complete{opacity:0;visibility:hidden;pointer-events:none}
.loading-spokes{width:40px;height:40px;animation:loading-ui-spokes-spin var(--duration,1s) linear infinite;transform-origin:center}
.startup-screen span{font:12px/1.6 var(--font);letter-spacing:2px;color:var(--muted)}
.page-content,.app-shell{transition:opacity .38s ease,transform .38s ease}
body.is-loading>.page-content,body.is-loading>.app-shell{opacity:0;transform:translateY(7px);pointer-events:none}
:root[data-motion=reduced] .loading-spokes{animation:none}:root[data-motion=reduced] .startup-screen,:root[data-motion=reduced] .page-content,:root[data-motion=reduced] .app-shell{transition:none;transform:none}
@media(prefers-reduced-motion:reduce){.loading-spokes{animation:none}.startup-screen,.page-content,.app-shell{transition:none!important;transform:none!important}}
`;

export const loadingMarkup = `<div id="startup-screen" class="startup-screen" role="status" aria-live="polite" aria-label="正在加载网页"><svg class="loading-spokes" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 2V6M16.2 7.8L19.1 4.9M18 12H22M16.2 16.2L19.1 19.1M12 18V22M4.9 19.1L7.8 16.2M2 12H6M4.9 4.9L7.8 7.8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>正在打开我们的瞬间</span></div>`;

// These preferences contain presentation settings only; identity stays in HttpOnly cookies.
export const interfaceScript = `(()=>{
  const key='moments-interface-v1',root=document.documentElement,system=matchMedia('(prefers-color-scheme: light)');
  const started=Date.now();let requested=false,completed=false,hideTimer,fallback;
  function clean(value){const p={};if(!value||typeof value!=='object'||Array.isArray(value))return p;if(['system','light','dark'].includes(value.appearanceTheme))p.appearanceTheme=value.appearanceTheme;if(['green','rose','blue','amber'].includes(value.accent))p.accent=value.accent;if(['compact','comfortable'].includes(value.density))p.density=value.density;if(typeof value.reduceMotion==='boolean')p.reduceMotion=value.reduceMotion;if(typeof value.albumName==='string')p.albumName=Array.from(value.albumName.replace(/\\s+/g,' ').trim()).slice(0,40).join('');return p;}
  function read(){try{return clean(JSON.parse(localStorage.getItem(key)||'{}'));}catch{return {};}}
  function apply(value=read()){const p=clean(value),light=p.appearanceTheme==='light'||(p.appearanceTheme==='system'&&system.matches);root.dataset.theme=light?'light':'dark';root.dataset.accent=p.accent||'green';root.dataset.density=p.density||'comfortable';root.dataset.motion=p.reduceMotion?'reduced':'full';document.querySelector('meta[name="theme-color"]')?.setAttribute('content',light?'#f2f5ef':'#111513');document.querySelectorAll('[data-album-name]').forEach(el=>el.textContent=p.albumName||'未命名相册');const button=document.getElementById('admin-theme-toggle');if(button){button.setAttribute('aria-label',light?'切换为夜间模式':'切换为日间模式');button.setAttribute('aria-pressed',String(light));}return p;}
  function remember(value){const p=clean(value);try{localStorage.setItem(key,JSON.stringify(p));}catch{}return p;}
  function complete(){if(completed)return;completed=true;document.body?.classList.remove('is-loading');document.querySelectorAll('[data-startup-inert]').forEach(el=>{el.inert=false;el.removeAttribute('data-startup-inert');});const loader=document.getElementById('startup-screen');if(loader){loader.classList.add('is-complete');loader.setAttribute('aria-hidden','true');hideTimer=setTimeout(()=>loader.hidden=true,350);}}
  function ready(){if(requested)return;requested=true;clearTimeout(fallback);const reduced=root.dataset.motion==='reduced'||matchMedia('(prefers-reduced-motion: reduce)').matches,remaining=reduced?0:Math.max(0,260-(Date.now()-started));if(remaining)setTimeout(complete,remaining);else complete();}
  window.MomentsUI={read,apply,remember,ready,key};apply();
  window.addEventListener('storage',event=>{if(event.key===key)apply();});window.addEventListener('pageshow',()=>apply());
  const changed=()=>{if(read().appearanceTheme==='system')apply();};if(system.addEventListener)system.addEventListener('change',changed);else system.addListener?.(changed);
  fallback=setTimeout(ready,15000);
})();`;

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
.startup-screen{position:fixed;inset:0;z-index:20000;display:grid;grid-template-columns:228px minmax(0,1fr) 260px;grid-template-rows:62px minmax(0,1fr);gap:20px;padding:24px;background:var(--bg);color:var(--accent);opacity:1;visibility:visible;transition:opacity .32s ease,visibility .32s;pointer-events:auto;font-family:var(--font)}
.startup-screen.is-complete{opacity:0;visibility:hidden;pointer-events:none}
.startup-brand{grid-column:1;grid-row:1;display:flex;align-items:center;gap:12px}.startup-brand svg{width:38px;height:38px;fill:none;stroke:var(--accent);stroke-width:1}.startup-brand b{font-size:22px;letter-spacing:3px;color:var(--ink);font-weight:650}.startup-brand small{display:block;color:var(--muted);font-size:10px;letter-spacing:2.4px}
.startup-toolbar{grid-column:2;grid-row:1;display:flex;align-items:center;gap:10px;padding:14px 18px;background:var(--surface);border:1px solid var(--line);border-radius:16px;box-shadow:0 10px 35px #0002}.startup-toolbar i{display:block;width:30px;height:12px;border-radius:4px;background:var(--selected)}.startup-toolbar i:first-child{width:96px;margin-right:auto}
.startup-title{grid-column:3;grid-row:1;align-self:center;min-width:0}.startup-title small{display:block;font-size:10px;letter-spacing:2px;color:var(--muted)}.startup-title b{display:block;font-size:17px;font-weight:500;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.startup-sidebar{grid-column:1;grid-row:2;display:flex;flex-direction:column;gap:14px;padding-top:12px}.startup-sidebar i{height:44px;border-radius:10px;background:var(--selected);opacity:.5}.startup-sidebar i:nth-child(2){opacity:.25}.startup-sidebar i:last-child{margin-top:auto;height:56px;border-top:1px solid var(--line);background:transparent;border-radius:0}
.startup-canvas{grid-column:2;grid-row:2;border-radius:16px;background-image:radial-gradient(var(--dots) .6px,transparent .6px);background-size:23px 23px;min-width:0;min-height:0}
.startup-days{grid-column:3;grid-row:2;display:grid;grid-template-rows:1fr 1fr 1fr;gap:20px;min-height:0}.startup-days i{border:1px solid var(--line);border-radius:14px;background:var(--surface);opacity:.65}
.startup-focus{grid-column:2;grid-row:2;z-index:1;justify-self:center;align-self:center;display:flex;flex-direction:column;align-items:center;gap:20px;padding:34px 38px;border:1px solid var(--line);border-radius:16px;background:var(--surface);box-shadow:0 18px 50px #0002;text-align:center;max-width:100%;min-width:0}
.loading-spokes{width:40px;height:40px;animation:loading-ui-spokes-spin var(--duration,1s) linear infinite;transform-origin:center}
.startup-focus span{font:12px/1.6 var(--font);letter-spacing:2px;color:var(--muted)}
:root[data-density=compact] .startup-screen{gap:12px;padding:16px}
@media(max-width:1200px){.startup-screen{grid-template-columns:178px minmax(0,1fr) 210px;gap:14px;padding:16px}}
@media(max-width:760px){.startup-screen{grid-template-columns:44px minmax(0,1fr);grid-template-rows:48px minmax(0,1fr);gap:12px;padding:10px}.startup-brand svg{width:31px;height:31px}.startup-brand>div,.startup-title,.startup-days{display:none}.startup-sidebar i{height:40px}.startup-toolbar{padding:10px 12px;border-radius:12px}.startup-toolbar i:first-child{width:60px}.startup-focus{padding:28px 22px}.startup-focus span{font-size:11px;letter-spacing:1px}}
.page-content,.app-shell{transition:opacity .38s ease,transform .38s ease}
body.is-loading>.page-content,body.is-loading>.app-shell{opacity:0;transform:translateY(7px);pointer-events:none}
:root[data-motion=reduced] .loading-spokes{animation:none}:root[data-motion=reduced] .startup-screen,:root[data-motion=reduced] .page-content,:root[data-motion=reduced] .app-shell{transition:none;transform:none}
@media(prefers-reduced-motion:reduce){.loading-spokes{animation:none}.startup-screen,.page-content,.app-shell{transition:none!important;transform:none!important}}
`;

export const spaceMark = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="13" r="4"/><circle cx="11" cy="13" r="9"/><path d="M14 1a12 12 0 1 1-13 13"/></svg>`;
export const loadingMarkup = `<div id="startup-screen" class="startup-screen" role="status" aria-live="polite" aria-label="正在加载网页"><div class="startup-brand" aria-hidden="true">${spaceMark}<div><b>瞬间</b><small>MOMENTS</small></div></div><div class="startup-toolbar" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div class="startup-title" aria-hidden="true"><small>OUR PRIVATE SPACE</small><b data-album-name>未命名相册</b></div><div class="startup-sidebar" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div class="startup-canvas" aria-hidden="true"></div><div class="startup-days" aria-hidden="true"><i></i><i></i><i></i></div><div class="startup-focus"><svg class="loading-spokes" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 2V6M16.2 7.8L19.1 4.9M18 12H22M16.2 16.2L19.1 19.1M12 18V22M4.9 19.1L7.8 16.2M2 12H6M4.9 4.9L7.8 7.8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>正在打开我们的瞬间</span></div></div>`;

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

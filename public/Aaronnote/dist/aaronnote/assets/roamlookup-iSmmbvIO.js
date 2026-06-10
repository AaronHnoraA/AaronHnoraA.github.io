var e=6e4,t=/(?:^|\/|\.{1,2}\/)[^\s()[\]<>"]+\.(?:md|markdown|typ)(?::\d+)?(?:[#@][^\s()[\]<>"]+)?/i;function n(){return globalThis.window?.aaronnoteApi?.roamlookup}function r(){let e=n()?.request;if(!e)throw Error(`RoamLookup native bridge is unavailable`);return e}function i(e){let t=e;if(t?.ok===!1)throw Error(String(t.message||`RoamLookup request failed`));return e}function a(e,t){let n=Number(e);return Number.isFinite(n)&&n>=1e4?n:t}async function o(e,t){return r()(e,t).then(e=>i(e))}function s(e){let n=String(e||``).trim();return/^(?:https?:|mailto:|file:|roam:\/\/|\/|\.{1,2}\/|#)/i.test(n)||t.test(n)}function c(e){return String(e||``).trim().replace(/^<|>$/g,``).replace(/(\.(?:md|markdown|typ)):\d+($|[#@])/i,`$1$2`)}function l(e,n){let r=/\[([^\]\n]+)\]\(([^)\s]+(?:\([^)]*\)[^)\s]*)?)\)/g,i=0;for(let a of n.matchAll(r)){let r=a.index??0;r>i&&e.append(document.createTextNode(n.slice(i,r)));let o=a[1]||a[2]||``,l=c(a[2]||``);if(s(l)){let n=document.createElement(`a`);n.href=l,n.textContent=o,n.dataset.roamlookupHref=l,t.test(l)||/^roam:\/\//i.test(l)?n.dataset.roamlookupNote=`true`:(n.target=`_blank`,n.rel=`noopener noreferrer`),e.append(n)}else e.append(document.createTextNode(o));i=r+a[0].length}i<n.length&&e.append(document.createTextNode(n.slice(i)))}function u(e,t,n){let r=document.createElement(`article`);r.className=`aaronnote-roamlookup-message is-${t}`;let i=document.createElement(`strong`);i.textContent=t===`user`?`You`:t===`assistant`?`RoamLookup`:`Status`;let a=document.createElement(`div`);return t===`assistant`?l(a,n):a.textContent=n,r.append(i,a),e.append(r),r.scrollIntoView({block:`end`}),r}function d(t){let n=document.querySelector(`.aaronnote-notes-tabs`),r=document.querySelector(`.aaronnote-notes-inner`),i=document.querySelector(`[data-notes-page]`);if(!n||!r)return t.setStatus(`RoamLookup: notes page not found`),()=>{};let s=``,c=!1,l=0,d=a(t.getSettings().idleMs,e),f=[],p=document.createElement(`style`);p.textContent=`
.aaronnote-roamlookup-panel {
  display: grid;
  grid-template-rows: auto minmax(260px, 1fr) auto;
  min-height: min(720px, calc(100vh - 220px));
  gap: 12px;
}
.aaronnote-roamlookup-panel[hidden] {
  display: none;
}
.aaronnote-roamlookup-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.aaronnote-roamlookup-head strong {
  color: var(--aaron-red-dark);
  font: 750 16px/1.2 var(--aaron-font-sans);
}
.aaronnote-roamlookup-head span {
  color: var(--aaron-muted);
  font-size: 12px;
}
.aaronnote-roamlookup-actions {
  display: flex;
  gap: 6px;
}
.aaronnote-roamlookup-panel button {
  min-height: 32px;
  border: 1px solid var(--aaron-paper-line);
  border-radius: 3px;
  padding: 0 10px;
  background: var(--aaron-paper);
  color: var(--aaron-ink);
  cursor: pointer;
}
.aaronnote-roamlookup-panel button:disabled {
  opacity: 0.55;
  cursor: default;
}
.aaronnote-roamlookup-log {
  overflow: auto;
  border: 1px solid var(--aaron-paper-line);
  background: var(--aaron-paper-soft);
  padding: 10px;
}
.aaronnote-roamlookup-message {
  display: grid;
  gap: 4px;
  margin: 0 0 10px;
  border-left: 3px solid var(--aaron-paper-line);
  padding: 7px 9px;
  background: var(--aaron-paper);
}
.aaronnote-roamlookup-message.is-user {
  border-left-color: var(--aaron-red);
}
.aaronnote-roamlookup-message.is-assistant {
  border-left-color: #15803d;
}
.aaronnote-roamlookup-message.is-system {
  border-left-color: #a16207;
}
.aaronnote-roamlookup-message strong {
  color: var(--aaron-muted);
  font-size: 11px;
}
.aaronnote-roamlookup-message div {
  white-space: pre-wrap;
  color: var(--aaron-ink);
  font: 13px/1.55 var(--aaron-font-sans);
}
.aaronnote-roamlookup-message a {
  color: var(--aaron-red-dark);
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}
.aaronnote-roamlookup-message a[data-roamlookup-note="true"] {
  font-weight: 700;
}
.aaronnote-roamlookup-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: end;
}
.aaronnote-roamlookup-form textarea {
  width: 100%;
  min-height: 74px;
  box-sizing: border-box;
  resize: vertical;
  border: 1px solid var(--aaron-paper-line);
  border-radius: 3px;
  padding: 9px 10px;
  background: var(--aaron-paper);
  color: var(--aaron-ink);
  font: 13px/1.45 var(--aaron-font-sans);
}
`,document.head.appendChild(p);let m=document.createElement(`button`);m.type=`button`,m.dataset.notesTab=`roamlookup`,m.textContent=`Roam lookup`;let h=document.createElement(`div`);h.dataset.notesPanel=`roamlookup`,h.className=`aaronnote-roamlookup-panel`,h.hidden=!0;let g=document.createElement(`header`);g.className=`aaronnote-roamlookup-head`;let _=document.createElement(`div`),v=document.createElement(`strong`);v.textContent=`Roam lookup`;let y=document.createElement(`span`);y.textContent=`Not started`,_.append(v,y);let b=document.createElement(`div`);b.className=`aaronnote-roamlookup-actions`;let x=document.createElement(`button`);x.type=`button`,x.textContent=`Start`;let S=document.createElement(`button`);S.type=`button`,S.textContent=`Close`,b.append(x,S),g.append(_,b);let C=document.createElement(`div`);C.className=`aaronnote-roamlookup-log`;let w=document.createElement(`form`);w.className=`aaronnote-roamlookup-form`;let T=document.createElement(`textarea`);T.placeholder=`Ask the knowledge base`;let E=document.createElement(`button`);E.type=`submit`,E.textContent=`Ask`,w.append(T,E),h.append(g,C,w),n.append(m),r.append(h);function D(e){y.textContent=e,t.setStatus(`RoamLookup: ${e}`)}function O(){return t.root.dataset.standalone===`true`}function k(){window.clearTimeout(l),l=0}function A(){return!h.hidden&&i?.hidden!==!0}function j(){k(),s&&(l=window.setTimeout(()=>{if(c){j();return}N(`Closed after leaving`)},d))}async function M(){if(O()||(k(),s))return;D(`Starting`);let e=await o(`start`,{file:t.currentFile()});if(e.disabled)throw Error(e.message||`RoamLookup disabled`);s=e.sessionId||``,d=a(e.idleMs??d,d),D(e.status||`Ready`)}async function N(e=`Closed`){k();let t=s;s=``,c=!1,t&&await o(`close`,{sessionId:t}).catch(()=>({})),D(e)}function P(){O()||(k(),i?.hidden&&window.dispatchEvent(new CustomEvent(`aaronnote:command`,{detail:{command:`open-filesystem`}})),document.querySelectorAll(`[data-notes-tab]`).forEach(e=>{e.classList.toggle(`is-active`,e===m)}),document.querySelectorAll(`[data-notes-panel]`).forEach(e=>{e.hidden=e!==h}),M().then(()=>T.focus()).catch(e=>{u(C,`system`,e instanceof Error?e.message:`RoamLookup failed`),D(`Failed`)}))}async function F(){if(O())return;let e=T.value.trim();if(!e||c)return;await M(),u(C,`user`,e),T.value=``,c=!0,E.disabled=!0;let t=u(C,`system`,`Running`);D(`Running`);try{let n=await o(`query`,{sessionId:s,query:e});t.remove(),n.sessionId&&(s=n.sessionId),u(C,`assistant`,n.answer||n.message||`No answer`),D(n.status||`Ready`)}catch(e){t.remove(),u(C,`system`,e instanceof Error?e.message:`RoamLookup failed`),D(`Failed`)}finally{c=!1,E.disabled=!1,A()||j(),T.focus()}}let I=e=>{e.preventDefault(),P()};m.addEventListener(`click`,I),f.push(()=>m.removeEventListener(`click`,I));let L=e=>{e.currentTarget!==m&&(h.hidden=!0,m.classList.remove(`is-active`),j())};return document.querySelectorAll(`[data-notes-tab]`).forEach(e=>{e!==m&&(e.addEventListener(`click`,L),f.push(()=>e.removeEventListener(`click`,L)))}),document.querySelectorAll(`[data-action='notes'], [data-action='agenda']`).forEach(e=>{e.addEventListener(`click`,L),f.push(()=>e.removeEventListener(`click`,L))}),x.addEventListener(`click`,()=>{M().catch(e=>{u(C,`system`,e instanceof Error?e.message:`RoamLookup failed`),D(`Failed`)})}),S.addEventListener(`click`,()=>void N(`Closed`)),w.addEventListener(`submit`,e=>{e.preventDefault(),F()}),T.addEventListener(`keydown`,e=>{e.key===`Enter`&&(e.metaKey||e.ctrlKey)&&(e.preventDefault(),F())}),C.addEventListener(`click`,e=>{let t=e.target?.closest(`a[data-roamlookup-href]`);if(!t)return;let n=t.dataset.roamlookupHref||t.getAttribute(`href`)||``;n&&(e.preventDefault(),document.dispatchEvent(new CustomEvent(`aaronnote:open-url`,{detail:{href:n,newWindow:!0}})))}),f.push(t.onSettingsChange(t=>{d=a(t.idleMs,e),l&&j()})),f.push(t.onAction(e=>{e===`open`&&P(),e===`close`&&N(`Closed`)})),()=>{N(`Closed`),f.splice(0).forEach(e=>e()),m.remove(),h.remove(),p.remove()}}export{d as setup};
var e=6e4;function t(e,t){let n=Number(e);return Number.isFinite(n)&&n>=1e4?n:t}async function n(e,t){let n=await fetch(e,{method:`POST`,headers:{"content-type":`application/json`},body:JSON.stringify(t)}),r=await n.json().catch(()=>({}));if(!n.ok)throw Error(String(r.message||n.statusText));return r}function r(e,t,n){let r=document.createElement(`article`);r.className=`aaronnote-roamlookup-message is-${t}`;let i=document.createElement(`strong`);i.textContent=t===`user`?`You`:t===`assistant`?`RoamLookup`:`Status`;let a=document.createElement(`div`);return a.textContent=n,r.append(i,a),e.append(r),r.scrollIntoView({block:`end`}),r}function i(i){let a=document.querySelector(`.aaronnote-notes-tabs`),o=document.querySelector(`.aaronnote-notes-inner`),s=document.querySelector(`[data-notes-page]`);if(!a||!o)return i.setStatus(`RoamLookup: notes page not found`),()=>{};let c=``,l=!1,u=0,d=t(i.getSettings().idleMs,e),f=[],p=document.createElement(`style`);p.textContent=`
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
`,document.head.appendChild(p);let m=document.createElement(`button`);m.type=`button`,m.dataset.notesTab=`roamlookup`,m.textContent=`Roam lookup`;let h=document.createElement(`div`);h.dataset.notesPanel=`roamlookup`,h.className=`aaronnote-roamlookup-panel`,h.hidden=!0;let g=document.createElement(`header`);g.className=`aaronnote-roamlookup-head`;let _=document.createElement(`div`),v=document.createElement(`strong`);v.textContent=`Roam lookup`;let y=document.createElement(`span`);y.textContent=`Not started`,_.append(v,y);let b=document.createElement(`div`);b.className=`aaronnote-roamlookup-actions`;let x=document.createElement(`button`);x.type=`button`,x.textContent=`Start`;let S=document.createElement(`button`);S.type=`button`,S.textContent=`Close`,b.append(x,S),g.append(_,b);let C=document.createElement(`div`);C.className=`aaronnote-roamlookup-log`;let w=document.createElement(`form`);w.className=`aaronnote-roamlookup-form`;let T=document.createElement(`textarea`);T.placeholder=`Ask the knowledge base`;let E=document.createElement(`button`);E.type=`submit`,E.textContent=`Ask`,w.append(T,E),h.append(g,C,w),a.append(m),o.append(h);function D(e){y.textContent=e,i.setStatus(`RoamLookup: ${e}`)}function O(){return i.root.dataset.standalone===`true`}function k(){window.clearTimeout(u),c&&(u=window.setTimeout(()=>{if(l){k();return}j(`Idle timeout`)},d))}async function A(){if(O()||(k(),c))return;D(`Starting`);let e=await n(`/api/roamlookup/start`,{file:i.currentFile()});if(e.disabled)throw Error(e.message||`RoamLookup disabled`);c=e.sessionId||``,d=t(e.idleMs??d,d),D(e.status||`Ready`),k()}async function j(e=`Closed`){window.clearTimeout(u),u=0;let t=c;c=``,l=!1,t&&await n(`/api/roamlookup/close`,{sessionId:t}).catch(()=>({})),D(e)}function M(){O()||(s?.hidden&&window.dispatchEvent(new CustomEvent(`aaronnote:command`,{detail:{command:`open-filesystem`}})),document.querySelectorAll(`[data-notes-tab]`).forEach(e=>{e.classList.toggle(`is-active`,e===m)}),document.querySelectorAll(`[data-notes-panel]`).forEach(e=>{e.hidden=e!==h}),A().then(()=>T.focus()).catch(e=>{r(C,`system`,e instanceof Error?e.message:`RoamLookup failed`),D(`Failed`)}))}async function N(){if(O())return;let e=T.value.trim();if(!e||l)return;await A(),k(),r(C,`user`,e),T.value=``,l=!0,E.disabled=!0;let t=r(C,`system`,`Running`);D(`Running`);try{let i=await n(`/api/roamlookup/query`,{sessionId:c,query:e});t.remove(),i.sessionId&&(c=i.sessionId),r(C,`assistant`,i.answer||i.message||`No answer`),D(i.status||`Ready`)}catch(e){t.remove(),r(C,`system`,e instanceof Error?e.message:`RoamLookup failed`),D(`Failed`)}finally{l=!1,E.disabled=!1,k(),T.focus()}}let P=e=>{e.preventDefault(),M()};m.addEventListener(`click`,P),f.push(()=>m.removeEventListener(`click`,P));let F=e=>{e.currentTarget!==m&&(h.hidden=!0,m.classList.remove(`is-active`))};return document.querySelectorAll(`[data-notes-tab]`).forEach(e=>{e!==m&&(e.addEventListener(`click`,F),f.push(()=>e.removeEventListener(`click`,F)))}),document.querySelectorAll(`[data-action='notes'], [data-action='agenda']`).forEach(e=>{e.addEventListener(`click`,F),f.push(()=>e.removeEventListener(`click`,F))}),x.addEventListener(`click`,()=>{A().catch(e=>{r(C,`system`,e instanceof Error?e.message:`RoamLookup failed`),D(`Failed`)})}),S.addEventListener(`click`,()=>void j(`Closed`)),w.addEventListener(`submit`,e=>{e.preventDefault(),N()}),T.addEventListener(`input`,k),T.addEventListener(`keydown`,e=>{k(),e.key===`Enter`&&(e.metaKey||e.ctrlKey)&&(e.preventDefault(),N())}),f.push(i.onSettingsChange(n=>{d=t(n.idleMs,e),k()})),f.push(i.onAction(e=>{e===`open`&&M(),e===`close`&&j(`Closed`)})),()=>{j(`Closed`),f.splice(0).forEach(e=>e()),m.remove(),h.remove(),p.remove()}}export{i as setup};
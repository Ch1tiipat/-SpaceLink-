(() => {
  const content = () => document.getElementById('content');
  const toast = (message, tone = '') => {
    const old = document.querySelector('.toast'); if (old) old.remove();
    const el = document.createElement('div'); el.className = `toast ${tone}`; el.textContent = message;
    document.body.append(el); setTimeout(() => el.remove(), 2500);
  };
  const icon = (name) => `<i data-lucide="${name}"></i>`;
  const btn = (label, kind = '') => `<button class="btn ${kind}">${label}</button>`;

  function authScreen() {
    if (document.getElementById('auth-screen')) return;
    const screen = document.createElement('div');
    screen.id = 'auth-screen';
    screen.innerHTML = `<div class="login-card"><div class="login-mark">${icon('rocket')}</div><h1>SpaceLink</h1><p>Admin Console · Sign in to manage bookings and operational data.</p><form id="login-form"><label>ADMIN EMAIL</label><input required type="email" value="admin@spacelink.local" /><label>PASSWORD</label><input required type="password" value="spacelink" /><button class="btn primary" type="submit">${icon('log-in')} Sign in to Console</button></form><small>Demo access is prefilled for this prototype.</small></div>`;
    document.body.append(screen); lucide.createIcons();
    screen.querySelector('form').addEventListener('submit', e => { e.preventDefault(); sessionStorage.setItem('spacelink-admin', '1'); screen.remove(); toast('Welcome back, SpaceLink Admin', 'success'); });
  }
  function protect() { if (!sessionStorage.getItem('spacelink-admin')) authScreen(); }

  function receipt() {
    content().innerHTML = `<div class="page-head"><div><h1>Payment Receipt</h1><p>Booking #BK-84145 · verified SpaceLink payment record.</p></div><div class="actions"><button class="btn" id="back-payments">${icon('arrow-left')} Back to Payments</button><button class="btn primary" id="print-receipt">${icon('printer')} Print Receipt</button></div></div><div class="receipt-wrap"><section class="card receipt"><div class="receipt-head"><div><span class="brand-icon">${icon('rocket')}</span><h2>SpaceLink</h2><small>OFFICIAL PAYMENT RECEIPT</small></div><div><b>RECEIPT #SL-2026-84145</b><p>Issued 17 October 2026</p></div></div><div class="receipt-grid"><div><label>BILLED TO</label><b>Lisa Manoban</b><span>Customer ID: CID-2048</span><span>lisa@example.com</span></div><div><label>BOOKING DETAILS</label><b>Zone Alpha · A-12</b><span>17 Oct 2026 · Day Pass</span><span>Booking ID: BK-84145</span></div></div><table class="data"><thead><tr><th>Description</th><th>Quantity</th><th>Amount</th></tr></thead><tbody><tr><td>Zone Alpha A-12 — Standard Day Pass</td><td>1 day</td><td>฿300.00</td></tr><tr><td>Service and payment processing</td><td>1</td><td>฿0.00</td></tr></tbody></table><div class="receipt-total"><span>Payment method: Bank transfer (verified)</span><strong>Total paid&nbsp; ฿300.00</strong></div><div class="receipt-stamp">PAID · VERIFIED</div></section><aside class="card receipt-side"><h3>${icon('circle-check')} Payment verified</h3><p>The uploaded payment slip matches the booking amount. This receipt is available for your records.</p><button class="btn" id="download-receipt">${icon('download')} Download PDF</button></aside></div>`;
    lucide.createIcons();
    document.getElementById('back-payments').onclick = () => render('payments');
    document.getElementById('print-receipt').onclick = () => window.print();
    document.getElementById('download-receipt').onclick = () => toast('Receipt download prepared', 'success');
  }

  const mapSrc = 'file:///C:/Users/User/Pictures/1_Floor_M10_2b29d8d4e4.png';
  function enhanceZones() {
    const map = document.querySelector('.zone-map');
    if (map && !map.dataset.enhanced) { map.dataset.enhanced = '1'; map.classList.add('floor-map'); map.innerHTML = `<div class="map-toolbar"><button class="map-zoom" data-zoom="out" aria-label="Zoom out">${icon('minus')}</button><span id="map-zoom-label">100%</span><button class="map-zoom" data-zoom="in" aria-label="Zoom in">${icon('plus')}</button><button class="map-zoom" data-zoom="reset" aria-label="Reset zoom">${icon('maximize')}</button></div><div class="map-viewport"><img src="${mapSrc}" alt="Floor plan of the booking area" /></div>`; let zoom=1; const img=map.querySelector('img'); map.querySelectorAll('.map-zoom').forEach(btn=>btn.addEventListener('click',()=>{const action=btn.dataset.zoom;zoom=action==='in'?Math.min(2.25,zoom+.25):action==='out'?Math.max(.75,zoom-.25):1;img.style.transform=`scale(${zoom})`;map.querySelector('#map-zoom-label').textContent=`${Math.round(zoom*100)}%`;})); }
    const calendar = document.querySelector('.calendar');
    if (calendar && !calendar.dataset.enhanced) {
      calendar.dataset.enhanced = '1'; const title = calendar.querySelector('.subhead');
      if (title) title.innerHTML = `<h2>${icon('calendar-days')} Booking calendar</h2><span class="calendar-selects"><select id="cal-month">${['January','February','March','April','May','June','July','August','September','October','November','December'].map((x,i)=>`<option value="${i}" ${i===9?'selected':''}>${x}</option>`).join('')}</select><select id="cal-year"><option>2026</option><option>2027</option><option>2028</option></select></span>`;
      calendar.querySelectorAll('td').forEach(td => { if (td.textContent.trim()) td.classList.add('date-choice'); });
      calendar.addEventListener('click', e => { const day=e.target.closest('.date-choice'); if(day){calendar.querySelectorAll('.date-choice').forEach(x=>x.classList.remove('active'));day.classList.add('active');toast(`Selected ${document.getElementById('cal-month').selectedOptions[0].text} ${day.textContent}, ${document.getElementById('cal-year').value}`,'success');} });
    }
  }
  function enhanceDashboard() {
    const slots = document.querySelector('.slots'); if (!slots || slots.dataset.enhanced) return;
    slots.dataset.enhanced = '1'; const ids=['A101','A102','A103','A104','A105','A106','A107','A108','A109','A110','B101','B102','B103','B104','B105','D101','D102','D103','D104','D105','E101','E102','E103','E104','E105'];
    slots.innerHTML = ids.map((id,i)=>`<div class="slot ${i%4===0?'busy':''}">#${id}<br>${icon(i%4===0?'lock':'check')}</div>`).join(''); lucide.createIcons();
  }
  function enhanceLedger() {
    const title = [...document.querySelectorAll('.card-title')].find(x=>x.textContent.includes('Vendor Risk Ledger')); if (!title || title.closest('.card').dataset.ledger) return;
    const card = title.closest('.card'); card.dataset.ledger='1'; card.innerHTML = `<div class="subhead"><h2>${icon('table-properties')} Vendor Risk Ledger</h2><span>${icon('sliders-horizontal')} &nbsp;${icon('refresh-cw')}</span></div><div class="table-wrap"><table class="data"><thead><tr><th>Vendor Details</th><th>Points</th><th>Last Infraction</th><th>Status</th><th>Actions</th></tr></thead><tbody><tr><td><div class="person"><span class="mini-avatar">ZA</span>Zenith Arena Co.<small>ID: #SP-89211</small></div></td><td><b style="color:#d5202c">42</b> / 50</td><td>No-show<br><small>Oct 12, 2026</small></td><td><span class="badge yellow">CRITICAL</span></td><td>—</td></tr><tr><td><div class="person"><span class="mini-avatar">NS</span>Neon Sports Hub<small>ID: #SP-44321</small></div></td><td><b>12</b> / 50</td><td>Late cancellation<br><small>Nov 02, 2026</small></td><td><span class="badge gray">HEALTHY</span></td><td>—</td></tr><tr><td><div class="person"><span class="mini-avatar">GP</span>Global Pro Courts<small>ID: #SP-00122</small></div></td><td><b style="color:#d5202c">55</b> / 50</td><td>Fraudulent booking<br><small>Nov 05, 2026</small></td><td><span class="badge red">BLACKLISTED</span></td><td><button class="btn whitelist">Whitelist</button></td></tr></tbody></table></div><div class="pagination"><span>Showing 1 to 3 of 1,244 vendors</span><span>${btn('Previous')} ${btn('1','primary')} ${btn('2')} ${btn('Next')}</span></div>`; lucide.createIcons();
  }
  function filterCycle(el) { const options = el.textContent.includes('Zone') ? ['All Zones','Zone Alpha','Zone Bravo','Zone Charlie'] : el.textContent.includes('Status') ? ['All Status','Pending','Verified','Rejected'] : el.textContent.includes('priority') ? ['All priorities','Critical','High','Normal'] : ['All categories','Tent / canopy','Booth equipment','Ground safety']; const current=el.dataset.filterIndex||0; const next=(+current+1)%options.length;el.dataset.filterIndex=next;el.textContent=options[next]+' ⌄';toast(`Filter set to ${options[next]}`); }
  function controlOptions(label) { const key=label.toLowerCase(); if(key.includes('zone'))return ['All Zones','Zone Alpha','Zone Bravo','Zone Charlie','Zone Delta'];if(key.includes('status'))return ['All Status','Pending','Approved','Verified','Rejected','In progress'];if(key.includes('priority'))return ['All priorities','Critical','High','Normal'];if(key.includes('categor'))return ['All categories','Tent / canopy','Booth equipment','Ground safety','Booking assistance'];if(key.includes('rating'))return ['All ratings','5 stars','4 stars','3 stars','2 stars','1 star'];return [label.replace('⌄','').trim(),'Newest first','Oldest first']; }
  function enhanceFilters() { document.querySelectorAll('.filterbar').forEach(bar=>{if(bar.dataset.enhanced)return;bar.dataset.enhanced='1';[...bar.querySelectorAll('.inputish')].forEach(item=>{const label=item.textContent.trim();let markup='';if(/search|booking id|customer/i.test(label))markup=`<input class="filter-field filter-search" type="search" aria-label="Search" placeholder="${label}" />`;else if(/date|oct|range/i.test(label))markup=`<span class="date-range"><input class="filter-field" type="date" aria-label="Start date" /><span>to</span><input class="filter-field" type="date" aria-label="End date" /></span>`;else markup=`<select class="filter-field filter-select" aria-label="${label}">${controlOptions(label).map((x,i)=>`<option ${i===0?'selected':''}>${x}</option>`).join('')}</select>`;const wrap=document.createElement('span');wrap.className='filter-control';wrap.innerHTML=markup;item.replaceWith(wrap);});const apply=[...bar.querySelectorAll('button')].find(x=>/filter/i.test(x.textContent));if(apply&&!apply.dataset.apply){apply.dataset.apply='1';apply.addEventListener('click',()=>toast('Filters applied to the current list','success'));}}); }
  function observe() { enhanceDashboard(); enhanceZones(); enhanceLedger(); enhanceFilters(); }
  new MutationObserver(observe).observe(content(), {childList:true,subtree:true});
  document.addEventListener('click', e => { const text=e.target.closest('a,button')?.textContent.trim(); if(text==='History'){e.preventDefault();receipt()} if(e.target.closest('.whitelist')){e.target.closest('tr').querySelector('.badge').className='badge green';e.target.closest('tr').querySelector('.badge').textContent='WHITELISTED';e.target.closest('.whitelist').remove();toast('Vendor whitelist request approved','success')} if(e.target.closest('.inputish')) filterCycle(e.target.closest('.inputish')); if(e.target.closest('.nav-link')?.textContent.includes('Log out')) { sessionStorage.removeItem('spacelink-admin'); if(window.SpaceLinkStore)SpaceLinkStore.clearSession(); location.href='../index.html'; } });
  protect(); observe();
})();

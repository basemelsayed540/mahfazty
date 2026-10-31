/* محفظتي - واجهة التطبيق */
(function () {
  'use strict';
  const A = window.Assistant;
  const KEY = 'mahfazty_v1';
  const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const KIND_COLOR = { cash: '#0B6E6E', wallet: '#B84A0B', insta: '#4A3AA8', bank: '#2F6FB5' };
  const KIND_LIST = [{ id: 'cash', name: 'نقدي' }, { id: 'wallet', name: 'محفظة' }, { id: 'insta', name: 'انستا باي' }, { id: 'bank', name: 'بنك / كارت' }];
  const DEF_ACCS = [{ id: 'cash', name: 'نقدي', kind: 'cash', color: KIND_COLOR.cash, opening: 0 }, { id: 'wallet', name: 'محفظة', kind: 'wallet', color: KIND_COLOR.wallet, opening: 0 }, { id: 'insta', name: 'انستا باي', kind: 'insta', color: KIND_COLOR.insta, opening: 0 }];
  const DAY = 864e5;

  /* ---------- التخزين ---------- */
  function defaults() {
    return { v: 1, recurring: [], recNid: 0, noRecur: {}, accounts: DEF_ACCS.map((a) => Object.assign({}, a, { words: [] })), txs: [], learned: {}, budgets: {},
      settings: { askRecur: 'always', recurTime: '09:00', remind: true, remindMode: 'interval', everyH: 2, startT: '09:00', endT: '22:00', times: ['09:00', '13:00', '18:00', '21:00'], remindText: 'صرفت حاجة في آخر ساعتين؟ سجّلها دلوقتي', lastAcc: 'cash', onboarded: false, lastReminder: 0, lastBanner: 0, aiOn: false, aiKey: '', aiModel: 'claude-haiku-5-5', theme: 'auto', seenVersion: '' },
      catConfig: { custom: [], rename: {}, color: {}, hidden: [], extra: {}, removed: {}, subs: {} } };
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const d = JSON.parse(raw); const b = defaults(); return Object.assign(b, d, { settings: Object.assign(b.settings, d.settings || {}) }); }
    } catch (e) { /* التخزين غير متاح */ }
    return defaults();
  }
  let S = load();
  const normCfg = () => { S.catConfig = Object.assign({ custom: [], rename: {}, color: {}, hidden: [], extra: {}, removed: {}, subs: {} }, S.catConfig || {}); if (!S.catConfig.subs) S.catConfig.subs = {}; };
  normCfg();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
  const engine = A.create(S.learned);
  engine.setConfig(S.catConfig);
  function applyCat(fn) { fn(S.catConfig); engine.setConfig(S.catConfig); save(); }
  function migrate() {
    if (!Array.isArray(S.accounts) || !S.accounts.length) S.accounts = DEF_ACCS.map((a) => Object.assign({}, a, { words: [] }));
    if (S.opening) { S.accounts.forEach((a) => { if (S.opening[a.id] != null) a.opening = +S.opening[a.id] || 0; }); delete S.opening; }
    S.accounts.forEach((a) => { a.words = a.words || []; a.opening = +a.opening || 0; a.kind = a.kind || 'cash'; a.color = a.color || KIND_COLOR[a.kind] || KIND_COLOR.cash; });
    engine.setAccounts(S.accounts);
    save();
  }
  migrate();
  const accIds = () => S.accounts.map((a) => a.id);
  const acctOf = (id) => S.accounts.find((a) => a.id === id);
  const accName = (id) => { const a = acctOf(id); return a ? a.name : 'حساب محذوف'; };
  const accOpening = (id) => { const a = acctOf(id); return a ? a.opening : 0; };
  const validAcc = (id) => (acctOf(id) ? id : S.accounts[0].id);
  const nameTaken = (name, except) => S.accounts.some((a) => a.id !== except && a.name.trim().toLowerCase() === String(name).trim().toLowerCase());
  function applyAcct(fn) { fn(); engine.setAccounts(S.accounts); save(); }

  const APP_VERSION = '1.13.0';
  const ui = { changelog: null, update: '', tab: 'home', vm: { y: new Date().getFullYear(), m: new Date().getMonth() }, vy: new Date().getFullYear(), draft: null, sheet: null, chat: [], text: '', q: '', toast: '', banner: false, busy: false };

  /* ---------- أدوات ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const catOf = (id) => engine.catOf(id);
  const chip = (id) => { const c = catOf(id); return `<span class="catchip" style="background:${c.color}">${esc(c.name)}</span>`; };
  function timeStr(ts) { const d = new Date(ts); let h = d.getHours(); const m = String(d.getMinutes()).padStart(2, '0'); const ap = h >= 12 ? 'م' : 'ص'; h = h % 12 || 12; return `${h}:${m} ${ap}`; }
  const startOfDay = (ts) => { const d = new Date(ts); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
  function dayLabel(ts) {
    const diff = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / DAY);
    if (diff === 0) return 'النهارده'; if (diff === 1) return 'امبارح'; const d = new Date(ts); return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  }
  function toast(msg, ms) { ui.toast = msg; render(); clearTimeout(toast._t); toast._t = setTimeout(() => { ui.toast = ''; const el = document.querySelector('.toast'); if (el) el.remove(); else render(); }, ms || 3200); }

  function balances() {
    const b = {}; S.accounts.forEach((a) => { b[a.id] = a.opening || 0; });
    S.txs.forEach((t) => {
      if (t.type === 'in') b[t.acc] = (b[t.acc] || 0) + t.amount; else if (t.type === 'out') b[t.acc] = (b[t.acc] || 0) - t.amount;
      else if (t.type === 'xfer') { b[t.acc] = (b[t.acc] || 0) - t.amount; b[t.to] = (b[t.to] || 0) + t.amount; }
    });
    return b;
  }
  const inMonth = (y, m) => S.txs.filter((t) => { const d = new Date(t.ts); return d.getFullYear() === y && d.getMonth() === m; });
  const sumBy = (arr, type) => arr.filter((t) => t.type === type).reduce((a, t) => a + t.amount, 0);
  function byCat(arr) { const o = {}; arr.filter((t) => t.type === 'out').forEach((t) => { o[t.cat] = (o[t.cat] || 0) + t.amount; }); return o; }

  /* ---------- شاشات ---------- */
  function bannerHtml() {
    if (!ui.banner) return '';
    return `<div class="notif" role="alert"><div class="row"><div class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/><path d="M3 7l12-3v3"/><circle cx="16.5" cy="13.5" r="1"/></svg></div>
      <div class="grow"><div class="small">محفظتي · الآن</div><div class="h" style="font-size:15px">صرفت حاجة في آخر ساعتين؟</div></div></div>
      <div class="row"><button class="btn primary grow" data-act="banner-open">فتح وتسجيل</button><button class="btn ghost grow" data-act="banner-skip">تخطي</button></div></div>`;
  }

  function updNoteHtml() {
    if (!S.settings.onboarded || S.settings.seenVersion === APP_VERSION) return '';
    const cl = ui.changelog && ui.changelog.versions ? ui.changelog.versions.find((v) => v.v === APP_VERSION) : null;
    return `<div class="card updnote" role="status"><div class="h">اتحدّث التطبيق للنسخة ${esc(APP_VERSION)}</div><div class="small" style="margin:4px 0 8px">${cl ? esc(cl.title) : 'في مميزات جديدة'}</div><div class="row"><button class="btn primary grow" data-act="whatsnew">شوف الجديد</button><button class="btn ghost grow" data-act="upd-dismiss">تمام</button></div></div>`;
  }

  function homeHtml() {
    const b = balances(); const total = S.accounts.reduce((x, a) => x + (b[a.id] || 0), 0);
    const nowD = new Date(); const marr = inMonth(nowD.getFullYear(), nowD.getMonth()); const minc = sumBy(marr, 'in'); const mout = sumBy(marr, 'out');
    return `<div class="screen">${bannerHtml()}${updNoteHtml()}${recurDueHtml()}
      <div class="total"><button class="reload" data-act="refresh-app" aria-label="تحديث التطبيق" title="تحديث التطبيق"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg></button><div class="tmid"><span class="small" style="font-size:14px">إجمالي رصيدك</span><b>${fmt(total)}</b></div><button class="reload" data-act="theme-toggle" aria-label="تبديل الوضع الداكن والعادي" title="الوضع الداكن / العادي"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg></button></div>
      <div class="tiles2"><div class="tile" style="background:var(--tealf)"><small>دخل ${MONTHS[nowD.getMonth()]}</small><b>+${fmt(minc)}</b></div><div class="tile" style="background:var(--redf)"><small>مصروف ${MONTHS[nowD.getMonth()]}</small><b>-${fmt(mout)}</b></div></div>
      <div class="accs3">${S.accounts.map((a) => `<button class="acard" style="background:${a.color}" data-act="acc" data-id="${a.id}" aria-label="${esc(a.name)} ${fmt(b[a.id] || 0)}"><span>${esc(a.name)}</span><b>${fmt(b[a.id] || 0)}</b></button>`).join('')}</div>
      <button class="btn primary big" data-act="add-tx" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>إدخال مصروف أو دخل</button>
      <div style="display:flex;flex-direction:column;gap:6px"><div class="h" style="padding:0 4px">آخر العمليات</div>
        ${historyBodyHtml()}
      </div></div>`;
  }

  function historyHtml() {
    return `<div class="screen"><div class="h" style="font-size:20px;padding:4px">السجل</div>${historyBodyHtml()}</div>`;
  }

  function historyBodyHtml() {
    const f = ui.hf || 'all'; const q = norm1(ui.hq);
    let arr = S.txs.slice().sort((a, b2) => b2.ts - a.ts);
    const hp = ui.hp || 'all'; const sod = startOfDay(Date.now()); const nowM = new Date(); const som = new Date(nowM.getFullYear(), nowM.getMonth(), 1).getTime();
    if (hp === 'today') arr = arr.filter((t) => t.ts >= sod); else if (hp === 'yest') arr = arr.filter((t) => t.ts >= sod - DAY && t.ts < sod); else if (hp === 'week') arr = arr.filter((t) => t.ts >= sod - 6 * DAY); else if (hp === 'month') arr = arr.filter((t) => t.ts >= som);
    if (f !== 'all') arr = arr.filter((t) => t.type === f);
    if (ui.ha) arr = arr.filter((t) => t.acc === ui.ha || t.to === ui.ha);
    if (q) arr = arr.filter((t) => norm1((t.label || '') + ' ' + catOf(t.cat).name + ' ' + engine.subName(t.cat, t.sub)).indexOf(q) >= 0 || String(t.amount) === q);
    const inc = sumBy(arr, 'in'); const out = sumBy(arr, 'out');
    let html = ''; let last = '';
    arr.slice(0, 300).forEach((t) => { const k = ymd(t.ts); if (k !== last) { last = k; html += `<div class="small" style="padding:6px 4px 0">${esc(dayLabel(t.ts))}</div>`; } html += txRow(t); });
    const seg = (id, n) => `<button class="${f === id ? 'on' : ''}" data-act="hf" data-v="${id}">${n}</button>`;
    const accSeg = `<div class="pick" role="group" aria-label="الحساب">${pickHtml([{ id: '', name: 'كل الحسابات' }].concat(accList()), ui.ha || '', 'data-act="ha"')}</div>`;
    return `<input id="hq" aria-label="بحث" placeholder="ابحث بالوصف أو التصنيف أو المبلغ" value="${esc(ui.hq || '')}" style="border:1px solid var(--line);border-radius:12px;background:var(--card);min-height:44px;padding:0 12px;font-size:15px;width:100%">
      <div class="seg" role="group" aria-label="الفترة">${[['today', 'اليوم'], ['yest', 'أمس'], ['week', 'أسبوع'], ['month', 'شهر'], ['all', 'الكل']].map((x) => `<button class="${hp === x[0] ? 'on' : ''}" data-act="hp" data-v="${x[0]}">${x[1]}</button>`).join('')}</div>
      <div class="seg" role="group" aria-label="النوع">${seg('all', 'الكل')}${seg('out', 'مصروف')}${seg('in', 'دخل')}${seg('xfer', 'تحويل')}</div>${accSeg}
      <div class="card row between"><span class="small">${arr.length} عملية</span><span class="small">دخل <b class="pos">${fmt(inc)}</b> · مصروف <b class="neg">${fmt(out)}</b></span></div>
      ${html || '<div class="card small">' + (S.txs.length ? 'مفيش عمليات مطابقة.' : 'لسه مفيش عمليات. اضغط "إدخال" فوق وسجّل أول عملية.') + '</div>'}`;
  }

  function entryModeSeg(mode) {
    return `<div class="seg" role="group" aria-label="طريقة الإدخال"><button class="${mode === 'smart' ? 'on' : ''}" data-act="entry-mode" data-v="smart">كتابة بكلامك</button><button class="${mode === 'manual' ? 'on' : ''}" data-act="entry-mode" data-v="manual">يدوي</button></div>`;
  }
  function entryHtml() {
    return `<div class="h" style="font-size:18px">إدخال مصروف أو دخل</div>${entryModeSeg('smart')}
      <div class="composer"><label class="small" for="inp">اكتب المبلغ والوصف، وأنا أصنّف تلقائي</label>
        <textarea id="inp" data-keepfocus="1" rows="2" placeholder="اكتب مصروفك أو دخلك هنا">${esc(ui.text)}</textarea>
        <div class="row between"><span class="small">ممكن أكتر من بند في نفس الكتابة.</span><button class="btn primary" data-act="parse" style="flex-shrink:0">سجّل</button></div></div>
      ${draftHtml()}<button class="btn ghost" data-act="close">إغلاق</button>`;
  }
  function openManual() {
    const n = Date.now();
    ui.sheet = { type: 'tx', isNew: true, id: null, catManual: false, subManual: false, hint: '', tx: { type: 'out', amount: '', label: '', cat: 'other', sub: '', acc: validAcc(S.settings.lastAcc), to: '' }, date: ymd(n), time: hhmm(n), confirm: false };
  }
  function autoCat(sh) {
    if (!sh || sh.tx.type === 'xfer') return;
    const lab = (sh.tx.label || '').trim(); if (!lab) { sh.hint = ''; return; }
    let conf = 'high';
    if (!sh.catManual) { const sc = engine.scoreLabel(lab); const pk = engine.pick(sc.score, null, sh.tx.type); sh.tx.cat = pk.cat; conf = pk.conf; }
    let subTxt = '';
    if (!sh.subManual) {
      const sm = engine.matchSub(lab, sh.tx.cat, sh.tx.type, !sh.catManual && conf === 'low');
      if (sm) { if (sm.cat !== sh.tx.cat && !sh.catManual) { sh.tx.cat = sm.cat; conf = 'mid'; } sh.tx.sub = sm.sub; } else sh.tx.sub = '';
    }
    if (sh.tx.sub) subTxt = ' · ' + engine.subName(sh.tx.cat, sh.tx.sub);
    if (!sh.catManual) sh.hint = conf === 'low' ? 'مش متأكد من التصنيف، اختار الصح وهتعلّم منه.' : 'اتصنّف تلقائي' + subTxt + '، وتقدر تغيّره.';
    const sel = document.getElementById('te_cat'); if (sel) { sel.innerHTML = catPick(sh.tx.type, sh.tx.cat, 'data-act="te-pick" data-k="cat"'); }
    const sw = document.getElementById('te_subwrap'); if (sw) sw.innerHTML = subRowHtml(sh);
    const h = document.getElementById('te_hint'); if (h) { h.textContent = sh.hint; h.className = conf === 'low' ? 'warn' : 'ok'; }
  }

  function txRow(t) {
    const arrow = (k) => `<span class="arr ${k}" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">${k === 'in' ? '<path d="M12 5v14M6 13l6 6 6-6"/>' : k === 'out' ? '<path d="M12 19V5M6 11l6-6 6 6"/>' : '<path d="M5 9h14M15 5l4 4-4 4M19 15H5M9 11l-4 4 4 4"/>'}</svg></span>`;
    if (t.type === 'xfer') return `<button class="tx" data-act="tx" data-id="${t.id}"><div class="row" style="gap:10px">${arrow('x')}<div><div class="t1">تحويل</div><div class="t2">${accName(t.acc)} ← ${accName(t.to)} · ${dayLabel(t.ts)} ${timeStr(t.ts)}</div></div></div><div style="font-weight:800">${fmt(t.amount)}</div></button>`;
    return `<button class="tx" data-act="tx" data-id="${t.id}"><div class="row" style="gap:10px">${arrow(t.type === 'in' ? 'in' : 'out')}<div><div class="t1">${esc(t.label || catOf(t.cat).name)}</div><div class="t2">${chip(t.cat)}${subChipHtml(t)}<span>${accName(t.acc)} · ${dayLabel(t.ts)} ${timeStr(t.ts)}</span></div></div></div><div class="${t.type === 'in' ? 'pos' : 'neg'}">${t.type === 'in' ? '+' : '-'}${fmt(t.amount)}</div></button>`;
  }

  /* أزرار اختيار بدل القوائم المنسدلة */
  function pickHtml(items, sel, attrs) {
    return items.map((c) => `<button type="button" class="pk${c.id === sel ? ' on' : ''}" ${attrs} data-v="${c.id}">${c.color ? `<i style="background:${c.color}"></i>` : ''}${esc(c.name)}</button>`).join('');
  }
  const catList = (type, sel) => { const l = (type === 'in' ? engine.catsIn() : engine.catsOut()).slice(); if (sel && !l.some((c) => c.id === sel)) l.push(engine.catOf(sel)); return l; };
  const accList = () => accIds().map((a) => ({ id: a, name: accName(a) }));
  const catPick = (type, sel, attrs) => pickHtml(catList(type, sel), sel, attrs);
  const accPick = (sel, attrs) => pickHtml(accList(), sel, attrs);

  function catOptions(type, sel) {
    const list = (type === 'in' ? engine.catsIn() : engine.catsOut()).slice();
    if (sel && !list.some((c) => c.id === sel)) list.push(engine.catOf(sel));
    return list.map((c) => `<option value="${c.id}"${c.id === sel ? ' selected' : ''}>${esc(c.name)}</option>`).join('');
  }
  function accOptions(sel) { return accIds().map((a) => `<option value="${a}"${a === sel ? ' selected' : ''}>${accName(a)}</option>`).join(''); }

  function draftHtml() {
    const d = ui.draft; if (!d) return '';
    if (d.kind === 'transfer') {
      return `<div class="card draft"><div class="h">تحويل بين حساباتك</div><div style="font-size:15px;font-weight:700">${fmt(d.amount)} من ${accName(d.from)} إلى ${accName(d.to)}</div>
        <div class="row"><button class="btn primary grow" data-act="save-draft">تأكيد التحويل</button><button class="btn ghost grow" data-act="cancel-draft">إلغاء</button></div></div>`;
    }
    const aiNote = d.ai === 'pending' ? '<div class="ok">بسأل Claude عشان أتأكد…</div>' : d.ai === 'done' ? '<div class="ok">Claude ساعدني في الفهم</div>' : d.ai === 'error' ? '<div class="warn">ما قدرتش أوصل لـClaude، اتصنّف محلياً.</div>' : '';
    const items = d.items.map((it, i) => {
      const unsure = it.conf === 'low';
      const msg = unsure ? `<div class="warn">مش متأكد من التصنيف. اختار الصح وهتعلّم منه.</div>`
        : (it.usedContext ? `<div class="ok">فهمتها من سياق كلامك</div>` : '');
      return `<div class="ditem" data-i="${i}">
        <div class="row"><input data-f="amount" inputmode="decimal" aria-label="المبلغ" value="${esc(it.amount)}" style="max-width:110px"><input data-f="label" aria-label="الوصف" value="${esc(it.label)}" placeholder="الوصف"><button class="xbtn" data-act="del-item" data-i="${i}" aria-label="حذف البند">✕</button></div>
        <div class="small">التصنيف</div><div class="pick">${catPick(it.type, it.cat, `data-act="di-pick" data-i="${i}" data-k="cat"`)}</div>${subPickHtml(it, i)}<div class="small">الحساب</div><div class="pick">${accPick(it.acc, `data-act="di-pick" data-i="${i}" data-k="acc"`)}</div>
        <div class="seg" role="group" aria-label="النوع"><button class="${it.type === 'out' ? 'on' : ''}" data-act="type" data-i="${i}" data-v="out">مصروف</button><button class="${it.type === 'in' ? 'on' : ''}" data-act="type" data-i="${i}" data-v="in">دخل</button></div>
        ${msg}</div>`;
    }).join('');
    return `<div class="card draft"><div class="h">راجع قبل الحفظ</div>${aiNote}${items}
      <div class="row"><button class="btn primary grow" data-act="save-draft">حفظ ${d.items.length > 1 ? 'الكل' : ''}</button><button class="btn ghost grow" data-act="cancel-draft">إلغاء</button></div></div>`;
  }

  function monthHtml() {
    const { y, m } = ui.vm; const arr = inMonth(y, m);
    const inc = sumBy(arr, 'in'); const out = sumBy(arr, 'out'); const net = inc - out;
    const first = new Date(y, m, 1); const dim = new Date(y, m + 1, 0).getDate(); const offset = (first.getDay() + 1) % 7;
    const per = {}; const perIn = {}; arr.forEach((t) => { const d = new Date(t.ts).getDate(); if (t.type === 'out') per[d] = (per[d] || 0) + t.amount; else if (t.type === 'in') perIn[d] = (perIn[d] || 0) + t.amount; });
    const max = Math.max(1, ...Object.keys(per).map((k) => per[k]));
    const now = new Date(); const isCur = now.getFullYear() === y && now.getMonth() === m;
    let cells = ''; for (let i = 0; i < offset; i++) cells += '<div class="day z"></div>';
    for (let d = 1; d <= dim; d++) {
      const v = per[d] || 0; const fut = isCur && d > now.getDate();
      const vi = perIn[d] || 0; const lv = v / max > 0.66 ? 3 : v / max > 0.33 ? 2 : 1; const cls = fut && !v && !vi ? 'fut' : v && vi ? 'both' : v ? 'o' + lv : vi ? 'inc' : '';
      cells += `<button class="day ${cls}" data-act="day" data-d="${d}" aria-label="${d} ${MONTHS[m]} مصروف ${fmt(v)} دخل ${fmt(vi)}">${d}</button>`;
    }
    const cats = byCat(arr); const keys = Object.keys(cats).sort((a, b) => cats[b] - cats[a]);
    const bars = keys.length ? keys.map((k) => {
      const bud = S.budgets[k]; const pct = out ? cats[k] / out * 100 : 0; const over = bud && cats[k] > bud;
      const sm = {}; arr.filter((t) => t.type === 'out' && t.cat === k && t.sub).forEach((t) => { sm[t.sub] = (sm[t.sub] || 0) + t.amount; });
      const subLines = Object.keys(sm).length ? `<div class="small">${Object.keys(sm).map((id) => `${esc(engine.subName(k, id))} ${fmt(sm[id])}`).join(' · ')}</div>` : '';
      return `<div style="display:flex;flex-direction:column;gap:4px"><div class="row between" style="font-size:13px;font-weight:600"><span>${esc(catOf(k).name)}${bud ? ` <span class="small">(من ${fmt(bud)})</span>` : ''}</span><span class="${over ? 'neg' : ''}">${fmt(cats[k])}</span></div><div class="bar"><i style="width:${bud ? Math.min(100, cats[k] / bud * 100) : pct}%;background:${over ? 'var(--red)' : catOf(k).color}"></i></div>${subLines}</div>`;
    }).join('') : '<div class="small">مفيش مصروفات في الشهر ده.</div>';
    const accs = accIds().map((a) => `<div class="row between" style="font-size:14px"><span class="muted" style="font-weight:600">${accName(a)}</span><b>${fmt(arr.filter((t) => t.type === 'out' && t.acc === a).reduce((s, t) => s + t.amount, 0))}</b></div>`).join('');
    return `<div class="screen">
      <div class="nav"><button data-act="mprev" aria-label="الشهر السابق">›</button><div style="text-align:center"><div style="font-size:20px;font-weight:800">${MONTHS[m]} ${y}</div><div class="small">حساب الشهر</div></div><button data-act="mnext" aria-label="الشهر التالي">‹</button></div>
      <div class="tiles3"><div class="tile" style="background:var(--tealf)"><small>دخل</small><b>${fmt(inc)}</b></div><div class="tile" style="background:var(--redf)"><small>مصروف</small><b>${fmt(out)}</b></div><div class="tile" style="background:var(--purplef)"><small>الصافي</small><b>${net >= 0 ? '+' : '-'}${fmt(Math.abs(net))}</b></div></div>
      <div class="card" style="display:flex;flex-direction:column;gap:8px"><div class="row between"><span class="h">أيام الشهر</span><span class="small">الغامق = صرف أكتر</span></div><div class="legend"><span><i style="background:var(--redf)"></i>مصروف</span><span><i style="background:var(--tealf)"></i>دخل</span><span><i class="bothi"></i>الاتنين</span></div>
        <div class="dow"><span>سبت</span><span>أحد</span><span>اثنين</span><span>ثلاثاء</span><span>أربعاء</span><span>خميس</span><span>جمعة</span></div><div class="days">${cells}</div></div>
      <div class="card" style="display:flex;flex-direction:column;gap:10px"><div class="h">المصروف حسب التصنيف</div>${bars}</div>
      <div class="card" style="display:flex;flex-direction:column;gap:8px"><div class="h">المصروف حسب البطاقة</div>${accs}</div></div>`;
  }

  function yearHtml() {
    const y = ui.vy; const now = new Date(); let inc = 0; let out = 0; const nets = [];
    for (let m = 0; m < 12; m++) {
      const arr = inMonth(y, m); const i = sumBy(arr, 'in'); const o = sumBy(arr, 'out'); inc += i; out += o;
      nets.push({ m, has: arr.some((t) => t.type !== 'xfer'), net: i - o, o });
    }
    const act = nets.filter((n) => n.has); const best = act.length ? act.reduce((a, b) => (b.net > a.net ? b : a)) : null; const worst = act.length ? act.reduce((a, b) => (b.net < a.net ? b : a)) : null;
    const maxO = act.length ? act.reduce((a, b) => (b.o > a.o ? b : a)) : null;
    const tiles = nets.map((n) => `<button class="mt ${!n.has ? 'n' : (best && n.m === best.m && act.length > 1 ? 'g' : (worst && n.m === worst.m && act.length > 1 ? 'w' : ''))}" data-act="gomonth" data-m="${n.m}"><b>${MONTHS[n.m]}</b><span>${n.has ? (n.net >= 0 ? '+' : '-') + fmt(Math.abs(n.net)) : '-'}</span></button>`).join('');
    const yarr = S.txs.filter((t) => new Date(t.ts).getFullYear() === y);
    const accs = accIds().map((a) => `<div class="row between" style="font-size:14px"><span class="muted" style="font-weight:600">${accName(a)}</span><b>${fmt(yarr.filter((t) => t.type === 'out' && t.acc === a).reduce((s, t) => s + t.amount, 0))}</b></div>`).join('');
    const months = Math.max(1, y === now.getFullYear() ? now.getMonth() + 1 : (act.length || 1));
    const saving = inc ? Math.round((inc - out) / inc * 100) : 0;
    return `<div class="screen">
      <div class="nav"><button data-act="yprev" aria-label="السنة السابقة">›</button><div style="text-align:center"><div style="font-size:20px;font-weight:800">سنة ${y}</div><div class="small">حساب السنة</div></div><button data-act="ynext" aria-label="السنة التالية">‹</button></div>
      <div style="background:var(--purplef);color:#fff;border-radius:22px;padding:16px;display:flex;flex-direction:column;gap:4px"><div style="font-size:13px;font-weight:600">توفير السنة</div><div style="font-size:36px;font-weight:800;line-height:1.15">${inc - out >= 0 ? '+' : '-'}${fmt(Math.abs(inc - out))} <span style="font-size:16px;font-weight:600"></span></div><div class="row between" style="font-size:13px;font-weight:700;padding-top:6px"><span>دخل ${fmt(inc)}</span><span>مصروف ${fmt(out)}</span></div></div>
      <div class="card" style="display:flex;flex-direction:column;gap:10px"><div class="row between"><span class="h">صافي كل شهر</span><span class="small">أخضر = الأفضل · أحمر = الأقل</span></div><div class="mgrid">${tiles}</div></div>
      <div class="tiles2"><div class="stat"><small>متوسط المصروف شهرياً</small><b>${fmt(out / months)}</b></div><div class="stat"><small>نسبة التوفير</small><b style="color:var(--teal)">${saving}%</b></div>
        <div class="stat"><small>أكتر شهر صرفاً</small><b>${maxO ? MONTHS[maxO.m] : '-'}</b></div><div class="stat"><small>عدد العمليات</small><b>${yarr.filter((t) => t.type !== 'xfer').length}</b></div></div>
      <div class="card" style="display:flex;flex-direction:column;gap:8px"><div class="h">الصرف حسب البطاقة (السنة)</div>${accs}</div></div>`;
  }

  /* ---------- المساعد: ملاحظات ذكية ---------- */
  function insights() {
    const out = []; const now = new Date(); const cur = inMonth(now.getFullYear(), now.getMonth());
    const prev = inMonth(now.getFullYear(), now.getMonth() - 1 < 0 ? now.getFullYear() - 1 : now.getFullYear(), (now.getMonth() + 11) % 12);
    const today = S.txs.filter((t) => t.ts >= startOfDay(Date.now()) && t.type !== 'xfer');
    if (!S.txs.length) { out.push('ابدأ بتسجيل أول مصروف بكلامك العادي، وأنا هتعلّم أسلوبك مع الوقت.'); return out; }
    if (!today.length) out.push('لسه ما سجلتش حاجة النهارده.');
    const co = sumBy(cur, 'out'); const po = sumBy(prev.filter((t) => new Date(t.ts).getDate() <= now.getDate()), 'out');
    if (po > 0 && co > 0) { const p = Math.round((co - po) / po * 100); out.push(p > 10 ? `مصروفك الشهر ده أعلى ${p}% من نفس الفترة في الشهر اللي فات.` : p < -10 ? `برافو. مصروفك أقل ${Math.abs(p)}% من نفس الفترة الشهر اللي فات.` : 'مصروفك ماشي قريب من الشهر اللي فات.'); }
    const bc = byCat(cur); const top = Object.keys(bc).sort((a, b) => bc[b] - bc[a])[0];
    if (top && co) out.push(`أكتر حاجة بتصرف عليها الشهر ده: ${catOf(top).name} (${Math.round(bc[top] / co * 100)}% من مصروفك).`);
    Object.keys(S.budgets).forEach((k) => { const b = S.budgets[k]; if (b > 0 && bc[k]) { const r = bc[k] / b; if (r >= 1) out.push(`تجاوزت ميزانية ${catOf(k).name} (${fmt(bc[k])} من ${fmt(b)}).`); else if (r >= 0.8) out.push(`قربت تخلّص ميزانية ${catOf(k).name}: صرفت ${Math.round(r * 100)}%.`); } });
    const day = now.getDate(); const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    if (co > 0 && day >= 5) out.push(`بمعدلك الحالي هتوصل لحوالي ${fmt(Math.round(co / day * dim))} مصروف آخر الشهر.`);
    const others = S.txs.filter((t) => t.cat === 'other').length;
    if (others >= 3) out.push(`عندي ${others} عمليات في "أخرى". افتحها وصنّفها وأنا هتعلّم منها.`);
    const kn = Object.keys(S.learned).filter((k) => k[0] !== '#' && k.indexOf(' ') < 0).length;
    if (kn) out.push(`اتعلمت ${kn} كلمة من تصحيحاتك لحد دلوقتي.`);
    return out;
  }

  function assistantHtml() {
    const ins = insights().map((t) => `<div class="insight"><i></i><div>${esc(t)}</div></div>`).join('');
    const chat = ui.chat.slice(-6).map((c) => `<div class="bubble me">${esc(c.q)}</div><div class="bubble bot">${esc(c.a)}</div>`).join('');
    const lk = Object.keys(S.learned).filter((k) => k[0] !== '#' && k.indexOf(' ') < 0).map((k) => {
      const e = S.learned[k]; const best = Object.keys(e).sort((a, b) => e[b] - e[a])[0]; return { k, best, n: e[best] };
    }).sort((a, b) => b.n - a.n).slice(0, 25);
    const learned = lk.length ? lk.map((x) => `<div class="row between"><span><b>${esc(x.k)}</b> ← ${chip(x.best)}</span><button class="xbtn" data-act="forget" data-k="${esc(x.k)}" aria-label="نسيان ${esc(x.k)}">✕</button></div>`).join('') : '<div class="small">لسه مفيش. لما تصحّح تصنيف هسجله هنا.</div>';
    return `<div class="screen">${bannerHtml()}
      <div class="card" style="display:flex;flex-direction:column;gap:8px"><div class="h">المساعد بيقولك</div>${ins}</div>
      <div class="card" style="display:flex;flex-direction:column;gap:8px"><div class="h">اسأل المساعد</div>
        ${chat}<div class="field"><input id="qinp" aria-label="سؤالك" placeholder="كام صرفت على الأكل الشهر ده؟" value="${esc(ui.q)}"><button class="btn primary" data-act="ask">اسأل</button></div>
        <div class="chips"><button class="chip" data-act="exq" data-t="كام صرفت النهارده">كام صرفت النهارده</button><button class="chip" data-act="exq" data-t="اكتر حاجة صرفت عليها">أكتر حاجة صرفت عليها</button><button class="chip" data-act="exq" data-t="معايا كام">معايا كام</button></div></div>
      <div class="card" style="display:flex;flex-direction:column;gap:8px"><div class="h">اللي اتعلمته منك</div>${learned}</div>
    </div>`;
  }

  function settingsHtml() {
    const st = S.settings; const times = reminderTimes();
    const budgets = engine.catsOut().filter((c) => c.id !== 'other').map((c) => `<div class="field"><label style="min-width:110px;font-size:13px;font-weight:600" for="b_${c.id}">${esc(c.name)}</label><input id="b_${c.id}" data-bud="${c.id}" inputmode="numeric" placeholder="بدون حد" value="${S.budgets[c.id] || ''}"></div>`).join('');
    const everyOpts = [1, 2, 3, 4, 6, 8].map((h) => `<option value="${h}"${h === st.everyH ? ' selected' : ''}>كل ${h === 1 ? 'ساعة' : h === 2 ? 'ساعتين' : h + ' ساعات'}</option>`).join('');
    const custom = (st.times || []).slice().sort().map((t) => `<span class="chip" style="display:inline-flex;gap:6px;align-items:center;color:var(--ink)">${t}<button class="xbtn" style="min-width:24px;min-height:24px" data-act="del-time" data-t="${t}" aria-label="حذف ${t}">✕</button></span>`).join('');
    return `<div class="screen">${bannerHtml()}
      <div style="font-size:22px;font-weight:800;padding:8px 4px 0">الإعدادات</div>
      <div class="card" style="display:flex;flex-direction:column;gap:12px"><div class="h">التذكير</div>
        <label class="row" style="font-size:14px;font-weight:600"><input type="checkbox" id="remind" ${st.remind ? 'checked' : ''} style="width:22px;height:22px"> تفعيل التذكير</label>
        <div class="seg" role="group" aria-label="نوع التذكير"><button class="${st.remindMode === 'interval' ? 'on' : ''}" data-act="rmode" data-v="interval">كل فترة</button><button class="${st.remindMode === 'custom' ? 'on' : ''}" data-act="rmode" data-v="custom">ساعات محددة</button></div>
        ${st.remindMode === 'interval' ? `
          <div class="field"><label for="every" style="min-width:60px;font-size:13px;font-weight:600">التكرار</label><select id="every">${everyOpts}</select></div>
          <div class="field"><label for="st" style="min-width:70px;font-size:13px;font-weight:600">من الساعة</label><input type="time" id="st" value="${st.startT}"></div>
          <div class="field"><label for="et" style="min-width:70px;font-size:13px;font-weight:600">إلى الساعة</label><input type="time" id="et" value="${st.endT}"></div>`
        : `<div class="chips">${custom || '<span class="small">مفيش ساعات. أضف ساعة تحت.</span>'}</div>
          <div class="field"><label for="newt" style="min-width:60px;font-size:13px;font-weight:600">ساعة جديدة</label><input type="time" id="newt" value="12:00"><button class="btn primary" data-act="add-time">إضافة</button></div>`}
        <div class="small">هيتبعت إشعار الساعة: ${times.length ? times.join(' · ') : 'ولا ساعة'}</div>
        <div class="field"><label for="rtext" style="min-width:60px;font-size:13px;font-weight:600">نص التذكير</label><input id="rtext" value="${esc(st.remindText)}"></div>
        <div class="row"><button class="btn ghost grow" data-act="test-remind">جرّب التذكير</button><button class="btn primary grow" data-act="apply-remind">حفظ وتطبيق</button></div></div>
      <div class="card" style="display:flex;flex-direction:column;gap:10px"><div class="h">الذكاء الاصطناعي (Claude) - اختياري</div>
        <div class="small">لما المساعد المحلي مش متأكد من تصنيف أو ما يفهمش الجملة، بيسأل Claude. محتاج نت، والنص اللي بتكتبه بس هو اللي بيتبعت (من غير أرصدتك). تكلفته صغيرة جداً، وتقدر تحط حد صرف على المفتاح من حساب Anthropic.</div>
        <label class="row" style="font-size:14px;font-weight:600"><input type="checkbox" id="aion" ${st.aiOn ? 'checked' : ''} style="width:22px;height:22px"> استخدم Claude</label>
        <div class="field"><label for="aikey" style="min-width:60px;font-size:13px;font-weight:600">المفتاح</label><input id="aikey" type="password" dir="ltr" autocomplete="off" placeholder="sk-ant-..." value="${esc(st.aiKey)}"></div>
        <div class="field"><label for="aimodel" style="min-width:60px;font-size:13px;font-weight:600">النموذج</label><select id="aimodel"><option value="claude-haiku-5-5"${st.aiModel === 'claude-haiku-5-5' ? ' selected' : ''}>Haiku 5.5 (أسرع وأرخص)</option><option value="claude-sonnet-5-5"${st.aiModel === 'claude-sonnet-5-5' ? ' selected' : ''}>Sonnet 5.5 (أذكى)</option></select></div>
        <div class="row"><button class="btn ghost grow" data-act="ai-test">اختبار الاتصال</button></div>
        <div class="small">المفتاح بيتحفظ على موبايلك بس. استخدم مفتاح مخصص للتطبيق ده.</div></div>
      ${recurSettingsHtml()}
      <div class="card" style="display:flex;flex-direction:column;gap:10px"><div class="h">الحسابات</div>
        <div class="small">ضيف أكتر من محفظة أو انستا باي أو بنك، وعدّل أو احذف أي حساب.</div>
        <div class="chips">${S.accounts.map((a) => `<button class="chip" style="color:var(--ink);display:inline-flex;gap:6px;align-items:center" data-act="acc-edit" data-id="${a.id}"><span style="width:10px;height:10px;border-radius:50%;background:${a.color};display:inline-block"></span>${esc(a.name)}</button>`).join('')}</div>
        <button class="btn primary" data-act="acc-new">+ حساب جديد</button></div>
      <div class="card" style="display:flex;flex-direction:column;gap:10px"><div class="h">المظهر</div>
        <div class="seg" role="group" aria-label="المظهر"><button class="${(st.theme || 'auto') === 'auto' ? 'on' : ''}" data-act="theme" data-v="auto">تلقائي</button><button class="${st.theme === 'light' ? 'on' : ''}" data-act="theme" data-v="light">فاتح</button><button class="${st.theme === 'dark' ? 'on' : ''}" data-act="theme" data-v="dark">داكن</button></div>
        <div class="small">"تلقائي" يمشي مع وضع الموبايل.</div></div>
      <div class="card" style="display:flex;flex-direction:column;gap:10px"><div class="h">التصنيفات</div>
        <div class="small">اضغط على تصنيف لتغيير اسمه أو لونه أو الكلمات اللي بتتصنف تحته.</div>
        <div class="small" style="margin-top:2px">المصروفات</div><div class="chips">${engine.catsOut().map(catChipBtn).join('')}</div>
        <div class="small">الدخل</div><div class="chips">${engine.catsIn().map(catChipBtn).join('')}</div>
        ${hiddenCatsHtml()}
        <button class="btn primary" data-act="cat-new">+ تصنيف جديد</button></div>
      <div class="card"><button class="btn ghost" style="width:100%" data-act="whatsnew">جديد في التطبيق${S.settings.seenVersion !== APP_VERSION ? '<i class="dot"></i>' : ''}</button></div>
      <div class="card"><details><summary>ميزانية شهرية لكل تصنيف</summary><div style="display:flex;flex-direction:column;gap:8px;padding-top:8px">${budgets}</div></details></div>
      <div class="card" style="display:flex;flex-direction:column;gap:8px"><div class="h">نسخة احتياطية</div><div class="row"><button class="btn ghost grow" data-act="export">تصدير</button><button class="btn ghost grow" data-act="import">استيراد</button></div></div>
      <div class="card" style="display:flex;flex-direction:column;gap:8px"><div class="h">عن التطبيق</div><div class="small">الإصدار ${APP_VERSION}. التحديثات بتوصلك تلقائياً لما تفتح التطبيق وفيه نت، من غير إعادة تثبيت.</div><button class="btn ghost" data-act="refresh-app">تحديث الآن</button></div></div>`;
  }

  /* ---------- مساعدات الشاشات الجديدة ---------- */
  const SWATCHES = ['#B84A0B', '#4A3AA8', '#0B6E6E', '#A8281C', '#2F6FB5', '#1F8A4C', '#9B3F8E', '#7A5C00', '#C2417A', '#6B4F3A'];
  const swatchesHtml = (sel, act) => `<div class="swatches" role="group" aria-label="اللون">${SWATCHES.map((c) => `<button class="sw${c === sel ? ' on' : ''}" style="background:${c}" data-act="${act}" data-c="${c}" aria-label="لون ${c}"></button>`).join('')}</div>`;
  const catChipBtn = (c) => `<button class="chip" style="color:var(--ink);display:inline-flex;gap:6px;align-items:center" data-act="cat-open" data-id="${c.id}"><span style="width:10px;height:10px;border-radius:50%;background:${c.color};display:inline-block"></span>${esc(c.name)}</button>`;
  function hiddenCatsHtml() {
    const h = S.catConfig.hidden || []; if (!h.length) return '';
    return `<div class="small">تصنيفات محذوفة (اضغط للاسترجاع)</div><div class="chips">${h.map((id) => `<button class="chip" style="color:var(--ink)" data-act="cat-restore" data-id="${id}">↺ ${esc(engine.catOf(id).name)}</button>`).join('')}</div>`;
  }
  const hhmm = (ts) => { const d = new Date(ts); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
  const ymd = (ts) => { const d = new Date(ts); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
  const toDigits = (v) => String(v == null ? '' : v).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/٫/g, '.');

  function txEditHtml(sh) {
    const t = sh.tx; const isX = t.type === 'xfer';
    const typeSeg = isX && !sh.isNew ? '' : `<div class="seg" role="group" aria-label="النوع"><button class="${t.type === 'out' ? 'on' : ''}" data-act="tx-type" data-v="out">مصروف</button><button class="${t.type === 'in' ? 'on' : ''}" data-act="tx-type" data-v="in">دخل</button>${sh.isNew ? `<button class="${t.type === 'xfer' ? 'on' : ''}" data-act="tx-type" data-v="xfer">تحويل</button>` : ''}</div>`;
    const fields = isX
      ? `<div class="field col"><label>من</label><div class="pick">${accPick(t.acc, 'data-act="te-pick" data-k="acc"')}</div></div><div class="field col"><label>إلى</label><div class="pick">${accPick(t.to, 'data-act="te-pick" data-k="to"')}</div></div>`
      : `<div class="field"><label for="te_label">الوصف</label><input id="te_label" data-te="label" value="${esc(t.label)}"></div><div class="field col"><label>التصنيف</label><div class="pick" id="te_cat">${catPick(t.type, t.cat, 'data-act="te-pick" data-k="cat"')}</div></div><div id="te_hint" class="${sh.hint && sh.hint.indexOf('مش') === 0 ? 'warn' : 'ok'}">${esc(sh.hint || '')}</div><div id="te_subwrap">${subRowHtml(sh)}</div><div class="field col"><label>الحساب</label><div class="pick">${accPick(t.acc, 'data-act="te-pick" data-k="acc"')}</div></div>`;
    const actions = sh.confirm
      ? `<div class="warn">متأكد إنك عايز تحذف العملية دي؟ رصيدك هيتعدّل.</div><div class="row"><button class="btn red grow" data-act="tx-del-do">نعم، احذف</button><button class="btn ghost grow" data-act="tx-del-cancel">لا</button></div>`
      : `<div class="row"><button class="btn primary grow" data-act="tx-save">${sh.isNew ? 'إضافة' : 'حفظ التعديل'}</button>${sh.isNew ? '' : '<button class="btn red" data-act="tx-del-ask">حذف</button>'}<button class="btn ghost" data-act="close">إغلاق</button></div>`;
    return `<div class="h" style="font-size:18px">${sh.isNew ? 'إدخال يدوي' : isX ? 'تعديل تحويل' : 'تعديل عملية'}</div>${sh.isNew ? entryModeSeg('manual') : ''}${typeSeg}
      <div class="field"><label for="te_amount">المبلغ</label><input id="te_amount" data-te="amount" inputmode="decimal" value="${esc(t.amount)}"></div>${fields}
      ${sh.isNew ? '' : `<div class="field"><label for="te_date">التاريخ</label><input id="te_date" type="date" data-te="date" value="${sh.date}"></div>
      <div class="field"><label for="te_time">الوقت</label><input id="te_time" type="time" data-te="time" value="${sh.time}"></div>`}${actions}`;
  }
  function wordChipsHtml(sh) {
    const q = norm1(sh.filter); const all = engine.effectiveWords(sh.id); const words = all.filter((x) => !q || norm1(x.w).indexOf(q) >= 0).slice(0, 250);
    return words.map((x) => `<span class="chip wchip${x.user ? ' user' : ''}">${esc(x.w)}<button class="xbtn" data-act="cat-delword" data-w="${esc(x.w)}" data-user="${x.user ? 1 : 0}" aria-label="حذف ${esc(x.w)}">✕</button></span>`).join('') || '<span class="small">مفيش كلمات.</span>';
  }
  const norm1 = (v) => A.norm(String(v || '')).trim();
  function catSheetHtml(sh) {
    const c = engine.catOf(sh.id); const prot = !!engine.PROTECTED[sh.id]; const used = S.txs.filter((t) => t.cat === sh.id).length;
    const count = engine.effectiveWords(sh.id).length;
    let del;
    if (prot) del = '<div class="small">ده تصنيف أساسي بيستقبل أي حاجة مش مفهومة، فما ينفعش يتحذف. تقدر تغيّر اسمه ولونه.</div>';
    else if (sh.confirm) {
      const opts = (c.type === 'in' ? engine.catsIn() : engine.catsOut()).filter((x) => x.id !== sh.id).map((x) => `<option value="${x.id}"${x.id === sh.moveTo ? ' selected' : ''}>${esc(x.name)}</option>`).join('');
      del = `<div class="warn">${used ? `فيه ${used} عملية في التصنيف ده. اختار تنقلها لأنهي تصنيف:` : 'متأكد من الحذف؟'}</div>${used ? `<div class="pick">${pickHtml((c.type === 'in' ? engine.catsIn() : engine.catsOut()).filter((x) => x.id !== sh.id), sh.moveTo, 'data-act="cat-moveto"')}</div>` : ''}<div class="row"><button class="btn red grow" data-act="cat-del-do">تأكيد الحذف</button><button class="btn ghost grow" data-act="cat-del-cancel">لا</button></div>`;
    } else del = '<button class="btn ghost" style="color:var(--red)" data-act="cat-del-ask">حذف التصنيف</button>';
    return `<div class="h" style="font-size:18px">تعديل التصنيف</div>
      <div class="field"><label for="ce_name">الاسم</label><input id="ce_name" data-ce="name" value="${esc(c.name)}"></div>
      <div><div class="small" style="margin-bottom:6px">اللون</div>${swatchesHtml(c.color, 'cat-color')}</div>
      ${subsSectionHtml(sh)}
      <div class="h">الكلمات (${count})</div><div class="small">أي كلمة هنا بتتصنف تحت "${esc(c.name)}". الكلمات اللي أضفتها بإطار ملوّن.</div>
      <div class="field"><input id="wfilter" data-ce="filter" data-keepfocus="1" aria-label="بحث في الكلمات" placeholder="ابحث في الكلمات" value="${esc(sh.filter || '')}"></div>
      <div class="chips wordbox">${wordChipsHtml(sh)}</div>
      <div class="field"><input id="newword" data-keepfocus="1" aria-label="كلمات جديدة" placeholder="أضف كلمات (افصل بمسافة)"><button class="btn primary" data-act="cat-addword">إضافة</button></div>
      ${c.builtin ? '<button class="btn ghost" data-act="cat-reset">استرجاع الإعدادات الأصلية للتصنيف</button>' : ''}
      ${del}<button class="btn primary" data-act="close">تم</button>`;
  }
  function newCatHtml(sh) {
    return `<div class="h" style="font-size:18px">تصنيف جديد</div>
      <div class="field"><label for="nc_name">الاسم</label><input id="nc_name" data-nc="name" value="${esc(sh.name)}" placeholder="مثال: إيجارات"></div>
      <div class="seg" role="group" aria-label="النوع"><button class="${sh.ctype === 'out' ? 'on' : ''}" data-act="nc-type" data-v="out">مصروف</button><button class="${sh.ctype === 'in' ? 'on' : ''}" data-act="nc-type" data-v="in">دخل</button></div>
      <div><div class="small" style="margin-bottom:6px">اللون</div>${swatchesHtml(sh.color, 'nc-color')}</div>
      <div class="field"><label for="nc_words">الكلمات</label><textarea id="nc_words" data-nc="words" style="direction:rtl;font-size:14px;min-height:70px" placeholder="كلمات مفصولة بمسافة، مثال: ايجار شقه عقد">${esc(sh.words)}</textarea></div>
      <div class="row"><button class="btn primary grow" data-act="nc-create">إنشاء</button><button class="btn ghost grow" data-act="close">إلغاء</button></div>`;
  }
  const subChipHtml = (t) => { const n = t.sub ? engine.subName(t.cat, t.sub) : ''; return n ? `<span class="subchip">${esc(n)}</span>` : ''; };
  function subRowHtml(sh) {
    const t = sh.tx; if (t.type === 'xfer') return ''; const subs = engine.subsOf(t.cat); if (!subs.length) return '';
    return `<div class="field col"><label>البند</label><div class="pick"><button type="button" class="pk${!t.sub ? ' on' : ''}" data-act="te-pick" data-k="sub" data-v="">بدون</button>${subs.map((x) => `<button type="button" class="pk${x.id === t.sub ? ' on' : ''}" data-act="te-pick" data-k="sub" data-v="${x.id}">${esc(x.name)}</button>`).join('')}</div></div>`;
  }
  function subPickHtml(it, i) {
    const subs = engine.subsOf(it.cat); if (!subs.length) return '';
    return `<div class="small">البند</div><div class="pick"><button type="button" class="pk${!it.sub ? ' on' : ''}" data-act="di-pick" data-i="${i}" data-k="sub" data-v="">بدون</button>${subs.map((x) => `<button type="button" class="pk${x.id === it.sub ? ' on' : ''}" data-act="di-pick" data-i="${i}" data-k="sub" data-v="${x.id}">${esc(x.name)}</button>`).join('')}</div>`;
  }
  function subsSectionHtml(sh) {
    const subs = engine.subsOf(sh.id);
    return `<div class="h">البنود (${subs.length})</div><div class="small">تفاصيل داخل التصنيف، زي: منزلي، منزل والدتي، منزل أختي، المحل، أو السيارة والموتوسيكل. التطبيق بيفهمها لما تكتبها في الوصف.</div>
      <div class="chips">${subs.map((x) => `<button class="chip" style="color:var(--ink)" data-act="sub-open" data-id="${x.id}">${esc(x.name)}</button>`).join('') || '<span class="small">لسه مفيش بنود.</span>'}</div>
      <div class="field"><input id="newsub" data-keepfocus="1" aria-label="بند جديد" placeholder="أضف بند (افصل بفاصلة لإضافة أكتر من بند)"><button class="btn primary" data-act="sub-add">إضافة</button></div>`;
  }
  function subSheetHtml(sh) {
    const sb = engine.subsOf(sh.cat).find((x) => x.id === sh.id); if (!sb) return '';
    const used = S.txs.filter((t) => t.cat === sh.cat && t.sub === sb.id).length;
    const words = (sb.words || []).map((w) => `<span class="chip wchip user">${esc(w)}<button class="xbtn" data-act="sub-delword" data-w="${esc(w)}" aria-label="حذف ${esc(w)}">✕</button></span>`).join('') || '<span class="small">مفيش كلمات إضافية.</span>';
    const del = sh.confirm
      ? `<div class="warn">${used ? `فيه ${used} عملية على البند ده، هتفضل متسجلة من غير بند.` : 'متأكد من الحذف؟'}</div><div class="row"><button class="btn red grow" data-act="sub-del-do">تأكيد الحذف</button><button class="btn ghost grow" data-act="sub-del-cancel">لا</button></div>`
      : '<button class="btn ghost" style="color:var(--red)" data-act="sub-del-ask">حذف البند</button>';
    return `<div class="h" style="font-size:18px">بند في "${esc(engine.catOf(sh.cat).name)}"</div>
      <div class="field col"><label for="se_name">الاسم</label><input id="se_name" data-se="name" value="${esc(sb.name)}"></div>
      <div class="h">كلمات بتدل عليه</div><div class="small">اسم البند بيتفهم لوحده، وبيفهم مرادفات زي ماما = أمي = والدتي. أضف كلمات تانية لو عايز.</div>
      <div class="chips">${words}</div>
      <div class="field"><input id="newsubword" data-keepfocus="1" aria-label="كلمات جديدة" placeholder="أضف كلمات (افصل بمسافة)"><button class="btn primary" data-act="sub-addword">إضافة</button></div>
      ${del}<button class="btn primary" data-act="sub-back">رجوع للتصنيف</button>`;
  }
  function accEditHtml(sh) {
    const a = acctOf(sh.id); if (!a) return '';
    const used = S.txs.filter((t) => t.acc === a.id || t.to === a.id).length;
    let del;
    if (S.accounts.length <= 1) del = '<div class="small">ده آخر حساب عندك، ما ينفعش يتحذف.</div>';
    else if (sh.confirm) {
      const others = S.accounts.filter((x) => x.id !== a.id).map((x) => ({ id: x.id, name: x.name, color: x.color }));
      del = `<div class="warn">${used ? `فيه ${used} عملية على الحساب ده. هتتنقل (ومعاها رصيده الافتتاحي) للحساب اللي تختاره:` : 'متأكد من الحذف؟'}</div>${used ? `<div class="pick">${pickHtml(others, sh.moveTo, 'data-act="acc-moveto"')}</div>` : ''}<div class="row"><button class="btn red grow" data-act="acc-del-do">تأكيد الحذف</button><button class="btn ghost grow" data-act="acc-del-cancel">لا</button></div>`;
    } else del = '<button class="btn ghost" style="color:var(--red)" data-act="acc-del-ask">حذف الحساب</button>';
    return `<div class="h" style="font-size:18px">تعديل الحساب</div>
      <div class="field col"><label for="ae_name">الاسم</label><input id="ae_name" data-ae="name" value="${esc(a.name)}"></div>
      <div class="field col"><label>النوع</label><div class="pick">${pickHtml(KIND_LIST, a.kind, 'data-act="acc-kind"')}</div></div>
      <div><div class="small" style="margin-bottom:6px">اللون</div>${swatchesHtml(a.color, 'acc-color')}</div>
      <div class="field col"><label for="ae_open">الرصيد الافتتاحي</label><input id="ae_open" data-open="${a.id}" inputmode="decimal" value="${a.opening || ''}" placeholder="0"></div>
      <div class="field col"><label for="ae_words">كلمات تدل عليه (اختياري)</label><input id="ae_words" data-ae="words" value="${esc((a.words || []).join('، '))}" placeholder="مثال: فودافون، فودا"><div class="small">لو كتبت أي كلمة منهم في كلامك، التطبيق يختار الحساب ده لوحده.</div></div>
      ${del}<button class="btn primary" data-act="close">تم</button>`;
  }
  function newAccHtml(sh) {
    return `<div class="h" style="font-size:18px">حساب جديد</div>
      <div class="field col"><label for="na_name">الاسم</label><input id="na_name" data-na="name" value="${esc(sh.name)}" placeholder="مثال: محفظة اورنج"></div>
      <div class="field col"><label>النوع</label><div class="pick">${pickHtml(KIND_LIST, sh.kind, 'data-act="na-kind"')}</div></div>
      <div><div class="small" style="margin-bottom:6px">اللون</div>${swatchesHtml(sh.color, 'na-color')}</div>
      <div class="field col"><label for="na_open">الرصيد الحالي (اختياري)</label><input id="na_open" data-na="opening" inputmode="decimal" value="${esc(sh.opening)}" placeholder="0"></div>
      <div class="row"><button class="btn primary grow" data-act="na-create">إنشاء</button><button class="btn ghost grow" data-act="close">إلغاء</button></div>`;
  }

  function whatsNewHtml() {
    const cl = ui.changelog;
    const list = cl && cl.versions ? cl.versions.map((v) => `<div class="card"><div class="row between"><b>الإصدار ${esc(v.v)}${v.v === APP_VERSION ? ' (الحالي)' : ''}</b><span class="small">${esc(v.date)}</span></div><div class="h" style="margin-top:4px">${esc(v.title)}</div><ul style="margin:6px 0 0;padding-inline-start:18px;line-height:1.9;font-size:14px">${v.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join('') : '<div class="small">ما قدرتش أحمّل السجل. تأكد من النت وجرّب تاني.</div>';
    return `<div class="h" style="font-size:18px">جديد في التطبيق</div>${list}<button class="btn primary" data-act="close">تم</button>`;
  }
  function updBarHtml() {
    return ui.update ? `<div class="updbar" role="status"><span>في تحديث جديد (${esc(ui.update)})</span><button data-act="refresh-app">حدّث الآن</button></div>` : '';
  }

  function sheetHtml() {
    const sh = ui.sheet; if (!sh) return '';
    let body = '';
    if (sh.type === 'onboard') {
      body = `<div class="h" style="font-size:18px">أهلاً بيك في محفظتي</div><div class="small">اكتب رصيدك الحالي في كل حساب (ممكن تسيبه صفر وتعدّله بعدين). وتقدر تضيف حسابات تانية (محفظة تانية، انستا تاني، بنك) من الإعدادات.</div>
        ${accIds().map((a) => `<div class="field"><label style="min-width:90px;font-weight:700" for="o_${a}">${accName(a)}</label><input id="o_${a}" data-open="${a}" inputmode="decimal" value="${accOpening(a) || ''}" placeholder="0"></div>`).join('')}
        <button class="btn primary big" data-act="onboard-ok">ابدأ</button>`;
    } else if (sh.type === 'acc') {
      const b = balances()[sh.id]; const list = S.txs.filter((t) => t.acc === sh.id || t.to === sh.id).sort((a, c) => c.ts - a.ts).slice(0, 12);
      body = `<div class="h" style="font-size:18px">${accName(sh.id)}</div><div style="font-size:30px;font-weight:800">${fmt(b)}</div>
        <div class="field"><label for="op" style="min-width:110px;font-size:13px;font-weight:600">الرصيد الافتتاحي</label><input id="op" data-open="${sh.id}" inputmode="decimal" value="${accOpening(sh.id) || ''}" placeholder="0"></div>
        <div class="small">لتحويل فلوس بين حساباتك اكتب مثلاً: حولت 500 من انستا للكاش</div>
        ${list.map(txRow).join('') || '<div class="small">مفيش عمليات.</div>'}
        <div class="row"><button class="btn ghost grow" data-act="acc-edit" data-id="${sh.id}">تعديل الحساب</button><button class="btn primary grow" data-act="close">تم</button></div>`;
    } else if (sh.type === 'tx') {
      body = sh.tx ? txEditHtml(sh) : '';
    } else if (sh.type === 'day') {
      const { y, m } = ui.vm; const arr = inMonth(y, m).filter((t) => new Date(t.ts).getDate() === sh.d).sort((a, c) => c.ts - a.ts);
      body = `<div class="h" style="font-size:18px">${sh.d} ${MONTHS[m]}</div>${arr.map(txRow).join('') || '<div class="small">مفيش عمليات في اليوم ده.</div>'}<button class="btn primary" data-act="close">تم</button>`;
    } else if (sh.type === 'entry') {
      body = entryHtml();
    } else if (sh.type === 'recur') {
      body = recurSheetHtml(sh);
    } else if (sh.type === 'accedit') {
      body = accEditHtml(sh);
    } else if (sh.type === 'newacc') {
      body = newAccHtml(sh);
    } else if (sh.type === 'sub') {
      body = subSheetHtml(sh);
    } else if (sh.type === 'cat') {
      body = catSheetHtml(sh);
    } else if (sh.type === 'newcat') {
      body = newCatHtml(sh);
    } else if (sh.type === 'whatsnew') {
      body = whatsNewHtml();
    } else if (sh.type === 'export') {
      body = `<div class="h">نسخة احتياطية</div><div class="small">انسخ النص ده واحفظه (مثلاً في ملاحظات أو رسالة لنفسك).</div><textarea id="exp" readonly>${esc(JSON.stringify(S))}</textarea>
        <div class="row"><button class="btn primary grow" data-act="copy-exp">نسخ</button><button class="btn ghost grow" data-act="close">إغلاق</button></div>`;
    } else if (sh.type === 'import') {
      body = `<div class="h">استيراد نسخة احتياطية</div><div class="small warn">ده هيستبدل كل بياناتك الحالية.</div><textarea id="imp" placeholder="الصق النص هنا"></textarea>
        <div class="row"><button class="btn primary grow" data-act="do-import">استيراد</button><button class="btn ghost grow" data-act="close">إلغاء</button></div>`;
    }
    return `<div class="scrim" data-act="scrim"><div class="sheet" role="dialog" aria-modal="true">${body}</div></div>`;
  }

  function tabsHtml() {
    const t = (id, n) => `<button class="${ui.tab === id ? 'on' : ''}" data-act="tab" data-id="${id}">${n}</button>`;
    return `<nav class="tabs"><div>${t('home', 'الرئيسية')}${t('month', 'الشهر')}${t('assistant', 'المساعد')}${t('settings', 'الإعدادات' + (S.settings.seenVersion !== APP_VERSION ? '<i class="dot"></i>' : ''))}</div></nav>`;
  }

  function render() {
    const ae = document.activeElement; const keepFocus = ae && ae.id; const pos = ae && ae.selectionStart;
    const oldSheet = document.querySelector('.sheet'); const st = oldSheet ? oldSheet.scrollTop : 0;
    const body = ui.tab === 'home' ? homeHtml() : ui.tab === 'month' ? monthHtml() : ui.tab === 'year' ? yearHtml() : ui.tab === 'history' ? historyHtml() : ui.tab === 'settings' ? settingsHtml() : assistantHtml();
    $('#app').innerHTML = updBarHtml() + body + tabsHtml() + sheetHtml() + (ui.toast ? `<div class="toast" role="status">${esc(ui.toast)}</div>` : '');
    const ns = document.querySelector('.sheet'); if (ns && ui.sheet === ui._lastSheet) ns.scrollTop = st; ui._lastSheet = ui.sheet;
    if (keepFocus) { const el = document.getElementById(keepFocus); if (el && (!ui.sheet || el.dataset.keepfocus)) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } } }
  }

  /* ---------- منطق ---------- */
  function submitText() {
    const text = ui.text.trim(); if (!text) { toast('اكتب مصروفك الأول، مثلاً: 50 بنزين و10 زيت'); return; }
    const r = engine.parse(text);
    if (r.kind === 'query') { answerQuery(text); ui.text = ''; ui.sheet = null; ui.tab = 'assistant'; render(); return; }
    if (r.kind === 'transfer') { ui.draft = { kind: 'transfer', amount: r.amount, from: r.from, to: r.to, dateOffset: r.dateOffset }; render(); return; }
    const useAI = !!(S.settings.aiOn && S.settings.aiKey && (!r.items.length || r.items.some((it) => it.conf === 'low')));
    if (!r.items.length && !useAI) { toast('ما لقيتش مبلغ. اكتب المبلغ مع الوصف، مثلاً: 50 فطار'); return; }
    r.items.forEach((it) => { it.acc = validAcc(it.acc || S.settings.lastAcc); it.origCat = it.cat; it.origSub = it.sub || ''; });
    const token = uid();
    ui.draft = { kind: 'entry', items: r.items, dateOffset: r.dateOffset, ai: useAI ? 'pending' : '', token };
    render();
    if (useAI) {
      aiParse(text).then((items) => {
        if (!ui.draft || ui.draft.token !== token) return;
        if (items && items.length) {
          ui.draft.items = items.map((it) => ({ amount: it.amount, label: it.label, type: it.type, cat: it.cat, origCat: it.cat, acc: validAcc(it.acc || S.settings.lastAcc), conf: 'mid', sub: it.sub || '', origSub: it.sub || '' }));
          ui.draft.ai = 'done';
        } else { ui.draft.ai = r.items.length ? '' : 'error'; if (!r.items.length) { ui.draft = null; toast('ما لقيتش مبلغ. اكتب المبلغ مع الوصف.'); return; } }
        render();
      }).catch(() => {
        if (!ui.draft || ui.draft.token !== token) return;
        if (!r.items.length) { ui.draft = null; toast('ما قدرتش أوصل لـClaude ولا لقيت مبلغ في كلامك.'); } else { ui.draft.ai = 'error'; }
        render();
      });
    }
  }

  /* ---------- Claude (اختياري) ---------- */
  async function callClaude(system, text, maxTokens) {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 15000);
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal: ctl.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': S.settings.aiKey.trim(), 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: S.settings.aiModel, max_tokens: maxTokens || 500, system, messages: [{ role: 'user', content: text }] }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const j = await res.json();
      return (j.content || []).map((c) => c.text || '').join('');
    } finally { clearTimeout(to); }
  }
  async function aiParse(text) {
    const out = engine.catsOut().map((c) => `${c.id}=${c.name}`).join('، '); const inn = engine.catsIn().map((c) => `${c.id}=${c.name}`).join('، ');
    const accTxt = S.accounts.map((a) => `${a.id}=${a.name}`).join('، ');
    const subTxt = engine.catsAll().map((c) => { const l = engine.subsOf(c.id); return l.length ? `${c.id}: ${l.map((x) => `${x.id}=${x.name}`).join('، ')}` : ''; }).filter(Boolean).join(' | ');
    const system = 'أنت مساعد داخل تطبيق مصاريف مصري. حوّل رسالة المستخدم (بالعامية المصرية) إلى بنود. ' +
      'ردّك JSON فقط بدون أي شرح ولا علامات كود، بالشكل: {"items":[{"amount":رقم,"label":"وصف قصير بالعربي","type":"out" أو "in","category":"معرّف التصنيف","account":"معرّف الحساب" أو null,"sub":"معرّف البند" أو null}]}. ' +
      `تصنيفات المصروف: ${out}. تصنيفات الدخل: ${inn}. الحسابات: ${accTxt}. ${subTxt ? `البنود الفرعية لكل تصنيف: ${subTxt}.` : ''} ` +
      'استخدم سياق الرسالة لحسم الكلمات الملتبسة (مثلاً "بنزين وزيت" يعني زيت العربية = vehicle). لو مفيش مبلغ رجّع {"items":[]}.';
    const txt = await callClaude(system, text, 500);
    const m = txt.match(/\{[\s\S]*\}/); if (!m) throw new Error('bad json');
    const obj = JSON.parse(m[0]); const arr = Array.isArray(obj.items) ? obj.items : [];
    return arr.map((it) => {
      const type = it.type === 'in' ? 'in' : 'out'; const pool = (type === 'in' ? engine.catsIn() : engine.catsOut()).map((c) => c.id);
      return { amount: Math.abs(parseFloat(it.amount)) || 0, label: String(it.label || '').slice(0, 60), type, cat: pool.indexOf(it.category) >= 0 ? it.category : (type === 'in' ? 'in_other' : 'other'), acc: accIds().indexOf(it.account) >= 0 ? it.account : null, sub: (it.sub && engine.subsOf(pool.indexOf(it.category) >= 0 ? it.category : '').some((x) => x.id === it.sub)) ? it.sub : '' };
    }).filter((it) => it.amount > 0);
  }
  function answerQuery(text) { ui.chat.push({ q: text, a: engine.answer(text, S.txs, Date.now(), balances()) }); }

  function saveDraft() {
    const d = ui.draft; if (!d) return; const now = Date.now();
    const ts = d.dateOffset ? startOfDay(now) + d.dateOffset * DAY + 12 * 36e5 : now;
    if (d.kind === 'transfer') {
      S.txs.push({ id: uid(), ts, type: 'xfer', amount: d.amount, acc: d.from, to: d.to, label: 'تحويل', cat: 'other' });
      ui.draft = null; ui.text = ''; save(); toast('اتسجل التحويل'); return;
    }
    const good = d.items.filter((it) => +it.amount > 0); const notes = [];
    good.forEach((it, i) => {
      const amount = +it.amount; S.txs.push({ id: uid(), ts: ts + i, type: it.type, amount, label: (it.label || '').trim(), cat: it.cat, acc: it.acc, sub: it.sub || '' });
      if (it.sub && it.sub !== it.origSub && it.label) { const ad = engine.learnSub(it.label, it.cat, it.sub); if (ad.length) notes.push(`اتعلمت إن "${ad.join(' ')}" = ${engine.subName(it.cat, it.sub)}`); }
      const corrected = it.cat !== it.origCat;
      engine.learn(it.label, it.cat, corrected);
      if (corrected && it.label) notes.push(`اتعلمت إن "${it.label.trim()}" = ${catOf(it.cat).name}`);
    });
    if (good.length) S.settings.lastAcc = good[good.length - 1].acc;
    ui.draft = null; ui.text = ''; if (ui.sheet && ui.sheet.type === 'entry') ui.sheet = null; S.settings.lastReminder = Date.now(); save();
    const advNote = afterSave(S.txs.slice(S.txs.length - good.length));
    toast((notes.length ? notes.join(' · ') : `اتسجل ${good.length} ${good.length > 1 ? 'عمليات' : 'عملية'}`) + (advNote ? ' · ' + advNote : ''));
  }

  /* ---------- تعديل العمليات والتصنيفات ---------- */
  function saveTx() {
    const sh = ui.sheet; const t = sh.tx;
    if (sh.isNew) {
      let subNote = '';
      const am = parseFloat(toDigits(t.amount)); if (!(am > 0)) { toast('اكتب مبلغ صحيح'); return; }
      const dq = (sh.date || '').split('-').map(Number); const tq = (sh.time || '00:00').split(':').map(Number);
      const ts0 = Date.now(); if (isNaN(ts0)) { toast('التاريخ غير صحيح'); return; }
      if (t.type === 'xfer') { if (t.acc === t.to) { toast('اختار حسابين مختلفين'); return; } S.txs.push({ id: uid(), ts: ts0, type: 'xfer', amount: am, acc: t.acc, to: t.to, label: 'تحويل', cat: 'other' }); }
      else { const lab = (t.label || '').trim(); S.txs.push({ id: uid(), ts: ts0, type: t.type, amount: am, label: lab, cat: t.cat, acc: t.acc, sub: t.sub || '' }); if (lab && t.cat !== 'other' && t.cat !== 'in_other') engine.learn(lab, t.cat, !!sh.catManual); if (lab && t.sub && sh.subManual) { const ad = engine.learnSub(lab, t.cat, t.sub); if (ad.length) subNote = `اتعلمت إن "${ad.join(' ')}" = ${engine.subName(t.cat, t.sub)}`; } }
      S.settings.lastAcc = t.acc; save(); ui.sheet = null; const advNote = afterSave(S.txs[S.txs.length - 1], sh.payFor); toast([subNote || 'اتسجلت العملية', advNote].filter(Boolean).join(' · ')); return;
    }
    const orig = S.txs.find((x) => x.id === t.id); if (!orig) { ui.sheet = null; render(); return; }
    const amount = parseFloat(toDigits(t.amount)); if (!(amount > 0)) { toast('اكتب مبلغ صحيح'); return; }
    const dp = (sh.date || '').split('-').map(Number); const tp = (sh.time || '00:00').split(':').map(Number);
    const ts = new Date(dp[0], (dp[1] || 1) - 1, dp[2] || 1, tp[0] || 0, tp[1] || 0).getTime(); if (isNaN(ts)) { toast('التاريخ غير صحيح'); return; }
    if (t.type === 'xfer' && t.acc === t.to) { toast('اختار حسابين مختلفين'); return; }
    const was = orig.cat; let note = '';
    orig.amount = amount; orig.ts = ts; orig.type = t.type; orig.acc = t.acc;
    if (t.type === 'xfer') orig.to = t.to; else { orig.label = (t.label || '').trim(); orig.cat = t.cat; orig.sub = t.sub || ''; if (orig.sub && sh.subManual && orig.label) { const ad = engine.learnSub(orig.label, orig.cat, orig.sub); if (ad.length) note = `اتعلمت إن "${ad.join(' ')}" = ${engine.subName(orig.cat, orig.sub)}`; } if (was !== orig.cat && orig.label) { engine.learn(orig.label, orig.cat, true); note = note || `اتعلمت إن "${orig.label}" = ${catOf(orig.cat).name}`; } }
    save(); ui.sheet = null; render(); toast(note || 'اتحفظ التعديل');
  }
  function teSet(el) {
    const sh = ui.sheet; if (!sh || sh.type !== 'tx') return; const k = el.dataset.te;
    if (k === 'date') sh.date = el.value; else if (k === 'time') sh.time = el.value; else sh.tx[k] = el.value;
    if (k === 'cat') { sh.catManual = true; sh.hint = ''; const h = document.getElementById('te_hint'); if (h) h.textContent = ''; }
    if (k === 'label') autoCat(sh);
  }
  function addWords() {
    const sh = ui.sheet; const inp = $('#newword'); const list = (inp ? inp.value : '').split(/[\s,،]+/).filter(Boolean); if (!list.length) return;
    const id = sh.id; let added = 0;
    applyCat((cfg) => {
      const cu = cfg.custom.find((x) => x.id === id);
      list.forEach((w) => {
        if (cu) { cu.words = cu.words || []; if (cu.words.indexOf(w) < 0) { cu.words.push(w); added++; } return; }
        cfg.removed[id] = cfg.removed[id] || [];
        if (cfg.removed[id].indexOf(w) >= 0) { cfg.removed[id] = cfg.removed[id].filter((x) => x !== w); added++; return; }
        if (!engine.effectiveWords(id).some((x) => x.w === w)) { cfg.extra[id] = cfg.extra[id] || []; cfg.extra[id].push(w); added++; }
      });
    });
    render(); toast(added ? `اتضافت ${added} كلمة` : 'الكلمات دي موجودة بالفعل');
  }
  function deleteCategory() {
    const sh = ui.sheet; const id = sh.id; const c = engine.catOf(id); if (engine.PROTECTED[id]) return;
    const target = sh.moveTo && sh.moveTo !== id ? sh.moveTo : (c.type === 'in' ? 'in_other' : 'other');
    S.txs.forEach((t) => { if (t.cat === id) { t.cat = target; t.sub = ''; } });
    delete S.budgets[id];
    Object.keys(S.learned).forEach((k) => { if (S.learned[k][id] != null) { delete S.learned[k][id]; if (!Object.keys(S.learned[k]).length) delete S.learned[k]; } });
    applyCat((cfg) => { delete cfg.subs[id]; const i = cfg.custom.findIndex((x) => x.id === id); if (i >= 0) cfg.custom.splice(i, 1); else if (cfg.hidden.indexOf(id) < 0) cfg.hidden.push(id); });
    ui.sheet = null; render(); toast(`اتحذف التصنيف، والعمليات اتنقلت لـ"${catOf(target).name}"`);
  }
  function createCategory() {
    const sh = ui.sheet; const name = (sh.name || '').trim(); if (!name) { toast('اكتب اسم التصنيف'); return; }
    const words = (sh.words || '').split(/[\s,،]+/).filter(Boolean);
    const id = 'c_' + uid();
    applyCat((cfg) => { cfg.custom.push({ id, name, color: sh.color, type: sh.ctype, words }); });
    ui.sheet = { type: 'cat', id, filter: '', confirm: false, moveTo: 'other' }; render(); toast('اتضاف التصنيف');
  }
  function applyTheme() {
    const th = S.settings.theme || 'auto'; document.documentElement.setAttribute('data-theme', th);
    const dark = th === 'dark' || (th === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', dark ? '#1A130D' : '#FFF8F0');
  }
  async function checkUpdate() {
    if (!/^https?:/.test(location.protocol)) return;
    try {
      const r = await fetch('changelog.json?_=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return; const j = await r.json();
      ui.changelog = j; const up = j.latest && j.latest !== APP_VERSION ? j.latest : ''; if (up !== ui.update || ui.sheet && ui.sheet.type === 'whatsnew') { ui.update = up; render(); }
    } catch (e) { /* مفيش نت */ }
  }

  /* ---------- الحسابات والبنود ---------- */
  function createAccount() {
    const sh = ui.sheet; const name = (sh.name || '').trim(); if (!name) { toast('اكتب اسم الحساب'); return; }
    if (nameTaken(name)) { toast('فيه حساب بنفس الاسم'); return; }
    const id = 'a_' + uid();
    applyAcct(() => { S.accounts.push({ id, name, kind: sh.kind, color: sh.color, opening: parseFloat(toDigits(sh.opening)) || 0, words: [] }); });
    ui.sheet = null; render(); toast('اتضاف الحساب');
  }
  function deleteAccount() {
    const sh = ui.sheet; const id = sh.id; if (S.accounts.length <= 1) return;
    const target = acctOf(sh.moveTo) && sh.moveTo !== id ? sh.moveTo : S.accounts.find((x) => x.id !== id).id;
    const old = acctOf(id);
    S.txs.forEach((t) => { if (t.acc === id) t.acc = target; if (t.to === id) t.to = target; });
    S.txs = S.txs.filter((t) => !(t.type === 'xfer' && t.acc === t.to));
    applyAcct(() => { acctOf(target).opening += old.opening || 0; S.accounts = S.accounts.filter((x) => x.id !== id); if (S.settings.lastAcc === id) S.settings.lastAcc = target; });
    ui.sheet = null; render(); toast(`اتحذف الحساب، وعملياته اتنقلت لـ"${accName(target)}"`);
  }
  function addSubs() {
    const sh = ui.sheet; const inp = $('#newsub'); const names = (inp ? inp.value : '').split(/[,،\n]+/).map((x) => x.trim()).filter(Boolean); if (!names.length) return;
    let added = 0;
    applyCat((cfg) => {
      const list = cfg.subs[sh.id] = cfg.subs[sh.id] || [];
      names.forEach((n) => { if (list.some((x) => A.norm(x.name).trim() === A.norm(n).trim())) return; list.push({ id: 's_' + uid() + added, name: n, words: [] }); added++; });
    });
    render(); toast(added ? `اتضاف ${added} بند` : 'البنود دي موجودة بالفعل');
  }
  function subAddWords() {
    const sh = ui.sheet; const inp = $('#newsubword'); const list = (inp ? inp.value : '').split(/[\s,،]+/).filter(Boolean); if (!list.length) return;
    applyCat((cfg) => { const sb = (cfg.subs[sh.cat] || []).find((x) => x.id === sh.id); if (sb) { sb.words = sb.words || []; list.forEach((w) => { if (sb.words.indexOf(w) < 0) sb.words.push(w); }); } });
    render(); toast('اتضافت الكلمات');
  }
  function deleteSub() {
    const sh = ui.sheet;
    S.txs.forEach((t) => { if (t.cat === sh.cat && t.sub === sh.id) t.sub = ''; });
    applyCat((cfg) => { cfg.subs[sh.cat] = (cfg.subs[sh.cat] || []).filter((x) => x.id !== sh.id); });
    ui.sheet = { type: 'cat', id: sh.cat, filter: '', confirm: false, moveTo: 'other' }; render(); toast('اتحذف البند');
  }

  /* ---------- المدفوعات المتكررة ---------- */
  const EVERY = [{ id: '0', name: 'مرة واحدة' }, { id: '1', name: 'كل شهر' }, { id: '3', name: 'كل 3 شهور' }, { id: '6', name: 'كل 6 شهور' }, { id: '12', name: 'كل سنة' }];
  const everyName = (n) => (n === 1 ? 'كل شهر' : n === 12 ? 'كل سنة' : `كل ${n} شهور`);
  const mkDate = (y, m, d) => { const dim = new Date(y, m + 1, 0).getDate(); return new Date(y, m, Math.min(d, dim)); };
  const dLabel = (ts) => { const d = new Date(ts); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
  const recKey = (x) => norm1(x.label) || (x.cat + '|' + (x.sub || ''));
  const recOf = (id) => S.recurring.find((r) => r.id === id);
  const MONTHLY_WORDS = /ايجار|قسط|اشتراك|كهرب|نور|ميه|مياه|غاز|انترنت|نت |واي ?فاي|فاتور|تليفون|موبايل|خط|جمعي|حضان|مدرس|مصاريف دراس|راتب|مرتب|معاش|ماهي/;
  function suggestEvery(x) {
    if (x.type === 'in') return x.cat === 'salary' ? 1 : 0;
    if (['bills', 'telecom', 'debt'].indexOf(x.cat) >= 0 || MONTHLY_WORDS.test(norm1(x.label))) return 1;
    return 0;
  }
  function nextFrom(day, every, mode, base) {
    const n = new Date(); if (mode === 'ask') return mkDate(n.getFullYear(), n.getMonth() + (every || 1), day).getTime();
    let t = mkDate(n.getFullYear(), n.getMonth(), day).getTime(); if (t < startOfDay(Date.now())) t = mkDate(n.getFullYear(), n.getMonth() + 1, day).getTime(); return base && base > t ? base : t;
  }
  function advanceRec(r) {
    let guard = 0;
    do { const d = new Date(r.next); r.next = mkDate(d.getFullYear(), d.getMonth() + r.every, r.day).getTime(); guard++; } while (r.next < startOfDay(Date.now()) && guard < 60);
    save(); scheduleRecur();
  }
  function recurSheetFor(tx) {
    const every = suggestEvery(tx); const day = new Date().getDate();
    return { type: 'recur', mode: 'ask', label: tx.label || '', amount: String(tx.amount), ttype: tx.type, cat: tx.cat, sub: tx.sub || '', acc: tx.acc, every, day, next: nextFrom(day, every || 1, 'ask'), confirm: false };
  }
  // بعد حفظ عمليات: يربطها بدفعة موجودة، أو يفتح سؤال التكرار
  function afterSave(txs, payFor) {
    const list = Array.isArray(txs) ? txs : [txs]; const queue = []; let note = '';
    list.forEach((tx) => {
      if (!tx || tx.type === 'xfer') return;
      const pr = payFor ? recOf(payFor) : null;
      const r = pr || S.recurring.find((x) => x.type === tx.type && ((norm1(tx.label) && x.key === norm1(tx.label)) || (tx.sub && x.sub === tx.sub && x.cat === tx.cat)));
      if (r) { if (pr || r.next <= Date.now() + 10 * DAY) { advanceRec(r); note = `الميعاد الجاي ${dLabel(r.next)}`; } return; }
      const am = S.settings.askRecur === true ? 'always' : S.settings.askRecur === false ? 'never' : (S.settings.askRecur || 'always');
      if (am === 'never' || (am === 'smart' && !suggestEvery(tx))) return;
      const k = recKey(tx); if (S.noRecur[k]) return;
      queue.push(tx);
    });
    if (queue.length) { ui.recQueue = queue.slice(1); ui.sheet = recurSheetFor(queue[0]); }
    return note;
  }
  function recNext() { const nx = (ui.recQueue || []).shift(); ui.sheet = nx ? recurSheetFor(nx) : null; render(); }
  function recurSheetHtml(sh) {
    const isOut = sh.ttype !== 'in'; const what = isOut ? 'الدفع' : 'الاستلام';
    const title = sh.mode === 'ask' ? (isOut ? 'هل المبلغ ده بيتدفع بشكل متكرر؟' : 'هل الدخل ده بيتكرر؟') : sh.mode === 'edit' ? 'تعديل دفعة متكررة' : 'دفعة متكررة جديدة';
    const [hh, mm] = (S.settings.recurTime || '09:00').split(':'); const tt = timeStr(new Date(2000, 0, 1, +hh || 0, +mm || 0).getTime());
    const typeSeg = sh.mode === 'new' ? `<div class="seg" role="group" aria-label="النوع"><button class="${sh.ttype === 'out' ? 'on' : ''}" data-act="rc-type" data-v="out">مصروف</button><button class="${sh.ttype === 'in' ? 'on' : ''}" data-act="rc-type" data-v="in">دخل</button></div>` : '';
    const more = sh.every > 0
      ? `<div class="field col"><label for="rc_day">يوم ${what} من الشهر (1 إلى 31)</label><input id="rc_day" type="number" min="1" max="31" inputmode="numeric" data-rc="day" value="${sh.day}"></div>
         <div class="field col"><label for="rc_next">ميعاد ${what} الجاي</label><input id="rc_next" type="date" data-rc="next" value="${ymd(sh.next)}"></div>
         <div class="ok">هفكّرك قبل الميعاد بـ3 أيام، وتاني يوم ${what} نفسه الساعة ${tt}.</div>`
      : (sh.mode === 'ask' ? '<div class="small">تمام، مرة واحدة. مش هسألك تاني عن نفس الوصف ده.</div>' : '<div class="warn">اختار التكرار (كل شهر أو كل 3 شهور...).</div>');
    let actions;
    if (sh.confirm) actions = '<div class="warn">متأكد إنك عايز تحذف الدفعة دي؟</div><div class="row"><button class="btn red grow" data-act="rc-del-do">نعم، احذف</button><button class="btn ghost grow" data-act="rc-del-cancel">لا</button></div>';
    else if (sh.mode === 'ask') actions = '<div class="row"><button class="btn primary grow" data-act="rc-save">حفظ</button><button class="btn ghost grow" data-act="rc-skip-ask">تخطي</button></div>';
    else actions = `<div class="row"><button class="btn primary grow" data-act="rc-save">${sh.mode === 'new' ? 'إضافة' : 'حفظ'}</button>${sh.mode === 'edit' ? '<button class="btn red" data-act="rc-del-ask">حذف</button>' : ''}<button class="btn ghost" data-act="close">إغلاق</button></div>`;
    return `<div class="h" style="font-size:18px">${title}</div>${typeSeg}
      <div class="field col"><label for="rc_label">الوصف</label><input id="rc_label" data-rc="label" value="${esc(sh.label)}" placeholder="مثال: كهرباء"></div>
      <div class="field col"><label for="rc_amount">المبلغ</label><input id="rc_amount" data-rc="amount" inputmode="decimal" value="${esc(sh.amount)}"></div>
      <div class="field col"><label>بيتكرر كل قد إيه؟</label><div class="pick">${pickHtml(EVERY, String(sh.every), 'data-act="rc-every"')}</div></div>${more}${actions}`;
  }
  function rcSet(el, commit) {
    const sh = ui.sheet; if (!sh || sh.type !== 'recur') return; const k = el.dataset.rc;
    if (k === 'label') sh.label = el.value; else if (k === 'amount') sh.amount = el.value;
    if (!commit) return;
    if (k === 'day') { const d = Math.min(31, Math.max(1, parseInt(toDigits(el.value), 10) || 1)); sh.day = d; const cur = new Date(sh.next); let nt = mkDate(cur.getFullYear(), cur.getMonth(), d).getTime(); if (sh.mode !== 'ask' && nt < startOfDay(Date.now())) nt = mkDate(cur.getFullYear(), cur.getMonth() + 1, d).getTime(); sh.next = nt; render(); }
    if (k === 'next' && el.value) { const q = el.value.split('-').map(Number); const nt = new Date(q[0], q[1] - 1, q[2]).getTime(); if (!isNaN(nt)) { sh.next = nt; sh.day = new Date(nt).getDate(); render(); } }
  }
  function rcSave() {
    const sh = ui.sheet; const amount = parseFloat(toDigits(sh.amount)); if (!(amount > 0)) { toast('اكتب مبلغ صحيح'); return; }
    const label = (sh.label || '').trim();
    if (sh.every === 0) {
      if (sh.mode === 'ask') { const k = recKey({ label, cat: sh.cat, sub: sh.sub }); if (k) S.noRecur[k] = 1; save(); recNext(); } else toast('اختار التكرار الأول');
      return;
    }
    if (sh.mode === 'new' && !label) { toast('اكتب وصف للدفعة'); return; }
    let next = sh.next; let guard = 0;
    while (next < startOfDay(Date.now()) && guard++ < 60) { const d = new Date(next); next = mkDate(d.getFullYear(), d.getMonth() + sh.every, sh.day).getTime(); }
    let cat = sh.cat; let sub = sh.sub; let acc = validAcc(sh.acc);
    if (sh.mode === 'new') {
      const pk = engine.pick(engine.scoreLabel(label).score, null, sh.ttype); cat = pk.cat; const sm = engine.matchSub(label, cat, sh.ttype, pk.conf === 'low'); sub = ''; if (sm) { cat = sm.cat; sub = sm.sub; } acc = validAcc(S.settings.lastAcc);
    }
    const data = { label, amount, type: sh.ttype, cat, sub, acc, every: sh.every, day: sh.day, next, key: recKey({ label, cat, sub }) };
    if (sh.mode === 'edit') { const r = recOf(sh.id); if (r) Object.assign(r, data); } else { S.recNid += 1; S.recurring.push(Object.assign({ id: 'r_' + uid(), nid: S.recNid }, data)); }
    save(); scheduleRecur();
    toast(`اتضبط التذكير: ${everyName(sh.every)} يوم ${sh.day}، الميعاد الجاي ${dLabel(next)}`, 4500);
    if (sh.mode === 'ask') recNext(); else { ui.sheet = null; render(); }
  }
  function recurDueHtml() {
    const sod = startOfDay(Date.now());
    const due = S.recurring.filter((r) => Math.round((startOfDay(r.next) - sod) / DAY) <= 3).sort((a, b) => a.next - b.next); if (!due.length) return '';
    return `<div class="card duecard" role="status"><div class="h">مواعيد الدفع القريبة</div>${due.map((r) => {
      const dd = Math.round((startOfDay(r.next) - sod) / DAY); const st = dd < 0 ? `متأخر ${-dd} يوم` : dd === 0 ? 'النهارده' : `بعد ${dd} يوم`; const nm = r.label || catOf(r.cat).name; const what = r.type === 'in' ? 'استلام' : 'دفع';
      return `<div class="dueitem"><div class="row between"><div><div class="t1" style="font-weight:700">${what} ${esc(nm)}</div><div class="small">${fmt(r.amount)} · ${st}</div></div></div><div class="row"><button class="btn primary grow" data-act="rc-pay" data-id="${r.id}">${r.type === 'in' ? 'سجّل الاستلام' : 'سجّل الدفع'}</button><button class="btn ghost" data-act="rc-skip" data-id="${r.id}">تخطي</button></div></div>`;
    }).join('')}</div>`;
  }
  function recurSettingsHtml() {
    const st = S.settings;
    const rows = S.recurring.slice().sort((a, b) => a.next - b.next).map((r) => `<button class="chip" style="color:var(--ink);text-align:right;display:flex;justify-content:space-between;gap:8px;border-radius:14px;width:100%" data-act="rc-open" data-id="${r.id}"><span>${esc(r.label || catOf(r.cat).name)} · ${fmt(r.amount)}</span><span class="small">${everyName(r.every)} · الجاي ${dLabel(r.next)}</span></button>`).join('') || '<div class="small">لسه مفيش مدفوعات متكررة. هتتضاف لما تجاوب على سؤال "بيتكرر؟" وإنت بتسجل، أو تضيفها من هنا.</div>';
    return `<div class="card" style="display:flex;flex-direction:column;gap:10px"><div class="h">المدفوعات المتكررة</div>
      <div class="small">لما تسجل مصروف أو دخل هسألك لو بيتكرر، وهفكّرك قبل الميعاد بـ3 أيام وفي يوم الدفع.</div>
      <div class="small">وقت تسجيل مصروف أو دخل جديد:</div>
      <div class="seg" role="group" aria-label="السؤال عن التكرار">${[['always', 'اسألني دايماً'], ['smart', 'للشهري بس'], ['never', 'ما تسألش']].map((x) => `<button class="${(st.askRecur === true ? 'always' : st.askRecur === false ? 'never' : (st.askRecur || 'always')) === x[0] ? 'on' : ''}" data-act="rc-ask" data-v="${x[0]}">${x[1]}</button>`).join('')}</div>
      <div class="small">"للشهري بس" يعني أسألك بس لو شكل المصروف متكرر زي الفواتير والإيجار والقسط والراتب.</div>
      <div class="field"><label for="rtime" style="min-width:90px;font-size:13px;font-weight:600">وقت التذكير</label><input id="rtime" type="time" value="${esc(st.recurTime || '09:00')}"></div>
      <div style="display:flex;flex-direction:column;gap:6px">${rows}</div>
      <button class="btn primary" data-act="rc-new">+ دفعة متكررة جديدة</button></div>`;
  }
  async function scheduleRecur() {
    const LN = cap('LocalNotifications'); if (!LN) return;
    try {
      const pend = await LN.getPending(); const mine = pend.notifications.filter((n) => n.id >= 100000); if (mine.length) await LN.cancel({ notifications: mine });
      if (!S.recurring.length) return;
      let perm = await LN.checkPermissions(); if (perm.display !== 'granted') perm = await LN.requestPermissions(); if (perm.display !== 'granted') return;
      await LN.createChannel({ id: 'recur', name: 'مواعيد الدفع', description: 'تذكير بمواعيد المدفوعات المتكررة', importance: 4, visibility: 1, vibration: true });
      const tp = String(S.settings.recurTime || '09:00').split(':'); const now = Date.now(); const list = [];
      S.recurring.forEach((r) => {
        const due = new Date(r.next); due.setHours(+tp[0] || 0, +tp[1] || 0, 0, 0); const pre = new Date(due.getTime() - 3 * DAY);
        const what = r.type === 'in' ? 'استلام' : 'دفع'; const nm = r.label || catOf(r.cat).name; const amt = fmt(r.amount);
        if (pre.getTime() > now) list.push({ id: 100000 + r.nid * 2, title: 'محفظتي', body: `بعد 3 أيام ميعاد ${what} ${nm} (${amt})`, channelId: 'recur', schedule: { at: pre, allowWhileIdle: true } });
        if (due.getTime() > now) list.push({ id: 100000 + r.nid * 2 + 1, title: 'محفظتي', body: `النهارده ميعاد ${what} ${nm} (${amt})`, channelId: 'recur', schedule: { at: due, allowWhileIdle: true } });
      });
      if (list.length) await LN.schedule({ notifications: list });
    } catch (e) { /* ignore */ }
  }

  /* ---------- أحداث ---------- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]'); if (!el) return; const a = el.dataset.act;
    if (a === 'scrim') { if (e.target === el) { ui.sheet = null; render(); } return; }
    const idx = +el.dataset.i;
    switch (a) {
      case 'tab': ui.tab = el.dataset.id; render(); window.scrollTo(0, 0); break;
      case 'te-pick': { const sh = ui.sheet; const k = el.dataset.k; sh.tx[k] = el.dataset.v; if (k === 'cat') { sh.catManual = true; sh.hint = ''; if (sh.tx.sub && !engine.subsOf(sh.tx.cat).some((x) => x.id === sh.tx.sub)) sh.tx.sub = ''; } if (k === 'sub') sh.subManual = true; render(); break; }
      case 'di-pick': { syncInputs(); const it = ui.draft.items[+el.dataset.i]; it[el.dataset.k] = el.dataset.v; if (el.dataset.k === 'cat' && it.sub && !engine.subsOf(it.cat).some((x) => x.id === it.sub)) it.sub = ''; render(); break; }
      case 'rc-ask': S.settings.askRecur = el.dataset.v; save(); render(); break;
      case 'rc-new': ui.sheet = { type: 'recur', mode: 'new', label: '', amount: '', ttype: 'out', cat: 'other', sub: '', acc: validAcc(S.settings.lastAcc), every: 1, day: new Date().getDate(), next: nextFrom(new Date().getDate(), 1, 'new'), confirm: false }; render(); break;
      case 'rc-open': { const r = recOf(el.dataset.id); if (r) { ui.sheet = { type: 'recur', mode: 'edit', id: r.id, label: r.label, amount: String(r.amount), ttype: r.type, cat: r.cat, sub: r.sub || '', acc: r.acc, every: r.every, day: r.day, next: r.next, confirm: false }; render(); } break; }
      case 'rc-type': ui.sheet.ttype = el.dataset.v; render(); break;
      case 'rc-every': { const sh = ui.sheet; sh.every = +el.dataset.v; if (sh.every > 0) sh.next = sh.mode === 'ask' ? nextFrom(sh.day, sh.every, 'ask') : (sh.next || nextFrom(sh.day, sh.every, 'new')); render(); break; }
      case 'rc-save': rcSave(); break;
      case 'rc-skip-ask': recNext(); break;
      case 'rc-del-ask': ui.sheet.confirm = true; render(); break;
      case 'rc-del-cancel': ui.sheet.confirm = false; render(); break;
      case 'rc-del-do': { const id = ui.sheet.id; S.recurring = S.recurring.filter((r) => r.id !== id); save(); scheduleRecur(); ui.sheet = null; render(); toast('اتحذفت الدفعة المتكررة'); break; }
      case 'rc-skip': { const r = recOf(el.dataset.id); if (r) { advanceRec(r); render(); toast(`اتخطت الدورة دي. الميعاد الجاي ${dLabel(r.next)}`); } break; }
      case 'rc-pay': { const r = recOf(el.dataset.id); if (r) { ui.sheet = { type: 'tx', isNew: true, id: null, payFor: r.id, catManual: false, subManual: false, hint: '', tx: { type: r.type, amount: String(r.amount), label: r.label, cat: r.cat, sub: r.sub || '', acc: validAcc(r.acc), to: '' }, date: ymd(Date.now()), time: hhmm(Date.now()), confirm: false }; render(); } break; }
      case 'acc-edit': ui.sheet = { type: 'accedit', id: el.dataset.id, confirm: false, moveTo: '' }; render(); break;
      case 'acc-new': ui.sheet = { type: 'newacc', name: '', kind: 'wallet', color: KIND_COLOR.wallet, opening: '' }; render(); break;
      case 'acc-kind': { const a = acctOf(ui.sheet.id); applyAcct(() => { a.kind = el.dataset.v; }); render(); break; }
      case 'acc-color': { const a = acctOf(ui.sheet.id); applyAcct(() => { a.color = el.dataset.c; }); render(); break; }
      case 'acc-moveto': ui.sheet.moveTo = el.dataset.v; render(); break;
      case 'acc-del-ask': ui.sheet.confirm = true; ui.sheet.moveTo = (S.accounts.find((x) => x.id !== ui.sheet.id) || {}).id; render(); break;
      case 'acc-del-cancel': ui.sheet.confirm = false; render(); break;
      case 'acc-del-do': deleteAccount(); break;
      case 'na-kind': ui.sheet.kind = el.dataset.v; ui.sheet.color = KIND_COLOR[el.dataset.v]; render(); break;
      case 'na-color': ui.sheet.color = el.dataset.c; render(); break;
      case 'na-create': createAccount(); break;
      case 'sub-add': addSubs(); break;
      case 'sub-open': ui.sheet = { type: 'sub', cat: ui.sheet.id, id: el.dataset.id, confirm: false }; render(); break;
      case 'sub-back': ui.sheet = { type: 'cat', id: ui.sheet.cat, filter: '', confirm: false, moveTo: 'other' }; render(); break;
      case 'sub-addword': subAddWords(); break;
      case 'sub-delword': { const sh = ui.sheet; applyCat((cfg) => { const sb = (cfg.subs[sh.cat] || []).find((x) => x.id === sh.id); if (sb) sb.words = (sb.words || []).filter((w) => w !== el.dataset.w); }); render(); break; }
      case 'sub-del-ask': ui.sheet.confirm = true; render(); break;
      case 'sub-del-cancel': ui.sheet.confirm = false; render(); break;
      case 'sub-del-do': deleteSub(); break;
      case 'cat-moveto': ui.sheet.moveTo = el.dataset.v; render(); break;
      case 'hp': ui.hp = el.dataset.v; render(); break;
      case 'hf': ui.hf = el.dataset.v; render(); break;
      case 'ha': ui.ha = el.dataset.v; render(); break;
      case 'exq': ui.q = el.dataset.t; doAsk(); break;
      case 'parse': syncInputs(); submitText(); break;
      case 'cancel-draft': ui.draft = null; render(); break;
      case 'save-draft': syncInputs(); saveDraft(); break;
      case 'del-item': ui.draft.items.splice(idx, 1); if (!ui.draft.items.length) ui.draft = null; render(); break;
      case 'type': { const it = ui.draft.items[idx]; it.type = el.dataset.v; const ok = (it.type === 'in' ? engine.catsIn() : engine.catsOut()).some((c) => c.id === it.cat); if (!ok) it.cat = it.type === 'in' ? 'in_other' : 'other'; if (!engine.subsOf(it.cat).some((x) => x.id === it.sub)) it.sub = ''; render(); break; }
      case 'acc': ui.sheet = { type: 'acc', id: el.dataset.id }; render(); break;
      case 'tx': { const t0 = S.txs.find((x) => x.id === el.dataset.id); if (t0) { ui.sheet = { type: 'tx', id: t0.id, catManual: false, subManual: false, hint: '', tx: Object.assign({}, t0), date: ymd(t0.ts), time: hhmm(t0.ts), confirm: false }; render(); } break; }
      case 'tx-type': { const t1 = ui.sheet.tx; t1.type = el.dataset.v; if (t1.type !== 'xfer') autoCat(ui.sheet); if (t1.type === 'xfer') { if (!t1.to || t1.to === t1.acc) t1.to = accIds().find((a) => a !== t1.acc); render(); break; } const okc = (t1.type === 'in' ? engine.catsIn() : engine.catsOut()).some((c) => c.id === t1.cat); if (!okc) t1.cat = t1.type === 'in' ? 'in_other' : 'other'; if (!engine.subsOf(t1.cat).some((x) => x.id === t1.sub)) t1.sub = ''; render(); break; }
      case 'add-tx': ui.draft = null; openManual(); render(); setTimeout(() => { const i = document.getElementById('te_amount'); if (i) i.focus(); }, 60); break;
      case 'entry-mode': if (el.dataset.v === 'manual') openManual(); else ui.sheet = { type: 'entry' }; render(); break;
      case 'theme-toggle': { const dark = document.documentElement.getAttribute('data-theme') === 'dark' || (S.settings.theme !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); S.settings.theme = dark ? 'light' : 'dark'; save(); applyTheme(); render(); toast(dark ? 'الوضع العادي' : 'الوضع الداكن'); break; }
      case 'tx-save': saveTx(); break;
      case 'tx-del-ask': ui.sheet.confirm = true; render(); break;
      case 'tx-del-cancel': ui.sheet.confirm = false; render(); break;
      case 'tx-del-do': S.txs = S.txs.filter((t) => t.id !== ui.sheet.id); ui.sheet = null; save(); render(); toast('اتحذفت العملية'); break;
      case 'theme': S.settings.theme = el.dataset.v; save(); applyTheme(); render(); break;
      case 'whatsnew': S.settings.seenVersion = APP_VERSION; save(); ui.sheet = { type: 'whatsnew' }; render(); checkUpdate(); break;
      case 'cat-open': ui.sheet = { type: 'cat', id: el.dataset.id, filter: '', confirm: false, moveTo: 'other' }; render(); break;
      case 'cat-new': ui.sheet = { type: 'newcat', name: '', ctype: 'out', color: SWATCHES[0], words: '' }; render(); break;
      case 'cat-color': { const id = ui.sheet.id; applyCat((cfg) => { const cu = cfg.custom.find((x) => x.id === id); if (cu) cu.color = el.dataset.c; else cfg.color[id] = el.dataset.c; }); render(); break; }
      case 'cat-delword': { const id = ui.sheet.id; const w = el.dataset.w; const user = el.dataset.user === '1'; applyCat((cfg) => { const cu = cfg.custom.find((x) => x.id === id); if (cu) cu.words = (cu.words || []).filter((x) => x !== w); else if (user) cfg.extra[id] = (cfg.extra[id] || []).filter((x) => x !== w); else { cfg.removed[id] = cfg.removed[id] || []; if (cfg.removed[id].indexOf(w) < 0) cfg.removed[id].push(w); } }); render(); break; }
      case 'cat-addword': addWords(); break;
      case 'cat-reset': { const id = ui.sheet.id; applyCat((cfg) => { delete cfg.rename[id]; delete cfg.color[id]; delete cfg.extra[id]; delete cfg.removed[id]; }); render(); toast('رجّعت الإعدادات الأصلية'); break; }
      case 'cat-del-ask': ui.sheet.confirm = true; render(); break;
      case 'cat-del-cancel': ui.sheet.confirm = false; render(); break;
      case 'cat-del-do': deleteCategory(); break;
      case 'cat-restore': applyCat((cfg) => { cfg.hidden = cfg.hidden.filter((x) => x !== el.dataset.id); }); render(); break;
      case 'nc-type': ui.sheet.ctype = el.dataset.v; render(); break;
      case 'nc-color': ui.sheet.color = el.dataset.c; render(); break;
      case 'nc-create': createCategory(); break;
      case 'day': ui.sheet = { type: 'day', d: +el.dataset.d }; render(); break;
      case 'close': ui.sheet = null; render(); break;
      case 'del-tx': S.txs = S.txs.filter((t) => t.id !== el.dataset.id); ui.sheet = null; save(); render(); break;
      case 'mprev': ui.vm.m--; if (ui.vm.m < 0) { ui.vm.m = 11; ui.vm.y--; } render(); break;
      case 'mnext': ui.vm.m++; if (ui.vm.m > 11) { ui.vm.m = 0; ui.vm.y++; } render(); break;
      case 'yprev': ui.vy--; render(); break;
      case 'ynext': ui.vy++; render(); break;
      case 'gomonth': ui.vm = { y: ui.vy, m: +el.dataset.m }; ui.tab = 'month'; render(); break;
      case 'ask': ui.q = ($('#qinp') || {}).value || ui.q; doAsk(); break;
      case 'forget': engine.forget(el.dataset.k); save(); render(); break;
      case 'upd-dismiss': S.settings.seenVersion = APP_VERSION; save(); render(); break;
      case 'onboard-ok': S.settings.seenVersion = APP_VERSION; S.settings.onboarded = true; ui.sheet = null; save(); render(); applyReminders(true); break;
      case 'export': ui.sheet = { type: 'export' }; render(); break;
      case 'import': ui.sheet = { type: 'import' }; render(); break;
      case 'copy-exp': { const ta = $('#exp'); ta.select(); try { (navigator.clipboard ? navigator.clipboard.writeText(ta.value) : Promise.reject()).then(() => toast('اتنسخ')).catch(() => { document.execCommand('copy'); toast('اتنسخ'); }); } catch (er) { document.execCommand('copy'); toast('اتنسخ'); } break; }
      case 'do-import': doImport(); break;
      case 'test-remind': testReminder(); break;
      case 'apply-remind': syncSettings(); save(); applyReminders(true); break;
      case 'rmode': S.settings.remindMode = el.dataset.v; save(); render(); applyReminders(false); break;
      case 'add-time': { const v = ($('#newt') || {}).value; if (v && S.settings.times.indexOf(v) < 0) { S.settings.times.push(v); save(); render(); applyReminders(false); } break; }
      case 'del-time': S.settings.times = S.settings.times.filter((x) => x !== el.dataset.t); save(); render(); applyReminders(false); break;
      case 'ai-test': syncSettings(); save(); aiTest(); break;
      case 'refresh-app': refreshApp(); break;
      case 'banner-open': ui.banner = false; ui.tab = 'home'; render(); setTimeout(() => { const i = $('#inp'); if (i) i.focus(); }, 50); break;
      case 'banner-skip': ui.banner = false; S.settings.lastReminder = Date.now(); save(); render(); break;
      default: break;
    }
  });
  function doAsk() { if (!ui.q.trim()) return; answerQuery(ui.q); ui.q = ''; ui.tab = 'assistant'; render(); }
  function doImport() {
    try { const d = JSON.parse($('#imp').value); if (!d || !Array.isArray(d.txs)) throw new Error('bad'); S = Object.assign(defaults(), d); normCfg(); migrate(); engine.setConfig(S.catConfig); scheduleRecur(); Object.keys(engine.learned).forEach((k) => delete engine.learned[k]); Object.assign(engine.learned, S.learned); S.learned = engine.learned; save(); ui.sheet = null; render(); toast('تم الاستيراد'); } catch (e) { toast('النص غير صالح'); }
  }
  function syncInputs() {
    const inp = $('#inp'); if (inp) ui.text = inp.value;
    if (ui.draft && ui.draft.items) document.querySelectorAll('.ditem').forEach((box) => {
      const it = ui.draft.items[+box.dataset.i]; if (!it) return;
      it.amount = box.querySelector('[data-f=amount]').value.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
      it.label = box.querySelector('[data-f=label]').value;
    });
  }
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.te) { teSet(t); return; }
    if (t.dataset.rc) { rcSet(t, false); return; }
    if (t.dataset.na) { if (ui.sheet && ui.sheet.type === 'newacc') ui.sheet[t.dataset.na] = t.value; return; }
    if (t.dataset.nc) { if (ui.sheet && ui.sheet.type === 'newcat') ui.sheet[t.dataset.nc] = t.value; return; }
    if (t.dataset.ce === 'filter') { if (ui.sheet) { ui.sheet.filter = t.value; const box = document.querySelector('.wordbox'); if (box) box.innerHTML = wordChipsHtml(ui.sheet); } return; }
    if (t.id === 'inp') ui.text = t.value; else if (t.id === 'qinp') ui.q = t.value;
    else if (t.id === 'hq') { ui.hq = t.value; render(); }
    else if (t.id === 'rtext') { S.settings.remindText = t.value; save(); }
    else if (t.id === 'aikey') { S.settings.aiKey = t.value; save(); }
    else if (t.dataset.bud) { const v = parseFloat(t.value); if (v > 0) S.budgets[t.dataset.bud] = v; else delete S.budgets[t.dataset.bud]; save(); }
    else if (t.dataset.open) { const ac = acctOf(t.dataset.open); if (ac) { ac.opening = parseFloat(toDigits(t.value)) || 0; save(); } }
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.te) { teSet(t); return; }
    if (t.dataset.rc) { rcSet(t, true); return; }
    if (t.dataset.ae && ui.sheet && ui.sheet.type === 'accedit') {
      const a = acctOf(ui.sheet.id); if (!a) return;
      if (t.dataset.ae === 'name') { const v = t.value.trim(); if (!v) { render(); return; } if (nameTaken(v, a.id)) { toast('فيه حساب بنفس الاسم'); render(); return; } applyAcct(() => { a.name = v; }); render(); }
      else if (t.dataset.ae === 'words') { applyAcct(() => { a.words = t.value.split(/[,،\n]+/).map((x) => x.trim()).filter(Boolean); }); }
      return;
    }
    if (t.dataset.se && ui.sheet && ui.sheet.type === 'sub') { const v = t.value.trim(); const sh = ui.sheet; if (v) { applyCat((cfg) => { const sb = (cfg.subs[sh.cat] || []).find((x) => x.id === sh.id); if (sb) sb.name = v; }); render(); } return; }
    if (t.dataset.ce === 'name') { const v = t.value.trim(); if (v && ui.sheet) { const id = ui.sheet.id; applyCat((cfg) => { const cu = cfg.custom.find((x) => x.id === id); if (cu) cu.name = v; else cfg.rename[id] = v; }); render(); } return; }
    if (t.dataset.ce === 'moveTo') { ui.sheet.moveTo = t.value; return; }
    else if (t.dataset.txcat) { const tx = S.txs.find((x) => x.id === t.dataset.txcat); if (tx) { const was = tx.cat; tx.cat = t.value; if (was !== tx.cat) { engine.learn(tx.label, tx.cat, true); toast(`اتعلمت إن "${tx.label}" = ${catOf(tx.cat).name}`); } save(); render(); } }
    else if (t.id === 'rtime' && t.value) { S.settings.recurTime = t.value; save(); scheduleRecur(); }
    else if (t.id === 'remind') { S.settings.remind = t.checked; save(); applyReminders(false); }
    else if (t.id === 'every') { S.settings.everyH = +t.value; save(); render(); applyReminders(false); }
    else if (t.id === 'st' && t.value) { S.settings.startT = t.value; save(); render(); applyReminders(false); }
    else if (t.id === 'et' && t.value) { S.settings.endT = t.value; save(); render(); applyReminders(false); }
    else if (t.id === 'aion') { S.settings.aiOn = t.checked; save(); }
    else if (t.id === 'aimodel') { S.settings.aiModel = t.value; save(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.id === 'inp' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ui.text = e.target.value; submitText(); }
    if (e.target.id === 'qinp' && e.key === 'Enter') { e.preventDefault(); ui.q = e.target.value; doAsk(); }
  });

  /* ---------- التذكير ---------- */
  const cap = (n) => (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[n]) || null;
  const pad2 = (n) => String(n).padStart(2, '0');
  const toMin = (t) => { const p = String(t || '0:0').split(':'); return (+p[0] || 0) * 60 + (+p[1] || 0); };
  function reminderTimes() {
    const st = S.settings;
    if (st.remindMode === 'custom') return Array.from(new Set(st.times || [])).sort();
    const a = toMin(st.startT); let b = toMin(st.endT); if (b < a) b += 1440; const step = Math.max(1, +st.everyH || 2) * 60; const out = [];
    for (let x = a; x <= b && out.length < 24; x += step) { const m = x % 1440; out.push(pad2(Math.floor(m / 60)) + ':' + pad2(m % 60)); }
    return out;
  }
  function showBanner() { ui.banner = true; render(); window.scrollTo(0, 0); }
  function syncSettings() {
    const g = (id) => document.getElementById(id);
    if (g('rtext')) S.settings.remindText = g('rtext').value || defaults().settings.remindText;
    if (g('aikey')) S.settings.aiKey = g('aikey').value;
  }
  async function applyReminders(announce) {
    const LN = cap('LocalNotifications');
    if (!LN) { if (announce) toast('إشعارات النظام بتشتغل في تطبيق الأندرويد. هنا التذكير بيظهر جوه التطبيق وهو مفتوح.'); return; }
    try {
      const perm = await LN.requestPermissions();
      if (perm.display !== 'granted') { if (announce) toast('لازم تسمح بالإشعارات من إعدادات التليفون'); return; }
      await LN.createChannel({ id: 'reminders', name: 'تذكير المصاريف', description: 'تذكير تسجيل المصاريف', importance: 4, visibility: 1, vibration: true });
      await LN.registerActionTypes({ types: [{ id: 'REMINDER', actions: [{ id: 'open', title: 'فتح' }, { id: 'skip', title: 'تخطي' }] }] });
      const pend = await LN.getPending(); const mineR = pend.notifications.filter((n) => n.id < 100000); if (mineR.length) await LN.cancel({ notifications: mineR });
      if (!S.settings.remind) { if (announce) toast('التذكير متوقف'); return; }
      const list = reminderTimes();
      await LN.schedule({ notifications: list.map((t) => ({ id: 1000 + toMin(t), title: 'محفظتي', body: S.settings.remindText, channelId: 'reminders', actionTypeId: 'REMINDER', schedule: { on: { hour: Math.floor(toMin(t) / 60), minute: toMin(t) % 60 }, allowWhileIdle: true } })) });
      if (announce) toast(list.length ? `اتضبط التذكير ${list.length} مرات يومياً: ${list.join(' · ')}` : 'مفيش ساعات للتذكير');
    } catch (e) { if (announce) toast('ما قدرتش أضبط التذكير: ' + (e && e.message ? e.message : '')); }
  }
  async function testReminder() {
    const LN = cap('LocalNotifications');
    if (LN) {
      try { await LN.requestPermissions(); await LN.schedule({ notifications: [{ id: 999, title: 'محفظتي', body: S.settings.remindText, channelId: 'reminders', actionTypeId: 'REMINDER', schedule: { at: new Date(Date.now() + 4000), allowWhileIdle: true } }] }); toast('هيجيلك إشعار بعد ثواني. اطلع من التطبيق وشوفه.'); return; } catch (e) { /* نكمل ببانر */ }
    }
    ui.tab = 'home'; showBanner();
  }
  async function aiTest() {
    if (!S.settings.aiKey) { toast('اكتب المفتاح الأول'); return; }
    toast('بختبر الاتصال…', 20000);
    try { const t = await callClaude('رد بكلمة واحدة فقط: تمام', 'اختبار', 20); toast(t ? 'الاتصال شغال ✔' : 'اتصلت لكن مفيش رد'); } catch (e) { toast('فشل الاتصال: ' + (e && e.message ? e.message : '') + '. تأكد من المفتاح والنت.', 5000); }
  }
  async function refreshApp() {
    if (ui.busyRefresh) return; ui.busyRefresh = true;
    toast('جاري التحقق من الاتصال…', 6000);
    let online = false;
    try {
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 6000);
      const r = await fetch('changelog.json?_=' + Date.now(), { cache: 'no-store', signal: ctl.signal }); clearTimeout(tm); online = r.ok;
    } catch (e) { online = false; }
    ui.busyRefresh = false;
    if (!online) { toast('لا يوجد اتصال بالإنترنت. التطبيق شغال على نسخته الحالية وبياناتك محفوظة.', 4500); return; }
    toast('جاري التحديث…', 3000);
    try { if (navigator.serviceWorker) { const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map((r) => r.update())); } } catch (e) { /* ignore */ }
    location.reload();
  }
  (function listenNotif() {
    const LN = cap('LocalNotifications'); if (!LN) return;
    LN.addListener('localNotificationActionPerformed', (ev) => {
      if (ev.actionId === 'skip') { const App = cap('App'); if (App && App.minimizeApp) App.minimizeApp(); return; }
      ui.tab = 'home'; render(); setTimeout(() => { const i = $('#inp'); if (i) i.focus(); }, 150);
    });
  })();
  // في المتصفح أو والتطبيق مفتوح: بانر عند كل ساعة تذكير
  function checkBanner() {
    if (!S.settings.remind || cap('LocalNotifications') || ui.banner || document.visibilityState !== 'visible') return;
    const now = new Date(); const nowMin = now.getHours() * 60 + now.getMinutes(); let due = -1;
    reminderTimes().forEach((t) => { const m = toMin(t); if (m <= nowMin && m > due) due = m; });
    if (due < 0 || nowMin - due > 30) return;
    const dueTs = startOfDay(now.getTime()) + due * 6e4;
    if ((S.settings.lastBanner || 0) >= dueTs) return;
    S.settings.lastBanner = Date.now(); save();
    if (Date.now() - (S.settings.lastReminder || 0) < 30 * 6e4) return; // سجّلت من شوية
    showBanner();
  }
  setInterval(checkBanner, 30000);

  if (!S.settings.onboarded) { S.settings.onboarded = true; S.settings.seenVersion = APP_VERSION; save(); } // من غير نافذة ترحيب. الأرصدة الافتتاحية من الإعدادات
  applyTheme();
  render();
  scheduleRecur();
  checkUpdate();
  setInterval(checkUpdate, 10 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { checkUpdate(); if (!ui.sheet) render(); } });
  if (window.matchMedia) { const mq = window.matchMedia('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change', () => applyTheme()); }
  applyReminders(false);
  window.__mahfazty = { S: () => S, ui, render, engine, reminderTimes, checkBanner };
})();

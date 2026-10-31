/* محفظتي - محرك التذكير الذكي: يكتشف المصروفات والدخل المتكرر من العمليات ويتوقع الموعد القادم */
(function (root) {
  'use strict';
  const DAY = 864e5;
  const SOON = 3; // أيام التنبيه قبل الموعد
  const LATE_GRACE = 5; // أيام نعتبره فيها متأخر، بعدها نفترض إنه اتخطى ونعرض الدورة اللي بعدها
  const HORIZON = 45; // بنعرض المواعيد خلال كام يوم
  const NOLABEL_CATS = ['bills', 'telecom', 'debt', 'salary']; // تصنيفات بنعتبرها متكررة حتى من غير وصف
  const MAX_AGE = { week: 35, fortnight: 50, month: 100, year: 400 }; // لو آخر مرة أقدم من كده الدورة اتوقفت
  const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  const sod = (ts) => { const d = new Date(ts); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
  const addDays = (ts, n) => { const d = new Date(ts); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime(); };
  const dim = (y, m) => new Date(y, m + 1, 0).getDate();
  const monthIdx = (ts) => { const d = new Date(ts); return d.getFullYear() * 12 + d.getMonth(); };
  const median = (a) => { const s = a.slice().sort((x, y) => x - y); const h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
  const near = (g, p, tol) => Math.abs(g - p) <= tol;

  /* مفتاح التجميع: نفس النوع + نفس الوصف (من غير أرقام) */
  function keyOf(t, norm) {
    const lab = norm(t.label || '').replace(/[0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (lab) return t.type + '|' + lab;
    if (NOLABEL_CATS.indexOf(t.cat) >= 0) return t.type + '|#' + t.cat + '|' + (t.sub || '');
    return '';
  }

  /* days: أيام العمليات (بداية اليوم) مرتبة وغير مكررة */
  function detect(days) {
    const n = days.length; if (n < 2) return null;
    const gaps = []; const mg = [];
    for (let i = 1; i < n; i++) { gaps.push(Math.round((days[i] - days[i - 1]) / DAY)); mg.push(monthIdx(days[i]) - monthIdx(days[i - 1])); }
    if (n >= 3 && gaps.every((g) => near(g, 7, 1))) return { kind: 'week', step: 7, maxAge: MAX_AGE.week };
    if (n >= 3 && gaps.every((g) => near(g, 14, 2))) return { kind: 'fortnight', step: 14, maxAge: MAX_AGE.fortnight };
    const doms = days.map((d) => new Date(d).getDate());
    const eom = doms.every((d) => d >= 28);
    const spread = Math.max.apply(null, doms) - Math.min.apply(null, doms);
    if (mg.every((m) => m === 1) && (eom || spread <= 5)) return { kind: 'month', dom: eom ? 'eom' : Math.round(median(doms)), maxAge: MAX_AGE.month };
    if (gaps.every((g) => near(g, 365, 12))) { const l = new Date(days[n - 1]); return { kind: 'year', m: l.getMonth(), d: l.getDate(), maxAge: MAX_AGE.year }; }
    return null;
  }

  /* أول موعد بعد التاريخ ref */
  function nextAfter(p, ref) {
    const r = new Date(ref);
    if (p.kind === 'week' || p.kind === 'fortnight') return addDays(ref, p.step);
    if (p.kind === 'month') { const y = r.getFullYear(); const m = r.getMonth() + 1; const last = dim(y, m); return new Date(y, m, p.dom === 'eom' ? last : Math.min(p.dom, last)).getTime(); }
    return new Date(r.getFullYear() + 1, p.m, Math.min(p.d, dim(r.getFullYear() + 1, p.m))).getTime();
  }

  /* txs: كل العمليات. ignore: { مفتاح: true }. بيرجّع القائمة مرتبة بالأقرب موعداً */
  function compute(txs, now, norm, ignore) {
    const today = sod(now); const groups = {}; const out = [];
    (txs || []).forEach((t) => { if (t.type !== 'in' && t.type !== 'out') return; const k = keyOf(t, norm); if (k) (groups[k] = groups[k] || []).push(t); });
    Object.keys(groups).forEach((k) => {
      const byDay = {};
      groups[k].forEach((t) => { const d = sod(t.ts); const e = byDay[d] || (byDay[d] = { amt: 0, last: t }); e.amt += t.amount; if (t.ts >= e.last.ts) e.last = t; });
      const days = Object.keys(byDay).map(Number).sort((a, b) => a - b).slice(-6);
      const p = detect(days); if (!p) return;
      const lastDay = days[days.length - 1]; if (today - lastDay > p.maxAge * DAY) return;
      let due = nextAfter(p, lastDay); let guard = 0;
      while (due < today - LATE_GRACE * DAY && guard++ < 80) due = nextAfter(p, due);
      const daysLeft = Math.round((due - today) / DAY); if (daysLeft > HORIZON) return;
      const recent = days.slice(-3).map((d) => byDay[d].amt); const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const lt = byDay[lastDay].last;
      out.push({ key: k, type: lt.type, label: (lt.label || '').trim(), cat: lt.cat, sub: lt.sub || '', acc: lt.acc, avg: Math.round(avg * 100) / 100, count: days.length, pattern: p, last: lastDay, due, daysLeft, ignored: !!(ignore && ignore[k]) });
    });
    out.sort((a, b) => a.due - b.due);
    return out;
  }

  function dueText(n) {
    if (n < 0) return n === -1 ? 'متأخر يوم' : 'متأخر ' + (n === -2 ? 'يومين' : (-n) + ' أيام');
    if (n === 0) return 'النهارده'; if (n === 1) return 'بكرة'; if (n === 2) return 'بعد يومين';
    return n <= 10 ? 'بعد ' + n + ' أيام' : 'بعد ' + n + ' يوم';
  }
  function kindText(p) {
    if (p.kind === 'week') return 'أسبوعي'; if (p.kind === 'fortnight') return 'كل أسبوعين'; if (p.kind === 'year') return 'سنوي';
    return p.dom === 'eom' ? 'شهري · آخر الشهر' : 'شهري · يوم ' + p.dom;
  }
  const isUrgent = (l) => !l.ignored && l.daysLeft <= SOON;

  const api = { SOON, HORIZON, LATE_GRACE, WEEKDAYS, compute, detect, nextAfter, keyOf, dueText, kindText, isUrgent, addDays, sod };
  root.PayEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

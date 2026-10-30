/* محفظتي - المساعد الذكي (يعمل بالكامل على الجهاز بدون إنترنت)
 * 1) يفهم النص العامي ويستخرج المبالغ والبنود
 * 2) يصنّف كل بند بقاموس + سياق الرسالة + ما تعلمه من تصحيحاتك
 * 3) يجاوب على أسئلة زي "كام صرفت على الأكل الشهر ده؟"
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Assistant = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- تطبيع النص العربي ---------- */
  const norm = (s) => String(s == null ? '' : s)
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/٫/g, '.')
    .replace(/,(?=\d{3}(\D|$))/g, '')
    .replace(/[،؛;,؟?!]/g, ' ')
    .toLowerCase();

  /* ---------- التصنيفات ---------- */
  const CATS_OUT = [
    { id: 'food', name: 'طعام', color: '#B84A0B' },
    { id: 'vehicle', name: 'المركبة', color: '#4A3AA8' },
    { id: 'transport', name: 'مواصلات', color: '#0B6E6E' },
    { id: 'bills', name: 'فواتير', color: '#A8281C' },
    { id: 'telecom', name: 'اتصالات', color: '#2F6FB5' },
    { id: 'health', name: 'صحة', color: '#1F8A4C' },
    { id: 'clothes', name: 'ملابس', color: '#9B3F8E' },
    { id: 'edu', name: 'تعليم', color: '#7A5C00' },
    { id: 'fun', name: 'ترفيه', color: '#C2417A' },
    { id: 'home', name: 'المنزل', color: '#6B4F3A' },
    { id: 'care', name: 'عناية شخصية', color: '#3A7D8C' },
    { id: 'gifts', name: 'هدايا وتبرعات', color: '#8C5A1E' },
    { id: 'debt', name: 'ديون وأقساط', color: '#5A5A6E' },
    { id: 'other', name: 'أخرى', color: '#7A6A5C' },
  ];
  const CATS_IN = [
    { id: 'salary', name: 'راتب', color: '#0B6E6E' },
    { id: 'work', name: 'شغل حر', color: '#1F8A4C' },
    { id: 'gift_in', name: 'هدية ومكافأة', color: '#8C5A1E' },
    { id: 'refund', name: 'استرجاع', color: '#2F6FB5' },
    { id: 'in_other', name: 'دخل آخر', color: '#7A6A5C' },
  ];
  const CAT_BY_ID = {};
  CATS_OUT.concat(CATS_IN).forEach((c) => { CAT_BY_ID[c.id] = c; });

  const ACCOUNTS = [
    { id: 'cash', name: 'نقدي' },
    { id: 'wallet', name: 'محفظة' },
    { id: 'insta', name: 'انستا باي' },
  ];

  /* ---------- القاموس (كلمات عامية مصرية) ---------- */
  const DICT_RAW = {
    food: `فطار فطور غدا غداء عشا عشاء سحور اكل اكله اكلات لحمه لحم لحمة فراخ فرخه دجاج سمك سمكه جمبري رز ارز مكرونه معكرونه عيش خبز خضار خضروات فاكهه فواكه طماطم بطاطس بطاطا بصل ثوم خيار موز تفاح برتقال عنب مانجو جوافه فراوله جبنه جبن لبن حليب زبادي بيض بيضه زبده سمنه سكر شاي قهوه نسكافيه بقاله بقال سوبرماركت ماركت هايبر مطعم ساندوتش سندوتش ساندوتشات شاورما كشري فول طعميه فلافل بيتزا برجر كنتاكي ماكدونالدز مشروب مشروبات عصير بيبسي كوكاكولا كولا مياه معدنيه حلويات حلوه شيكولاته ايسكريم ايس دليفري طلبات جزار جزاره ملح بهارات دقيق شوربه ملوخيه محشي كباب كفته وجبه وجبات سناكس شيبسي بسكوت لب مكسرات عسل مربي توابل بامبوزه عيش بلدي فينو كرواسون فطير حواوشي كافيه كوفي نسكافيه كابتشينو ماتشا تسالي لب سودانی مخبوزات مخبز فرن`,
    vehicle: `بنزين سولار وقود تموين فلتر اطار كاوتش بطاريه عربيه عربيتي عربيتك سياره سيارتي موتوسيكل موتور موتوسيكلي ميكانيكي ميكانيكا ميكانيكى غسيل عربيه جراج ركنه رخصه مخالفه ترخيص كاوتشات بنشر ونش لمبه لمبات مساحات فرامل شكمان رديتر تيل تانك فتيس طرمبه كهربائي عربيات تفويل تغيير زيت اصلاح`,
    transport: `مواصلات اوبر كريم ميني ميكروباص تاكسي مترو اتوبيس باص قطار تذكره تذاكر سواق توصيله انديرايف تكتك سكوتر اجره اجرة نقل ركوبه موصلات تاكسى`,
    bills: `كهرباء نور فاتوره فواتير انترنت واي فاي وي اورنج ايجار قسط ضرايب عداد عدادات كارت شحن مياه فاتورة تلفزيون دش ريسيفر رسوم`,
    telecom: `رصيد باقه باقات خط خطوط شحن موبايل نت كارت فكه اتصالات فودافون اورنج تي ميني`,
    health: `دوا دواء ادويه صيدليه صيدلية دكتور طبيب كشف تحاليل تحليل اشعه عمليه مستشفي علاج فيتامين نضارة نضاره عدسات اسنان عيادة عياده مصل حقنه حقن اسعاف علاجات مكمل مكملات برشام شراب كحه`,
    clothes: `هدوم ملابس قميص بنطلون تيشرت فستان جاكت حذاء جزمه شوز شنطه حجاب عبايه جيبه بدله شراب كلوت كوتشي كوتشى لبس لبسي بيجامه فانله بلوفر شبشب مايوه`,
    edu: `مدرسه جامعه كورس كتاب كتب كشكول اقلام قلم دروس درس سنتر دراسه دراسي تعليم دبلومه ماجستير حضانه كراسه مذاكره تدريس اون لاين شهاده امتحان امتحانات`,
    fun: `سينما فيلم لعبه العاب نتفلكس شاهد خروجه رحله مصيف حفله بلايستيشن بلاي ستيشن فرجه ملاهي مسرح كونسرت مباراه ماتش ملعب بولينج كورة كوره هوايه يوتيوب سبوتيفاي`,
    home: `اثاث سباك نجار كهربائي منظفات صابون مسحوق شامبو ادوات منزليه مطبخ مفروشات تلاجه ثلاجه غساله بوتجاز سخان مراتب ديكور دهان نقاش سجاد ستاره ستائر مقشه كلور مبيد زبالة زباله بواب شغاله شغالة ترميم تشطيب مفتاح كالون سجاده`,
    care: `حلاق حلاقه كوافير كوافيره عطر مكياج كريم صالون جيم نادي مساج بشره شعر مزيل مراه ريحه ظافر مانيكير باديكير`,
    gifts: `هديه هدايا تبرع تبرعات صدقه زكاه كفاله فرح نقوطه واجب عزاء مجامله عيديه خيريه جمعيه خير كسوه`,
    debt: `سلفه سلف دين ديون قرض قروض قسط اقساط جمعيه فايده كارت ائتمان سداد`,
    salary: `راتب مرتب ماهيه مرتبات رواتب حافز حوافز`,
    work: `شغل مشروع عميل اتعاب عموله ارباح ربح مبيعات بيع بعت تصميم مشروعي فريلانس خدمه اجر اجره`,
    gift_in: `مكافاه بونص هديه عيديه منحه علاوه جايزه نقوط`,
    refund: `استرجاع مسترجع رجع مرتجع استرداد استردت`,
  };

  /* كلمات تحمل أكتر من معنى: الأولى هي الافتراضية، والسياق يحسم */
  const AMBIGUOUS_RAW = {
    زيت: ['food', 'vehicle'],
    'غاز': ['vehicle', 'bills'],
    ميه: ['bills', 'food'],
    صيانه: ['vehicle', 'home'],
    اشتراك: ['fun', 'bills'],
    ايجار: ['bills', 'home'],
    كهربائي: ['home', 'vehicle'],
    لبن: ['food'],
    شحن: ['telecom', 'vehicle'],
    كارت: ['telecom', 'bills'],
    كهرباء: ['bills', 'home'],
    نظافه: ['home', 'care'],
    غسيل: ['vehicle', 'home'],
    تامين: ['vehicle', 'health'],
    اصلاح: ['vehicle', 'home'],
    عمليه: ['health'],
  };

  const INCOME_WORDS = norm('قبضت استلمت استلمنا حصلت حولولي حولوا حولو وصلني وصلنا جالي جاني دخل ايراد ايرادات استرجعت رجعولي مرتب راتب ماهيه مكافاه بونص ارباح عيديه').split(/\s+/);
  const INCOME_VERBS = new Set(norm('قبضت استلمت استلمنا حصلت حولولي حولوا حولو وصلني وصلنا جالي جاني دخل ايراد ايرادات استرجعت رجعولي').split(/\s+/));
  const STOP = new Set(norm(`و في ف علي عن من الي الي ل لل ب بـ عشان ده دي دا كمان تاني برضو بعد قبل وقت لاحقا ثم بعدين اول الصبح بليل
    دفعت صرفت اشتريت اشتريه جبت جبنا اخدت دفع صرف كتبت سجل سجلي اضف ضيف حط حطي لي ليا انا بتاع بتاعت يعني يوم النهارده امبارح اليوم برده ايه حاجه حاجات شويه كذا`).split(/\s+/));
  const CURRENCY = new Set(norm('جنيه جنيها جنيهات جينه جني ج جم ج.م egp le l.e pound pounds').split(/\s+/));
  const GRADES = new Set(['80', '87', '90', '92', '95']);

  const NUM_WORDS = {
    واحد: 1, واحده: 1, اتنين: 2, اثنين: 2, تنين: 2, تلاته: 3, ثلاثه: 3, تلات: 3, اربعه: 4, اربع: 4, خمسه: 5, خمس: 5,
    سته: 6, ست: 6, سبعه: 7, سبع: 7, تمانيه: 8, ثمانيه: 8, تمن: 8, تسعه: 9, تسع: 9, عشره: 10, عشر: 10,
    احداشر: 11, اتناشر: 12, تلاتاشر: 13, اربعتاشر: 14, خمستاشر: 15, ستاشر: 16, سبعتاشر: 17, تمنتاشر: 18, تسعتاشر: 19,
    عشرين: 20, تلاتين: 30, ثلاثين: 30, اربعين: 40, خمسين: 50, ستين: 60, سبعين: 70, تمانين: 80, ثمانين: 80, تسعين: 90,
    ميه: 100, ميت: 100, مائه: 100, ميتين: 200, تلتميه: 300, تلاتميه: 300, ربعميه: 400, خمسميه: 500, ستميه: 600,
    سبعميه: 700, تمنميه: 800, تسعميه: 900, الف: 1000, الاف: 1000, الفين: 2000,
  };

  /* ---------- أدوات ---------- */
  function keyForms(w) {
    const s = new Set([w]);
    if (w.startsWith('ال') && w.length > 3) s.add(w.slice(2));
    for (const p of ['وال', 'بال', 'فال', 'كال', 'لل']) if (w.startsWith(p) && w.length > p.length + 2) s.add(w.slice(p.length));
    if (w.endsWith('ه') && w.length > 3) s.add(w.slice(0, -1));
    else if (w.length > 2) s.add(w + 'ه');
    if (w.endsWith('ات') && w.length > 4) { s.add(w.slice(0, -2)); s.add(w.slice(0, -2) + 'ه'); }
    if (w.endsWith('ين') && w.length > 5) s.add(w.slice(0, -2));
    if (w.endsWith('ي') && w.length > 4) s.add(w.slice(0, -1) + 'ه');
    return [...s];
  }
  function lev1(a, b) { // هل المسافة بين الكلمتين <= 1
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
    if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
    if (a.length > b.length) return a.slice(i + 1) === b.slice(i);
    return b.slice(i + 1) === a.slice(i);
  }
  const isNum = (t) => /^\d+(\.\d+)?$/.test(t);

  /* ---------- الكلمات الملتبسة (ثابتة) ---------- */
  const AMBIG = new Map();
  Object.keys(AMBIGUOUS_RAW).forEach((w) => {
    const nw = norm(w);
    keyForms(nw).forEach((k) => AMBIG.set(k, AMBIGUOUS_RAW[w]));
  });
  const PROTECTED = { other: 1, in_other: 1 }; // تصنيفات احتياطية لا تُحذف

  /* ---------- المحرك ---------- */
  function create(initialLearned) {
    const learned = initialLearned || {}; // { كلمة: { cat: عدد } , 'كلمتين تانيين': {...}, '#label': {...} }

    /* إعدادات التصنيفات من المستخدم: custom = تصنيفات جديدة، rename/color = تعديل الاسم واللون،
       hidden = تصنيفات مخفية، extra = كلمات مضافة لتصنيف جاهز، removed = كلمات محذوفة من تصنيف جاهز */
    let cfg = { custom: [], rename: {}, color: {}, hidden: [], extra: {}, removed: {} };
    let INDEX = new Map(); let USER = new Map(); let INDEX_KEYS = [];
    const isHidden = (id) => cfg.hidden.indexOf(id) >= 0;
    function rebuild() {
      INDEX = new Map(); USER = new Map();
      const add = (map, word, cat) => { keyForms(word).forEach((k) => { if (!map.has(k)) map.set(k, new Set()); map.get(k).add(cat); }); };
      Object.keys(DICT_RAW).forEach((cat) => {
        if (isHidden(cat)) return; const rem = new Set(cfg.removed[cat] || []);
        DICT_RAW[cat].split(/\s+/).forEach((raw) => { if (!raw || rem.has(raw)) return; const nw = norm(raw); if (nw.length > 1) add(INDEX, nw, cat); });
      });
      Object.keys(cfg.extra).forEach((cat) => { if (!isHidden(cat)) (cfg.extra[cat] || []).forEach((w) => { const nw = norm(w).trim(); if (nw.length > 1) add(USER, nw, cat); }); });
      cfg.custom.forEach((c) => (c.words || []).forEach((w) => { const nw = norm(w).trim(); if (nw.length > 1) add(USER, nw, c.id); }));
      INDEX_KEYS = Array.from(INDEX.keys());
    }
    function setConfig(c) {
      cfg = { custom: [], rename: {}, color: {}, hidden: [], extra: {}, removed: {} };
      if (c) Object.keys(cfg).forEach((k) => { if (c[k] != null) cfg[k] = c[k]; });
      rebuild();
    }
    const decorate = (c, type) => ({ id: c.id, name: cfg.rename[c.id] || c.name, color: cfg.color[c.id] || c.color, type, builtin: !c.custom });
    function catsOf(type) {
      const base = (type === 'in' ? CATS_IN : CATS_OUT).filter((c) => !isHidden(c.id));
      const lastId = type === 'in' ? 'in_other' : 'other';
      const main = base.filter((c) => c.id !== lastId).map((c) => decorate(c, type));
      const custom = cfg.custom.filter((c) => c.type === type).map((c) => decorate({ id: c.id, name: c.name, color: c.color, custom: true }, type));
      const last = base.filter((c) => c.id === lastId).map((c) => decorate(c, type));
      return main.concat(custom, last);
    }
    const catsOut = () => catsOf('out');
    const catsIn = () => catsOf('in');
    function catOf(id) {
      const f = catsOut().concat(catsIn()).find((c) => c.id === id);
      if (f) return f;
      const b = CAT_BY_ID[id]; // مخفي أو محذوف: نرجّع الاسم الأصلي عشان العمليات القديمة تفضل مفهومة
      if (b) return { id: b.id, name: cfg.rename[b.id] || b.name, color: b.color, type: CATS_IN.some((c) => c.id === id) ? 'in' : 'out', builtin: true, hidden: true };
      const cu = cfg.custom.find((c) => c.id === id); if (cu) return { id: cu.id, name: cu.name, color: cu.color, type: cu.type, builtin: false, hidden: true };
      return { id: 'other', name: 'أخرى', color: '#7A6A5C', type: 'out', builtin: true };
    }
    function effectiveWords(id) {
      if (CAT_BY_ID[id]) {
        const rem = new Set(cfg.removed[id] || []);
        const base = (DICT_RAW[id] || '').split(/\s+/).filter((w) => w && !rem.has(w)).map((w) => ({ w, user: false }));
        return base.concat((cfg.extra[id] || []).map((w) => ({ w, user: true })));
      }
      const c = cfg.custom.find((x) => x.id === id); return c ? (c.words || []).map((w) => ({ w, user: true })) : [];
    }
    const catsAll = () => catsOut().concat(catsIn());
    setConfig(null);

    const known = (w) => keyForms(w).some((f) => INDEX.has(f) || USER.has(f) || AMBIG.has(f) || learned[f]);

    function learnedFor(key) { return learned[key] || null; }

    function contentTokens(label) {
      return norm(label).split(/\s+/).filter((t) => t.length > 1 && !STOP.has(t) && !CURRENCY.has(t) && !isNum(t));
    }

    /* درجات التصنيف لبند واحد (بدون سياق) */
    function scoreLabel(label) {
      const toks = contentTokens(label);
      const score = {};
      const add = (c, v) => { score[c] = (score[c] || 0) + v; };
      toks.forEach((t) => {
        const forms = keyForms(t);
        let matched = false;
        // تعلّم المستخدم
        const lc = {};
        forms.forEach((f) => { const l = learnedFor(f); if (l) Object.keys(l).forEach((c) => { lc[c] = Math.max(lc[c] || 0, l[c]); }); });
        Object.keys(lc).forEach((c) => { add(c, Math.min(lc[c], 6) * 1.5); matched = true; });
        // كلمات أضافها المستخدم لتصنيف: لها الأولوية على القاموس
        const uc = new Set(); forms.forEach((f) => { if (USER.has(f)) USER.get(f).forEach((c) => uc.add(c)); });
        // قاموس
        let amb = null; const direct = new Set();
        if (!uc.size) forms.forEach((f) => { if (AMBIG.has(f)) amb = AMBIG.get(f); if (INDEX.has(f)) INDEX.get(f).forEach((c) => direct.add(c)); });
        if (uc.size) { uc.forEach((c) => add(c, 4.5)); matched = true; }
        else if (amb) { amb.forEach((c, i) => add(c, i === 0 ? 1.5 : 1.2)); matched = true; }
        else if (direct.size === 1) { add([...direct][0], 3); matched = true; }
        else if (direct.size > 1) { direct.forEach((c) => add(c, 1.6)); matched = true; }
        // مطابقة تقريبية للكلمات غير المعروفة (أخطاء إملائية)
        if (!matched && t.length >= 5) {
          const hit = new Set();
          for (const k of INDEX_KEYS) { if (Math.abs(k.length - t.length) <= 1 && k.length >= 4 && lev1(k, t)) INDEX.get(k).forEach((c) => hit.add(c)); }
          if (hit.size === 1) add([...hit][0], 2);
        }
      });
      // كلمتين ورا بعض + العنوان كامله
      for (let i = 0; i < toks.length - 1; i++) { const l = learnedFor(toks[i] + ' ' + toks[i + 1]); if (l) Object.keys(l).forEach((c) => add(c, Math.min(l[c], 6) * 2)); }
      if (toks.length) { const l = learnedFor('#' + toks.join(' ')); if (l) Object.keys(l).forEach((c) => add(c, Math.min(l[c], 6) * 2.5)); }
      return { score, toks };
    }

    function pick(score, ctx, type) {
      const s = Object.assign({}, score);
      const pool = (type === 'in' ? catsIn() : catsOut()).map((c) => c.id);
      if (ctx) Object.keys(ctx).forEach((c) => { if (s[c] != null) s[c] += Math.min(ctx[c], 2) * 1.5; });
      let ranked = Object.keys(s).filter((c) => pool.indexOf(c) >= 0 && s[c] > 0).sort((a, b) => s[b] - s[a]);
      if (!ranked.length) return { cat: type === 'in' ? 'in_other' : 'other', conf: 'low', ranked: [] };
      const top = s[ranked[0]]; const second = ranked[1] ? s[ranked[1]] : 0;
      const conf = top >= 3 && top - second >= 1 ? 'high' : (top - second >= 0.8 && top >= 1.5 ? 'mid' : 'low');
      return { cat: ranked[0], conf, ranked: ranked.slice(0, 3) };
    }

    /* تحويل الأرقام المكتوبة بالحروف (خمسين جنيه) */
    function convertNumberWords(tokens) {
      const hasDigits = tokens.some(isNum);
      const out = []; let i = 0;
      while (i < tokens.length) {
        if (NUM_WORDS[tokens[i]] != null) {
          let j = i; let total = 0; let cur = 0; const run = [];
          while (j < tokens.length && (NUM_WORDS[tokens[j]] != null || (tokens[j] === 'و' && NUM_WORDS[tokens[j + 1]] != null && j > i))) {
            const t = tokens[j];
            if (t !== 'و') {
              const v = NUM_WORDS[t];
              if ((t === 'الف' || t === 'الاف') && cur > 0 && cur < 1000) { total += cur * 1000; cur = 0; } else cur += v;
              run.push(t);
            }
            j++;
          }
          total += cur;
          const nextCur = tokens[j] != null && CURRENCY.has(tokens[j]);
          const weak = run.length === 1 && ['ميه', 'ميت', 'واحد', 'واحده', 'عشر', 'عشره', 'ست', 'سته', 'خمس', 'تمن', 'تلات', 'اربع', 'سبع', 'تسع'].indexOf(run[0]) >= 0;
          if (nextCur || (!hasDigits && !weak && j >= tokens.length - 0)) { out.push(String(total)); i = j; continue; }
          if (!hasDigits && !weak) { out.push(String(total)); i = j; continue; }
        }
        out.push(tokens[i]); i++;
      }
      return out;
    }

    /* ---------- تحليل رسالة كاملة ---------- */
    function parse(text) {
      let t = norm(text).replace(/(\d)([^\d\s.])/g, '$1 $2').replace(/([^\d\s.])(\d)/g, '$1 $2').replace(/\.(?!\d)/g, ' ').replace(/\s+/g, ' ').trim();
      if (!t) return { kind: 'empty', items: [] };
      let tokens = t.split(' ');
      // فصل حرف الواو الملتصق (وزيت -> و زيت)
      tokens = tokens.flatMap((w) => (w.length > 3 && w[0] === 'و' && !known(w) && known(w.slice(1)) ? ['و', w.slice(1)] : [w]));
      // رقم بعد "بنزين" هو غالبا الدرجة (92)
      tokens = convertNumberWords(tokens);

      // سؤال؟
      const hasNum = tokens.some(isNum);
      if (!hasNum && /(^| )(كام|قد ايه|اد ايه|ايه هو|اكتر|اعلي|متوسط|اجمالي|مجموع|وفرت|معايا|رصيدي|فاضل)( |$)/.test(tokens.join(' '))) return { kind: 'query', text: tokens.join(' ') };

      const dateOffset = /اول امبارح|أول امبارح/.test(tokens.join(' ')) ? -2 : (tokens.indexOf('امبارح') >= 0 ? -1 : 0);

      // تحويل بين الحسابات
      const joined = tokens.join(' ');
      const accIn = (s) => accountsIn(s);
      if (/(^| )(حولت|سحبت|ايدعت|ودعت|حوّلت|ايداع|سحب|حول)( |$)/.test(joined) && hasNum) {
        const amt = parseFloat(tokens.find(isNum));
        const mFrom = joined.match(/من ([^ ]+(?: باي| كاش)?)/); const mTo = joined.match(/(?:^| )(?:لل|ل|الي|الى|علي|ع) ?([^ ]+(?: باي| كاش)?)/);
        let from = mFrom ? accIn(mFrom[1])[0] : null; let to = mTo ? accIn(mTo[1])[0] : null;
        const all = accIn(joined);
        if (/(^| )(سحبت|سحب)( |$)/.test(joined) && !to) { from = from || all[0] || 'insta'; to = 'cash'; }
        if (/(^| )(ايدعت|ودعت|ايداع)( |$)/.test(joined) && !from) { to = to || all[0] || 'insta'; from = 'cash'; }
        if (!from && all.length === 2) { from = all[0]; to = all[1]; }
        if (from && to && from !== to && amt > 0) return { kind: 'transfer', amount: amt, from, to, dateOffset };
      }

      // مواقع الأرقام (مع استبعاد درجة البنزين)
      const numIdx = [];
      tokens.forEach((tk, i) => {
        if (!isNum(tk)) return;
        const prev = tokens[i - 1];
        const isGrade = GRADES.has(tk) && (prev === 'بنزين' || prev === 'سولار') && tokens.some((x, k) => k !== i && isNum(x));
        if (!isGrade) numIdx.push(i);
      });
      if (!numIdx.length) return { kind: 'entry', items: [], dateOffset };
      // "جنيه" بعد الرقم ملصوق بيه
      const gaps = [];
      for (let k = 0; k <= numIdx.length; k++) {
        const a = k === 0 ? 0 : numIdx[k - 1] + 1; const b = k === numIdx.length ? tokens.length : numIdx[k];
        gaps.push(tokens.slice(a, b));
      }
      const meaningful = (arr) => arr.filter((x) => !STOP.has(x) && !CURRENCY.has(x) && !isNum(x) || (isNum(x) && GRADES.has(x)));
      const afterStyle = meaningful(gaps[0]).length === 0;
      const labels = numIdx.map(() => []);
      const accIsolate = [];
      if (!afterStyle) labels[0] = labels[0].concat(gaps[0]);
      for (let k = 1; k < numIdx.length; k++) {
        const g = gaps[k]; let p = -1;
        for (let q = g.length - 1; q >= 0; q--) { if (g[q] === 'و' || g[q] === 'ثم' || g[q] === 'بعدين') { p = q; break; } }
        let left; let right;
        if (p >= 0) { left = g.slice(0, p); right = g.slice(p + 1); } else if (afterStyle) { left = g; right = []; } else { left = []; right = g; }
        labels[k - 1] = labels[k - 1].concat(left);
        labels[k] = labels[k].concat(right);
      }
      labels[numIdx.length - 1] = labels[numIdx.length - 1].concat(gaps[numIdx.length]);
      if (afterStyle) labels[0] = labels[0].concat(gaps[0]); // كلمات تمهيدية مثل "دفعت من انستا"

      // بناء البنود
      const messageAccs = accountsIn(tokens.join(' '));
      const msgIncome = tokens.some((x) => INCOME_VERBS.has(x));
      const items = numIdx.map((ti, k) => {
        let amount = parseFloat(tokens[ti]);
        // 5 الف
        if (tokens[ti + 1] === 'الف' || tokens[ti + 1] === 'الاف') { amount *= 1000; }
        const raw = labels[k];
        const acc = accountsIn(raw.join(' '))[0] || (messageAccs.length === 1 ? messageAccs[0] : null);
        const labelToks = raw.filter((x) => !STOP.has(x) && !CURRENCY.has(x) && x !== 'الف' && x !== 'الاف' && !ACC_WORDS.has(x) && !INCOME_VERBS.has(x) && !/^(نقدا|نقدي|كاش|انستا|انستاباي|instapay|باي|فودافون|محفظه|محفظتي)$/.test(x));
        const label = labelToks.join(' ').trim();
        const incomeHit = msgIncome || labelToks.some((x) => INCOME_WORDS.indexOf(x) >= 0 && ['راتب', 'مرتب', 'ماهيه', 'مكافاه', 'بونص', 'ارباح', 'عيديه', 'ايراد', 'ايرادات', 'دخل'].indexOf(x) >= 0);
        const type = incomeHit ? 'in' : 'out';
        const sc = scoreLabel(label);
        return { amount, label: label || '', acc, type, _sc: sc };
      });
      // السياق: التصنيفات الواضحة في باقي البنود
      const strong = items.map((it) => { const p = pick(it._sc.score, null, it.type); return p.conf === 'high' ? p.cat : null; });
      items.forEach((it, i) => {
        const ctx = {};
        strong.forEach((c, j) => { if (c && j !== i) ctx[c] = (ctx[c] || 0) + 1; });
        const p = pick(it._sc.score, ctx, it.type);
        it.cat = p.cat; it.conf = p.conf; it.candidates = p.ranked;
        // السياق حسم كلمة ملتبسة؟
        it.usedContext = !!(Object.keys(ctx).length && p.ranked.length && !!ctx[p.cat]);
        delete it._sc;
      });
      return { kind: 'entry', items, dateOffset };
    }

    /* ---------- التعلّم ---------- */
    function learn(label, cat, wasCorrection) {
      const toks = contentTokens(label);
      if (!toks.length || !cat || cat === 'other' && !wasCorrection) return;
      const inc = wasCorrection ? 3 : 1;
      const bump = (key) => { const k = key; learned[k] = learned[k] || {}; learned[k][cat] = Math.min((learned[k][cat] || 0) + inc, 12); };
      toks.forEach((t) => { if (!AMBIG.has(t) && !wasCorrection && INDEX.has(t) && INDEX.get(t).has(cat) && INDEX.get(t).size === 1) return; bump(keyForms(t)[keyForms(t).length > 1 && t.startsWith('ال') ? 1 : 0]); });
      for (let i = 0; i < toks.length - 1; i++) bump(toks[i] + ' ' + toks[i + 1]);
      bump('#' + toks.join(' '));
    }
    function forget(key) { delete learned[key]; }

    /* ---------- أسئلة ---------- */
    function answer(text, txs, now, accountBalances) {
      const q = norm(text); const toks = q.split(/\s+/);
      const fmt = (n) => Math.round(n).toLocaleString('en-US');
      const d0 = new Date(now); const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      let from = new Date(d0.getFullYear(), d0.getMonth(), 1).getTime(); let to = Infinity; let scope = 'الشهر ده';
      const has = (re) => re.test(q);
      if (has(/النهارده|اليوم/)) { from = startOf(d0); to = from + 864e5; scope = 'النهارده'; }
      else if (has(/اول امبارح/)) { from = startOf(d0) - 2 * 864e5; to = from + 864e5; scope = 'أول امبارح'; }
      else if (has(/امبارح/)) { from = startOf(d0) - 864e5; to = from + 864e5; scope = 'امبارح'; }
      else if (has(/الاسبوع/)) { from = startOf(d0) - 6 * 864e5; scope = 'آخر 7 أيام'; }
      else if (has(/الشهر (اللي|الي) فات|الشهر الماضي/)) { from = new Date(d0.getFullYear(), d0.getMonth() - 1, 1).getTime(); to = new Date(d0.getFullYear(), d0.getMonth(), 1).getTime(); scope = 'الشهر اللي فات'; }
      else if (has(/السنه|السنة|العام/)) { from = new Date(d0.getFullYear(), 0, 1).getTime(); scope = 'السنة دي'; }
      const inRange = txs.filter((x) => x.ts >= from && x.ts < to && x.type !== 'xfer');
      // تصنيف مذكور؟
      let cat = null;
      for (const c of catsAll()) { if (q.indexOf(norm(c.name)) >= 0) { cat = c.id; break; } }
      if (!cat) {
        const lbl = toks.filter((x) => x.length > 2 && !STOP.has(x) && !/^(كام|صرفت|دخل|قد|اد|ايه|الشهر|الاسبوع|النهارده|امبارح|السنه|ده|دي|اجمالي|مجموع|علي|على|اكتر|متوسط)$/.test(x));
        if (lbl.length) { const s = scoreLabel(lbl.join(' ')); const p = pick(s.score, null, 'out'); if (p.conf !== 'low' || s.score[p.cat] >= 1.5) cat = p.cat === 'other' ? null : p.cat; }
      }
      const sum = (arr) => arr.reduce((a, b) => a + b.amount, 0);
      if (has(/رصيد|معايا|فاضل/) && accountBalances) {
        const tot = accountBalances.cash + accountBalances.wallet + accountBalances.insta;
        return `رصيدك الكلي ${fmt(tot)} ج.م: نقدي ${fmt(accountBalances.cash)}، محفظة ${fmt(accountBalances.wallet)}، انستا باي ${fmt(accountBalances.insta)}.`;
      }
      if (has(/اكتر|اعلي|اغلي/)) {
        const by = {}; inRange.filter((x) => x.type === 'out').forEach((x) => { by[x.cat] = (by[x.cat] || 0) + x.amount; });
        const top = Object.keys(by).sort((a, b) => by[b] - by[a])[0];
        if (!top) return `مفيش مصروفات مسجلة ${scope}.`;
        return `أكتر حاجة صرفت عليها ${scope} هي ${catOf(top).name}: ${fmt(by[top])} ج.م.`;
      }
      if (has(/وفرت|صافي|الصافي/)) {
        const inc = sum(inRange.filter((x) => x.type === 'in')); const out = sum(inRange.filter((x) => x.type === 'out'));
        return `${scope}: دخل ${fmt(inc)} ومصروف ${fmt(out)}، يعني الصافي ${inc - out >= 0 ? '+' : '-'}${fmt(Math.abs(inc - out))} ج.م.`;
      }
      if (has(/متوسط/)) {
        const out = inRange.filter((x) => x.type === 'out'); const days = Math.max(1, Math.ceil((Math.min(Date.now(), to) - from) / 864e5));
        return `متوسط مصروفك اليومي ${scope} حوالي ${fmt(sum(out) / days)} ج.م.`;
      }
      const wantIn = has(/دخل|ايراد|قبضت|استلمت|مرتب|راتب/) && !has(/صرفت|مصروف/);
      const list = inRange.filter((x) => x.type === (wantIn ? 'in' : 'out') && (!cat || x.cat === cat));
      const label = cat ? catOf(cat).name : (wantIn ? 'الدخل' : 'المصروفات');
      if (!list.length) return `مفيش ${wantIn ? 'دخل' : 'مصروفات'} ${cat ? 'في ' + label + ' ' : ''}مسجلة ${scope}.`;
      return `${wantIn ? 'دخلك' : 'صرفت'} ${cat ? 'على ' + label : 'إجمالي'} ${scope}: ${fmt(sum(list))} ج.م (${list.length} عملية).`;
    }

    return { parse, learn, forget, answer, scoreLabel, pick, learned, setConfig, getConfig: () => cfg, catsOut, catsIn, catsAll, catOf, effectiveWords, PROTECTED };
  }

  /* ---------- الحسابات ---------- */
  const ACC_WORDS = new Set(['انستا', 'انستاباي', 'instapay', 'محفظه', 'فودافون', 'كاش', 'نقدي', 'نقدا', 'باي', 'اورنج', 'محفظتي']);
  function accountsIn(s) {
    const out = [];
    const re = /(فودافون كاش|فودافون|اورنج كاش|اتصالات كاش|وي كاش|محفظتي|محفظه|انستا ?باي|انستا|instapay|نقدا|نقدي|كاش|cash|من جيبي)/g;
    let m;
    while ((m = re.exec(s))) {
      const w = m[1];
      let id = 'cash';
      if (/فودافون|اورنج|اتصالات|وي كاش|محفظ/.test(w)) id = 'wallet';
      else if (/انستا|instapay/.test(w)) id = 'insta';
      out.push(id);
    }
    return out;
  }

  return { create, norm, CATS_OUT, CATS_IN, CAT_BY_ID, ACCOUNTS };
});

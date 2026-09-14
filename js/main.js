/* ==========================================================================
   كلاسيك نوار — سكربت الصفحة
   ========================================================================== */
(function () {
  'use strict';

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- الأرقام العربية ---------- */
  var AR = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

  function toAr(n) {
    return String(n).replace(/\d/g, function (d) { return AR[+d]; });
  }
  function toEn(s) {
    return String(s)
      .replace(/[٠-٩]/g, function (d) { return d.charCodeAt(0) - 0x0660; })
      .replace(/[۰-۹]/g, function (d) { return d.charCodeAt(0) - 0x06F0; });
  }

  /* ---------- تخزين آمن ---------- */
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* تجاهل */ } }
  };

  /* ---------- إشعار ---------- */
  var noteEl = $('#toast');
  var noteTimer;
  function note(msg) {
    if (!noteEl) return;
    noteEl.textContent = msg;
    noteEl.classList.add('is-up');
    clearTimeout(noteTimer);
    noteTimer = setTimeout(function () { noteEl.classList.remove('is-up'); }, 3000);
  }

  /* ---------- العدّاد ---------- */
  (function countdown() {
    var h = $('#cdH'), m = $('#cdM'), s = $('#cdS');
    if (!h) return;

    var SPAN = 6 * 60 * 60 * 1000; // نافذة ٦ ساعات لكل زائر
    var end = parseInt(store.get('offerEnd'), 10);

    if (!end || isNaN(end) || end < Date.now()) {
      end = Date.now() + SPAN;
      store.set('offerEnd', String(end));
    }

    function pad(n) { return toAr(n < 10 ? '0' + n : n); }

    function tick() {
      var left = Math.max(0, end - Date.now());
      var t = Math.floor(left / 1000);
      h.textContent = pad(Math.floor(t / 3600));
      m.textContent = pad(Math.floor(t % 3600 / 60));
      s.textContent = pad(t % 60);
      if (left <= 0) {
        end = Date.now() + SPAN;
        store.set('offerEnd', String(end));
      }
    }

    tick();
    setInterval(tick, 1000);
  })();

  /* ---------- الدفعة المتبقية ---------- */
  (function batch() {
    var el = $('#stockLeft');
    var fill = $('#meterFill');
    if (!el || !fill) return;

    var left = 7;
    setInterval(function () {
      if (left > 3 && Math.random() > 0.6) {
        left--;
        el.textContent = toAr(left);
        fill.style.width = Math.round(left / 30 * 100) + '%';
      }
    }, 25000);
  })();

  /* ---------- الأسعار ---------- */
  var PRICES = { 1: 199, 2: 349, 3: 479 };

  var qty      = $('#qty');
  var sumQty   = $('#sumQty');
  var sumPrice = $('#sumPrice');
  var sumTotal = $('#sumTotal');

  function chosen() {
    var q = qty ? parseInt(qty.value, 10) : 2;
    return PRICES[q] ? q : 2;
  }

  function sync() {
    var q = chosen();
    var price = PRICES[q];

    if (sumQty)   sumQty.textContent   = toAr(q);
    if (sumPrice) sumPrice.textContent = toAr(price);
    if (sumTotal) sumTotal.textContent = toAr(price);

    // يُستعلم في كل مرة لأن زر الإرسال يُعاد بناؤه بعد الإرسال
    var bt = $('#btnTotal');
    if (bt) bt.textContent = toAr(price);

    $$('.ladder__row').forEach(function (row) {
      row.classList.toggle('is-on', parseInt(row.dataset.qty, 10) === q);
    });
  }

  if (qty) qty.addEventListener('change', sync);

  $$('.ladder__row').forEach(function (row) {
    row.addEventListener('click', function () {
      if (qty) qty.value = row.dataset.qty;
      sync();
      note('تم اختيار ' + row.querySelector('b').textContent + ' — أكمل بياناتك');
      var target = $('#order');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  sync();

  /* ---------- النموذج ---------- */
  var form = $('#orderForm');

  var RULES = {
    name: function (v) {
      if (!v) return 'اكتب اسمك من فضلك';
      if (v.length < 3) return 'الاسم قصير جداً';
      return '';
    },
    phone: function (v) {
      var d = toEn(v).replace(/[\s\-()]/g, '');
      if (!d) return 'اكتب رقم جوالك';
      if (!/^(?:\+?9665|05|5)\d{8}$/.test(d)) return 'رقم غير صحيح — مثال: 0512345678';
      return '';
    },
    city: function (v) { return v ? '' : 'اختر مدينتك'; },
    address: function (v) {
      if (!v) return 'اكتب عنوانك';
      if (v.length < 10) return 'أضف تفاصيل أكثر ليصلك الطلب';
      return '';
    }
  };

  function mark(name, msg) {
    var input = form.elements[name];
    var box = input.closest('.f');
    var err = $('.err[data-err="' + name + '"]', form);
    if (box) box.classList.toggle('bad', !!msg);
    if (err) err.textContent = msg;
    return !msg;
  }

  function check(name) {
    return mark(name, RULES[name](form.elements[name].value.trim()));
  }

  if (form) {
    Object.keys(RULES).forEach(function (name) {
      var input = form.elements[name];
      if (!input) return;
      input.addEventListener('blur', function () { check(name); });
      input.addEventListener('input', function () {
        var box = input.closest('.f');
        if (box && box.classList.contains('bad')) check(name);
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var first = null;
      Object.keys(RULES).forEach(function (name) {
        if (!check(name) && !first) first = form.elements[name];
      });

      if (first) {
        first.focus();
        first.scrollIntoView({ behavior: 'smooth', block: 'center' });
        note('راجع الحقول المطلوبة');
        return;
      }

      var btn = $('#submitBtn');
      var label = btn.innerHTML;
      btn.disabled = true;
      btn.textContent = 'جارٍ الإرسال…';

      // محاكاة — استبدلها باستدعاء الواجهة البرمجية الحقيقية
      setTimeout(function () {
        var order = {
          name: form.elements.name.value.trim(),
          phone: toEn(form.elements.phone.value).replace(/\s/g, ''),
          city: form.elements.city.value,
          address: form.elements.address.value.trim(),
          notes: form.elements.notes.value.trim(),
          qty: chosen(),
          total: PRICES[chosen()],
          createdAt: new Date().toISOString()
        };
        store.set('lastOrder', JSON.stringify(order));

        var no = $('#orderNo');
        if (no) no.textContent = '#' + toAr(Math.floor(10000 + Math.random() * 89999));

        $('#success').hidden = false;
        btn.disabled = false;
        btn.innerHTML = label;
        sync();
        note('تم استلام طلبك');
      }, 1000);
    });

    var again = $('#newOrder');
    if (again) {
      again.addEventListener('click', function () {
        form.reset();
        $('#success').hidden = true;
        $$('.f.bad', form).forEach(function (f) { f.classList.remove('bad'); });
        $$('.err', form).forEach(function (f) { f.textContent = ''; });
        sync();
      });
    }
  }

  /* ---------- الأسئلة ---------- */
  $$('.faq__q').forEach(function (q) {
    q.addEventListener('click', function () {
      var item = q.parentElement;
      var panel = $('.faq__a', item);
      var open = item.classList.contains('is-open');

      $$('.faq__i').forEach(function (other) {
        other.classList.remove('is-open');
        $('.faq__a', other).style.maxHeight = null;
      });

      if (!open) {
        item.classList.add('is-open');
        panel.style.maxHeight = panel.scrollHeight + 'px';
      }
    });
  });

  /* ---------- ظهور تدريجي ---------- */
  (function rise() {
    var sel = '.hero__body,.hero__shot,.sec__head,.notes li,.spec,.words figure,' +
              '.ladder,.batch,.recap,.form,.faq,.close__in,.plate__cap';
    var items = $$(sel);

    if (!('IntersectionObserver' in window)) return;

    items.forEach(function (el) { el.classList.add('rise'); });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -30px' });

    items.forEach(function (el) { io.observe(el); });
  })();

  /* ---------- التمرير ---------- */
  (function scroll() {
    var head = $('#head');
    var dock = $('#dock');
    var orderSec = $('#order');

    function update() {
      var y = window.pageYOffset;
      if (head) head.classList.toggle('is-stuck', y > 8);

      if (dock && orderSec) {
        var r = orderSec.getBoundingClientRect();
        var inside = r.top < window.innerHeight && r.bottom > 0;
        dock.classList.toggle('is-up', y > 480 && !inside);
      }
    }

    window.addEventListener('scroll', update, { passive: true });
    update();
  })();

  /* ---------- السنة ---------- */
  var year = $('#year');
  if (year) year.textContent = toAr(new Date().getFullYear());

})();

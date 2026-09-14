/* ==========================================================================
   الساعة الكلاسيكية السوداء — سكربت الصفحة
   ========================================================================== */
(function () {
  'use strict';

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- الأرقام العربية ---------- */
  var AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

  function toAr(n) {
    return String(n).replace(/\d/g, function (d) { return AR_DIGITS[+d]; });
  }
  function toEn(str) {
    return String(str)
      .replace(/[٠-٩]/g, function (d) { return d.charCodeAt(0) - 0x0660; })
      .replace(/[۰-۹]/g, function (d) { return d.charCodeAt(0) - 0x06F0; });
  }

  /* ---------- تخزين آمن ---------- */
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* تجاهل */ } }
  };

  /* ---------- الإشعارات ---------- */
  var toastEl = $('#toast');
  var toastTimer;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-visible'); }, 3200);
  }

  /* ---------- العداد التنازلي ---------- */
  (function countdown() {
    var hEl = $('#cdH'), mEl = $('#cdM'), sEl = $('#cdS');
    if (!hEl) return;

    var WINDOW_MS = 6 * 60 * 60 * 1000; // ٦ ساعات لكل زائر
    var deadline = parseInt(store.get('offerDeadline'), 10);

    if (!deadline || isNaN(deadline) || deadline < Date.now()) {
      deadline = Date.now() + WINDOW_MS;
      store.set('offerDeadline', String(deadline));
    }

    function pad(n) { return toAr(n < 10 ? '0' + n : n); }

    function tick() {
      var left = Math.max(0, deadline - Date.now());
      var total = Math.floor(left / 1000);
      hEl.textContent = pad(Math.floor(total / 3600));
      mEl.textContent = pad(Math.floor(total % 3600 / 60));
      sEl.textContent = pad(total % 60);
      if (left <= 0) {
        // إعادة تشغيل النافذة حتى يبقى العرض متاحاً
        deadline = Date.now() + WINDOW_MS;
        store.set('offerDeadline', String(deadline));
      }
    }

    tick();
    setInterval(tick, 1000);
  })();

  /* ---------- المشاهدون والمخزون ---------- */
  (function liveSignals() {
    var viewers = $('#liveViewers');
    var stockEl = $('#stockLeft');
    var bar = $('.stock__bar i');
    var count = 14;
    var stock = 7;

    if (viewers) {
      setInterval(function () {
        count += Math.floor(Math.random() * 5) - 2;
        count = Math.min(38, Math.max(9, count));
        viewers.textContent = toAr(count);
      }, 5000);
    }

    if (stockEl && bar) {
      setInterval(function () {
        if (stock > 3 && Math.random() > 0.65) {
          stock--;
          stockEl.textContent = toAr(stock);
          bar.style.width = Math.round(stock / 30 * 100) + '%';
        }
      }, 22000);
    }
  })();

  /* ---------- الأسعار والعروض ---------- */
  var PRICES = { 1: 199, 2: 349, 3: 479 };

  var qtySelect = $('#qty');
  var sumQty    = $('#sumQty');
  var sumPrice  = $('#sumPrice');
  var sumTotal  = $('#sumTotal');

  function currentQty() {
    var q = qtySelect ? parseInt(qtySelect.value, 10) : 2;
    return PRICES[q] ? q : 2;
  }

  function syncSummary() {
    var q = currentQty();
    var price = PRICES[q];
    if (sumQty)   sumQty.textContent   = toAr(q);
    if (sumPrice) sumPrice.textContent = toAr(price);
    if (sumTotal) sumTotal.textContent = toAr(price);
    // يُعاد استعلامه في كل مرة لأن زر الإرسال يُعاد بناؤه بعد الإرسال
    var btnTotal = $('#btnTotal');
    if (btnTotal) btnTotal.textContent = toAr(price);

    $$('.offer').forEach(function (o) {
      o.classList.toggle('is-active', parseInt(o.dataset.qty, 10) === q);
    });
  }

  if (qtySelect) qtySelect.addEventListener('change', syncSummary);

  $$('.offer').forEach(function (offer) {
    offer.addEventListener('click', function () {
      var q = offer.dataset.qty;
      if (qtySelect) qtySelect.value = q;
      syncSummary();
      toast('تم اختيار العرض ✓ أكمل بياناتك بالأسفل');
      var target = $('#order');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  syncSummary();

  /* ---------- التحقق من النموذج ---------- */
  var form = $('#orderForm');

  var RULES = {
    name: function (v) {
      if (!v) return 'الرجاء كتابة الاسم';
      if (v.length < 3) return 'الاسم قصير جداً';
      return '';
    },
    phone: function (v) {
      var digits = toEn(v).replace(/[\s\-()]/g, '');
      if (!digits) return 'الرجاء كتابة رقم الجوال';
      if (!/^(?:\+?9665|05|5)\d{8}$/.test(digits)) return 'رقم الجوال غير صحيح (مثال: 0512345678)';
      return '';
    },
    city: function (v) { return v ? '' : 'الرجاء اختيار المدينة'; },
    address: function (v) {
      if (!v) return 'الرجاء كتابة العنوان';
      if (v.length < 10) return 'أضف تفاصيل أكثر للعنوان';
      return '';
    }
  };

  function setError(name, msg) {
    var input = form.elements[name];
    var box = input.closest('.field');
    var err = $('.err[data-err="' + name + '"]', form);
    if (box) box.classList.toggle('has-error', !!msg);
    if (err) err.textContent = msg;
    return !msg;
  }

  function validateField(name) {
    var input = form.elements[name];
    return setError(name, RULES[name](input.value.trim()));
  }

  if (form) {
    Object.keys(RULES).forEach(function (name) {
      var input = form.elements[name];
      if (!input) return;
      input.addEventListener('blur', function () { validateField(name); });
      input.addEventListener('input', function () {
        var box = input.closest('.field');
        if (box && box.classList.contains('has-error')) validateField(name);
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var firstInvalid = null;
      Object.keys(RULES).forEach(function (name) {
        if (!validateField(name) && !firstInvalid) firstInvalid = form.elements[name];
      });

      if (firstInvalid) {
        firstInvalid.focus();
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        toast('الرجاء تصحيح الحقول المطلوبة');
        return;
      }

      var btn = $('#submitBtn');
      var original = btn.innerHTML;
      btn.disabled = true;
      btn.textContent = 'جارٍ إرسال الطلب…';

      // محاكاة الإرسال — استبدلها باستدعاء الـ API الحقيقي عند الربط
      setTimeout(function () {
        var order = {
          name: form.elements.name.value.trim(),
          phone: toEn(form.elements.phone.value).replace(/\s/g, ''),
          city: form.elements.city.value,
          address: form.elements.address.value.trim(),
          notes: form.elements.notes.value.trim(),
          qty: currentQty(),
          total: PRICES[currentQty()],
          createdAt: new Date().toISOString()
        };
        store.set('lastOrder', JSON.stringify(order));

        var no = $('#orderNo');
        if (no) no.textContent = '#' + toAr(Math.floor(10000 + Math.random() * 89999));

        $('#success').hidden = false;
        btn.disabled = false;
        btn.innerHTML = original;
        syncSummary();
        toast('تم إرسال طلبك بنجاح 🎉');
      }, 1200);
    });

    var newOrder = $('#newOrder');
    if (newOrder) {
      newOrder.addEventListener('click', function () {
        form.reset();
        $('#success').hidden = true;
        $$('.field.has-error', form).forEach(function (f) { f.classList.remove('has-error'); });
        $$('.err', form).forEach(function (f) { f.textContent = ''; });
        syncSummary();
      });
    }
  }

  /* ---------- الأسئلة الشائعة ---------- */
  $$('.faq__q').forEach(function (q) {
    q.addEventListener('click', function () {
      var item = q.parentElement;
      var panel = $('.faq__a', item);
      var isOpen = item.classList.contains('is-open');

      $$('.faq__item').forEach(function (other) {
        other.classList.remove('is-open');
        $('.faq__a', other).style.maxHeight = null;
      });

      if (!isOpen) {
        item.classList.add('is-open');
        panel.style.maxHeight = panel.scrollHeight + 'px';
      }
    });
  });

  /* ---------- الظهور عند التمرير ---------- */
  (function reveal() {
    var items = $$('.reveal');
    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px' });
    items.forEach(function (el) { io.observe(el); });
  })();

  /* ---------- الهيدر والشريط الثابت ---------- */
  (function onScroll() {
    var header = $('#header');
    var bar = $('#stickyBar');
    var orderSection = $('#order');

    function update() {
      var y = window.pageYOffset;
      if (header) header.classList.toggle('is-scrolled', y > 10);

      if (bar && orderSection) {
        var rect = orderSection.getBoundingClientRect();
        var inOrder = rect.top < window.innerHeight && rect.bottom > 0;
        bar.classList.toggle('is-visible', y > 500 && !inOrder);
      }
    }

    window.addEventListener('scroll', update, { passive: true });
    update();
  })();

  /* ---------- السنة ---------- */
  var year = $('#year');
  if (year) year.textContent = toAr(new Date().getFullYear());

})();

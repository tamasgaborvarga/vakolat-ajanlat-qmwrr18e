/* Paletta Vakolatcentrum — kliensoldali viselkedés.
   Szándékosan kevés: mobilmenü, nyitvatartás-jelző, terméskeresés,
   galéria-nagyítás, finom megjelenés görgetéskor. Keretrendszer nélkül. */

(function () {
  'use strict';

  /* ---------------------------------------------------------- fejléc ---- */
  var hdr = document.querySelector('.hdr');
  if (hdr) {
    var onScroll = function () {
      if (window.scrollY > 8) hdr.setAttribute('data-stuck', '');
      else hdr.removeAttribute('data-stuck');
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ------------------------------------------------------ mobilmenü ---- */
  var burger = document.querySelector('.burger');
  var mnav = document.querySelector('.mnav');
  if (burger && mnav) {
    burger.addEventListener('click', function () {
      var open = burger.getAttribute('aria-expanded') === 'true';
      burger.setAttribute('aria-expanded', String(!open));
      if (open) mnav.removeAttribute('data-open');
      else mnav.setAttribute('data-open', '');
    });
    mnav.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        burger.setAttribute('aria-expanded', 'false');
        mnav.removeAttribute('data-open');
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') {
        burger.setAttribute('aria-expanded', 'false');
        mnav.removeAttribute('data-open');
        burger.focus();
      }
    });
  }

  /* ------------------------------------------------- nyitvatartás-jelző --
     A nyitvatartási adat a DOM-ban van (data-hours), így egyetlen forrásból
     jön. Az idő MINDIG Europe/Budapest szerint számolódik, nem a látogató
     saját időzónája szerint. */
  function budapestNow() {
    // en-US rövid napnév: stabil, nem függ a látogató nyelvi beállításától
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Budapest',
      weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(new Date());
    var get = function (t) {
      for (var i = 0; i < parts.length; i++) if (parts[i].type === t) return parts[i].value;
      return '';
    };
    var map = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
    var idx = map[get('weekday')];
    if (idx === undefined) idx = (new Date().getDay() + 6) % 7; // hétfő = 0
    var h = parseInt(get('hour'), 10);
    if (h === 24) h = 0; // egyes motorok éjfélkor 24-et adnak
    // a mai budapesti dátum ÉÉÉÉ-HH-NN alakban (sv-SE ezt adja)
    var ymd = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Budapest' }).format(new Date());
    return { day: idx, mins: h * 60 + parseInt(get('minute'), 10), ymd: ymd };
  }

  /* ------------------------------------------- rendkívüli zárva tartás --
     data-closures = { elore: napok, napok: [{tol, ig, szoveg}] } (data/site.js) */
  function addDays(ymd, n) {
    var p = ymd.split('-');
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n));
    return d.toISOString().slice(0, 10);
  }
  function closedOn(closures, ymd) {
    if (!closures) return null;
    for (var i = 0; i < closures.napok.length; i++) {
      var c = closures.napok[i];
      if (ymd >= c.tol && ymd <= c.ig) return c;
    }
    return null;
  }
  var HO = ['január', 'február', 'március', 'április', 'május', 'június', 'július',
    'augusztus', 'szeptember', 'október', 'november', 'december'];
  function huDay(ymd) {
    var p = ymd.split('-');
    return HO[+p[1] - 1] + ' ' + (+p[2]) + '.';
  }
  function readClosures(el) {
    try { return JSON.parse(el.getAttribute('data-closures')); } catch (e) { return null; }
  }

  var band = document.querySelector('.closure');
  if (band) {
    var cl = readClosures(band);
    var today = budapestNow().ymd;
    var hit = null;
    if (cl) {
      for (var ci = 0; ci < cl.napok.length; ci++) {
        var c = cl.napok[ci];
        if (today <= c.ig && today >= addDays(c.tol, -cl.elore)) { hit = c; break; }
      }
    }
    if (hit) {
      var range = hit.tol === hit.ig ? huDay(hit.tol) : huDay(hit.tol) + ' – ' + huDay(hit.ig);
      band.querySelector('.closure-when').textContent =
        (today >= hit.tol ? 'Ma zárva tartunk' : 'Rendkívüli zárva tartás') + ' (' + range + ').';
      band.querySelector('.closure-txt').textContent = hit.szoveg;
      band.hidden = false;
    }
  }

  function toMin(s) {
    var a = s.split(':');
    return parseInt(a[0], 10) * 60 + parseInt(a[1], 10);
  }

  var statusEls = document.querySelectorAll('[data-hours]');
  statusEls.forEach(function (el) {
    var hours;
    try { hours = JSON.parse(el.getAttribute('data-hours')); } catch (e) { return; }
    var now = budapestNow();
    var closures = readClosures(el);
    var today = closedOn(closures, now.ymd) ? null : hours[now.day];
    var open = false;
    var text;

    if (today && today.nyit && today.zar) {
      var o = toMin(today.nyit), c = toMin(today.zar);
      if (now.mins >= o && now.mins < c) {
        open = true;
        text = 'Most nyitva · ' + today.zar + '-ig';
      } else if (now.mins < o) {
        text = 'Most zárva · ma ' + today.nyit + '-kor nyit';
      }
    }
    if (!open && !text) {
      // a következő nyitási nap megkeresése
      // a következő nyitási nap — a rendkívüli zárva tartást átugorva
      var next = null;
      for (var i = 1; i <= 40; i++) {
        var d = hours[(now.day + i) % 7];
        var dYmD = addDays(now.ymd, i);
        if (d && d.nyit && !closedOn(closures, dYmD)) { next = { d: d, offset: i, ymd: dYmD }; break; }
      }
      text = !next
        ? 'Most zárva'
        : 'Most zárva · ' + (next.offset === 1 ? 'holnap'
          : next.offset < 7 ? next.d.nap.toLowerCase() : huDay(next.ymd)) +
          ' ' + next.d.nyit + '-kor nyit';
    }
    el.setAttribute('data-open', open ? '1' : '0');
    var t = el.querySelector('.status-text');
    if (t) t.textContent = text;
  });

  // mai sor kiemelése a nyitvatartási táblázatban
  document.querySelectorAll('table.hours').forEach(function (tbl) {
    var idx = budapestNow().day;
    var rows = tbl.querySelectorAll('tbody tr');
    if (rows[idx]) rows[idx].setAttribute('data-today', '');
  });

  /* --------------------------------------------------- terméskeresés ---- */
  var list = document.querySelector('[data-prodlist]');
  if (list) {
    var q = document.querySelector('#q');
    var catSel = document.querySelector('#cat');
    var brandSel = document.querySelector('#brand');
    var countEl = document.querySelector('[data-count]');
    var emptyEl = document.querySelector('[data-empty]');
    var items = Array.prototype.slice.call(list.querySelectorAll('[data-search]'));

    // ékezetfüggetlen keresés: „glett" és „glettelő", „fugazo" és „fugázó" is találjon
    var norm = function (s) {
      return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    };

    var apply = function () {
      var term = norm((q && q.value || '').trim());
      var cat = catSel ? catSel.value : '';
      var brand = brandSel ? brandSel.value : '';
      var shown = 0;
      items.forEach(function (it) {
        var ok = true;
        if (cat && it.getAttribute('data-cat') !== cat) ok = false;
        if (ok && brand && it.getAttribute('data-brand') !== brand) ok = false;
        if (ok && term && norm(it.getAttribute('data-search')).indexOf(term) === -1) ok = false;
        it.hidden = !ok;
        if (ok) shown++;
      });
      if (countEl) {
        countEl.textContent = shown === items.length
          ? items.length + ' termék'
          : shown + ' találat · ' + items.length + ' termékből';
      }
      if (emptyEl) emptyEl.hidden = shown !== 0;
      var url = new URL(window.location.href);
      if (term) url.searchParams.set('q', q.value.trim()); else url.searchParams.delete('q');
      if (cat) url.searchParams.set('kategoria', cat); else url.searchParams.delete('kategoria');
      if (brand) url.searchParams.set('marka', brand); else url.searchParams.delete('marka');
      history.replaceState(null, '', url.pathname + (url.search || ''));
    };

    // kezdőállapot a címsorból
    var init = new URL(window.location.href).searchParams;
    if (q && init.get('q')) q.value = init.get('q');
    if (catSel && init.get('kategoria')) catSel.value = init.get('kategoria');
    if (brandSel && init.get('marka')) brandSel.value = init.get('marka');

    var t = null;
    if (q) q.addEventListener('input', function () {
      clearTimeout(t); t = setTimeout(apply, 120);
    });
    if (catSel) catSel.addEventListener('change', apply);
    if (brandSel) brandSel.addEventListener('change', apply);
    apply();
  }

  /* ------------------------------------------------------- galéria ------ */
  var gal = document.querySelector('[data-gallery]');
  var lb = document.querySelector('dialog.lb');
  if (gal && lb && typeof lb.showModal === 'function') {
    var figs = Array.prototype.slice.call(gal.querySelectorAll('button'));
    var img = lb.querySelector('img');
    var cap = lb.querySelector('[data-cap]');
    var pos = lb.querySelector('[data-pos]');
    var cur = 0;

    var show = function (i) {
      cur = (i + figs.length) % figs.length;
      var b = figs[cur];
      img.src = b.getAttribute('data-full');
      img.alt = b.getAttribute('data-alt') || '';
      if (cap) cap.textContent = b.getAttribute('data-alt') || '';
      if (pos) pos.textContent = (cur + 1) + ' / ' + figs.length;
    };

    figs.forEach(function (b, i) {
      b.addEventListener('click', function () { show(i); lb.showModal(); });
    });
    lb.querySelector('[data-prev]').addEventListener('click', function () { show(cur - 1); });
    lb.querySelector('[data-next]').addEventListener('click', function () { show(cur + 1); });
    lb.querySelector('[data-close]').addEventListener('click', function () { lb.close(); });
    lb.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); show(cur + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(cur - 1); }
    });
    lb.addEventListener('click', function (e) { if (e.target === lb) lb.close(); });
    lb.addEventListener('close', function () { if (figs[cur]) figs[cur].focus(); });
  }

  /* ------------------------------------------ projektválasztó (tabok) --
     WAI-ARIA tabs: kattintás, ←/→/↑/↓, Home/End. JS nélkül minden panel látszik. */
  document.querySelectorAll('[data-tabs]').forEach(function (box) {
    var tabs = Array.prototype.slice.call(box.querySelectorAll('[role=tab]'));
    var list = box.querySelector('[role=tablist]');
    var select = function (i, focus) {
      tabs.forEach(function (t, j) {
        var on = i === j;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tabs[i].focus();
      // mobilon a vízszintes chipsorban a kiválasztott látszódjon
      if (list.scrollWidth > list.clientWidth) {
        list.scrollTo({ left: tabs[i].offsetLeft - 16, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
    };
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(i, false); });
      t.addEventListener('keydown', function (e) {
        var k = e.key, n = tabs.length, to = null;
        if (k === 'ArrowRight' || k === 'ArrowDown') to = (i + 1) % n;
        else if (k === 'ArrowLeft' || k === 'ArrowUp') to = (i - 1 + n) % n;
        else if (k === 'Home') to = 0;
        else if (k === 'End') to = n - 1;
        if (to !== null) { e.preventDefault(); select(to, true); }
      });
    });
    tabs.forEach(function (t, i) { document.getElementById(t.getAttribute('aria-controls')).hidden = i !== 0; });
  });

  /* ------------------------------------------------ görgetéses felfedés --
     [data-rv] / [data-rv-group] a nézetbe érve kapja az .is-in osztályt
     (CSS végzi az animációt). A .js osztály nélkül minden látható. */
  var rvEls = document.querySelectorAll('[data-rv], [data-rv-group]');
  var reveal = function (el) {
    el.classList.add('is-in');
    // a lépcsőzés után a kártyák hover-átmenete visszaáll (lásd CSS .is-done)
    setTimeout(function () { el.classList.add('is-done'); }, 1100);
  };
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { reveal(en.target); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    rvEls.forEach(function (el) { io.observe(el); });
  } else {
    rvEls.forEach(reveal);
  }

  /* --------------------------------------------------- ajánlatkérés ----
     Végpont nélkül kitöltött e-mailt nyit (mailto) — bármilyen tárhelyen
     működik. Ha a form `data-endpoint`-ot kap, oda küld POST-tal, fájllal. */
  var form = document.querySelector('form[data-quote]');
  if (form) {
    var endpoint = form.getAttribute('data-endpoint');
    var msg = form.querySelector('[data-msg]');
    var say = function (t, ok) {
      msg.textContent = t;
      msg.setAttribute('data-ok', ok ? '1' : '0');
      msg.hidden = false;
      msg.focus();
    };
    // termékoldalról érkezve (?termek=…) a termék neve előre bekerül a listába
    // projektválasztóból (?munka=…) a munka fajtája kerül előre
    var qs = new URL(window.location.href).searchParams;
    var termek = qs.get('termek'), munka = qs.get('munka');
    var lista = form.querySelector('#q-lista');
    if (lista && !lista.value) {
      if (termek) lista.value = 'Termék: ' + termek.slice(0, 120) + '\n';
      else if (munka) lista.value = 'Munka: ' + munka.slice(0, 80) + '\n';
    }
    var fileIn = form.querySelector('input[type=file]');
    var maxMB = +form.getAttribute('data-maxmb') || 10;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = Array.prototype.filter.call(form.elements, function (el) { return el.willValidate && !el.checkValidity(); });
      if (bad.length) {
        var names = bad.map(function (el) { return el.getAttribute('data-nev') || el.name; });
        say('Kérjük, töltse ki: ' + names.join(', ') + '.', false);
        bad[0].focus();
        return;
      }
      var f = new FormData(form);
      if (f.get('weboldal')) return; // csapda-mező: robot

      if (fileIn && fileIn.files[0] && fileIn.files[0].size > maxMB * 1048576) {
        say('A csatolt fájl nagyobb ' + maxMB + ' MB-nál. Kérjük, kisebbet válasszon.', false);
        return;
      }

      if (!endpoint) {
        var lines = [
          'Név: ' + f.get('nev'),
          'Telefon: ' + f.get('telefon'),
          'E-mail: ' + (f.get('email') || '—'),
          'Település: ' + (f.get('telepules') || '—'),
          'Kiszállítást kér: ' + (f.get('szallitas') ? 'igen' : 'nem'),
          '',
          'Anyaglista / kérdés:',
          f.get('lista'),
        ];
        var href = 'mailto:' + form.getAttribute('data-to') +
          '?subject=' + encodeURIComponent('Ajánlatkérés — ' + f.get('nev')) +
          '&body=' + encodeURIComponent(lines.join(String.fromCharCode(13, 10)));
        window.location.href = href;
        say('Megnyílt a levelezője a kitöltött üzenettel — ott küldje el. Tervrajzot, fotót ott tud csatolni. Ha nem nyílt meg semmi, írjon a ' + form.getAttribute('data-to') + ' címre.', true);
        return;
      }

      var btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      fetch(endpoint, { method: 'POST', body: f, headers: { Accept: 'application/json' } })
        .then(function (r) {
          if (!r.ok) throw new Error(r.status);
          form.reset();
          say('Köszönjük, megkaptuk. Hamarosan jelentkezünk a megadott telefonszámon.', true);
        })
        .catch(function () {
          say('A küldés nem sikerült. Kérjük, hívjon minket, vagy írjon a ' + form.getAttribute('data-to') + ' címre.', false);
        })
        .then(function () { btn.disabled = false; btn.removeAttribute('aria-busy'); });
    });
  }

})();

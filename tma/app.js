/* ============================================================================
   БАЗА — Telegram Mini App
   ----------------------------------------------------------------------------
   Работает поверх store.js, как и сайт с админ-панелью: те же тарифы,
   та же схема зала, те же брони.

   Telegram-обвязка:
     ready() / expand()      — сигнал «приложение загрузилось»;
     MainButton              — бронь без длинного скролла;
     BackButton              — закрыть диалог;
     HapticFeedback          — тактильный отклик;
     themeParams             — цвета темы Telegram;
     CloudStorage            — сохраняем имя/телефон между запусками;
     initDataUnsafe.user     — подпись аккаунта (только для показа имени,
                               авторизацию на сервере здесь не делаем).

   ДЕМО-РЕЖИМ: бронь живёт в localStorage этого клиента. Общего сервера нет,
   поэтому панель клуба на другом устройстве её не увидит. Под боевой режим
   в store.js подменяются только функции записи — интерфейс не меняется.
   ========================================================================= */
(function () {
  'use strict';

  /* ----------------------------------------------------------- Telegram --- */
  const tg = (window.Telegram && window.Telegram.WebApp) || null;
  const isTelegram = !!tg && !!(tg.initData || tg.platform !== 'unknown');

  /* Безопасные вызовы: вне Telegram скрипт мог не загрузиться. */
  const MainButton = {
    el: isTelegram ? tg.MainButton : null,
    show(text, onClick) {
      if (!this.el) return;
      this.el.setText(text);
      this.el.offClick(this._h);
      this._h = onClick;
      this.el.onClick(onClick);
      this.el.show();
    },
    hide() { if (this.el) { this.el.offClick(this._h); this.el.hide(); } },
    get visible() { return !!(this.el && this.el.isVisible); },
  };

  function haptic(kind) {
    if (isTelegram && tg.HapticFeedback) {
      if (kind === 'ok' || kind === 'err' || kind === 'warn') {
        tg.HapticFeedback.notificationOccurred(kind);
      } else {
        tg.HapticFeedback.impactOccurred(kind || 'light');
      }
    } else if (navigator.vibrate) {
      navigator.vibrate(kind === 'ok' || kind === 'err' ? 18 : 8);
    }
  }

  function applyTheme() {
    if (!isTelegram || !tg.themeParams) return;
    const p = tg.themeParams;
    const set = (k, v) => { if (v) document.documentElement.style.setProperty(k, v); };
    set('--tg-bg',     p.bg_color);
    set('--tg-text',   p.text_color);
    set('--tg-hint',   p.hint_color);
    set('--tg-link',   p.link_color);
    set('--tg-btn',    p.button_color);
    set('--tg-btntext', p.button_text_color);
    set('--tg-sec',    p.secondary_bg_color);
  }

  /* --------------------------------------------------------------- утилиты --- */
  const $ = s => document.querySelector(s);
  const data = () => BAZA.get();

  const esc = s => String(s === null || s === undefined ? '' : s)
    .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const money = n => Number(n || 0).toLocaleString('ru-RU') + ' ₽';

  const DOW = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

  const svg = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';

  const ICON = {
    pin:  '<path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    city: '<path d="M3 21h18M5 21V7l7-4v18M19 21V11l-4-2"/><path d="M9 21v-4M9 10h.01M9 13h.01M16 13h.01M16 16h.01"/>',
    time: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    call: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  };

  const slotLabel = id => (data().slots.find(s => s.id === id) || { label: id }).label;
  const zoneName  = id => (data().zones.find(z => z.id === id) || { name: id }).name;

  function priceText(tariff, slot) {
    const t = data().tariffs[tariff];
    if (!t) return '';
    return money(t.price[slot] || 0) + (t.hourly ? '/ч' : '');
  }

  /* ----------------------------------------------------------------- стейт --- */
  const state = {
    day: BAZA.dateKey(),
    slot: 'night',
    sel: null,             // {zoneId, seat, tariff}
    saved: null,           // данные клиента из Telegram CloudStorage
  };

  /* ------------------------------------------------------------------ тост --- */
  function toast(text, kind) {
    const el = document.createElement('div');
    el.className = 'toast' + (kind === 'err' ? ' toast--err' : '');
    el.setAttribute('role', 'status');
    el.textContent = text;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('toast--in'));
    setTimeout(() => {
      el.classList.remove('toast--in');
      setTimeout(() => el.remove(), 320);
    }, 3400);
  }

  /* ============================================================ ЗАГОЛОВОК === */
  function renderTop() {
    const c = data().club;

    $('#mHours').textContent = c.openFrom + ' — ' + c.openTo;
    $('#mCity').textContent = c.city;
    $('#mPay').textContent = c.payments;

    $('#cAddr').textContent = c.address;
    $('#cCity').textContent = c.city;
    $('#cHours').textContent = c.openFrom + ' — ' + c.openTo;
    $('#cPay').textContent = c.payments;
    $('#footName').textContent = c.name + ' — ' + c.sub;
    $('#footNote').textContent = (c.telegram && c.telegram.webhook)
      ? 'Заявка сразу уходит администратору, он подтвердит бронь и зарезервирует место.'
      : 'Через Telegram Mini App. Пока бот не подключён к серверу, бронь хранится в этом устройстве.';

    if (c.phone) {
      $('#cPhoneRow').hidden = false;
      $('#cPhone').textContent = c.phone;
    }

    const open = BAZA.isOpenAt();
    $('#openDot').dataset.closed = open ? '0' : '1';
    $('#openText').textContent = open ? 'открыто сейчас' : statusWhenClosed();

    /* аккаунт Telegram — только для подстановки имени */
    const u = isTelegram && tg.initDataUnsafe ? tg.initDataUnsafe.user : null;
    if (u) {
      $('#who').hidden = false;
      $('#whoName').textContent = u.first_name || '';
      if (u.photo_url) $('#whoAvatar').src = u.photo_url;
      else $('#whoAvatar').remove();
    }
  }

  function statusWhenClosed() {
    const today = BAZA.dateKey();
    const now = new Date();
    for (let i = 0; i < 8; i++) {
      const d = BAZA.addDays(now, i);
      const key = BAZA.dateKey(d);
      const h = BAZA.hoursFor(key);
      if (!h) continue;
      const o = h.open.split(':').map(Number);
      const c = h.close.split(':').map(Number);
      const oM = o[0] * 60 + o[1];
      const cM = (c[0] * 60 + c[1]) <= oM ? c[0] * 60 + c[1] + 1440 : c[0] * 60 + c[1];
      const cur = d.toDateString() === now.toDateString()
        ? now.getHours() * 60 + now.getMinutes() : -1;
      if (cur < oM || cur < cM) {
        if (i === 0) return 'сегодня в ' + h.open;
        return DOW[d.getDay()] + ', ' + d.getDate() + ' ' + MON[d.getMonth()] + ' в ' + h.open;
      }
    }
    return 'закрыто';
  }

  /* ============================================================== ТАРИФЫ === */
  function renderTariffs() {
    const d = data();
    const cards = Object.entries(d.tariffs).map(([key, t]) => `
      <article class="tcard${t.featured ? ' tcard--flag' : ''}">
        <div class="tcard__head">
          <h3>${esc(t.name)}</h3>
          ${t.featured ? '<span class="badge badge--acc">топ</span>' : ''}
          ${t.hourly ? '<span class="badge badge--warn">по часам</span>' : ''}
        </div>
        <div class="tcard__p">${esc(money(t.price[state.slot] || 0))}${t.hourly ? '/ч' : ''}</div>
        <p class="tcard__d">${esc(t.desc)}</p>
        <p class="tcard__s">${esc(t.specs.slice(0, 3).map(r => r[0] + ': ' + r[1]).join(' · '))}</p>
      </article>`).join('');
    $('#tCards').innerHTML = cards;
  }

  /* =============================================================== ДАТЫ === */
  function renderDates() {
    const now = new Date();
    const html = [];
    for (let i = 0; i < 14; i++) {
      const d = BAZA.addDays(now, i);
      const key = BAZA.dateKey(d);
      const closed = !BAZA.hoursFor(key);
      html.push(`
        <button class="date${closed ? ' date--closed' : ''}" type="button"
                data-day="${key}" aria-pressed="${key === state.day}"
                ${closed ? 'disabled' : ''}>
          <span class="date__dow">${i === 0 ? 'сегодня' : DOW[d.getDay()]}</span>
          <span class="date__n">${d.getDate()}</span>
        </button>`);
    }
    $('#dates').innerHTML = html.join('');
  }

  /* =============================================================== СЛОТЫ === */
  function renderSlots() {
    const d = data();
    $('#slots').innerHTML = d.slots.map(s => {
      const free = countFree(state.day, s.id);
      const full = s.id === 'full';
      return `<button class="slot${full ? ' slot--full' : ''}" type="button"
                data-slot="${esc(s.id)}" aria-pressed="${s.id === state.slot}"
                ${free === 0 ? 'disabled' : ''}>
        <span class="slot__l">${esc(s.label)} · ${esc(s.time)}</span>
        <span class="slot__t">${free === 0 ? 'мест нет' : 'свободно ' + free}</span>
      </button>`;
    }).join('');
  }

  function countFree(day, slot) {
    let n = 0;
    data().zones.forEach(z => z.seats.forEach(id => {
      if (!BAZA.isSeatBusy(day, slot, z.id, id).busy) n++;
    }));
    return n;
  }

  /* ============================================================== МЕСТА === */
  function renderSeats() {
    const d = data();
    const hours = BAZA.hoursFor(state.day);
    const notice = $('#closedNotice');

    if (!hours) {
      notice.hidden = false;
      notice.className = 'notice';
      notice.textContent = 'В этот день клуб не работает. Выбери другую дату.';
      $('#seatMap').innerHTML = '';
      $('#summary').hidden = true;
      $('#freeBadge').textContent = 'выходной';
      MainButton.hide();
      $('#mbHint').classList.remove('mb-hint--on');
      return;
    }
    notice.hidden = true;

    const free = countFree(state.day, state.slot);
    $('#freeBadge').textContent = 'свободно ' + free;
    $('#zoneCount').textContent = 'слот ' + slotLabel(state.slot);

    $('#seatMap').innerHTML = d.zones.map(z => {
      const t = d.tariffs[z.tariff];
      const rows = z.seats.map(id => {
        const st = BAZA.isSeatBusy(state.day, state.slot, z.id, id);
        const sel = state.sel && state.sel.zoneId === z.id && state.sel.seat === id;
        const cls = sel ? 'seat--sel' : st.busy ? 'seat--taken' : 'seat--free';
        return `<button class="seat ${cls}" type="button" data-zone="${esc(z.id)}" data-seat="${esc(id)}"
                  aria-pressed="${!!sel}" ${st.busy && !sel ? 'disabled' : ''}
                  title="${st.busy ? 'Место занято' : 'Выбрать место ' + esc(id)}">
          <span class="seat__id">${esc(id)}</span>
          <span class="seat__p">${esc(priceText(z.tariff, state.slot))}</span>
        </button>`;
      }).join('');
      return `<div class="zone">
        <div class="zone__head">
          <h3>${esc(z.name)}</h3>
          <span class="badge badge--muted">${esc(t ? t.name : z.tariff)}</span>
          <span class="zone__cnt">${z.seats.length}</span>
        </div>
        <div class="seats">${rows}</div>
      </div>`;
    }).join('');
  }

  /* ============================================================== ИТОГ === */
  function renderSummary() {
    const box = $('#summary');
    if (!state.sel) {
      box.hidden = true;
      MainButton.hide();
      $('#mbHint').classList.remove('mb-hint--on');
      return;
    }

    box.hidden = false;
    $('#sSeat').textContent = state.sel.seat + ' · ' + zoneName(state.sel.zoneId);
    $('#sWhen').textContent = formatWhen(state.day, state.slot);
    $('#sTariff').textContent = data().tariffs[state.sel.tariff].name;
    $('#sTotal').textContent = priceText(state.sel.tariff, state.slot);
    $('#resetBtn').hidden = false;

    MainButton.show('Забронировать ' + priceText(state.sel.tariff, state.slot), openDialog);
  }

  function formatWhen(day, slot) {
    const d = new Date(day + 'T12:00:00');
    const s = data().slots.find(x => x.id === slot);
    const base = DOW[d.getDay()] + ', ' + d.getDate() + ' ' + MON[d.getMonth()];
    return base + (s ? ' · ' + s.time : '');
  }

  /* =========================================================== ДИАЛОГ === */
  const dlg = $('#bookDlg');
  let pending = null;

  function openDialog() {
    if (!state.sel) return;
    pending = { ...state.sel };
    const when = formatWhen(state.day, state.slot);

    $('#dlgSummary').innerHTML =
      esc('Место ' + pending.seat + ' · ' + zoneName(pending.zoneId)) + '<br>' +
      esc(when) + '<br>' +
      esc('Тариф: ' + data().tariffs[pending.tariff].name);

    $('#dlgTotal').textContent = priceText(pending.tariff, state.slot);
    $('#bkMsg').hidden = true;

    if (state.saved) {
      if (state.saved.name) $('#bkName').value = state.saved.name;
      if (state.saved.phone) $('#bkPhone').value = state.saved.phone;
    }

    dlg.showModal();
    haptic('light');
    if (isTelegram && tg.BackButton) {
      tg.BackButton.offClick(closeDialog);
      tg.BackButton.onClick(closeDialog);
      tg.BackButton.show();
    }
    setTimeout(() => $('#bkName').focus(), 120);
  }

  function closeDialog() {
    dlg.close();
    if (isTelegram && tg.BackButton) tg.BackButton.hide();
  }

  function dlMsg(text) {
    const el = $('#bkMsg');
    el.textContent = text;
    el.hidden = false;
    haptic('err');
  }

  $('#bookForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#bkName').value.trim();
    const phone = $('#bkPhone').value.trim();

    if (!name) return dlMsg('Напиши, как к тебе обращаться.');
    if (!phone) return dlMsg('Оставь телефон, администратору надо будет подтвердить бронь.');
    if (phone.replace(/\D/g, '').length < 10) return dlMsg('Телефон выглядит коротким — проверь цифры.');

    /* повторная проверка: место могли занять, пока открывался диалог */
    if (BAZA.isSeatBusy(state.day, state.slot, pending.zoneId, pending.seat).busy) {
      dlMsg('Это место только что заняли. Выбери другое.');
      closeDialog();
      state.sel = null;
      renderSeats();
      renderSummary();
      return;
    }

    const b = BAZA.createBooking({
      date: state.day, slot: state.slot,
      zoneId: pending.zoneId, seat: pending.seat, tariff: pending.tariff,
      client: name, phone: phone,
      total: data().tariffs[pending.tariff].price[state.slot] || 0,
      by: (isTelegram && tg.initDataUnsafe && tg.initDataUnsafe.user)
        ? ('tg:' + tg.initDataUnsafe.user.id)
        : 'miniapp',
    });

    saveCloud(name, phone);
    closeDialog();
    haptic('ok');

    state.sel = null;
    renderSeats();
    renderSummary();
    renderSlots();
    renderTariffs();

    toast('Место ' + b.seat + ' забронировано на ' + formatWhen(b.date, b.slot));

    /* Если задан адрес приёма заявок — сообщаем боту, он напишет администратору. */
    notifyBooking(b).then(ok => {
      if (ok) toast('Заявка отправлена администратору');
      else if ((data().club.telegram || {}).webhook) toast('Бронь сохранена, но бот не ответил', 'err');
    });
  });

  /* Бронь -> бот -> личка администратора.
     В демо-режиме club.telegram.webhook пуст, и заявка остаётся только
     в этом устройстве: уведомления без сервера быть не может. */
  function notifyBooking(b) {
    var cfg = data().club.telegram || {};
    if (!cfg.webhook) return Promise.resolve(false);

    var headers = { 'Content-Type': 'application/json' };
    if (cfg.secret) headers['X-Baza-Secret'] = cfg.secret;

    var tgUser = (isTelegram && tg.initDataUnsafe && tg.initDataUnsafe.user)
      ? String(tg.initDataUnsafe.user.id) : '';

    return fetch(cfg.webhook, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        date: b.date,
        slot: b.slot,
        when: formatWhen(b.date, b.slot),
        zoneId: b.zoneId,
        zone: zoneName(b.zoneId),
        seat: b.seat,
        tariff: b.tariff,
        client: b.client,
        phone: b.phone,
        total: money(b.total),
        tgUser: tgUser,
      }),
    }).then(function (r) { return r.ok; }).catch(function () { return false; });
  }

  /* Клиентские данные храним в облаке Telegram, чтобы не вводить каждый раз.
     Приватность: это хранилище клиента, не наш сервер. */
  function saveCloud(name, phone) {
    state.saved = { name: name, phone: phone };
    if (!isTelegram || !tg.CloudStorage) return;
    try {
      tg.CloudStorage.setItem('bkName', name);
      tg.CloudStorage.setItem('bkPhone', phone);
    } catch (err) { /* квота или приватный режим — не критично */ }
  }
  function loadCloud(done) {
    if (!isTelegram || !tg.CloudStorage) return done(null);
    let got = 0;
    const out = {};
    const tick = () => { if (++got >= 2) done(out); };
    try {
      tg.CloudStorage.getItem('bkName', v => { out.name = v; tick(); });
      tg.CloudStorage.getItem('bkPhone', v => { out.phone = v; tick(); });
    } catch (err) { done(null); }
  }

  /* ============================================================ СОБЫТИЯ === */
  $('#dates').addEventListener('click', e => {
    const b = e.target.closest('[data-day]');
    if (!b || b.disabled) return;
    state.day = b.dataset.day;
    state.sel = null;
    haptic('light');
    renderAll();
  });

  $('#slots').addEventListener('click', e => {
    const b = e.target.closest('[data-slot]');
    if (!b || b.disabled) return;
    state.slot = b.dataset.slot;
    state.sel = null;
    haptic('light');
    renderAll();
  });

  $('#seatMap').addEventListener('click', e => {
    const b = e.target.closest('[data-seat]');
    if (!b || b.disabled) return;
    const zoneId = b.dataset.zone;
    const seat = b.dataset.seat;
    const z = data().zones.find(x => x.id === zoneId);
    state.sel = { zoneId: zoneId, seat: seat, tariff: z.tariff };
    haptic('light');
    renderSeats();
    renderSummary();
    /* показываем выбранное место */
    b.scrollIntoView({ block: 'nearest' });
  });

  $('#bookBtn').addEventListener('click', openDialog);
  $('#resetBtn').addEventListener('click', () => {
    state.sel = null;
    renderSeats();
    renderSummary();
  });
  $('#bookClose').addEventListener('click', closeDialog);
  $('#bookCancel').addEventListener('click', closeDialog);
  dlg.addEventListener('click', e => { if (e.target === dlg) closeDialog(); });

  /* =============================================================== СТАРТ === */
  function renderAll() {
    renderDates();
    renderSlots();
    renderSeats();
    renderSummary();
    renderTariffs();
  }

  function boot() {
    applyTheme();
    renderTop();
    renderAll();

    loadCloud(v => { state.saved = v; });

    if (isTelegram) {
      tg.ready();
      tg.expand();

      /* настройку темы/аккаунта меняют только когда Mini App открыт в Telegram */
      if (tg.onEvent) {
        tg.onEvent('themeChanged', () => { applyTheme(); renderTop(); });
        tg.onEvent('viewportChanged', () => { if (!tg.isExpanded) tg.expand(); });
      }

      /* закрываем приложение кнопкой Telegram, если бронь не начата */
      if (tg.BackButton) {
        tg.BackButton.onClick(() => {
          MainButton.hide();
          tg.close();
        });
      }
    }

    /* подсказка про MainButton только когда кнопки нет (веб-версия) */
    if (!MainButton.visible) {
      const hint = $('#mbHint');
      hint.classList.toggle('mb-hint--on', !isTelegram);
    }

    document.documentElement.dataset.tg = isTelegram ? '1' : '0';
  }

  /* данные могли измениться в другой вкладке */
  if (BAZA.subscribe) BAZA.subscribe(() => { renderTop(); });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

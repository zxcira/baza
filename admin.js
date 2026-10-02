/* ============================================================================
   БАЗА — админ-панель
   Работает поверх общего слоя store.js (window.BAZA) — того же источника
   данных, что и публичный сайт. Любая правка здесь сразу видна на сайте.

   Демо-режим: данные лежат в localStorage этого браузера.
   Для продакшена функции BAZA.* заменяются вызовами к API — интерфейс тот же.
   ========================================================================= */
(function () {
  'use strict';

  /* ----------------------------------------------------------- утилиты --- */
  const $ = s => document.querySelector(s);

  const data = () => BAZA.get();

  const esc = s => String(s === null || s === undefined ? '' : s)
    .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const money = n => Number(n || 0).toLocaleString('ru-RU') + ' ₽';

  const svg = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';

  const ICON = {
    grid:  '<path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>',
    list:  '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    tag:   '<path d="M20.59 13.41 12 22l-9-9V4h9l8.59 8.59a2 2 0 0 1 0 2.82z"/><path d="M7 7h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    chart: '<path d="M3 21h18"/><path d="M6 17v-7M11 17V5M16 17v-4M21 17v-7"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 21v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1"/><path d="M17 4.5a3.5 3.5 0 0 1 0 7"/>',
    db:    '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6"/><path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"/>',
    out:   '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
    plus:  '<path d="M12 5v14M5 12h14"/>',
    down:  '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>',
    up:    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    x:     '<path d="M18 6L6 18M6 6l12 12"/>',
    lock:  '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    copy:  '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  };

  const TABS = [
    { id: 'seats',    label: 'Места',        icon: 'grid',  perm: 'seats',
      title: 'Занятость мест', hint: 'Свободное место — заблокируется, блок — снимется, бронь — откроется карточка.' },
    { id: 'bookings', label: 'Брони',        icon: 'list',  perm: 'bookings',
      title: 'Журнал броней', hint: 'Подтверждение, отмена, удаление и выгрузка в CSV.' },
    { id: 'tariffs',  label: 'Тарифы',       icon: 'tag',   perm: 'tariffs',
      title: 'Тарифы и цены', hint: 'Цены по слотам, состав железа и витрина карточек.' },
    { id: 'schedule', label: 'Расписание',   icon: 'clock', perm: 'schedule',
      title: 'Расписание', hint: 'Часы по дням недели и особые даты. Изменения сохраняются сразу.' },
    { id: 'stats',    label: 'Статистика',   icon: 'chart', perm: 'stats',
      title: 'Статистика', hint: 'Выручка, средний чек, загрузка и популярные тарифы за период.' },
    { id: 'users',    label: 'Пользователи', icon: 'users', perm: 'users',
      title: 'Пользователи и роли', hint: 'Владелец видит всё, администратор — только места и брони.' },
    { id: 'data',     label: 'Данные',       icon: 'db',    perm: 'data',
      title: 'Данные клуба', hint: 'Экспорт, импорт, сброс к демо-состоянию и журнал действий.' },
  ];

  const WD = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const WD_ORDER = [1, 2, 3, 4, 5, 6, 0];   // показываем с понедельника

  /* ------------------------------------------------------------- стейт --- */
  const ui = {
    tab: 'seats',
    focus: null,
    seats: { date: BAZA.dateKey(), slot: 'night', reason: '' },
    bk:    { date: '', status: '', q: '' },
    stats: { from: BAZA.dateKey(BAZA.addDays(new Date(), -30)), to: BAZA.dateKey() },
  };

  let user  = null;
  let unsub = null;

  const app   = $('#app');
  const modal = $('#modal');

  /* ------------------------------------------------------------- toast --- */
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
    }, 3600);
  }

  /* ------------------------------------------------------------- modal --- */
  function openModal(html, onSubmit) {
    modal.innerHTML = html;
    modal.showModal();
    modal.querySelectorAll('[data-act="modal-close"]').forEach(b =>
      b.addEventListener('click', () => modal.close()));
    const form = modal.querySelector('form');
    if (form && onSubmit) form.addEventListener('submit', e => { e.preventDefault(); onSubmit(form); });
    return form;
  }
  function modalMsg(text, ok) {
    const el = modal.querySelector('#modalMsg');
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
    el.classList.toggle('notice--ok', !!ok);
    el.classList.toggle('notice--err', !ok);
  }

  /* ------------------------------------------------------------ экспорт --- */
  function download(name, text, mime) {
    const blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
    }
    return Promise.resolve(false);
  }

  /* ======================================================================
     ВХОД
     ==================================================================== */
  function renderLogin() {
    if (unsub) { unsub(); unsub = null; }
    app.innerHTML = `
    <div class="login">
      <form class="login__box" id="loginForm" novalidate>
        <div class="login__brand">
          <span class="login__mark"><img src="assets/logo.png" alt="" width="52" height="52"></span>
          <span>
            <span class="login__name">БАЗА</span><br>
            <span class="login__sub">админ-панель</span>
          </span>
        </div>

        <h1>Вход</h1>

        <label class="f"><span class="label">Логин</span>
          <input class="inp" type="text" name="login" autocomplete="username" required autofocus>
        </label>
        <label class="f"><span class="label">Пароль</span>
          <input class="inp" type="password" name="password" autocomplete="current-password" required>
        </label>

        <p class="notice" id="loginMsg" hidden></p>

        <button class="btn btn--primary" type="submit">${svg(ICON.lock)} Войти</button>

        <div class="demo-creds">
          демо-доступ<br>
          <b>owner</b> / baza &nbsp;— владелец<br>
          <b>admin</b> / admin &nbsp;— смена
        </div>
      </form>
    </div>`;

    $('#loginForm').addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      const res = BAZA.login(f.elements.login.value.trim(), f.elements.password.value);
      if (!res.ok) {
        const el = $('#loginMsg');
        el.textContent = res.error;
        el.hidden = false;
        el.classList.add('notice--err');
        return;
      }
      user = BAZA.session();
      renderShell();
    });
  }

  /* ======================================================================
     КАРКАС
     ==================================================================== */
  function renderShell() {
    if (!user) return renderLogin();

    const tabs = TABS.filter(t => BAZA.can(t.perm));
    if (!tabs.some(t => t.id === ui.tab)) ui.tab = tabs.length ? tabs[0].id : 'seats';

    const today = BAZA.dateKey();
    const todayCount = data().bookings.filter(b => b.date === today && b.status !== 'cancelled').length;

    app.innerHTML = `
    <div class="app">
      <aside class="rail">
        <div class="rail__brand">
          <span class="rail__mark"><img src="assets/logo.png" alt="" width="44" height="44"></span>
          <span>
            <span class="rail__name">БАЗА</span><br>
            <span class="rail__sub">админ-панель</span>
          </span>
        </div>

        <nav class="rail__nav" aria-label="Разделы">
          ${tabs.map(t => `
            <button class="nav-btn" type="button" data-act="tab" data-tab="${t.id}"
                    ${t.id === ui.tab ? 'aria-current="page"' : ''}>
              ${svg(ICON[t.icon])}<span>${esc(t.label)}</span>
              ${t.id === 'bookings' && todayCount ? `<span class="cnt">${todayCount}</span>` : ''}
            </button>`).join('')}
        </nav>

        <div class="rail__spacer"></div>

        <div class="rail__user">
          <span class="rail__who">${esc(user.name)}</span>
          <span class="rail__role">${esc(user.role === 'owner' ? 'владелец' : 'администратор')}</span>
          <a class="btn btn--ghost btn--sm" href="index.html" target="_blank" rel="noopener">Открыть сайт</a>
          <button class="btn btn--ghost btn--sm" type="button" data-act="logout">${svg(ICON.out)} Выйти</button>
          <span class="rail__demo">демо-режим · данные в этом браузере</span>
        </div>
      </aside>

      <main class="main">
        <div id="view"></div>
      </main>
    </div>`;

    if (!unsub) unsub = BAZA.subscribe(() => { if (user) renderView(); });
    renderView();
  }

  function renderView() {
    const t = TABS.find(x => x.id === ui.tab) || TABS[0];
    const body = ({
      seats:    viewSeats,
      bookings: viewBookings,
      tariffs:  viewTariffs,
      schedule: viewSchedule,
      stats:    viewStats,
      users:    viewUsers,
      data:     viewData,
    }[t.id] || viewSeats)();

    $('#view').innerHTML = `
      <div class="page-head">
        <h1>${esc(t.title)}</h1>
        <p>${esc(t.hint)}</p>
      </div>
      ${body}`;

    /* возврат фокуса после перерисовки */
    if (ui.focus) {
      const el = document.getElementById(ui.focus);
      if (el) {
        el.focus();
        if (el.setSelectionRange && typeof el.value === 'string') {
          try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) { /* noop */ }
        }
      }
      ui.focus = null;
    }
  }

  /* ======================================================================
     1. МЕСТА
     ==================================================================== */
  const slotLabel  = id => (data().slots.find(s => s.id === id) || { label: id }).label;
  const tariffName = id => (data().tariffs[id] || { name: id }).name;
  const zoneName   = id => (data().zones.find(z => z.id === id) || { name: id }).name;

  function viewSeats() {
    const d = data();
    const date = ui.seats.date;
    const slot = ui.seats.slot;
    const closed = !BAZA.hoursFor(date);

    let total = 0, busy = 0;
    d.zones.forEach(z => z.seats.forEach(id => {
      total++;
      if (BAZA.isSeatBusy(date, slot, z.id, id).busy) busy++;
    }));

    const zones = d.zones.map(z => {
      const t = d.tariffs[z.tariff];
      const seats = z.seats.map(id => {
        const st = BAZA.isSeatBusy(date, slot, z.id, id);
        const cls = !st.busy ? 'seat--free' : (st.kind === 'block' ? 'seat--block' : 'seat--booked');
        const title = !st.busy ? 'Свободно — нажми, чтобы заблокировать'
          : st.kind === 'block' ? 'Заблокировано — нажми, чтобы снять'
          : 'Бронь — нажми, чтобы открыть карточку';
        return `<button class="seat ${cls}" type="button" title="${esc(title)}"
                  data-act="seat" data-zone="${esc(z.id)}" data-seat="${esc(id)}">
                  <b>${esc(id)}</b><small>${esc(t ? t.name : z.tariff)}</small>
                </button>`;
      }).join('');
      return `<div class="zone">
        <div class="zone__head">
          <h3>${esc(z.name)}</h3>
          <span class="badge">${esc(t ? t.name : z.tariff)}</span>
          <span class="badge">${esc(z.note)}</span>
          <span class="badge">${z.seats.length} мест</span>
        </div>
        <div class="seats">${seats}</div>
      </div>`;
    }).join('');

    return `
      <section class="panel">
        <div class="panel__head">
          <h2>Параметры смены</h2>
          <span class="spacer"></span>
          <span class="badge ${closed ? 'badge--danger' : 'badge--ok'}">
            ${closed ? 'выходной' : 'клуб работает'}</span>
          <span class="badge">занято ${busy} из ${total}</span>
        </div>

        <div class="fields">
          <label class="f"><span class="label">Дата</span>
            <input class="inp" type="date" id="f-seats-date" data-in="seats-date" value="${esc(date)}"></label>
          <label class="f"><span class="label">Слот</span>
            <select class="inp" data-in="seats-slot">
              ${d.slots.map(s => `<option value="${esc(s.id)}"${s.id === slot ? ' selected' : ''}>
                ${esc(s.label)} · ${esc(s.time)}</option>`).join('')}
            </select></label>
          <label class="f"><span class="label">Причина блокировки</span>
            <input class="inp" type="text" id="f-seats-reason" data-in="seats-reason"
                   maxlength="60" placeholder="Например: ПК на диагностике"
                   value="${esc(ui.seats.reason)}"></label>
        </div>
        <p class="hint">Причина подставится в блокировку, которую ты поставишь следующей.</p>
      </section>

      <section class="panel">
        <div class="panel__head">
          <h2>Схема зала</h2>
          <span class="spacer"></span>
          <span class="legend-i"><i class="sw sw-free"></i> свободно</span>
          <span class="legend-i"><i class="sw sw-booked"></i> бронь</span>
          <span class="legend-i"><i class="sw sw-block"></i> блок</span>
        </div>
        ${zones}
      </section>`;
  }

  function actionSeat(btn) {
    if (!BAZA.can('seats')) return toast('Недостаточно прав', 'err');

    const zoneId = btn.dataset.zone;
    const seat   = btn.dataset.seat;
    const date   = ui.seats.date;
    const slot   = ui.seats.slot;
    const st     = BAZA.isSeatBusy(date, slot, zoneId, seat);

    if (st.kind === 'booking') {
      const b = data().bookings.find(x =>
        x.date === date && x.zoneId === zoneId && x.seat === seat &&
        x.status !== 'cancelled' && (x.slot === slot || x.slot === 'full' || slot === 'full'));
      if (!b) return;
      openModal(`
        <form class="modal__in">
          <div class="modal__head">
            <h2 id="modalTitle">Бронь · место ${esc(seat)}</h2>
            <button class="icon-btn" type="button" data-act="modal-close" aria-label="Закрыть">${svg(ICON.x)}</button>
          </div>
          <div class="notice notice--ok">
            ${esc(b.client)} · ${esc(b.phone || 'телефон не указан')}<br>
            ${esc(b.date)} · ${esc(slotLabel(b.slot))} · ${esc(money(b.total))}<br>
            тариф: ${esc(tariffName(b.tariff))}
          </div>
          <div class="modal__acts">
            <button class="btn btn--primary" type="button" data-act="bk-close" data-id="${esc(b.id)}">
              ${svg(ICON.check)} Отметить пришедшим</button>
            <button class="btn btn--danger" type="button" data-act="bk-cancel-modal" data-id="${esc(b.id)}">
              ${svg(ICON.x)} Отменить бронь</button>
          </div>
        </form>`);
      return;
    }

    if (st.kind === 'block') {
      BAZA.toggleBlock(date, slot, zoneId, seat, '', user.login);
      return toast('Блокировка с места ' + seat + ' снята');
    }

    const reason = ui.seats.reason || 'Занято';
    BAZA.toggleBlock(date, slot, zoneId, seat, reason, user.login);
    toast('Место ' + seat + ' заблокировано');
  }

  /* ======================================================================
     2. БРОНИ
     ==================================================================== */
  function filteredBookings() {
    let list = data().bookings.slice();
    if (ui.bk.date)   list = list.filter(b => b.date === ui.bk.date);
    if (ui.bk.status) list = list.filter(b => b.status === ui.bk.status);
    if (ui.bk.q) {
      const q = ui.bk.q.toLowerCase();
      list = list.filter(b => (b.client + ' ' + b.phone + ' ' + b.seat + ' ' + b.date + ' ' + b.zoneId)
        .toLowerCase().includes(q));
    }
    list.sort((a, b) => (b.date + b.slot + b.seat).localeCompare(a.date + a.slot + a.seat));
    return list;
  }

  function viewBookings() {
    const list = filteredBookings();

    const rows = list.length ? list.map(b => `
      <tr>
        <td class="mono">${esc(b.date)}</td>
        <td>${esc(slotLabel(b.slot))}</td>
        <td>${esc(zoneName(b.zoneId))}</td>
        <td class="mono">${esc(b.seat)}</td>
        <td>${esc(tariffName(b.tariff))}</td>
        <td>${esc(b.client)}</td>
        <td class="mono">${esc(b.phone || '—')}</td>
        <td class="mono">${esc(money(b.total))}</td>
        <td>${b.status === 'cancelled'
              ? '<span class="badge badge--danger">отменена</span>'
              : b.status === 'done'
                ? '<span class="badge">завершена</span>'
                : '<span class="badge badge--ok">подтверждена</span>'}</td>
        <td>
          <div class="row-act">
            ${b.status === 'cancelled'
              ? `<button class="icon-btn" type="button" title="Вернуть в работу"
                   data-act="bk-restore" data-id="${esc(b.id)}">${svg(ICON.check)}</button>`
              : `<button class="icon-btn" type="button" title="Отменить"
                   data-act="bk-cancel" data-id="${esc(b.id)}">${svg(ICON.x)}</button>`}
            <button class="icon-btn icon-btn--danger" type="button" title="Удалить"
              data-act="bk-del" data-id="${esc(b.id)}">${svg(ICON.trash)}</button>
          </div>
        </td>
      </tr>`).join('')
      : `<tr><td colspan="10" class="empty-row">Ничего не найдено</td></tr>`;

    const total = list.filter(b => b.status !== 'cancelled')
      .reduce((a, b) => a + (Number(b.total) || 0), 0);

    return `
      <section class="panel">
        <div class="panel__head">
          <h2>Фильтр</h2>
          <span class="spacer"></span>
          <span class="badge">${list.length} записей</span>
          <span class="badge badge--ok">${esc(money(total))}</span>
        </div>
        <div class="fields">
          <label class="f"><span class="label">Дата</span>
            <input class="inp" type="date" id="f-bk-date" data-in="bk-date" value="${esc(ui.bk.date)}"></label>
          <label class="f"><span class="label">Статус</span>
            <select class="inp" data-in="bk-status">
              <option value="">Все</option>
              <option value="confirmed"${ui.bk.status === 'confirmed' ? ' selected' : ''}>Подтверждена</option>
              <option value="done"${ui.bk.status === 'done' ? ' selected' : ''}>Завершена</option>
              <option value="cancelled"${ui.bk.status === 'cancelled' ? ' selected' : ''}>Отменена</option>
            </select></label>
          <label class="f"><span class="label">Поиск</span>
            <input class="inp" type="search" id="f-bk-q" data-in="bk-q"
                   placeholder="имя, телефон, место" value="${esc(ui.bk.q)}"></label>
        </div>
        <div class="panel__acts">
          <button class="btn btn--primary" type="button" data-act="bk-new">${svg(ICON.plus)} Добавить бронь</button>
          <button class="btn btn--ghost" type="button" data-act="bk-csv">${svg(ICON.down)} Экспорт CSV</button>
          <button class="btn btn--ghost" type="button" data-act="bk-clear">Сбросить фильтр</button>
        </div>
      </section>

      <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr>
            <th>Дата</th><th>Слот</th><th>Зона</th><th>Место</th><th>Тариф</th>
            <th>Клиент</th><th>Телефон</th><th>Сумма</th><th>Статус</th><th></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function bookingCSV() {
    const list = filteredBookings();
    const head = ['Дата', 'Слот', 'Зона', 'Место', 'Тариф', 'Клиент', 'Телефон', 'Сумма', 'Статус'];
    const q = v => '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
    const lines = [head.map(q).join(';')].concat(list.map(b => [
      b.date, slotLabel(b.slot), zoneName(b.zoneId), b.seat, tariffName(b.tariff),
      b.client, b.phone || '', b.total || 0,
      b.status === 'cancelled' ? 'отменена' : b.status === 'done' ? 'завершена' : 'подтверждена',
    ].map(q).join(';')));
    /* BOM, чтобы Excel не ломал кириллицу */
    download('baza-broni-' + BAZA.dateKey() + '.csv', '\uFEFF' + lines.join('\r\n'), 'text/csv');
    toast('Выгружено записей: ' + list.length);
  }

  function openBookingModal() {
    const d = data();
    const form = openModal(`
      <form class="modal__in">
        <div class="modal__head">
          <h2 id="modalTitle">Новая бронь</h2>
          <button class="icon-btn" type="button" data-act="modal-close" aria-label="Закрыть">${svg(ICON.x)}</button>
        </div>
        <div class="fields">
          <label class="f"><span class="label">Дата</span>
            <input class="inp" type="date" name="date" value="${esc(BAZA.dateKey())}" required></label>
          <label class="f"><span class="label">Слот</span>
            <select class="inp" name="slot">
              ${d.slots.map(s => `<option value="${esc(s.id)}">${esc(s.label)} · ${esc(s.time)}</option>`).join('')}
            </select></label>
          <label class="f"><span class="label">Зона</span>
            <select class="inp" name="zoneId">
              ${d.zones.map(z => `<option value="${esc(z.id)}">${esc(z.name)}</option>`).join('')}
            </select></label>
          <label class="f"><span class="label">Место</span>
            <select class="inp" name="seat"></select></label>
          <label class="f"><span class="label">Имя клиента</span>
            <input class="inp" type="text" name="client" maxlength="60" required></label>
          <label class="f"><span class="label">Телефон</span>
            <input class="inp" type="tel" name="phone" maxlength="24" placeholder="+7 900 000-00-00"></label>
        </div>
        <p class="notice" id="modalMsg" hidden></p>
        <div class="modal__acts">
          <button class="btn btn--primary" type="submit">${svg(ICON.check)} Добавить</button>
          <button class="btn btn--ghost" type="button" data-act="modal-close">Отмена</button>
        </div>
      </form>`, submit);

    const zoneSel = form.elements.zoneId;
    const seatSel = form.elements.seat;
    const slotSel = form.elements.slot;
    const dateInp = form.elements.date;

    function fillSeats() {
      const z = data().zones.find(x => x.id === zoneSel.value);
      if (!z) { seatSel.innerHTML = ''; return; }
      seatSel.innerHTML = z.seats.map(id => {
        const busy = BAZA.isSeatBusy(dateInp.value, slotSel.value, z.id, id).busy;
        return `<option value="${esc(id)}"${busy ? ' disabled' : ''}>${esc(id)}${busy ? ' — занято' : ''}</option>`;
      }).join('');
      const free = [...seatSel.options].find(o => !o.disabled);
      if (free) seatSel.value = free.value;
    }
    zoneSel.addEventListener('change', fillSeats);
    slotSel.addEventListener('change', fillSeats);
    dateInp.addEventListener('change', fillSeats);
    fillSeats();

    function submit(f) {
      const z = data().zones.find(x => x.id === f.elements.zoneId.value);
      const date = f.elements.date.value;
      const slot = f.elements.slot.value;
      const seat = f.elements.seat.value;
      const client = f.elements.client.value.trim();
      const phone = f.elements.phone.value.trim();

      if (!z)      return modalMsg('Выбери зону.', false);
      if (!seat)   return modalMsg('В этой зоне на выбранный слот нет свободных мест.', false);
      if (!client) return modalMsg('Укажи имя клиента.', false);
      if (BAZA.isSeatBusy(date, slot, z.id, seat).busy) return modalMsg('Это место уже занято.', false);

      BAZA.createBooking({
        date, slot, zoneId: z.id, seat, tariff: z.tariff,
        client, phone, total: (data().tariffs[z.tariff].price[slot] || 0), by: user.login,
      });
      modal.close();
      toast('Бронь добавлена: ' + seat + ' · ' + date);
    }
  }

  /* ======================================================================
     3. ТАРИФЫ
     ==================================================================== */
  function viewTariffs() {
    const d = data();
    const editable = BAZA.can('tariffs');

    const cards = Object.entries(d.tariffs).map(([key, t]) => `
      <div class="tcard${t.featured ? ' tcard--flag' : ''}" data-tpanel="${esc(key)}">
        <div class="tcard__head">
          <h3>${esc(t.name)}</h3>
          <span class="badge">${esc(key)}</span>
          ${t.featured ? '<span class="badge badge--ok">витрина</span>' : ''}
          ${t.hourly ? '<span class="badge badge--warn">по часам</span>' : ''}
        </div>

        <div class="fields">
          <label class="f"><span class="label">Название</span>
            <input class="inp" type="text" data-field="name" maxlength="40"
                   value="${esc(t.name)}"${editable ? '' : ' disabled'}></label>
          <label class="f"><span class="label">Плашка</span>
            <input class="inp" type="text" data-field="badge" maxlength="24"
                   value="${esc(t.badge)}"${editable ? '' : ' disabled'}></label>
        </div>

        <label class="f"><span class="label">Описание</span>
          <input class="inp" type="text" data-field="desc" maxlength="120"
                 value="${esc(t.desc)}"${editable ? '' : ' disabled'}></label>

        <div class="price-grid">
          ${d.slots.map(s => `
            <label class="f"><span class="label">${esc(s.label)}</span>
              <input class="inp mono" type="number" min="0" step="10" data-field="price.${esc(s.id)}"
                     value="${Number(t.price[s.id] || 0)}"${editable ? '' : ' disabled'}></label>`).join('')}
        </div>

        <div class="row-act">
          <label class="check"><input type="checkbox" data-field="featured"
            ${t.featured ? 'checked' : ''}${editable ? '' : ' disabled'}> на витрине</label>
          <label class="check"><input type="checkbox" data-field="hourly"
            ${t.hourly ? 'checked' : ''}${editable ? '' : ' disabled'}> цена за час</label>
        </div>

        <div>
          <span class="label">Железо и состав</span>
          <div class="spec-list" style="margin-top:.5rem">
            ${t.specs.map((row, i) => `
              <div class="spec-row" data-spec-row>
                <input class="inp" type="text" data-spec-part="0" maxlength="30"
                       value="${esc(row[0])}" placeholder="Параметр"${editable ? '' : ' disabled'}>
                <input class="inp" type="text" data-spec-part="1" maxlength="60"
                       value="${esc(row[1])}" placeholder="Значение"${editable ? '' : ' disabled'}>
                <button class="icon-btn icon-btn--danger" type="button" title="Удалить строку"
                        data-act="spec-del" data-tkey="${esc(key)}" data-i="${i}"
                        ${editable ? '' : ' disabled'}>${svg(ICON.trash)}</button>
              </div>`).join('')}
          </div>
        </div>

        ${editable ? `
        <div class="panel__acts">
          <button class="btn btn--ghost btn--sm" type="button"
                  data-act="spec-add" data-tkey="${esc(key)}">${svg(ICON.plus)} Строка</button>
          <button class="btn btn--primary btn--sm" type="button"
                  data-act="tariff-save" data-tkey="${esc(key)}">${svg(ICON.check)} Сохранить</button>
        </div>` : ''}
      </div>`).join('');

    return `<div class="tgrid">${cards}</div>
      <p class="hint">Правки появятся на сайте сразу после сохранения. Цены — целые числа в рублях.</p>`;
  }

  function saveTariff(key) {
    if (!BAZA.can('tariffs')) return toast('Недостаточно прав', 'err');
    const root = document.querySelector('[data-tpanel="' + key + '"]');
    if (!root) return;
    const val = s => { const el = root.querySelector(s); return el ? el.value : ''; };
    const chk = s => { const el = root.querySelector(s); return el ? el.checked : false; };

    const prices = {};
    data().slots.forEach(s => { prices[s.id] = Number(val('[data-field="price.' + s.id + '"]')) || 0; });

    const specs = [...root.querySelectorAll('[data-spec-row]')]
      .map(r => [
        r.querySelector('[data-spec-part="0"]').value.trim(),
        r.querySelector('[data-spec-part="1"]').value.trim(),
      ])
      .filter(p => p[0] || p[1]);

    const patch = {
      name: val('[data-field="name"]').trim() || key,
      badge: val('[data-field="badge"]').trim(),
      desc: val('[data-field="desc"]').trim(),
      price: prices,
      featured: chk('[data-field="featured"]'),
      hourly: chk('[data-field="hourly"]'),
      specs: specs,
    };

    BAZA.update(s => {
      s.tariffs[key] = Object.assign({}, s.tariffs[key], patch);
      s.audit.unshift({ at: new Date().toISOString(), user: user.login,
        action: 'tariff.update', detail: patch.name });
      s.audit = s.audit.slice(0, 500);
    });
    toast('Тариф «' + patch.name + '» сохранён');
  }

  function specAdd(key) {
    BAZA.update(s => { s.tariffs[key].specs.push(['', '']); });
  }
  function specDel(key, i) {
    BAZA.update(s => { s.tariffs[key].specs.splice(Number(i), 1); });
  }

  /* ======================================================================
     4. РАСПИСАНИЕ
     ==================================================================== */
  function viewSchedule() {
    const d = data();
    const editable = BAZA.can('schedule');

    const week = WD_ORDER.map(idx => {
      const h = d.schedule.week[idx];
      const closed = !h;
      return `<div class="week__row${closed ? ' is-closed' : ''}">
        <span class="week__day">${esc(WD[idx])}</span>
        <label class="f"><span class="label">Открытие</span>
          <input class="inp mono" type="time" data-in="week-open" data-day="${idx}"
                 value="${esc(h ? h.open : '12:00')}"${closed || !editable ? ' disabled' : ''}></label>
        <label class="f"><span class="label">Закрытие</span>
          <input class="inp mono" type="time" data-in="week-close" data-day="${idx}"
                 value="${esc(h ? h.close : '02:00')}"${closed || !editable ? ' disabled' : ''}></label>
        <label class="check">
          <input type="checkbox" data-in="week-closed" data-day="${idx}"
                 ${closed ? 'checked' : ''}${editable ? '' : ' disabled'}> выходной
        </label>
      </div>`;
    }).join('');

    const exceptions = d.schedule.exceptions
      .slice().sort((a, b) => a.date.localeCompare(b.date))
      .map(x => `
        <tr>
          <td class="mono">${esc(x.date)}</td>
          <td>${x.closed ? '<span class="badge badge--danger">выходной</span>'
                          : '<span class="badge badge--ok">' + esc(x.open + ' — ' + x.close) + '</span>'}</td>
          <td>${esc(x.note || '—')}</td>
          <td>
            <div class="row-act">
              <button class="icon-btn icon-btn--danger" type="button" title="Удалить"
                data-act="ex-del" data-date="${esc(x.date)}">${svg(ICON.trash)}</button>
            </div>
          </td>
        </tr>`).join('') || '<tr><td colspan="4" class="empty-row">Особых дат нет</td></tr>';

    return `
      <section class="panel">
        <div class="panel__head"><h2>Дни недели</h2>
          <span class="spacer"></span><span class="badge">часы работы</span></div>
        <div class="week">${week}</div>
        <p class="hint">Закрытие раньше открытия означает работу через полночь (12:00 → 02:00).</p>
      </section>

      <section class="panel">
        <div class="panel__head"><h2>Особые даты</h2>
          <span class="spacer"></span>
          <span class="badge">${d.schedule.exceptions.length}</span></div>

        ${editable ? `
        <div class="fields">
          <label class="f"><span class="label">Дата</span>
            <input class="inp" type="date" id="f-ex-date" value="${esc(BAZA.dateKey())}"></label>
          <label class="f"><span class="label">Открытие</span>
            <input class="inp mono" type="time" id="f-ex-open" value="12:00"></label>
          <label class="f"><span class="label">Закрытие</span>
            <input class="inp mono" type="time" id="f-ex-close" value="02:00"></label>
          <label class="f"><span class="label">Комментарий</span>
            <input class="inp" type="text" id="f-ex-note" maxlength="60" placeholder="Новый год"></label>
        </div>
        <div class="panel__acts">
          <label class="check"><input type="checkbox" id="f-ex-closed"> весь день закрыто</label>
          <button class="btn btn--primary btn--sm" type="button" data-act="ex-add">
            ${svg(ICON.plus)} Добавить дату</button>
        </div>` : '<p class="hint">Особые даты доступны только владельцу.</p>'}
      </section>

      <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr><th>Дата</th><th>Режим</th><th>Комментарий</th><th></th></tr></thead>
          <tbody>${exceptions}</tbody>
        </table>
      </div>`;
  }

  function setWeekDay(dayIdx, patch) {
    if (!BAZA.can('schedule')) return;
    BAZA.update(s => {
      const cur = s.schedule.week[dayIdx] || { open: '12:00', close: '02:00' };
      s.schedule.week[dayIdx] = Object.assign({}, cur, patch);
    });
  }
  function toggleWeekClosed(dayIdx, closed) {
    if (!BAZA.can('schedule')) return;
    BAZA.update(s => {
      s.schedule.week[dayIdx] = closed ? null : { open: '12:00', close: '02:00' };
    });
  }
  function addException() {
    if (!BAZA.can('schedule')) return toast('Недостаточно прав', 'err');
    const date   = $('#f-ex-date').value;
    const closed = $('#f-ex-closed').checked;
    const open   = $('#f-ex-open').value || '12:00';
    const close  = $('#f-ex-close').value || '02:00';
    const note   = $('#f-ex-note').value.trim();
    if (!date) return toast('Укажи дату', 'err');

    BAZA.update(s => {
      s.schedule.exceptions = s.schedule.exceptions.filter(x => x.date !== date);
      s.schedule.exceptions.push({ date, closed, open, close, note });
      s.audit.unshift({ at: new Date().toISOString(), user: user.login,
        action: 'schedule.exception', detail: date + (closed ? ' выходной' : ' ' + open + '—' + close) });
      s.audit = s.audit.slice(0, 500);
    });
    toast('Дата ' + date + ' обновлена');
  }
  function delException(date) {
    BAZA.update(s => {
      s.schedule.exceptions = s.schedule.exceptions.filter(x => x.date !== date);
      s.audit.unshift({ at: new Date().toISOString(), user: user.login,
        action: 'schedule.exception.del', detail: date });
      s.audit = s.audit.slice(0, 500);
    });
    toast('Дата ' + date + ' убрана');
  }

  /* ======================================================================
     5. СТАТИСТИКА
     ==================================================================== */
  function viewStats() {
    const st = BAZA.stats(ui.stats.from, ui.stats.to);

    const days = Object.keys(st.byDay).sort();
    const maxDay = Math.max(1, ...days.map(d => st.byDay[d]));
    const bars = days.length ? days.map(d => `
      <div class="bar">
        <span class="bar__key">${esc(d.slice(5))}</span>
        <span class="bar__track"><span class="bar__fill" style="width:${Math.round(st.byDay[d] / maxDay * 100)}%"></span></span>
        <span class="bar__val">${esc(money(st.byDay[d]))}</span>
      </div>`).join('') : '<p class="hint">За выбранный период броней нет.</p>';

    const tariffRows = Object.entries(st.byTariff)
      .sort((a, b) => b[1].sum - a[1].sum)
      .map(([name, v]) => `<tr>
        <td>${esc(name)}</td>
        <td class="mono">${v.count}</td>
        <td class="mono">${esc(money(v.sum))}</td>
        <td class="mono">${esc(money(Math.round(v.sum / v.count)))}</td>
      </tr>`).join('') || '<tr><td colspan="4" class="empty-row">Нет данных</td></tr>';

    const slotRows = data().slots.map(s => {
      const n = st.bySlot[s.id] || 0;
      return `<tr><td>${esc(s.label)}</td><td class="mono">${esc(s.time)}</td><td class="mono">${n}</td></tr>`;
    }).join('');

    return `
      <section class="panel">
        <div class="panel__head"><h2>Период</h2></div>
        <div class="fields">
          <label class="f"><span class="label">С</span>
            <input class="inp" type="date" id="f-st-from" data-in="st-from" value="${esc(ui.stats.from)}"></label>
          <label class="f"><span class="label">По</span>
            <input class="inp" type="date" id="f-st-to" data-in="st-to" value="${esc(ui.stats.to)}"></label>
        </div>
      </section>

      <div class="kpis">
        <div class="kpi"><b>${esc(money(st.revenue))}</b><span>выручка</span></div>
        <div class="kpi"><b>${st.count}</b><span>броней</span></div>
        <div class="kpi"><b>${esc(money(st.avgTicket))}</b><span>средний чек</span></div>
        <div class="kpi"><b>${esc(money(st.avgPerDay))}</b><span>в день</span></div>
        <div class="kpi"><b>${st.capacityUsed}%</b><span>загрузка мест</span></div>
      </div>

      <section class="panel">
        <div class="panel__head"><h2>Выручка по дням</h2>
          <span class="spacer"></span><span class="badge">${days.length} дней</span></div>
        <div class="bars">${bars}</div>
      </section>

      <section class="panel">
        <div class="panel__head"><h2>По тарифам</h2></div>
        <div class="tbl-wrap">
          <table class="tbl">
            <thead><tr><th>Тариф</th><th>Броней</th><th>Выручка</th><th>Средняя</th></tr></thead>
            <tbody>${tariffRows}</tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <div class="panel__head"><h2>По слотам</h2></div>
        <div class="tbl-wrap">
          <table class="tbl">
            <thead><tr><th>Слот</th><th>Время</th><th>Броней</th></tr></thead>
            <tbody>${slotRows}</tbody>
          </table>
        </div>
      </section>`;
  }

  /* ======================================================================
     6. ПОЛЬЗОВАТЕЛИ
     ==================================================================== */
  function viewUsers() {
    const d = data();
    const editable = BAZA.can('users');
    const owners = d.users.filter(u => u.role === 'owner').length;

    const rows = d.users.map(u => `
      <tr>
        <td class="mono">${esc(u.login)}</td>
        <td>${esc(u.name)}</td>
        <td>${u.role === 'owner'
              ? '<span class="badge badge--ok">владелец</span>'
              : '<span class="badge">администратор</span>'}</td>
        <td>
          <div class="row-act">
            ${editable ? `
              <button class="icon-btn" type="button" title="Сменить пароль"
                data-act="user-pass" data-id="${esc(u.id)}">${svg(ICON.lock)}</button>` : ''}
            <button class="icon-btn icon-btn--danger" type="button" title="Удалить"
              data-act="user-del" data-id="${esc(u.id)}"
              ${(!editable || (u.role === 'owner' && owners <= 1)) ? 'disabled' : ''}>${svg(ICON.trash)}</button>
          </div>
        </td>
      </tr>`).join('');

    return `
      <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr><th>Логин</th><th>Имя</th><th>Роль</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      ${editable ? `
      <section class="panel" style="margin-top:1rem">
        <div class="panel__head"><h2>Добавить пользователя</h2></div>
        <div class="fields">
          <label class="f"><span class="label">Логин</span>
            <input class="inp" type="text" id="f-u-login" maxlength="24" autocomplete="off"></label>
          <label class="f"><span class="label">Имя</span>
            <input class="inp" type="text" id="f-u-name" maxlength="40"></label>
          <label class="f"><span class="label">Пароль</span>
            <input class="inp" type="text" id="f-u-pass" maxlength="40" autocomplete="new-password"></label>
          <label class="f"><span class="label">Роль</span>
            <select class="inp" id="f-u-role">
              <option value="admin">Администратор</option>
              <option value="owner">Владелец</option>
            </select></label>
        </div>
        <div class="panel__acts">
          <button class="btn btn--primary" type="button" data-act="user-add">${svg(ICON.plus)} Добавить</button>
        </div>
        <p class="hint">Пароли хранятся в виде простого демо-хеша. Для продакшена нужен сервер и нормальное хеширование.</p>
      </section>` : ''}`;
  }

  function userAdd() {
    if (!BAZA.can('users')) return toast('Недостаточно прав', 'err');
    const login = $('#f-u-login').value.trim().toLowerCase();
    const name  = $('#f-u-name').value.trim();
    const pass  = $('#f-u-pass').value;
    const role  = $('#f-u-role').value;

    if (!login || !name || !pass) return toast('Заполни логин, имя и пароль', 'err');
    if (data().users.some(u => u.login === login)) return toast('Такой логин уже занят', 'err');

    BAZA.update(s => {
      s.users.push({ id: BAZA.uid('u'), login, name, role, pass: BAZA.hash(pass) });
      s.audit.unshift({ at: new Date().toISOString(), user: user.login,
        action: 'user.add', detail: login + ' (' + role + ')' });
      s.audit = s.audit.slice(0, 500);
    });
    toast('Пользователь ' + login + ' добавлен');
  }

  function userPass(id) {
    if (!BAZA.can('users')) return toast('Недостаточно прав', 'err');
    const u = data().users.find(x => x.id === id);
    if (!u) return;
    const pass = prompt('Новый пароль для «' + u.login + '»:', '');
    if (pass === null) return;
    if (!pass.trim()) return toast('Пустой пароль не подходит', 'err');
    BAZA.update(s => {
      const t = s.users.find(x => x.id === id);
      if (t) t.pass = BAZA.hash(pass);
      s.audit.unshift({ at: new Date().toISOString(), user: user.login,
        action: 'user.pass', detail: u.login });
      s.audit = s.audit.slice(0, 500);
    });
    toast('Пароль обновлён');
  }

  function userDel(id) {
    if (!BAZA.can('users')) return toast('Недостаточно прав', 'err');
    const u = data().users.find(x => x.id === id);
    if (!u) return;
    if (u.id === user.id) return toast('Нельзя удалить самого себя', 'err');
    const owners = data().users.filter(x => x.role === 'owner').length;
    if (u.role === 'owner' && owners <= 1) return toast('Это последний владелец', 'err');
    if (!confirm('Удалить пользователя «' + u.login + '»?')) return;

    BAZA.update(s => {
      s.users = s.users.filter(x => x.id !== id);
      s.audit.unshift({ at: new Date().toISOString(), user: user.login,
        action: 'user.del', detail: u.login });
      s.audit = s.audit.slice(0, 500);
    });
    toast('Пользователь удалён');
  }

  /* ======================================================================
     7. ДАННЫЕ
     ==================================================================== */
  function viewData() {
    const d = data();
    const auditRows = d.audit.slice(0, 80).map(a => `
      <tr>
        <td class="mono">${esc(new Date(a.at).toLocaleString('ru-RU'))}</td>
        <td class="mono">${esc(a.user)}</td>
        <td>${esc(a.action)}</td>
        <td>${esc(a.detail || '')}</td>
      </tr>`).join('') || '<tr><td colspan="4" class="empty-row">Пока пусто</td></tr>';

    return `
      <section class="panel">
        <div class="panel__head"><h2>Состояние</h2></div>
        <div class="kpis" style="margin-bottom:0">
          <div class="kpi"><b>${d.bookings.length}</b><span>броней</span></div>
          <div class="kpi"><b>${d.blocks.length}</b><span>блокировок</span></div>
          <div class="kpi"><b>${d.users.length}</b><span>пользователей</span></div>
          <div class="kpi"><b>${d.zones.reduce((a, z) => a + z.seats.length, 0)}</b><span>мест</span></div>
        </div>
        <p class="hint">Обновлено: ${esc(new Date(d.updatedAt).toLocaleString('ru-RU'))}</p>
      </section>

      <section class="panel">
        <div class="panel__head"><h2>Экспорт и импорт</h2></div>
        <p class="hint" style="margin-top:0;margin-bottom:1rem">
          Экспорт — снимок всех данных клуба в JSON. Импорт заменяет состояние целиком.
        </p>
        <div class="panel__acts" style="margin-top:0">
          <button class="btn btn--primary" type="button" data-act="data-download">
            ${svg(ICON.down)} Скачать JSON</button>
          <button class="btn btn--ghost" type="button" data-act="data-copy">
            ${svg(ICON.copy)} Скопировать</button>
          <button class="btn btn--ghost" type="button" data-act="data-import-file">
            ${svg(ICON.up)} Импорт из файла</button>
          <input type="file" id="f-import" accept="application/json,.json" hidden>
          <button class="btn btn--danger" type="button" data-act="data-reset">
            ${svg(ICON.trash)} Сброс к демо</button>
        </div>
        <label class="f" style="margin-top:1rem"><span class="label">Вставить JSON вручную</span>
          <textarea class="inp" id="f-import-text" placeholder='{"version":1, ...}'></textarea></label>
        <div class="panel__acts" style="margin-top:.75rem">
          <button class="btn btn--ghost" type="button" data-act="data-import-text">Импортировать текст</button>
        </div>
      </section>

      <section class="panel">
        <div class="panel__head"><h2>Журнал действий</h2>
          <span class="spacer"></span>
          <span class="badge">последние ${Math.min(80, d.audit.length)}</span></div>
        <div class="tbl-wrap">
          <table class="tbl">
            <thead><tr><th>Когда</th><th>Кто</th><th>Действие</th><th>Детали</th></tr></thead>
            <tbody>${auditRows}</tbody>
          </table>
        </div>
      </section>`;
  }

  function importText(text) {
    try {
      BAZA.import(text);
      toast('Данные импортированы');
      renderView();
    } catch (e) {
      toast('Ошибка импорта: ' + e.message, 'err');
    }
  }

  /* ======================================================================
     СОБЫТИЯ
     ==================================================================== */
  const CLICK = {
    tab:    b => { ui.tab = b.dataset.tab; ui.focus = null; renderShell(); },
    logout: () => { if (unsub) { unsub(); unsub = null; } BAZA.logout(); user = null; renderLogin(); },
    seat:   actionSeat,

    'bk-new':   () => openBookingModal(),
    'bk-csv':   () => bookingCSV(),
    'bk-clear': () => { ui.bk = { date: '', status: '', q: '' }; renderView(); },

    'bk-cancel':       b => { BAZA.setBookingStatus(b.dataset.id, 'cancelled', user.login); toast('Бронь отменена'); },
    'bk-cancel-modal': b => { BAZA.setBookingStatus(b.dataset.id, 'cancelled', user.login); modal.close(); toast('Бронь отменена'); },
    'bk-restore':      b => { BAZA.setBookingStatus(b.dataset.id, 'confirmed', user.login); toast('Бронь возвращена'); },
    'bk-close':        b => { BAZA.setBookingStatus(b.dataset.id, 'done', user.login); modal.close(); toast('Отмечено пришедшим'); },
    'bk-del':          b => { if (confirm('Удалить бронь безвозвратно?')) { BAZA.deleteBooking(b.dataset.id, user.login); toast('Бронь удалена'); } },

    'spec-add':    b => specAdd(b.dataset.tkey),
    'spec-del':    b => specDel(b.dataset.tkey, b.dataset.i),
    'tariff-save': b => saveTariff(b.dataset.tkey),

    'ex-add': () => addException(),
    'ex-del': b => delException(b.dataset.date),

    'user-add':  () => userAdd(),
    'user-pass': b => userPass(b.dataset.id),
    'user-del':  b => userDel(b.dataset.id),

    'data-download':    () => { download('baza-data-' + BAZA.dateKey() + '.json', BAZA.export(), 'application/json'); toast('Файл сохранён'); },
    'data-copy':        () => copyText(BAZA.export()).then(ok => toast(ok ? 'JSON в буфере обмена' : 'Браузер запретил доступ к буферу', ok ? '' : 'err')),
    'data-import-file': () => $('#f-import').click(),
    'data-import-text': () => {
      const t = $('#f-import-text').value.trim();
      if (!t) return toast('Вставь JSON', 'err');
      importText(t);
    },
    'data-reset': () => {
      if (confirm('Сбросить ВСЕ данные к демо-состоянию? Брони, тарифы и пользователи будут перезаписаны.')) {
        BAZA.reset();
        toast('Данные сброшены к демо');
      }
    },
  };

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const h = CLICK[b.dataset.act];
    if (!h) return;
    e.preventDefault();
    h(b, e);
  });

  document.addEventListener('change', e => {
    const el = e.target.closest('[data-in]');
    if (el) {
      const k = el.dataset.in;

      if (k === 'seats-date')        { ui.seats.date = el.value; renderView(); }
      else if (k === 'seats-slot')   { ui.seats.slot = el.value; renderView(); }
      else if (k === 'seats-reason') { ui.seats.reason = el.value; }
      else if (k === 'bk-date')      { ui.bk.date = el.value; renderView(); }
      else if (k === 'bk-status')    { ui.bk.status = el.value; renderView(); }
      else if (k === 'st-from')      { ui.stats.from = el.value; renderView(); }
      else if (k === 'st-to')        { ui.stats.to = el.value; renderView(); }
      else if (k === 'week-open')    { setWeekDay(el.dataset.day, { open: el.value }); }
      else if (k === 'week-close')   { setWeekDay(el.dataset.day, { close: el.value }); }
      else if (k === 'week-closed')  { toggleWeekClosed(el.dataset.day, el.checked); }
      return;
    }

    if (e.target.id === 'f-import') {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const fr = new FileReader();
      fr.onload = () => importText(String(fr.result));
      fr.readAsText(file);
      e.target.value = '';
    }
  });

  /* поиск по броням: обновляем по вводу, сохраняя фокус и позицию каретки */
  document.addEventListener('input', e => {
    const el = e.target.closest('[data-in="bk-q"]');
    if (!el) return;
    ui.bk.q = el.value;
    ui.focus = 'f-bk-q';
    renderView();
  });

  /* ======================================================================
     СТАРТ
     ==================================================================== */
  function boot() {
    user = BAZA.session();
    /* сессия могла остаться от удалённого пользователя */
    if (user && !data().users.some(u => u.id === user.id)) {
      BAZA.logout();
      user = null;
    }
    if (user) renderShell(); else renderLogin();
  }

  boot();
})();

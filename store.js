/* ============================================================================
   БАЗА — общий слой данных
   ----------------------------------------------------------------------------
   Единственный источник правды для публичного сайта и админ-панели.
   Хранилище — localStorage, поэтому данные видны только в этом браузере.
   Для продакшена этот файл заменяется вызовами к API, контракт не меняется.

   ДЕМО-ОГРАНИЧЕНИЯ (осознанные, для локального прототипа):
   - пароль хешируется, но не солится и не проверяется на сервере;
   - данные не синхронизируются между устройствами;
   - очистка хранилища браузера стирает всё.

   Подключение:  <script src="store.js"></script>  →  window.BAZA
   ========================================================================= */
(function (global) {
  'use strict';

  var KEY = 'baza.store.v1';
  var SCHEMA_VERSION = 1;

  /* ---------------------------------------------------------------- утилиты */
  function dateKey(d) {
    d = d || new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }
  function addDays(date, n) {
    var d = new Date(date.getTime());
    d.setDate(d.getDate() + n);
    return d;
  }
  function parseHM(s) {
    var p = String(s).split(':');
    return { h: parseInt(p[0], 10) || 0, m: parseInt(p[1], 10) || 0 };
  }
  function hhmm(s) {
    var t = parseHM(s);
    return String(t.h).padStart(2, '0') + ':' + String(t.m).padStart(2, '0');
  }
  /** Минуты от полуночи; время закрытия после полуночи считается как +24ч. */
  function minutes(s) {
    var t = parseHM(s), v = t.h * 60 + t.m;
    return v < 12 * 60 ? v + 24 * 60 : v;
  }
  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function deepMerge(base, patch) {
    if (Array.isArray(patch)) return patch.slice();
    if (patch === null || typeof patch !== 'object') return patch === undefined ? base : patch;
    var out = Array.isArray(base) ? [] : {};
    var keys = Object.keys(base || {}).concat(Object.keys(patch));
    keys.forEach(function (k) {
      var hasB = base && Object.prototype.hasOwnProperty.call(base, k);
      var hasP = patch && Object.prototype.hasOwnProperty.call(patch, k);
      if (hasP) out[k] = deepMerge(hasB ? base[k] : undefined, patch[k]);
      else out[k] = base[k];
    });
    return out;
  }

  /* ------------------------------------------------------------ хеш пароля */
  /* Демо-уровень. Не использовать как есть в продакшене. */
  function hash(text) {
    var s = String(text), h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return 'djb2$' + h.toString(16) + '$' + s.length;
  }

  /* ---------------------------------------------------------- данные по умолчанию */
  function defaults() {
    var today = dateKey();
    var tomorrow = dateKey(addDays(new Date(), 1));

    return {
      version: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),

      club: {
        name: 'БАЗА',
        sub: 'клуб киберспорта',
        city: 'Снежинск',
        address: 'ул. Ленина, 19',
        phone: '+7 993 930-55-56',
        email: 'baza_snz@mail.ru',
        payments: 'Наличные · карты · СБП',
        rating: '4.0 · 2ГИС',
        openFrom: '12:00',
        openTo: '02:00',

        /* Куда ведёт кнопка «Забронировать». Бронь и оплата живут в
           системе клуба (Langame), сайт на неё только ведёт и не дублирует. */
        bookingUrl: 'https://langame.ru/registration',

        /* Связь с Telegram-ботом. Пустые поля = демо-режим: приложение
           работает, но бронь никуда не уходит и живёт в этом устройстве.
           Заполняется вручную в панели -> Данные (или импортом JSON). */
        telegram: {
          bot: '',                        // @username бота, для ссылки в приложении
          webhook: '',                    // https://…/hook — адрес приёма заявок
          secret: '',                     // значение заголовка X-Baza-Secret
        },
      },

      /* 0 = воскресенье. Значение null — выходной. */
      schedule: {
        week: {
          0: { open: '12:00', close: '02:00' },
          1: { open: '12:00', close: '02:00' },
          2: { open: '12:00', close: '02:00' },
          3: { open: '12:00', close: '02:00' },
          4: { open: '12:00', close: '02:00' },
          5: { open: '12:00', close: '02:00' },
          6: { open: '12:00', close: '02:00' },
        },
        exceptions: [],                  // [{date, closed, open, close, note}]
      },

      slots: [
        { id: 'day',   label: 'День',        time: '12:00 — 17:00' },
        { id: 'night', label: 'Вечер',       time: '17:00 — 02:00' },
        { id: 'full',  label: 'Полный день', time: '12:00 — 02:00' },
      ],

      tariffs: {
        comf: {
          name: 'Общий зал', badge: '12 мест', featured: false,
          desc: 'Игровые ПК на RTX 5060 — для катки с друзьями и рейтинга.',
          price: { day: 170, night: 220, full: 170 },   // TODO: сверить с прайсом Langame
          hourly: true,
          specs: [
            ['Процессор', 'Intel i5-12400F'],
            ['Видеокарта', 'NVIDIA RTX 5060'],
            ['Монитор', 'Xiaomi 23.8" · 200 Гц'],
            ['Кресло', 'ZONE 51'],
          ],
        },
        vip: {
          name: 'VIP', badge: '10 мест', featured: true,
          desc: 'Флагманские стойки: RTX 5060 Ti и 280 Гц.',
          price: { day: 250, night: 300, full: 250 },   // TODO: сверить с прайсом Langame
          hourly: true,
          specs: [
            ['Процессор', 'Intel i5-14400F'],
            ['Видеокарта', 'NVIDIA RTX 5060 Ti'],
            ['Монитор', 'ASUS 27" · 280 Гц'],
            ['Кресло', 'ZONE 51'],
          ],
        },
        ps: {
          name: 'PlayStation 5', badge: '2 консоли', featured: false,
          desc: 'PS5 с DualSense — отдельная зона, оплата по времени.',
          price: { day: 250, night: 300, full: 250 },   // TODO: сверить с прайсом Langame
          hourly: true,
          specs: [
            ['Консоль', 'Sony PlayStation 5'],
            ['Периферия', 'DualSense'],
            ['Формат', 'Отдельная зона'],
          ],
        },
      },

      zones: [
        { id: 'z1', name: 'Общий зал', tariff: 'comf', note: '12 компьютеров',
          seats: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'] },
        { id: 'zv', name: 'VIP', tariff: 'vip', note: '10 компьютеров',
          seats: ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10'] },
        { id: 'zs', name: 'PlayStation', tariff: 'ps', note: '2 консоли PS5',
          seats: ['PS1', 'PS2'] },
      ],

      /* Ручные блокировки: ПК сломан, место держат по телефону и т.п. */
      blocks: [],

      /* [{id, date, slot, zoneId, seat, tariff, client, phone, total, status, createdAt, by}] */
      bookings: [],

      users: [
        { id: 'u_owner', login: 'owner', name: 'Владелец', role: 'owner',
          pass: hash('baza') },
        { id: 'u_admin', login: 'admin', name: 'Смена', role: 'admin',
          pass: hash('admin') },
      ],

      audit: [],
    };
  }

  /* --------------------------------------------------- демо-заполнение (1-й запуск) */
  function seedDemo(data) {
    var today = dateKey();
    var tomorrow = dateKey(addDays(new Date(), 1));
    var b = [], blocks = [], n = 0;

    function book(date, slot, zoneId, seat, tariff, client, status) {
      n++;
      return {
        id: 'bk_seed' + n, date: date, slot: slot, zoneId: zoneId, seat: seat,
        tariff: tariff, client: client, phone: '+7 900 000-00-0' + (n % 10),
        total: (data.tariffs[tariff].price[slot] || 0), status: status || 'confirmed',
        createdAt: new Date().toISOString(), by: 'seed',
      };
    }

    /* несколько броней на сегодня и завтра, чтобы схема выглядела живой */
    b.push(book(today,    'night', 'z1', '3',  'comf', 'Кирилл'));
    b.push(book(today,    'night', 'z1', '1',  'comf', 'Аня'));
    b.push(book(today,    'day',   'z1', '7',  'comf', 'Дмитрий'));
    b.push(book(today,    'night', 'zv', 'V2', 'vip',  'Егор'));
    b.push(book(today,    'night', 'zs', 'PS2','ps',   'Марк'));
    b.push(book(today,    'night', 'zv', 'V6', 'vip',  'Соня'));
    b.push(book(tomorrow, 'night', 'z1', '2',  'comf', 'Илья'));
    b.push(book(tomorrow, 'night', 'zv', 'V1', 'vip',  'Никита'));

    /* и одна ручная блокировка — якобы ПК на ремонте */
    blocks.push({ id: uid('bl'), date: today, slot: 'full', zoneId: 'z1', seat: '9',
      reason: 'ПК на диагностике', by: 'seed', at: new Date().toISOString() });

    data.bookings = b;
    data.blocks = blocks;
    return data;
  }

  /* ------------------------------------------------------------------ чтение */
  var state = null;

  function load() {
    if (state) return state;
    var raw = null;
    try { raw = global.localStorage.getItem(KEY); } catch (e) { raw = null; }

    if (!raw) {
      state = seedDemo(defaults());
      persist();
      return state;
    }
    var parsed;
    try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
    if (!parsed || typeof parsed !== 'object') {
      state = seedDemo(defaults());
      persist();
      return state;
    }
    /* дополняем недостающие поля, не затирая пользовательские данные */
    state = deepMerge(defaults(), parsed);
    state.version = SCHEMA_VERSION;
    return state;
  }

  function persist() {
    try {
      state.updatedAt = new Date().toISOString();
      global.localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      global.console && console.warn('BAZA: не удалось сохранить состояние', e);
    }
  }

  /* ------------------------------------------------------------ подписка */
  var listeners = [];

  function emit() {
    listeners.forEach(function (fn) {
      try { fn(state); } catch (e) { console.error(e); }
    });
  }

  function subscribe(fn) {
    listeners.push(fn);
    return function () {
      var i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  /* синхронизация между вкладками */
  global.addEventListener('storage', function (e) {
    if (e.key !== KEY || !e.newValue) return;
    try {
      state = deepMerge(defaults(), JSON.parse(e.newValue));
      state.version = SCHEMA_VERSION;
      emit();
    } catch (err) { /* игнорируем битые данные */ }
  });

  function update(mutator) {
    load();
    mutator(state);
    persist();
    emit();
    return state;
  }

  /* ------------------------------------------------------------------ время */
  /** Действует ли исключение на дату. */
  function exceptionFor(date) {
    return (state || load()).schedule.exceptions.filter(function (x) {
      return x.date === date;
    })[0] || null;
  }

  /** Часы работы на дату: {open, close} или null, если выходной. */
  function hoursFor(date) {
    load();
    var ex = exceptionFor(date);
    if (ex) return ex.closed ? null : { open: ex.open, close: ex.close, note: ex.note };
    var d = new Date(date + 'T12:00:00');
    return state.schedule.week[d.getDay()] || null;
  }

  /** Открыто ли сейчас (или в указанный момент). */
  function isOpenAt(when) {
    var d = when || new Date();
    var h = hoursFor(dateKey(d));
    if (!h) return false;
    var cur = d.getHours() * 60 + d.getMinutes();
    var o = parseHM(h.open), c = parseHM(h.close);
    var open = o.h * 60 + o.m;
    var close = c.h * 60 + c.m;
    if (close <= open) close += 24 * 60;          // работаем через полночь
    if (cur < open && close > 24 * 60) {          /* раннее утро — вчерашняя смена */
      return cur < (close - 24 * 60);
    }
    return cur >= open && cur < close;
  }

  /* -------------------------------------------------------------- занятость */
  /** Занято ли место на дату и слот (бронь или ручная блокировка). */
  function isSeatBusy(date, slot, zoneId, seat) {
    load();
    var hit = state.bookings.some(function (b) {
      return b.date === date && b.seat === seat && b.zoneId === zoneId &&
        b.status !== 'cancelled' && (b.slot === slot || b.slot === 'full' || slot === 'full');
    });
    if (hit) return { busy: true, kind: 'booking' };

    var blk = state.blocks.some(function (x) {
      return x.date === date && x.seat === seat && x.zoneId === zoneId &&
        (x.slot === slot || x.slot === 'full' || slot === 'full');
    });
    if (blk) return { busy: true, kind: 'block' };

    return { busy: false };
  }

  function bookingsFor(date, slot) {
    load();
    return state.bookings.filter(function (b) {
      if (b.status === 'cancelled') return false;
      if (date && b.date !== date) return false;
      if (slot && !(b.slot === slot || b.slot === 'full' || slot === 'full')) return false;
      return true;
    });
  }

  function createBooking(input) {
    var b = {
      id: uid('bk'),
      date: input.date, slot: input.slot, zoneId: input.zoneId, seat: input.seat,
      tariff: input.tariff, client: input.client || 'Без имени',
      phone: input.phone || '', total: input.total || 0,
      status: 'confirmed', createdAt: new Date().toISOString(),
      by: input.by || 'site',
    };
    update(function (s) {
      s.bookings.push(b);
      s.audit.unshift({
        at: b.createdAt, user: b.by, action: 'booking.create',
        detail: b.date + ' ' + b.seat + ' (' + b.slot + ')',
      });
      s.audit = s.audit.slice(0, 500);
    });
    return b;
  }

  function setBookingStatus(id, status, by) {
    return update(function (s) {
      var b = s.bookings.filter(function (x) { return x.id === id; })[0];
      if (!b) return;
      b.status = status;
      b.updatedAt = new Date().toISOString();
      s.audit.unshift({
        at: b.updatedAt, user: by || 'admin', action: 'booking.' + status,
        detail: b.date + ' ' + b.seat + ' · ' + b.client,
      });
      s.audit = s.audit.slice(0, 500);
    });
  }

  function deleteBooking(id, by) {
    return update(function (s) {
      s.bookings = s.bookings.filter(function (x) { return x.id !== id; });
      s.audit.unshift({ at: new Date().toISOString(), user: by || 'admin',
        action: 'booking.delete', detail: id });
      s.audit = s.audit.slice(0, 500);
    });
  }

  /* ------------------------------------------------------------- блокировки */
  function toggleBlock(date, slot, zoneId, seat, reason, by) {
    return update(function (s) {
      var i = s.blocks.findIndex(function (x) {
        return x.date === date && x.slot === slot && x.zoneId === zoneId && x.seat === seat;
      });
      if (i >= 0) {
        s.blocks.splice(i, 1);
        s.audit.unshift({ at: new Date().toISOString(), user: by || 'admin',
          action: 'block.remove', detail: date + ' ' + seat });
      } else {
        s.blocks.push({ id: uid('bl'), date: date, slot: slot, zoneId: zoneId, seat: seat,
          reason: reason || '', by: by || 'admin', at: new Date().toISOString() });
        s.audit.unshift({ at: new Date().toISOString(), user: by || 'admin',
          action: 'block.add', detail: date + ' ' + seat + ' (' + slot + ')' });
      }
      s.audit = s.audit.slice(0, 500);
    });
  }

  /* -------------------------------------------------------------- авторизация */
  function login(loginName, password) {
    load();
    var u = state.users.filter(function (x) { return x.login === loginName; })[0];
    if (!u) return { ok: false, error: 'Пользователь не найден' };
    if (u.pass !== hash(password)) return { ok: false, error: 'Неверный пароль' };
    var session = { id: u.id, login: u.login, name: u.name, role: u.role, at: Date.now() };
    try { global.sessionStorage.setItem('baza.session', JSON.stringify(session)); } catch (e) {}
    update(function (s) {
      s.audit.unshift({ at: new Date().toISOString(), user: u.login, action: 'auth.login', detail: u.role });
      s.audit = s.audit.slice(0, 500);
    });
    return { ok: true, user: session };
  }

  function logout() {
    try { global.sessionStorage.removeItem('baza.session'); } catch (e) {}
  }

  function session() {
    try { return JSON.parse(global.sessionStorage.getItem('baza.session') || 'null'); }
    catch (e) { return null; }
  }

  /** owner — всё; admin — только смена (места и брони). */
  var PERMS = {
    owner: ['seats', 'tariffs', 'schedule', 'bookings', 'stats', 'users', 'data'],
    admin: ['seats', 'bookings'],
  };
  function can(action) {
    var s = session();
    if (!s) return false;
    return (PERMS[s.role] || []).indexOf(action) >= 0;
  }

  /* --------------------------------------------------------------- статистика */
  function stats(fromDate, toDate) {
    load();
    var list = state.bookings.filter(function (b) {
      if (b.status === 'cancelled') return false;
      if (fromDate && b.date < fromDate) return false;
      if (toDate && b.date > toDate) return false;
      return true;
    });
    var revenue = 0, byDay = {}, byTariff = {}, bySlot = {};
    list.forEach(function (b) {
      var sum = b.total || 0;
      revenue += sum;
      byDay[b.date] = (byDay[b.date] || 0) + sum;
      var t = state.tariffs[b.tariff] ? state.tariffs[b.tariff].name : b.tariff;
      byTariff[t] = byTariff[t] || { count: 0, sum: 0 };
      byTariff[t].count++; byTariff[t].sum += sum;
      bySlot[b.slot] = (bySlot[b.slot] || 0) + 1;
    });
    var totalSeats = state.zones.reduce(function (a, z) { return a + z.seats.length; }, 0);
    var days = Object.keys(byDay).length || 1;
    return {
      count: list.length, revenue: revenue,
      avgPerDay: Math.round(revenue / days),
      avgTicket: list.length ? Math.round(revenue / list.length) : 0,
      byDay: byDay, byTariff: byTariff, bySlot: bySlot,
      totalSeats: totalSeats,
      capacityUsed: totalSeats ? Math.round((list.length / (totalSeats * days)) * 100) : 0,
    };
  }

  /* ------------------------------------------------------------- сериализация */
  function exportJSON() {
    load();
    return JSON.stringify(state, null, 2);
  }

  function importJSON(text) {
    var parsed = JSON.parse(text);            // бросает исключение при мусоре
    if (!parsed || typeof parsed !== 'object' || !parsed.zones || !parsed.tariffs) {
      throw new Error('Это не похоже на файл данных БАЗЫ: нет полей zones/tariffs');
    }
    state = deepMerge(defaults(), parsed);
    state.version = SCHEMA_VERSION;
    persist();
    emit();
    return state;
  }

  function reset() {
    state = seedDemo(defaults());
    persist();
    emit();
    return state;
  }

  /* ------------------------------------------------------------------- API */
  global.BAZA = {
    KEY: KEY,
    load: load, update: update, subscribe: subscribe, persist: persist,
    reset: reset, export: exportJSON, import: importJSON,
    dateKey: dateKey, addDays: addDays, hhmm: hhmm, uid: uid, hash: hash,
    hoursFor: hoursFor, isOpenAt: isOpenAt, exceptionFor: exceptionFor,
    isSeatBusy: isSeatBusy, bookingsFor: bookingsFor,
    createBooking: createBooking, setBookingStatus: setBookingStatus, deleteBooking: deleteBooking,
    toggleBlock: toggleBlock,
    login: login, logout: logout, session: session, can: can, PERMS: PERMS,
    stats: stats,
    get: function () { return load(); },
  };
})(window);

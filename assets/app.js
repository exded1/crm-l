
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const svg = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  const ICON = {
    all: svg('<rect x="4" y="4.5" width="16" height="5" rx="1.5"/><rect x="4" y="14.5" width="16" height="5" rx="1.5"/>'),
    gen: svg('<rect x="3" y="7.5" width="18" height="10" rx="1.5"/><path d="M6 17.5V20M18 17.5V20M16 7.5V4.5h2.5M12.6 9.6l-2.6 3.3h3.6L11 16"/>'),
    stacker: svg('<path d="M9 3v15M11.5 3v15M11.5 9.5H21M3.5 18V11a1 1 0 0 1 1-1H9M3.5 16h5.5M11.5 18.5H20"/><circle cx="6" cy="19.5" r="1.6"/><circle cx="19" cy="20" r="1.1"/>'),
    truck: svg('<path d="M3.5 4.5h2.2l2.6 8M6.5 12.5h4v4.5M10.5 16.5H21M6.5 12.5V17"/><circle cx="8" cy="18.6" r="1.6"/><circle cx="19" cy="19" r="1.2"/>'),
    other: svg('<path d="M4 12.5V5a1 1 0 0 1 1-1h7.5l7.5 7.5-8.5 8.5z"/><circle cx="8.3" cy="8.3" r="1.2"/>'),
    phone: svg('<path d="M5 4h3.5l1.8 4.4-2.2 1.5a11 11 0 0 0 6 6l1.5-2.2L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4z"/>'),
    wa: svg('<path d="M4 20l1.3-4A8 8 0 1 1 8.2 19z"/><path d="M9 9.5c.3 2.3 2.2 4.2 4.5 4.6l1.2-1.2 1.8.8c-.2 1.3-1.2 2-2.5 1.9A6.3 6.3 0 0 1 8.2 10c-.1-1.3.6-2.3 1.9-2.5l.8 1.8z"/>'),
    tg: svg('<path d="M20.8 4.4 3.6 11.1a.6.6 0 0 0 0 1.1l4.4 1.5 1.6 4.8a.6.6 0 0 0 1 .2l2.2-2.2 4 2.9a.6.6 0 0 0 .9-.3l3.5-13.9a.6.6 0 0 0-.4-.8z"/>'),
    vb: svg('<path d="M6 4h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-5l-4 4v-4H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M9 7.5c0 3 2.5 5.5 5.5 5.5M12 7c1.8.2 3 1.4 3.2 3.2"/>'),
    close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  };
  const PLATFORM = { fb: 'Facebook', ig: 'Instagram', manual: 'Вручную' };
  const COLS = ['leads', 'crm', 'meta'];
  const S = { leads: {}, crm: {}, meta: {}, tab: 'all', col: 'new', q: '', open: null, sync: {}, seen: null };
  const sources = () => (S.meta.sources && S.meta.sources.list) || [];
  const sourceOf = (id) => sources().find((s) => s.id === id);
  let store = null, mcp = null, stops = [], watched = '', dragId = null;

  /* ---------- Хранилище: база страницы в Claude, а вне Claude — этот браузер ---------- */
  const DB_TEXT = { quota_exceeded: 'хранилище заполнено', resource_exhausted: 'слишком много изменений подряд, подождите пару секунд', revoked: 'доступ к базе закрыт', not_granted: 'доступ к базе закрыт', invalid_argument: 'у вас доступ только на просмотр' };
  const human = (e) => (e && (DB_TEXT[e.code] || e.message || e.code)) || 'неизвестная ошибка';

  /* Своя база (Supabase): вход по паролю, данные только за входом. Так работает версия на своём адресе. */
  // не sb-…-auth-token: на том же адресе живёт EXDED CRM и ищет свой вход по этому шаблону
  const AUTH_KEY = 'crm-l-auth';
  // у Safari «нет сети» называется Load failed, у Chrome Failed to fetch
  const netText = (e) => (!e || !e.message || /fetch|network|load failed/i.test(e.message) ? 'нет связи' : e.message);
  const OFFLINE = 'Нет связи с базой. Вход сохранён, пароль не нужен.';
  /* Устройство = этот браузер или значок на «Домой». Мест у почты два, считает их база. */
  const deviceRow = (d, label) => `<li><div><b>${esc(d.label || 'Устройство')}</b><small>${d.this ? 'это устройство' : 'заходили ' + esc(when(d.seen_at))}</small></div>${d.this ? '' : `<button class="btn small" type="button" data-act="${label}" data-id="${esc(d.device)}">Отключить</button>`}</li>`;
  function deviceId() {
    let id = localStorage.getItem('crm-l-device');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('crm-l-device', id); }
    return id;
  }
  function deviceLabel() {
    const u = navigator.userAgent;
    const os = /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) || (/Macintosh/.test(u) && navigator.maxTouchPoints > 1) ? 'iPad' : /Android/.test(u) ? 'Android' : /Mac/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows' : 'Компьютер';
    const app = matchMedia('(display-mode: standalone)').matches ? 'значок CRM L' : /Edg/.test(u) ? 'Edge' : /OPR\//.test(u) ? 'Opera' : /Firefox|FxiOS/.test(u) ? 'Firefox' : /Chrome|CriOS/.test(u) ? 'Chrome' : 'Safari';
    return `${os}, ${app}`;
  }
  // mode: wait — открываем, login — почта и пароль, retry — только «Повторить»
  function showGate(mode, text) {
    const gate = $('#gate');
    gate.hidden = false;
    $('#gate-msg').textContent = text;
    gate.querySelectorAll('.gate-in').forEach((x) => { x.hidden = mode !== 'login'; });
    $('form', gate).noValidate = mode !== 'login';
    $('#g-go').hidden = mode === 'wait' || mode === 'devices';
    $('#g-out').hidden = mode !== 'devices';
    $('#g-dev').innerHTML = '';
    $('#g-go').textContent = mode === 'login' ? 'Войти' : 'Повторить';
  }
  function askGate(sb, mode, text) {
    const form = $('#gate form');
    showGate(mode, text);
    if (mode === 'login') $('#g-mail').focus();
    return new Promise((resolve) => {
      const done = () => { form.onsubmit = null; removeEventListener('online', done); showGate('wait', 'Открываю'); resolve(); };
      if (mode === 'retry') addEventListener('online', done);
      form.onsubmit = async (e) => {
        e.preventDefault();
        if (mode === 'retry') { done(); return; }
        $('#g-go').disabled = true;
        const { error } = await sb.auth.signInWithPassword({ email: form.email.value.trim(), password: form.password.value });
        $('#g-go').disabled = false;
        if (!error) { form.reset(); done(); return; }
        $('#gate-msg').textContent = error.message === 'Invalid login credentials' ? 'Неверная почта или пароль' : netText(error) === 'нет связи' ? 'Нет связи, попробуйте ещё раз' : error.message;
      };
    });
  }
  // оба места заняты: отключить одно из устройств или выйти
  function askDevices(sb, list) {
    showGate('devices', 'Этот аккаунт уже открыт на двух устройствах. Отключите одно, чтобы войти здесь.');
    $('#g-dev').innerHTML = list.map((d) => deviceRow(d, 'gate-drop')).join('');
    return new Promise((resolve) => {
      const go = async (fn) => { showGate('wait', 'Открываю'); await fn(); ACT['gate-drop'] = null; $('#g-out').onclick = null; resolve(); };
      ACT['gate-drop'] = (id) => go(() => sb.rpc('device_drop', { p_device: id }));
      $('#g-out').onclick = () => go(() => sb.auth.signOut({ scope: 'local' }));
    });
  }
  /* Ключ доступа живёт час, на старте он почти всегда просрочен. Библиотека без связи держит запуск до полуминуты,
     а потом отвечает «входа нет», поэтому продлеваем сами, ещё до неё, и пароль зря не спрашиваем. */
  async function freshen(cfg) {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch { /* нет сохранённого входа */ }
    if (!saved || !saved.refresh_token || saved.expires_at * 1000 - Date.now() > 120000) return 'ok';
    try {
      const r = await fetch(cfg.url + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: cfg.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: saved.refresh_token }) });
      if (r.status === 429 || r.status >= 500) return 'offline';
      if (!r.ok) { localStorage.removeItem(AUTH_KEY); return 'ok'; }
      const j = await r.json();
      localStorage.setItem(AUTH_KEY, JSON.stringify({ ...j, expires_at: j.expires_at || Math.floor(Date.now() / 1000) + j.expires_in }));
      return 'ok';
    } catch { return 'offline'; }
  }
  async function signIn(sb) {
    for (let text = ''; ;) {
      const { data } = await sb.auth.getSession();
      const user = data.session && data.session.user;
      if (!user) { await askGate(sb, 'login', text); text = ''; continue; }
      const { data: dev, error } = await sb.rpc('device_enter', { p_device: deviceId(), p_label: deviceLabel() });
      if (error && error.message === 'Нет доступа') { await sb.auth.signOut({ scope: 'local' }); text = 'У этой почты нет доступа к CRM L'; continue; }
      if (error) { await askGate(sb, 'retry', OFFLINE); continue; }
      if (dev.ok) return user;
      if (dev.blocked) { await sb.auth.signOut({ scope: 'local' }); text = 'Это устройство отключили. Чтобы вернуться, войдите с паролем.'; continue; }
      await askDevices(sb, dev.devices);
    }
  }
  async function supabaseStore(cfg) {
    if (window.top !== window.self) { document.body.textContent = 'CRM L не открывается внутри чужого сайта'; throw new Error('frame'); }
    showGate('wait', 'Открываю');
    while (await freshen(cfg) === 'offline') await askGate(null, 'retry', OFFLINE);
    const sb = window.supabase.createClient(cfg.url, cfg.key, { auth: { storageKey: AUTH_KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    const user = await signIn(sb);
    const at = new Map();
    // старая копия строки не затирает новую: порядок по часам базы
    const apply = (row) => {
      const key = `${row.col}/${row.id}`, t = Date.parse(row.updated_at) || 0;
      if ((at.get(key) || 0) > t) return;
      if (row.col === 'leads' && started && !S.leads[row.id] && row.data.platform !== 'manual') {
        // заявки одного чтения — одним сообщением
        if (!came.length) setTimeout(() => { toast(came.length === 1 ? `Новая заявка: ${came[0].name || fmtPhone(came[0].phone)}` : `Новых заявок: ${came.length}`); came = []; }, 700);
        came.push(row.data);
      }
      at.set(key, t);
      S[row.col][row.id] = row.data;
    };
    let started = false, came = [];
    const pull = async () => {
      // это устройство отключили с другого: на экран входа
      const { data: alive, error: e0 } = await sb.rpc('is_team');
      if (e0) throw new Error(netText(e0));
      if (!alive) { location.reload(); return; }
      for (let from = 0; ; from += 1000) {
        const { data, error } = await sb.from('crm_docs').select('col,id,data,updated_at').order('col').order('id').range(from, from + 999);
        if (error) throw new Error(netText(error));
        data.forEach(apply);
        if (data.length < 1000) break;
      }
      S.sync.link = {};
      refresh();
    };
    const retryPull = () => pull().catch((e) => { S.sync.link = { err: e.message === 'нет связи' ? 'Нет связи с базой' : e.message }; renderSync(); });
    for (;;) { try { await pull(); break; } catch { await askGate(sb, 'retry', OFFLINE); } }
    $('#gate').hidden = true;
    started = true;
    sb.channel('crm-l').on('postgres_changes', { event: '*', schema: 'public', table: 'crm_docs' }, (p) => { if (p.new && p.new.id) { apply(p.new); refresh(); } })
      .subscribe((st) => { if (st === 'SUBSCRIBED') retryPull(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) retryPull(); });
    addEventListener('online', retryPull);
    setInterval(() => { if (!document.hidden) retryPull(); }, 60000);
    return {
      ready: Promise.resolve(), remote: true, user, pull: retryPull,
      async put(col, id, patch) {
        const { data, error } = await sb.rpc('crm_put', { p_col: col, p_id: id, p_patch: patch });
        if (error) throw new Error(netText(error));
        apply(data);
        refresh();
      },
      // попросить сервер прочитать таблицы сейчас, не дожидаясь минуты
      async readSheets() { const { data, error } = await sb.functions.invoke('pull', { body: {} }); if (error) throw new Error('сервер не ответил'); return data.results || {}; },
      async devices() { const { data, error } = await sb.rpc('device_list'); if (error) throw new Error(netText(error)); return data; },
      async dropDevice(id) { const { error } = await sb.rpc('device_drop', { p_device: id }); if (error) throw new Error(netText(error)); },
      async logout() { await sb.rpc('device_drop', { p_device: deviceId() }); await sb.auth.signOut({ scope: 'local' }); location.reload(); },
      // нынешний пароль проверяем отдельным входом, который ничего не запоминает и сразу закрывается
      async changePassword(oldPass, newPass) {
        const probe = window.supabase.createClient(cfg.url, cfg.key, { auth: { storageKey: 'crm-l-probe', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
        const { error: e1 } = await probe.auth.signInWithPassword({ email: user.email, password: oldPass });
        if (e1) throw new Error(e1.message === 'Invalid login credentials' ? 'нынешний пароль неверный' : netText(e1));
        await probe.auth.signOut({ scope: 'local' });
        const { error } = await sb.auth.updateUser({ password: newPass });
        if (error) throw new Error(/different from the old/i.test(error.message) ? 'новый пароль совпадает с прежним' : /weak|at least/i.test(error.message) ? 'слишком простой пароль' : netText(error));
      },
    };
  }

  async function openStore() {
    if (window.CRM_L_CONFIG) return supabaseStore(window.CRM_L_CONFIG);
    let db = null;
    try { db = window.claude && await window.claude.use('db'); } catch { /* ниже запасной вариант */ }
    if (!db) return localStore();
    const exists = new Set(), queue = new Map();
    let settle;
    const ready = new Promise((r) => { settle = r; });
    const pending = new Set(COLS);
    const slow = setTimeout(() => toast('База долго не отвечает, показываю то, что есть'), 10000);
    for (const name of COLS) {
      db.collection(name).onSnapshot((snap) => {
        S[name] = {};
        for (const d of snap.docs) { S[name][d.id] = d.data(); exists.add(`${name}/${d.id}`); }
        if (!snap.metadata.fromCache) { pending.delete(name); if (!pending.size) { clearTimeout(slow); settle(); } }
        refresh();
      }, (e) => { clearTimeout(slow); toast('База: ' + human(e)); });
    }
    return {
      ready,
      // одна запись за раз на документ; update сливает поля, поэтому правки с двух устройств не затирают друг друга
      put(name, id, patch) {
        const key = `${name}/${id}`;
        const next = (queue.get(key) || Promise.resolve()).catch(() => {}).then(async () => {
          const ref = db.doc(key);
          const write = () => (exists.has(key) ? ref.update(patch) : ref.set(patch));
          try { await write(); } catch (e) {
            if (!e || e.code !== 'unavailable') throw e;
            await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
            await write();
          }
          exists.add(key);
        });
        queue.set(key, next);
        return next;
      },
    };
  }
  function localStore() {
    try { const saved = JSON.parse(localStorage.getItem('crm-l') || '{}'); for (const n of COLS) S[n] = saved[n] || {}; } catch { /* пустая база */ }
    if (window.claude) toast('База недоступна: изменения останутся только в этом браузере');
    return {
      ready: Promise.resolve(),
      async put(name, id, patch) {
        const old = S[name][id] || {};
        S[name][id] = { ...old, ...patch, ...(patch.log ? { log: { ...old.log, ...patch.log } } : {}) };
        try { localStorage.setItem('crm-l', JSON.stringify({ leads: S.leads, crm: S.crm, meta: S.meta })); } catch (e) { toast('Не сохранилось: ' + e.message); }
        refresh();
      },
    };
  }
  async function save(id, patch, text) {
    const now = new Date().toISOString();
    const p = { ...patch, updated_at: now };
    if (patch.status) p.status_at = now;
    if (text) p.log = { ['t' + Date.now() + Math.random().toString(36).slice(2, 5)]: { at: now, text, ...(store.user ? { by: store.user.email } : {}) } };
    try { await store.put('crm', id, p); return true; } catch (e) { toast('Не сохранилось: ' + human(e)); return false; }
  }

  /* ---------- Таблицы Facebook ---------- */
  const DRIVE = 'Google Drive';
  const MCP_TEXT = {
    needs_reauth: 'Google Drive отключился. Переподключите его: claude.ai, Настройки, Коннекторы',
    server_not_connected: 'Google Drive не подключён. Добавьте его: claude.ai, Настройки, Коннекторы',
    selection_required: 'Подключено несколько Google Drive. Выберите один в окне Claude',
    not_in_manifest: 'Доступ к Google Drive выключен. Включите его в разрешениях этой страницы',
    approval_required: 'Нажмите, чтобы разрешить чтение таблиц',
    consent_required: 'Нажмите, чтобы разрешить чтение таблиц',
    blocked_by_policy: 'Чтение Google Drive запрещено в настройках организации',
    server_unavailable: 'Google Drive не отвечает, попробую ещё раз сам',
    rate_limited: 'Google Drive просит подождать, попробую ещё раз сам',
  };
  const mcpText = (e) => (e && (MCP_TEXT[e.code] || e.message)) || 'Таблица не читается';

  async function ingest(src, rows) {
    await store.ready;
    const had = Object.values(S.leads).some((l) => l.source === src.id);
    const fresh = [];
    for (const { id, ...lead } of rowsToLeads(rows, src.id)) {
      const old = S.leads[id];
      // таблицу могут править посторонние, поэтому имя и телефон запоминаем с первого раза, обновляем только пометку
      if (!old) { await store.put('leads', id, lead); fresh.push(lead); } else if (old.note !== lead.note) await store.put('leads', id, { note: lead.note });
    }
    if (had && fresh.length) toast(fresh.length === 1 ? `Новая заявка: ${fresh[0].name || fmtPhone(fresh[0].phone)}` : `Новых заявок: ${fresh.length}`);
  }
  async function onPull(src, res) {
    try {
      const csv = csvFromResult(res);
      let rows;
      if (csv) rows = parseCSV(csv);
      else {
        const r = await mcp.callTool(DRIVE, 'read_file_content', { fileId: src.sheet });
        rows = parseMarkdownTable((r.payload && r.payload.fileContent) || '');
      }
      await ingest(src, rows);
      S.sync[src.id] = { at: (res.cache && res.cache.storedAt) || Date.now() };
    } catch (e) { S.sync[src.id] = { err: (e && MCP_TEXT[e.code]) || `«${src.name}»: ${human(e)}` }; }
    renderSync();
  }
  async function pullLocal(src) {
    try {
      const r = await fetch(`https://docs.google.com/spreadsheets/d/${src.sheet}/gviz/tq?tqx=out:csv&gid=0`);
      if (!r.ok) throw new Error('Google ответил ' + r.status);
      await ingest(src, parseCSV(await r.text()));
      S.sync[src.id] = { at: Date.now() };
    } catch (e) { S.sync[src.id] = { err: `«${src.name}»: ${e.message}` }; }
    renderSync();
  }
  const driveArgs = (src) => ({ fileId: src.sheet, exportMimeType: 'text/csv' });
  function watchSheets() {
    const key = JSON.stringify(sources().map((s) => [s.id, s.sheet]));
    if (!store || store.remote || key === watched) return;
    watched = key;
    stops.forEach((f) => f());
    stops = sources().map((src) => {
      if (mcp) {
        return mcp.watchTool(DRIVE, 'download_file_content', driveArgs(src), (ev) => {
          if (ev.type === 'data') { onPull(src, ev.result); return; }
          S.sync[src.id] = { ...S.sync[src.id], err: mcpText(ev.error) };
          renderSync();
        }, { refetchInterval: 60000, cache: { staleTime: 30000 } });
      }
      if (window.claude) { S.sync[src.id] = { err: 'Здесь таблицы не читаются, показаны сохранённые заявки' }; return () => {}; }
      pullLocal(src);
      const t = setInterval(() => pullLocal(src), 60000);
      return () => clearInterval(t);
    });
    renderSync();
  }
  async function pullNow() {
    $('#sync span').textContent = 'Обновляю';
    if (store && store.remote) { try { await store.readSheets(); } catch { /* покажет состояние базы */ } await store.pull(); renderSync(); return; }
    await Promise.all(sources().map(async (src) => {
      if (!mcp) { if (!window.claude) await pullLocal(src); return; }
      try { await onPull(src, await mcp.callTool(DRIVE, 'download_file_content', driveArgs(src), { cache: { refresh: true } })); } catch (e) { S.sync[src.id] = { ...S.sync[src.id], err: mcpText(e) }; }
    }));
    renderSync();
  }

  /* ---------- Данные для экрана ---------- */
  const fmtTime = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const fmtDay = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });
  const dayNo = (d) => Math.floor((new Date(d).setHours(12, 0, 0, 0)) / 864e5);
  function when(iso) {
    const d = new Date(iso), diff = dayNo(d) - dayNo(new Date());
    if (!iso || Number.isNaN(d.getTime())) return '';
    const day = diff === 0 ? 'сегодня' : diff === -1 ? 'вчера' : diff === 1 ? 'завтра' : fmtDay.format(d);
    return `${day} ${fmtTime.format(d)}`;
  }
  function view(id) {
    const lead = S.leads[id];
    if (!lead) return null;
    const c = S.crm[id] || {};
    const d = describe(lead.answer);
    const log = Object.values(c.log || {}).sort((a, b) => String(b.at).localeCompare(String(a.at)));
    const amount = Number.isFinite(c.amount) ? c.amount : c.amount === null ? null : d.exact ? d.exact.price : null;
    return { id, lead, c, d, log, amount, status: statusOf(lead, c), name: c.name || lead.name || fmtPhone(lead.phone) || 'Без имени' };
  }
  function views() {
    const q = S.q.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    return Object.keys(S.leads).map(view).filter((v) => {
      if (S.tab !== 'all' && v.lead.source !== S.tab) return false;
      if (!q) return true;
      if (digits.length >= 3 && phoneDigits(v.lead.phone).includes(digits)) return true;
      return [v.name, v.d.text, v.lead.answer, v.lead.note, v.lead.campaign, ...v.log.map((x) => x.text)].join(' ').toLowerCase().includes(q);
    });
  }
  const born = (v) => Date.parse(v.lead.created) || 0;
  function sortCol(status, list) {
    if (status === 'new') return list.sort((a, b) => born(b) - born(a));
    const next = (v) => (v.c.next ? Date.parse(v.c.next) : Infinity);
    const touched = (v) => Date.parse(v.c.updated_at) || born(v);
    return list.sort((a, b) => (next(a) === next(b) ? 0 : next(a) - next(b)) || touched(b) - touched(a));
  }
  function dueInfo(iso) {
    const d = new Date(iso), diff = dayNo(d) - dayNo(new Date());
    return { cls: d < new Date() ? 'is-overdue' : diff === 0 ? 'is-today' : '', label: (d < new Date() ? 'Просрочен ' : '') + when(iso) };
  }

  /* ---------- Экран ---------- */
  const need = (d) => `<p class="need">${d.bars ? `<span class="bars" aria-hidden="true">${[1, 2, 3].map((n) => `<i${n <= d.bars ? ' class="on"' : ''}></i>`).join('')}</span>` : ICON[d.kind] || ICON.other}<span>${esc(d.text)}</span></p>`;
  function wayLinks(phone, full) {
    const n = phoneDigits(phone);
    if (!n) return '';
    const list = [['call', 'tel:+' + n, 'Позвонить', ICON.phone], ['vb', 'viber://chat?number=%2B' + n, 'Viber', ICON.vb], ['tg', 'https://t.me/+' + n, 'Telegram', ICON.tg], ['wa', 'https://wa.me/' + n, 'WhatsApp', ICON.wa]];
    const attr = (k) => (k === 'tg' || k === 'wa' ? ' target="_blank" rel="noopener noreferrer"' : '');
    return list.map(([k, href, label, icon]) => `<a class="${full ? 'btn' : `way way-${k}`}" href="${href}"${attr(k)} data-copy="+${n}" aria-label="${label}" title="${label}">${icon}${full ? label : ''}</a>`).join('');
  }
  function cardHTML(v) {
    const { lead, c, d, status } = v;
    const src = sourceOf(lead.source);
    const wait = Date.now() - born(v);
    const age = status === 'new' && born(v) ? `<span class="age${wait > 36e5 ? ' hot' : ''}">ждёт ${ago(wait)}</span>`
      : status === 'wait' && c.status_at ? `<span class="age wait">ждём ${ago(Date.now() - Date.parse(c.status_at))}</span>` : '';
    const meta = [S.tab === 'all' && src ? src.name : '', { fb: 'FB', ig: 'IG' }[lead.platform] || PLATFORM[lead.platform], when(lead.created)].filter(Boolean).join(', ');
    const note = v.log.length ? v.log[0].text : lead.note;
    const due = c.next ? dueInfo(c.next) : null;
    return `<article class="card${S.seen && !S.seen.has(v.id) ? ' is-enter' : ''}" draggable="true" data-id="${esc(v.id)}">
  <p class="card-meta"><span>${esc(meta)}</span>${age}</p>
  <div class="card-top"><button class="card-open" type="button" data-act="open" data-id="${esc(v.id)}">${esc(v.name)}</button>${v.amount && status !== 'lost' ? `<span class="card-sum">${money(v.amount)}</span>` : ''}</div>
  ${need(d)}
  ${status === 'lost' ? `<p class="reason">${esc(c.lost_reason || 'Причина не указана')}</p>` : note ? `<p class="card-note">${esc(note)}</p>` : ''}
  ${status === 'lost' ? '' : `<div class="card-foot">${due ? `<span class="due ${due.cls}">${ICON.phone}${esc(due.label)}</span>` : ''}<span class="ways">${wayLinks(lead.phone)}</span></div>`}
</article>`;
  }
  const EMPTY = { new: 'Новых заявок нет', work: 'Перетащите сюда заявку, с которой говорите', wait: 'Ждём ответа или оплаты', client: 'Кто купил', lost: 'Кто отказался и почему' };
  function renderLines(all) {
    const count = (id) => all.filter((v) => id === 'all' || v.lead.source === id);
    const tab = (id, name, sub, icon) => {
      const fresh = count(id).filter((v) => v.status === 'new').length;
      return `<button class="line-tab${S.tab === id ? ' on' : ''}" type="button" data-act="line" data-id="${esc(id)}" aria-pressed="${S.tab === id}">${icon}<span><b>${esc(name)}</b><small>${esc(sub)}</small></span>${fresh ? `<span class="fresh" title="Новые">${fresh}</span>` : ''}</button>`;
    };
    const cur = count(S.tab), by = (p) => cur.filter((v) => v.lead.platform === p).length;
    const today = cur.filter((v) => born(v) && dayNo(v.lead.created) === dayNo(new Date())).length;
    $('#lines').innerHTML = tab('all', 'Все', 'все направления', ICON.all)
      + sources().map((s) => tab(s.id, s.name, s.brand || 'таблица Google', ICON[s.icon] || ICON.other)).join('')
      + '<button class="line-tab add" type="button" data-act="settings">Добавить таблицу</button>'
      + `<span class="line-sum">Всего ${cur.length}, Facebook ${by('fb')}, Instagram ${by('ig')}, сегодня ${today}</span>`;
  }
  function renderAgenda() {
    const list = Object.keys(S.crm).map(view).filter((v) => v && v.c.next && v.status !== 'lost').sort((a, b) => Date.parse(a.c.next) - Date.parse(b.c.next)).slice(0, 20);
    $('#agenda').innerHTML = list.length ? '<b>Перезвонить</b>' + list.map((v) => {
      const due = dueInfo(v.c.next);
      return `<button class="task ${due.cls}" type="button" data-act="open" data-id="${esc(v.id)}"><time>${esc(when(v.c.next))}</time><span>${esc(v.name)}</span></button>`;
    }).join('') : '';
  }
  function renderBoard() {
    const list = views();
    const board = $('#board');
    if (!board.children.length) {
      board.innerHTML = STATUSES.map(([k, label]) => `<section class="col s-${k}" data-col="${k}" aria-label="${label}"><div class="col-head"><h2>${label}</h2><span></span><em></em></div><div class="col-list" data-empty="${EMPTY[k]}"></div></section>`).join('');
    }
    for (const [k] of STATUSES) {
      const col = $(`[data-col="${k}"]`, board);
      const mine = sortCol(k, list.filter((v) => v.status === k));
      const sum = mine.reduce((a, v) => a + (v.amount || 0), 0);
      col.classList.toggle('is-cur', S.col === k);
      $('.col-head span', col).textContent = mine.length;
      $('.col-head em', col).textContent = sum ? money(sum) : '';
      $('.col-list', col).innerHTML = mine.map(cardHTML).join('');
    }
    $('#tabs').innerHTML = STATUSES.map(([k, label]) => `<button type="button" data-act="col" data-id="${k}" class="${S.col === k ? 'on' : ''}" aria-pressed="${S.col === k}">${label} <span>${list.filter((v) => v.status === k).length}</span></button>`).join('');
    S.seen = new Set(Object.keys(S.leads));
  }
  function renderSync() {
    if (store && store.remote) {
      // таблицы читает сервер раз в минуту; если не читал дольше 5 минут, это видно сразу
      const state = S.meta.intake || {};
      for (const s of sources()) {
        const at = Date.parse(state[s.id]), err = state[`${s.id}_err`];
        S.sync[s.id] = { ...(at ? { at } : {}), ...(err ? { err: `«${s.name}»: ${err}` } : at && Date.now() - at > 5 * 6e4 ? { err: `«${s.name}»: не читалась ${ago(Date.now() - at)}` } : {}) };
      }
      if (S.sync.link && S.sync.link.err) for (const s of sources()) S.sync[s.id] = { ...S.sync[s.id], err: S.sync.link.err };
    }
    const states = sources().map((s) => S.sync[s.id]).filter(Boolean);
    const bad = states.find((s) => s.err);
    const at = Math.min(...states.filter((s) => s.at).map((s) => s.at));
    const el = $('#sync');
    el.className = 'sync' + (bad ? ' err' : states.length ? ' live' : '');
    const text = bad ? bad.err : Number.isFinite(at) ? `Таблицы: ${fmtTime.format(at)}` : sources().length ? 'Читаю таблицы' : 'Таблиц нет';
    $('span', el).textContent = text;
    el.title = text + '. Нажмите, чтобы обновить';
    if ($('#modal').open && $('#modal .src')) $('#modal .src').innerHTML = sourceRows();
  }
  let queued = false;
  function refresh() {
    if (queued) return;
    queued = true;
    // не requestAnimationFrame: в фоновой вкладке он стоит, а счётчик в заголовке нужен именно там
    setTimeout(() => {
      queued = false;
      if (dragId) { setTimeout(refresh, 300); return; }
      if (S.tab !== 'all' && sources().length && !sourceOf(S.tab)) S.tab = 'all';
      const all = Object.keys(S.leads).map(view);
      const fresh = all.filter((v) => v.status === 'new').length;
      document.title = fresh ? `(${fresh}) CRM L` : 'CRM L';
      renderLines(all); renderAgenda(); renderBoard(); renderDrawer(); watchSheets(); if (store && store.remote) renderSync();
    }, 16);
  }

  /* ---------- Карточка клиента ---------- */
  const OUTCOMES = {
    talk: { label: 'Поговорили', go: (st) => (['new', 'wait', 'lost'].includes(st) ? { status: 'work' } : {}) },
    miss: { label: 'Не дозвонился', go: (st) => ({ ...(st === 'new' ? { status: 'work' } : {}), next: inTwoHours().toISOString() }) },
    kp: { label: 'Отправил КП', go: () => ({ status: 'wait', next: atDay(2).toISOString() }) },
    buy: { label: 'Купил', go: () => ({ status: 'client', next: null }) },
  };
  const localInput = (iso) => { const d = new Date(iso); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); };
  let drawn = null, asking = null;
  function renderDrawer() {
    const box = $('#drawer');
    const v = S.open && view(S.open);
    if (!v) { if (box.open) box.close(); return; }
    const ae = document.activeElement;
    const keep = drawn === v.id && box.contains(ae) && ae.id ? { id: ae.id, val: ae.value, at: ae.selectionStart } : null;
    const draft = drawn === v.id && $('#d-note') ? $('#d-note').value : '';
    const top = drawn === v.id && $('.d-scroll', box) ? $('.d-scroll', box).scrollTop : 0;
    drawn = v.id;
    const { lead, c, d } = v;
    const src = sourceOf(lead.source);
    const twins = Object.keys(S.leads).filter((id) => id !== v.id && phoneDigits(lead.phone) && phoneDigits(S.leads[id].phone) === phoneDigits(lead.phone)).map(view);
    const lostOpen = v.status === 'lost' || asking === v.id;
    const facts = [['Направление', src && src.name], ['Откуда', PLATFORM[lead.platform]], ['Пришла', lead.created && `${fmtDay.format(new Date(lead.created))}, ${fmtTime.format(new Date(lead.created))}`], ['Кампания', lead.campaign], ['Объявление', lead.ad], ['Форма', lead.form], ['Ответ в форме', lead.answer]].filter((f) => f[1]);
    box.innerHTML = `<div class="d-head"><input id="d-name" value="${esc(v.name)}" aria-label="Имя клиента" autocomplete="off"><button class="icon-btn" type="button" data-act="close" aria-label="Закрыть">${ICON.close}</button></div>
<div class="seg" role="group" aria-label="Статус">${STATUSES.map(([k, l]) => `<button type="button" class="s-${k}${v.status === k ? ' on' : ''}" data-act="status" data-id="${k}" aria-pressed="${v.status === k}">${l}</button>`).join('')}</div>
<div class="d-scroll">
  ${lostOpen ? `<div class="lost-box"><b>Почему в минус?</b><div class="chips">${REASONS.map((r) => `<button type="button" class="${c.lost_reason === r && v.status === 'lost' ? 'on' : ''}" data-act="reason" data-id="${esc(r)}">${esc(r)}</button>`).join('')}</div><form class="own" data-form="reason"><input id="d-reason" name="reason" maxlength="80" autocomplete="off" placeholder="Своя причина" aria-label="Своя причина" value="${esc(v.status === 'lost' && c.lost_reason && !REASONS.includes(c.lost_reason) ? c.lost_reason : '')}"><button class="btn">В минус</button></form></div>` : ''}
  <section class="sec"><p class="phone">${esc(fmtPhone(lead.phone) || 'Телефона нет')}</p><div class="go">${wayLinks(lead.phone, true)}${phoneDigits(lead.phone) ? `<button class="btn quiet" type="button" data-act="copy" data-copy="+${phoneDigits(lead.phone)}">Скопировать номер</button>` : ''}</div>
  ${twins.map((t) => `<p class="warn">Этот номер уже есть: <button class="btn small" type="button" data-act="open" data-id="${esc(t.id)}">${esc(t.name)}, ${esc((sourceOf(t.lead.source) || {}).name || '')}</button></p>`).join('')}</section>
  <section class="sec"><h3>Чем закончился контакт</h3><div class="outs">${Object.entries(OUTCOMES).map(([k, o]) => `<button class="btn" type="button" data-act="out" data-id="${k}">${o.label}</button>`).join('')}<button class="btn" type="button" data-act="ask">Отказ</button></div></section>
  <section class="sec"><h3>Что нужно</h3>${need(d)}${d.warn ? `<p class="warn">${esc(d.warn)}</p>` : ''}
  ${d.models.length ? `<ul class="models">${d.models.map((m) => `<li><b>${esc(m.name)}</b><span class="p">${money(m.price)}</span><small>${esc(m.info)}</small><a href="${m.url}" target="_blank" rel="noopener noreferrer">Rozetka</a></li>`).join('')}</ul><p class="hint">Цены и наличие на ${PRICE_DATE}</p>` : ''}
  ${lead.note ? `<p class="quote">${esc(lead.note)}<br><span class="hint">пометка в таблице Google</span></p>` : ''}</section>
  <section class="sec"><div class="row2"><label class="f"><span>Сумма сделки, ₴</span><input id="d-amount" inputmode="numeric" autocomplete="off" value="${v.amount == null ? '' : v.amount}"></label><label class="f"><span>Следующий звонок</span><input id="d-next" type="datetime-local" value="${c.next ? localInput(c.next) : ''}"></label></div>
  <div class="chips">${[['2h', 'Через 2 часа'], ['1', 'Завтра 10:00'], ['3', 'Через 3 дня'], ['7', 'Через неделю']].map(([k, l]) => `<button type="button" data-act="next" data-id="${k}">${l}</button>`).join('')}${c.next ? '<button type="button" data-act="next" data-id="off">Убрать звонок</button>' : ''}</div></section>
  <section class="sec"><label class="f"><span>О чём говорили</span><textarea id="d-note" placeholder="Что нужно, куда доставка, о чём договорились"></textarea></label><div class="foot"><button class="btn primary" type="button" data-act="note">Записать</button></div>
  ${v.log.length ? `<ul class="log">${v.log.map((x) => `<li><time>${esc([when(x.at), x.by].filter(Boolean).join(', '))}</time>${esc(x.text)}</li>`).join('')}</ul>` : ''}</section>
  <section class="sec"><h3>Заявка</h3><dl class="d-src">${facts.map(([k, t]) => `<dt>${k}</dt><dd>${esc(t)}</dd>`).join('')}${src ? `<dt>Таблица</dt><dd><a href="https://docs.google.com/spreadsheets/d/${esc(src.sheet)}/edit" target="_blank" rel="noopener noreferrer">открыть в Google</a></dd>` : ''}</dl></section>
</div>`;
    $('#d-note').value = draft;
    if (keep && $('#' + keep.id)) { const el = $('#' + keep.id); el.value = keep.val; el.focus(); try { el.setSelectionRange(keep.at, keep.at); } catch { /* не текстовое поле */ } }
    if (!box.open) box.showModal();
    $('.d-scroll', box).scrollTop = top;
  }
  function openLead(id) { S.open = id; asking = null; if ($('#modal').open) $('#modal').close(); renderDrawer(); }
  const LABEL = Object.fromEntries(STATUSES);
  async function setStatus(id, status) {
    const v = view(id);
    if (!v || v.status === status) return;
    if (status === 'lost') { S.open = id; asking = id; renderDrawer(); $('.d-scroll').scrollTop = 0; return; }
    asking = null;
    await save(id, { status, ...(status === 'client' ? { next: null } : {}) }, `Статус: ${LABEL[status]}`);
  }

  /* ---------- Окна ---------- */
  const modal = (html) => { const m = $('#modal'); m.innerHTML = html; if (!m.open) m.showModal(); };
  function openNew() {
    if (!sources().length) { openSettings(); return; }
    modal(`<form data-form="new"><h2>Новая заявка</h2>
<label class="f"><span>Телефон</span><input id="n-phone" name="phone" type="tel" inputmode="tel" autocomplete="off" required placeholder="+380"></label><div id="n-match"></div>
<label class="f"><span>Имя или компания</span><input id="n-name" name="name" autocomplete="off"></label>
<div class="row2"><label class="f"><span>Направление</span><select id="n-src" name="source">${sources().map((s) => `<option value="${esc(s.id)}"${s.id === S.tab ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
<label class="f"><span>Что нужно</span><input id="n-need" name="answer" autocomplete="off" placeholder="100 кВА в кожухе"></label></div>
<label class="f"><span>О чём говорили</span><textarea id="n-note" name="note"></textarea></label>
<div class="foot"><button class="btn quiet" type="button" data-act="close">Отмена</button><button class="btn primary">Сохранить</button></div></form>`);
    $('#n-phone').focus();
  }
  const sourceRows = () => sources().map((s) => {
    const st = S.sync[s.id] || {};
    const n = Object.values(S.leads).filter((l) => l.source === s.id).length;
    return `<li><div><b>${esc(s.name)}</b><small class="${st.err ? 'bad' : ''}">${esc(st.err || `Заявок: ${n}${st.at ? `, прочитано в ${fmtTime.format(st.at)}` : ''}`)}</small></div><a class="btn small" href="https://docs.google.com/spreadsheets/d/${esc(s.sheet)}/edit" target="_blank" rel="noopener noreferrer">Открыть</a><button class="btn small quiet" type="button" data-act="drop" data-id="${esc(s.id)}">Отключить</button></li>`;
  }).join('');
  function openSettings() {
    modal(`<div class="box"><h2>Таблицы с заявками</h2><ul class="src">${sourceRows()}</ul>
<form data-form="source"><h3>Добавить ещё одну</h3><label class="f"><span>Название вкладки</span><input id="s-name" name="name" required autocomplete="off" placeholder="Например, Погрузчики"></label>
<label class="f"><span>Ссылка на таблицу Google</span><input id="s-link" name="link" required autocomplete="off" placeholder="https://docs.google.com/spreadsheets/d/…"></label><p class="hint">Подходит любая таблица, куда Facebook складывает заявки. В ней должен быть открыт доступ «Все, у кого есть ссылка», «Читатель».</p>
<div class="foot"><button class="btn quiet" type="button" data-act="close">Закрыть</button><button class="btn primary">Добавить</button></div></form>${store && store.remote ? `<hr class="rule"><h3>Аккаунт</h3><p>${esc(store.user.email)}</p><ul class="src" id="acc-dev"><li><small>Загружаю устройства</small></li></ul><p class="hint">У аккаунта не больше двух устройств. Браузер и значок на экране «Домой» считаются отдельно.</p>
<form data-form="pass"><h3>Сменить пароль</h3><input type="email" autocomplete="username" value="${esc(store.user.email)}" hidden><label class="f"><span>Нынешний пароль</span><input id="p-old" name="old" type="password" autocomplete="current-password" required></label><label class="f"><span>Новый пароль, от 8 знаков</span><input id="p-new" name="new" type="password" autocomplete="new-password" minlength="8" required></label><label class="f"><span>Новый пароль ещё раз</span><input id="p-rep" name="rep" type="password" autocomplete="new-password" required></label><div class="foot"><button class="btn quiet" type="button" data-act="logout">Выйти</button><button class="btn">Сменить пароль</button></div></form>` : ''}</div>`);
    if (store && store.remote) showDevices();
  }
  async function showDevices() {
    let html;
    try { html = (await store.devices()).map((d) => deviceRow(d, 'dev-drop')).join(''); } catch (e) { html = `<li><small class="bad">Не загрузилось: ${esc(human(e))}</small></li>`; }
    if ($('#acc-dev')) $('#acc-dev').innerHTML = html;
  }
  const saveSources = (list) => store.put('meta', 'sources', { list }).catch((e) => toast('Не сохранилось: ' + human(e)));
  let toastTimer;
  // popover: поверх открытых окон, иначе на телефоне сообщение под карточкой
  function toast(text) { const t = $('#toast'); t.textContent = text; t.hidden = false; if (t.showPopover) { if (t.matches(':popover-open')) t.hidePopover(); t.showPopover(); } clearTimeout(toastTimer); toastTimer = setTimeout(() => { if (t.hidePopover) t.hidePopover(); t.hidden = true; }, 4200); }
  async function copy(text) { try { await navigator.clipboard.writeText(text); toast(`Номер ${fmtPhone(text)} скопирован`); } catch { /* номер виден в карточке, его можно выделить */ } }

  /* ---------- Действия ---------- */
  const ACT = {
    open: (id) => openLead(id),
    line: (id) => { S.tab = id; location.hash = id; refresh(); },
    col: (id) => { S.col = id; refresh(); },
    close: (id, el) => el.closest('dialog').close(),
    sync: pullNow, new: openNew, settings: openSettings,
    copy: () => {},
    status: (id) => setStatus(S.open, id),
    ask: () => { asking = S.open; renderDrawer(); $('.d-scroll').scrollTop = 0; },
    reason: async (id) => { const lead = S.open; asking = null; $('#d-reason').blur(); if (await save(lead, { status: 'lost', lost_reason: id, next: null }, `Минус: ${id}`)) toast('Перенёс в минус'); },
    out: async (id) => { const v = view(S.open), o = OUTCOMES[id]; asking = null; if (await save(v.id, o.go(v.status), o.label)) toast(o.label + ', записал'); },
    next: (id) => save(S.open, { next: id === 'off' ? null : (id === '2h' ? inTwoHours() : atDay(+id)).toISOString() }),
    note: async () => { const el = $('#d-note'), text = el.value.trim(); if (!text) { el.focus(); return; } if (await save(S.open, {}, text)) { $('#d-note').value = ''; toast('Записал'); } },
    logout: () => store.logout(),
    'dev-drop': async (id, el) => {
      if (!el.dataset.sure) { el.dataset.sure = 1; el.textContent = 'Точно отключить?'; return; }
      try { await store.dropDevice(id); toast('Устройство отключено'); } catch (e) { toast('Не получилось: ' + human(e)); }
      showDevices();
    },
    drop: (id, el) => { if (el.dataset.sure) { saveSources(sources().filter((s) => s.id !== id)).then(openSettings); toast('Таблица отключена, её заявки остались во вкладке «Все»'); } else { el.dataset.sure = 1; el.textContent = 'Точно отключить?'; } },
  };
  document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-copy]');
    if (c) copy(c.dataset.copy);
    const el = e.target.closest('[data-act]');
    if (el && ACT[el.dataset.act]) ACT[el.dataset.act](el.dataset.id, el);
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'd-name') save(S.open, { name: t.value.trim() });
    if (t.id === 'd-amount') { const n = t.value.replace(/[^\d.,]/g, '').replace(',', '.'); save(S.open, { amount: n === '' ? null : Number(n) || 0 }); }
    if (t.id === 'd-next') { const d = new Date(t.value); save(S.open, { next: t.value && !Number.isNaN(d.getTime()) ? d.toISOString() : null }); }
  });
  document.addEventListener('input', (e) => {
    if (e.target.id === 'q') { S.q = e.target.value; refresh(); }
    if (e.target.id === 'n-phone') {
      const n = phoneDigits(e.target.value);
      const hit = n.length >= 9 && Object.keys(S.leads).find((id) => phoneDigits(S.leads[id].phone) === n);
      $('#n-match').innerHTML = hit ? `<p class="warn">Уже есть: <button class="btn small" type="button" data-act="open" data-id="${esc(hit)}">${esc(view(hit).name)}</button></p>` : '';
    }
  });
  document.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (e.target.dataset.form === 'login') return;
    const f = Object.fromEntries(new FormData(e.target));
    if (e.target.dataset.form === 'reason') { if (f.reason.trim()) ACT.reason(f.reason.trim()); else $('#d-reason').focus(); return; }
    if (e.target.dataset.form === 'pass') {
      if (f.new.length < 8) { toast('Новый пароль короче 8 знаков'); return; }
      if (f.new !== f.rep) { toast('Новые пароли не совпадают'); return; }
      const btn = $('button:not([type])', e.target);
      btn.disabled = true;
      try { await store.changePassword(f.old, f.new); e.target.reset(); toast('Пароль сменён. На другом устройстве войдите заново'); } catch (err) { toast('Не сменился: ' + human(err)); }
      btn.disabled = false;
      return;
    }
    if (e.target.dataset.form === 'source') {
      const sheet = sheetIdOf(f.link);
      if (!sheet) { toast('Это не ссылка на таблицу Google'); return; }
      const gid = gidOf(f.link);
      // ссылка с gid=0 и без него — один и тот же первый лист
      if (sources().some((s) => s.sheet === sheet && (Number(s.gid) || 0) === (Number(gid) || 0))) { toast('Эта таблица уже подключена'); return; }
      const id = 's' + Date.now();
      await saveSources([...sources(), { id, name: f.name.trim(), icon: 'other', sheet, ...(gid ? { gid } : {}) }]);
      openSettings();
      if (store.remote) {
        toast('Читаю таблицу');
        try {
          const r = (await store.readSheets())[id];
          await new Promise((ok) => setTimeout(ok, 900)); // после сообщения о новых заявках
          toast(!r ? 'Таблица подключена, заявки появятся в течение минуты' : r.err ? `«${f.name.trim()}»: ${r.err}` : `Таблица подключена, заявок: ${r.count}`);
          await store.pull();
        } catch (err) { toast('Таблица подключена, но ' + human(err)); }
      }
    } else {
      if (phoneDigits(f.phone).length < 7) { toast('Проверьте номер телефона'); return; }
      const id = 'm:' + Date.now() + Math.random().toString(36).slice(2, 6);
      const now = new Date().toISOString();
      try { await store.put('leads', id, { source: f.source, created: now, name: f.name.trim(), phone: '+' + phoneDigits(f.phone), answer: f.answer.trim(), note: '', platform: 'manual', campaign: '', ad: '', form: '' }); } catch (err) { toast('Не сохранилось: ' + human(err)); return; }
      await save(id, { status: 'work' }, f.note.trim() || 'Заявка записана вручную');
      $('#modal').close();
      toast('Заявка сохранена');
    }
  });
  document.addEventListener('keydown', (e) => { if (e.target.id === 'd-note' && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) ACT.note(); });
  $('#drawer').addEventListener('close', () => { S.open = null; drawn = null; asking = null; });
  for (const id of ['#drawer', '#modal']) $(id).addEventListener('click', (e) => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.currentTarget.close(); } });

  const board = $('#board');
  const colAt = (e) => e.target.closest && e.target.closest('.col');
  board.addEventListener('dragstart', (e) => { const c = e.target.closest('.card'); if (!c) return; dragId = c.dataset.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); c.classList.add('dragging'); });
  board.addEventListener('dragover', (e) => { const c = colAt(e); if (!c || !dragId) return; e.preventDefault(); board.querySelectorAll('.col').forEach((x) => x.classList.toggle('over', x === c)); });
  board.addEventListener('drop', (e) => { const c = colAt(e), id = dragId; if (!c || !id) return; e.preventDefault(); dragId = null; setStatus(id, c.dataset.col); });
  board.addEventListener('dragend', () => { dragId = null; board.querySelectorAll('.over, .dragging').forEach((x) => x.classList.remove('over', 'dragging')); refresh(); });

  const fromHash = () => { S.tab = location.hash.slice(1) || 'all'; refresh(); };
  addEventListener('hashchange', fromHash);
  setInterval(refresh, 60000);
  (async () => {
    fromHash();
    try { store = await openStore(); } catch (e) { if (e.message !== 'frame') toast('Не открылось: ' + human(e)); return; }
    try { mcp = window.claude ? await window.claude.use('mcp') : null; } catch { mcp = null; }
    refresh();
  })();
})();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');

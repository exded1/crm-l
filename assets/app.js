
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
    cal: svg('<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>'),
    prev: svg('<path d="M14.5 5.5L8 12l6.5 6.5"/>'),
    next: svg('<path d="M9.5 5.5L16 12l-6.5 6.5"/>'),
  };
  const PLATFORM = { fb: 'Facebook', ig: 'Instagram', manual: 'Вручную' };
  const COLS = ['leads', 'crm', 'meta'];
  const S = { leads: {}, crm: {}, meta: {}, tab: 'all', col: 'new', q: '', open: null, sync: {} };
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
    const app = matchMedia('(display-mode: standalone)').matches ? 'значок CRM L' : /Edg/.test(u) ? 'Edge' : /OPR\//.test(u) ? 'Opera' : /Firefox|FxiOS/.test(u) ? 'Firefox' : /SamsungBrowser/.test(u) ? 'Samsung Internet' : /Chrome|CriOS/.test(u) ? 'Chrome' : 'Safari';
    return `${os}, ${app}`;
  }
  // mode: wait — открываем, login — почта и пароль, retry — только «Повторить»
  function showGate(mode, text) {
    const gate = $('#gate');
    gate.getAnimations().forEach((x) => x.cancel());
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
    const sb = window.supabase.createClient(cfg.url, cfg.key, { auth: { storageKey: AUTH_KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      global: { fetch: (u, o = {}) => fetch(u, { ...o, signal: o.signal || AbortSignal.timeout(20000) }) } }); // зависший запрос — тоже «нет связи»
    const user = await signIn(sb);
    const at = new Map();
    // старая копия строки не затирает новую: порядок по часам базы
    const apply = (row) => {
      const key = `${row.col}/${row.id}`, t = Date.parse(row.updated_at) || 0;
      if ((at.get(key) || 0) > t || (at.get(key) === t && JSON.stringify(S[row.col][row.id]) === JSON.stringify(row.data))) return false;
      if (row.col === 'leads' && started && !S.leads[row.id] && row.data.platform !== 'manual') {
        // заявки одного чтения — одним сообщением
        if (!came.length) setTimeout(() => { toast(came.length === 1 ? `Новая заявка: ${came[0].name || fmtPhone(came[0].phone)}` : `Новых заявок: ${came.length}`); came = []; }, 700);
        came.push(row.data);
      }
      at.set(key, t);
      S[row.col][row.id] = row.data;
      return true;
    };
    // новое только «когда прочитаны таблицы» — доску не перерисовываем
    const show = (rows) => { if (rows.filter(apply).some((r) => r.id !== 'intake')) refresh(); else renderSync(); };
    let started = false, came = [], busy = null;
    // первый раз всё, дальше только изменившееся (строки не удаляются); 30 секунд внахлёст, чтобы не потерять запись, которая дошла позже
    const pull = async () => {
      const since = at.size ? new Date(Math.max(...at.values()) - 30000).toISOString() : '1970-01-01T00:00:00Z';
      // это устройство отключили с другого: на экран входа
      const { data: alive, error: e0 } = await sb.rpc('is_team');
      if (e0) throw new Error(netText(e0));
      if (!alive) { location.reload(); return; }
      const rows = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await sb.from('crm_docs').select('col,id,data,updated_at').gt('updated_at', since).order('col').order('id').range(from, from + 999);
        if (error) throw new Error(netText(error));
        rows.push(...data);
        if (data.length < 1000) break;
      }
      S.sync.link = {};
      show(rows);
    };
    const noLink = (text) => { S.sync.link = { err: text }; renderSync(); };
    const retryPull = () => (busy ||= pull().catch((e) => noLink(e.message === 'нет связи' ? 'Нет связи с базой' : e.message)).finally(() => { busy = null; }));
    for (;;) { try { await pull(); break; } catch { await askGate(sb, 'retry', OFFLINE); } }
    const bye = play($('#gate'), { opacity: [1, 0] }, 240);
    if (bye) bye.onfinish = () => { $('#gate').hidden = true; }; else $('#gate').hidden = true;
    started = true;
    sb.channel('crm-l').on('postgres_changes', { event: '*', schema: 'public', table: 'crm_docs' }, (p) => { if (p.new && p.new.id) show([p.new]); })
      .subscribe((st) => { if (st === 'SUBSCRIBED') retryPull(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) retryPull(); });
    addEventListener('online', retryPull);
    addEventListener('offline', () => noLink('Нет связи'));
    // живой канал приносит правки сразу; это подстраховка на случай, если телефон его усыпил
    setInterval(() => { if (!document.hidden) retryPull(); }, 10000);
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
      async history(id) { const { data, error } = await sb.from('crm_history').select('at,email,device,field,old,new').eq('lead', id).order('at', { ascending: false }).order('id').limit(300); if (error) throw new Error(netText(error)); return data; },
      async pushInfo() { const { data, error } = await sb.rpc('push_info'); if (error) throw new Error(netText(error)); return data; },
      async pushSet(p_sub, p_leads, p_calls) { const { error } = await sb.rpc('push_set', { p_sub, p_leads, p_calls }); if (error) throw new Error(netText(error)); },
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
  async function save(id, patch, text, auto) {
    const now = new Date().toISOString();
    const p = { ...patch, updated_at: now };
    if (patch.status) p.status_at = now;
    if (text) p.log = { ['t' + Date.now() + Math.random().toString(36).slice(2, 5)]: { at: now, text, ...(store.user ? { by: store.user.email } : {}), ...(auto ? { auto: true } : {}) } };
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
  // нажали на значок: прочитать таблицы сейчас; значок крутится, итог говорит сообщение
  async function pullNow() {
    const el = $('#sync');
    if (!store || el.getAttribute('aria-busy') === 'true') return;
    el.setAttribute('aria-busy', 'true');
    let busy = true;
    const work = pullAll().finally(() => { busy = false; renderSync(); });
    // крутим целыми оборотами: загрузка кончилась раньше — оборот всё равно доходит до конца. Таймер — для скрытой вкладки, там кадров нет
    do {
      if (still.matches) break;
      const turn = $('.mark svg', el).animate({ transform: ['rotate(0deg)', 'rotate(360deg)'] }, { duration: 900, easing: 'cubic-bezier(.45, .05, .55, .95)' });
      await Promise.race([turn.finished, new Promise((ok) => setTimeout(ok, 1400))]);
    } while (busy);
    const fresh = await work;
    el.setAttribute('aria-busy', 'false');
    const bad = [S.sync.link, ...sources().map((s) => S.sync[s.id])].find((x) => x && x.err);
    if (bad) toast(bad.err); else if (!fresh) toast('Обновлено, новых заявок нет');
  }
  async function pullAll() {
    if (store.remote) {
      let fresh = 0;
      try { for (const r of Object.values(await store.readSheets())) fresh += r.fresh || 0; } catch { /* причину покажет состояние базы */ }
      await store.pull();
      return fresh;
    }
    const before = Object.keys(S.leads).length;
    await Promise.all(sources().map(async (src) => {
      if (!mcp) { if (!window.claude) await pullLocal(src); return; }
      try { await onPull(src, await mcp.callTool(DRIVE, 'download_file_content', driveArgs(src), { cache: { refresh: true } })); } catch (e) { S.sync[src.id] = { ...S.sync[src.id], err: mcpText(e) }; }
    }));
    return Object.keys(S.leads).length - before;
  }

  /* ---------- Плавность ---------- */
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const play = (el, frames, ms = 260) => (still.matches || !el.animate ? null : el.animate(frames, { duration: ms, easing: 'cubic-bezier(.22, 1, .36, 1)' }));
  // Обновляем разметку на месте, а не целиком: те же элементы остаются собой, поэтому переходы CSS доигрывают, а фокус, набранный текст и прокрутка не сбиваются
  const keyOf = (n) => (n.nodeType !== 1 ? '' : n.id || n.dataset.k || (n.dataset.act || n.dataset.id ? `${n.dataset.act || ''}:${n.dataset.id || ''}` : ''));
  function sync(a, b) {
    const free = new Set(a.childNodes);
    let at = a.firstChild;
    for (const n of [...b.childNodes]) {
      let o = null;
      for (const x of free) if (x.nodeName === n.nodeName && keyOf(x) === keyOf(n)) { o = x; break; }
      free.delete(o);
      if (o && o.nodeType === 1) {
        for (const { name, value } of n.attributes) if (o.getAttribute(name) !== value) o.setAttribute(name, value);
        for (const { name } of [...o.attributes]) if (!n.hasAttribute(name)) o.removeAttribute(name);
        if (n.nodeName === 'INPUT' && o !== document.activeElement && o.value !== n.value) o.value = n.value;
        if (n.nodeName !== 'TEXTAREA') sync(o, n);
      } else if (o && o.data !== n.data) o.data = n.data;
      if ((o || n) === at) at = at.nextSibling; else a.insertBefore(o || n, at);
    }
    for (const x of free) x.remove();
  }
  function morph(el, html) {
    if (el.lastHtml === html) return;
    el.lastHtml = html;
    const t = document.createElement('template');
    t.innerHTML = html;
    sync(el, t.content);
  }
  // Окно сначала рисуется за краем, движение начинается через четыре кадра: иначе Safari теряет начало, пока рисует. Таймер — для скрытой вкладки.
  // Закрывается после анимации; открыли раньше — она разворачивается обратно
  function raise(d) {
    const turn = d.turn = (d.turn || 0) + 1, go = () => { if (d.turn === turn) d.classList.remove('closing', 'pre'); };
    if (d.open || still.matches) { go(); if (!d.open) d.showModal(); return; }
    d.classList.add('closing', 'pre');
    d.showModal();
    let left = 4;
    const frame = () => { left -= 1; if (left) requestAnimationFrame(frame); else go(); };
    requestAnimationFrame(frame);
    setTimeout(go, 160);
  }
  function shut(d) {
    if (!d.open || d.classList.contains('closing')) return;
    if (d.contains(document.activeElement)) document.activeElement.blur(); // недописанное поле успевает сохраниться
    if (d.id === 'drawer') S.open = null; // чтобы обновление данных не открыло карточку обратно
    d.classList.add('closing');
    const turn = d.turn = (d.turn || 0) + 1;
    // таймер — для скрытой вкладки, там анимации не заканчиваются
    Promise.race([Promise.allSettled(d.getAnimations().map((x) => x.finished)), new Promise((ok) => setTimeout(ok, 500))]).then(() => { if (d.turn === turn) { d.close(); d.classList.remove('closing', 'pre'); } });
  }
  // высота окна меняется плавно, а не скачком
  function grow(change) {
    const m = $('#modal'), h = m.offsetHeight;
    change();
    if (m.open && h && h !== m.offsetHeight) play(m, { height: [`${h}px`, `${m.offsetHeight}px`] });
  }

  /* ---------- Данные для экрана ---------- */
  const fmtTime = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const fmtDay = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });
  const fmtLong = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
  const fmtMonth = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' });
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
    return `<article class="card" draggable="true" data-id="${esc(v.id)}">
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
    morph($('#lines'), tab('all', 'Все', 'все направления', ICON.all)
      + sources().map((s) => tab(s.id, s.name, s.brand || 'таблица Google', ICON[s.icon] || ICON.other)).join('')
      + '<button class="line-tab add" type="button" data-act="settings">Добавить таблицу</button>'
      + `<span class="line-sum">Всего ${cur.length}, Facebook ${by('fb')}, Instagram ${by('ig')}, сегодня ${today}</span>`);
  }
  function renderAgenda() {
    const list = Object.keys(S.crm).map(view).filter((v) => v && v.c.next && v.status !== 'lost').sort((a, b) => Date.parse(a.c.next) - Date.parse(b.c.next)).slice(0, 20);
    morph($('#agenda'), list.length ? '<b>Перезвонить</b>' + list.map((v) => {
      const due = dueInfo(v.c.next);
      return `<button class="task ${due.cls}" type="button" data-act="open" data-id="${esc(v.id)}"><time>${esc(when(v.c.next))}</time><span>${esc(v.name)}</span></button>`;
    }).join('') : '');
  }
  // где карточки были до обновления: потом они доезжают на новые места, а не перескакивают
  let shown = null;
  const snap = () => new Map(still.matches ? [] : [...document.querySelectorAll('#board .card')].map((x) => [x.dataset.id, [x.getBoundingClientRect(), x.parentNode]]));
  function moveCards(was) {
    const now = { tab: S.tab, col: S.col, q: S.q }, old = shown, at = (k) => STATUSES.findIndex((x) => x[0] === k);
    shown = now;
    if (!old || old.q !== now.q) return; // первый показ и набор в поиске — сразу
    if (old.tab !== now.tab || old.col !== now.col) {
      const from = old.col !== now.col ? `translateX(${at(now.col) > at(old.col) ? 28 : -28}px)` : 'translateY(10px)';
      for (const x of document.querySelectorAll('#board .col-list')) play(x, { opacity: [0, 1], transform: [from, 'none'] }, 240);
      return;
    }
    for (const x of document.querySelectorAll('#board .card')) {
      const r = x.getBoundingClientRect(), [o, parent] = was.get(x.dataset.id) || [];
      if (!r.width || r.bottom < 0 || r.top > innerHeight) continue;
      if (!o || !o.width || parent !== x.parentNode) play(x, { opacity: [0, 1], transform: ['scale(.96)', 'none'] }, 280);
      else if (Math.abs(o.top - r.top) > 1 || Math.abs(o.left - r.left) > 1) play(x, { transform: [`translate(${o.left - r.left}px, ${o.top - r.top}px)`, 'none'] }, 320);
    }
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
      morph($('.col-list', col), mine.map(cardHTML).join(''));
    }
    morph($('#tabs'), STATUSES.map(([k, label]) => `<button type="button" data-act="col" data-id="${k}" class="${S.col === k ? 'on' : ''}" aria-pressed="${S.col === k}">${label} <span>${list.filter((v) => v.status === k).length}</span></button>`).join(''));
  }
  function renderSync() {
    if (store && store.remote) {
      // таблицы читает сервер каждые 20 секунд; если не читал дольше 5 минут, это видно сразу
      const state = S.meta.intake || {};
      for (const s of sources()) {
        const at = Date.parse(state[s.id]), err = state[`${s.id}_err`];
        S.sync[s.id] = { ...(at ? { at } : {}), ...(err ? { err: `«${s.name}»: ${err}` } : at && Date.now() - at > 5 * 6e4 ? { err: `«${s.name}»: не читалась ${ago(Date.now() - at)}` } : {}) };
      }
    }
    const link = S.sync.link;
    const states = sources().map((s) => S.sync[s.id]).filter(Boolean);
    const bad = link && link.err ? link : states.find((s) => s.err);
    const at = Math.min(...states.filter((s) => s.at).map((s) => s.at));
    const el = $('#sync');
    el.className = 'sync' + (!link ? '' : link.err ? ' off' : ' on') + (bad && bad !== link ? ' err' : '');
    const text = bad ? bad.err : Number.isFinite(at) ? `Таблицы: ${fmtTime.format(at)}` : sources().length ? 'Читаю таблицы' : 'Таблиц нет';
    $('span', el).textContent = text;
    el.title = text + '. Нажмите, чтобы обновить';
    el.setAttribute('aria-label', 'Обновить заявки. ' + text);
    if ($('#modal').open && $('#modal .src') && !$('#modal .src [data-sure]')) morph($('#modal .src'), sourceRows()); // пока ждём «Точно отключить?», не сбиваем
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
      const was = snap();
      renderLines(all); renderAgenda(); renderBoard(); moveCards(was); renderDrawer(); watchSheets(); if (store && store.remote) renderSync();
    }, 16);
  }

  /* ---------- Карточка клиента ---------- */
  const OUTCOMES = {
    talk: { label: 'Поговорили', go: (st) => (['new', 'wait', 'lost'].includes(st) ? { status: 'work' } : {}) },
    miss: { label: 'Не дозвонился', go: (st) => ({ ...(st === 'new' ? { status: 'work' } : {}), next: inTwoHours().toISOString() }) },
    kp: { label: 'Отправил КП', go: () => ({ status: 'wait', next: atDay(2).toISOString() }) },
    buy: { label: 'Купил', go: () => ({ status: 'client', next: null }) },
  };
  let drawn = null, asking = null;
  function renderDrawer() {
    const box = $('#drawer');
    const v = S.open && view(S.open);
    if (!v) { shut(box); return; }
    const fresh = drawn !== v.id, hadLost = !!$('.lost-box', box);
    drawn = v.id;
    const { lead, c, d } = v;
    const src = sourceOf(lead.source);
    const twins = Object.keys(S.leads).filter((id) => id !== v.id && phoneDigits(lead.phone) && phoneDigits(S.leads[id].phone) === phoneDigits(lead.phone)).map(view);
    const lostOpen = v.status === 'lost' || asking === v.id;
    const facts = [['Направление', src && src.name], ['Откуда', PLATFORM[lead.platform]], ['Пришла', lead.created && `${fmtDay.format(new Date(lead.created))}, ${fmtTime.format(new Date(lead.created))}`], ['Кампания', lead.campaign], ['Объявление', lead.ad], ['Форма', lead.form], ['Ответ в форме', lead.answer]].filter((f) => f[1]);
    const html = `<div class="d-head"><input id="d-name" value="${esc(v.name)}" aria-label="Имя клиента" autocomplete="off"><button class="icon-btn" type="button" data-act="close" aria-label="Закрыть" autofocus>${ICON.close}</button></div>
<div class="seg s-${v.status}" role="group" aria-label="Статус" style="--i:${STATUSES.findIndex((x) => x[0] === v.status)}">${STATUSES.map(([k, l]) => `<button type="button" class="s-${k}${v.status === k ? ' on' : ''}" data-act="status" data-id="${k}" aria-pressed="${v.status === k}">${l}</button>`).join('')}</div>
<div class="d-scroll">
  ${lostOpen ? `<div class="lost-box" data-k="lost"><b>Почему в минус?</b><div class="chips">${REASONS.map((r) => `<button type="button" class="${c.lost_reason === r && v.status === 'lost' ? 'on' : ''}" data-act="reason" data-id="${esc(r)}">${esc(r)}</button>`).join('')}</div><form class="own" data-form="reason"><input id="d-reason" name="reason" maxlength="80" autocomplete="off" placeholder="Своя причина" aria-label="Своя причина" value="${esc(v.status === 'lost' && c.lost_reason && !REASONS.includes(c.lost_reason) ? c.lost_reason : '')}"><button class="btn">В минус</button></form></div>` : ''}
  <section class="sec" data-k="phone"><p class="phone">${esc(fmtPhone(lead.phone) || 'Телефона нет')}</p><div class="go">${wayLinks(lead.phone, true)}${phoneDigits(lead.phone) ? `<button class="btn quiet" type="button" data-act="copy" data-copy="+${phoneDigits(lead.phone)}">Скопировать номер</button>` : ''}</div>
  ${twins.map((t) => `<p class="warn">Этот номер уже есть: <button class="btn small" type="button" data-act="open" data-id="${esc(t.id)}">${esc(t.name)}, ${esc((sourceOf(t.lead.source) || {}).name || '')}</button></p>`).join('')}</section>
  <section class="sec" data-k="outs"><h3>Чем закончился контакт</h3><div class="outs">${Object.entries(OUTCOMES).map(([k, o]) => `<button class="btn" type="button" data-act="out" data-id="${k}">${o.label}</button>`).join('')}<button class="btn" type="button" data-act="ask">Отказ</button></div></section>
  <section class="sec" data-k="need"><h3>Что нужно</h3>${need(d)}${d.warn ? `<p class="warn">${esc(d.warn)}</p>` : ''}
  ${d.models.length ? `<ul class="models">${d.models.map((m) => `<li><b>${esc(m.name)}</b><span class="p">${money(m.price)}</span><small>${esc(m.info)}</small><a href="${m.url}" target="_blank" rel="noopener noreferrer">Rozetka</a></li>`).join('')}</ul><p class="hint">Цены и наличие на ${PRICE_DATE}</p>` : ''}
  ${lead.note ? `<p class="quote">${esc(lead.note)}<br><span class="hint">пометка в таблице Google</span></p>` : ''}</section>
  <section class="sec" data-k="deal"><div class="row2"><label class="f"><span>Сумма сделки, ₴</span><input id="d-amount" inputmode="numeric" autocomplete="off" value="${v.amount == null ? '' : v.amount}"></label><div class="f"><span>Следующий звонок</span><button class="pick ${c.next ? dueInfo(c.next).cls : 'is-empty'}" id="d-next" type="button" data-act="cal">${c.next ? `${dueInfo(c.next).cls === 'is-overdue' ? 'Просрочен: ' : ''}${fmtLong.format(new Date(c.next))}, ${fmtTime.format(new Date(c.next))}` : 'Выбрать день и время'}${ICON.cal}</button></div></div>
  <div class="chips">${[['2h', 'Через 2 часа'], ['1', 'Завтра 10:00'], ['3', 'Через 3 дня'], ['7', 'Через неделю']].map(([k, l]) => `<button type="button" data-act="next" data-id="${k}">${l}</button>`).join('')}${c.next ? '<button type="button" data-act="next" data-id="off">Убрать звонок</button>' : ''}</div></section>
  <section class="sec" data-k="talk"><label class="f"><span>О чём говорили</span><textarea id="d-note" placeholder="Что нужно, куда доставка, о чём договорились"></textarea></label><div class="foot"><button class="btn primary" type="button" data-act="note">Записать</button></div>
  ${v.log.length ? `<ul class="log">${v.log.map((x) => `<li><time>${esc([when(x.at), x.by].filter(Boolean).join(', '))}</time>${esc(x.text)}</li>`).join('')}</ul>` : ''}</section>
  <section class="sec" data-k="src"><h3>Заявка</h3><dl class="d-src">${facts.map(([k, t]) => `<dt>${k}</dt><dd>${esc(t)}</dd>`).join('')}${src ? `<dt>Таблица</dt><dd><a href="https://docs.google.com/spreadsheets/d/${esc(src.sheet)}/edit" target="_blank" rel="noopener noreferrer">открыть в Google</a></dd>` : ''}</dl>${store && store.remote ? '<div><button class="btn" type="button" data-act="history">История изменений</button></div>' : ''}</section>
</div>`;
    if (fresh) { box.innerHTML = html; box.lastHtml = html; $('.d-scroll', box).scrollTop = 0; } else morph(box, html);
    if (fresh && box.open) play($('.d-scroll', box), { opacity: [0, 1] }, 200); // из карточки в другую карточку
    const lost = $('.lost-box', box);
    if (lost && !hadLost && !fresh) play(lost, { height: ['0px', `${lost.offsetHeight}px`], paddingBlock: ['0px', '12px'], marginBottom: ['-20px', '0px'], opacity: [0, 1] }, 300);
    raise(box);
  }
  function openLead(id) { S.open = id; asking = null; shut($('#modal')); renderDrawer(); }
  const LABEL = Object.fromEntries(STATUSES);
  async function setStatus(id, status) {
    const v = view(id);
    if (!v || v.status === status) return;
    if (status === 'lost') { S.open = id; asking = id; renderDrawer(); $('.d-scroll').scrollTo({ top: 0, behavior: 'smooth' }); return; }
    asking = null;
    await save(id, { status, ...(status === 'client' ? { next: null } : {}) }, `Статус: ${LABEL[status]}`, true);
  }

  /* ---------- Окна ---------- */
  const modal = (html) => { const m = $('#modal'); grow(() => { m.innerHTML = html; }); raise(m); };
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
  // Календарь звонка. Свой, потому что системный на iPhone сохранял «сейчас» при открытии, а его «Сбросить» не действовало.
  // Ничего не пишем, пока не нажали «Назначить»
  let cal = null;
  function openCal() {
    const was = new Date((S.crm[S.open] || {}).next || 0);
    const d = was > new Date() ? was : atDay(1);
    d.setSeconds(0, 0);
    cal = { id: S.open, d, y: d.getFullYear(), m: d.getMonth() };
    modal('<div class="box cal" id="cal"></div>');
    drawCal();
  }
  function drawCal() {
    const now = new Date(), { d, y, m } = cal, box = $('#cal');
    const has = (S.crm[cal.id] || {}).next;
    const btn = (id, text, on, off, more = '') => `<button type="button" data-act="cal" data-id="${id}" aria-pressed="${on}"${on ? ' class="on"' : ''}${off ? ' disabled' : ''}${more}>${text}</button>`;
    const day = (n) => {
      if (!n) return '<i></i>';
      const x = new Date(y, m, n), diff = dayNo(x) - dayNo(now);
      return btn('d:' + n, n, dayNo(x) === dayNo(d), diff < 0, ` aria-label="${fmtLong.format(x)}"${diff === 0 ? ' aria-current="date"' : ''}`);
    };
    const past = (h, min) => new Date(d).setHours(h, min, 59) < now;
    const plus = (list, x) => [...new Set([...list, x])].sort((a, b) => a - b);
    const hours = plus(Array.from({ length: 14 }, (_, i) => i + 8), d.getHours());
    const mins = plus([0, 15, 30, 45], d.getMinutes());
    morph(box, `<div class="cal-top"><h2>Следующий звонок</h2><button class="icon-btn" type="button" data-act="close" aria-label="Закрыть">${ICON.close}</button></div>
<div class="cal-top cal-own" data-k="own"><h3>${fmtLong.format(d)}</h3><input id="cal-h" inputmode="numeric" maxlength="2" autocomplete="off" aria-label="Часы" value="${String(d.getHours()).padStart(2, '0')}"><b>:</b><input id="cal-m" inputmode="numeric" maxlength="2" autocomplete="off" aria-label="Минуты" value="${String(d.getMinutes()).padStart(2, '0')}"></div>
<div class="cal-top" data-k="nav"><button class="icon-btn" type="button" data-act="cal" data-id="m:-1" aria-label="Предыдущий месяц"${y * 12 + m <= now.getFullYear() * 12 + now.getMonth() ? ' disabled' : ''}>${ICON.prev}</button><b aria-live="polite">${fmtMonth.format(new Date(y, m, 1)).replace(/\s*г\.$/, '')}</b><button class="icon-btn" type="button" data-act="cal" data-id="m:1" aria-label="Следующий месяц">${ICON.next}</button></div>
<div class="cal-grid cal-days">${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((x) => `<span>${x}</span>`).join('')}${monthDays(y, m).map(day).join('')}</div>
<div class="cal-grid cal-time" data-k="h">${hours.map((h) => btn('h:' + h, h, h === d.getHours(), past(h, 59))).join('')}</div>
<div class="cal-grid cal-time cal-min" data-k="m">${mins.map((x) => btn('i:' + x, String(x).padStart(2, '0'), x === d.getMinutes(), past(d.getHours(), x))).join('')}</div>
<div class="cal-foot"><button class="btn primary" type="button" data-act="cal" data-id="ok">Назначить</button>${has ? '<button class="btn quiet" type="button" data-act="cal" data-id="off">Убрать звонок</button>' : ''}</div>`);
    calDone();
  }
  function calDone(bad) {
    const ok = $('#cal [data-id="ok"]'), late = cal.d < new Date();
    ok.disabled = bad || late;
    ok.textContent = bad ? 'Часы 0–23, минуты 0–59' : late ? 'Это время уже прошло' : `Назначить: ${fmtLong.format(cal.d)}, ${fmtTime.format(cal.d)}`;
  }
  // время вписывают с клавиатуры: поля не перерисовываем, иначе клавиатура закроется
  function typeCal(el) {
    const digits = el.value.replace(/\D/g, ''), n = Number(digits), hours = el.id === 'cal-h', bad = !digits || n > (hours ? 23 : 59);
    if (el.value !== digits) el.value = digits;
    if (!bad) {
      if (hours) cal.d.setHours(n); else cal.d.setMinutes(n);
      for (const b of $('#cal').querySelectorAll(`[data-id^="${hours ? 'h' : 'i'}:"]`)) { const on = Number(b.dataset.id.slice(2)) === n; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }
      if (hours && (digits.length === 2 || n > 2)) $('#cal-m').focus();
    }
    $('#cal').lastHtml = '';
    calDone(bad);
  }
  function tapCal(id) {
    const [k, v] = id.split(':'), n = Number(v), d = new Date(cal.d);
    if (k === 'ok' || k === 'off') { shut($('#modal')); save(cal.id, { next: k === 'ok' ? d.toISOString() : null }); return; }
    if (k === 'm') { const x = new Date(cal.y, cal.m + n, 1); cal.y = x.getFullYear(); cal.m = x.getMonth(); }
    if (k === 'd') d.setFullYear(cal.y, cal.m, n);
    if (k === 'h') d.setHours(n);
    if (k === 'i') d.setMinutes(n);
    // выбрали сегодня, а время уже прошло: ближайшие четверть часа
    if (d < new Date()) d.setTime(Math.ceil(Date.now() / 9e5) * 9e5);
    cal.d = d;
    drawCal();
    if (k === 'm') play($('.cal-days'), { opacity: [0, 1], transform: [`translateX(${n * 24}px)`, 'none'] }, 240);
  }
  const sourceRows = () => sources().map((s) => {
    const st = S.sync[s.id] || {};
    const n = Object.values(S.leads).filter((l) => l.source === s.id).length;
    return `<li><div><b>${esc(s.name)}</b><small class="${st.err ? 'bad' : ''}">${esc(st.err || `Заявок: ${n}${st.at ? `, прочитано в ${fmtTime.format(st.at)}` : ''}`)}</small></div><a class="btn small" href="https://docs.google.com/spreadsheets/d/${esc(s.sheet)}/edit" target="_blank" rel="noopener noreferrer">Открыть</a><button class="btn small quiet" type="button" data-act="drop" data-id="${esc(s.id)}">Отключить</button></li>`;
  }).join('');
  function openSettings() {
    modal(`<div class="box"><h2>Настройки</h2>${store && store.remote ? `<section class="sec" id="push"><h3>Уведомления на это устройство</h3>
<label class="check"><input id="push-leads" type="checkbox" disabled><span>Пришла новая заявка</span></label>
<label class="check"><input id="push-calls" type="checkbox" disabled><span>Пора звонить: наступил «Следующий звонок»</span></label><p class="hint"></p></section><hr class="rule">` : ''}<h3>Таблицы с заявками</h3><ul class="src">${sourceRows()}</ul>
<form data-form="source"><h3>Добавить ещё одну</h3><label class="f"><span>Название вкладки</span><input id="s-name" name="name" required autocomplete="off" placeholder="Например, Погрузчики"></label>
<label class="f"><span>Ссылка на таблицу Google</span><input id="s-link" name="link" required autocomplete="off" placeholder="https://docs.google.com/spreadsheets/d/…"></label><p class="hint">Подходит любая таблица, куда Facebook складывает заявки. В ней должен быть открыт доступ «Все, у кого есть ссылка», «Читатель».</p>
<div class="foot"><button class="btn quiet" type="button" data-act="close">Закрыть</button><button class="btn primary">Добавить</button></div></form>${store && store.remote ? `<hr class="rule"><h3>Аккаунт</h3><p>${esc(store.user.email)}</p><ul class="src" id="acc-dev"><li><small>Загружаю устройства</small></li></ul><p class="hint">У аккаунта не больше двух устройств. На iPhone браузер и значок на экране «Домой» считаются отдельно.</p>
<form data-form="pass"><h3>Сменить пароль</h3><input type="email" autocomplete="username" value="${esc(store.user.email)}" hidden><label class="f"><span>Нынешний пароль</span><input id="p-old" name="old" type="password" autocomplete="current-password" required></label><label class="f"><span>Новый пароль, от 8 знаков</span><input id="p-new" name="new" type="password" autocomplete="new-password" minlength="8" required></label><label class="f"><span>Новый пароль ещё раз</span><input id="p-rep" name="rep" type="password" autocomplete="new-password" required></label><div class="foot"><button class="btn quiet" type="button" data-act="logout">Выйти</button><button class="btn">Сменить пароль</button></div></form>` : ''}</div>`);
    if (store && store.remote) { showDevices(); showPush(); }
  }
  // Уведомления на телефон. На iPhone они бывают только у значка на экране «Домой»
  function pushBlock() {
    const android = /Android/.test(navigator.userAgent);
    if (!('PushManager' in window && 'Notification' in window && 'serviceWorker' in navigator)) return android ? 'Откройте CRM L в Chrome или Samsung Internet: здесь уведомлений нет.' : /iPhone|iPad/.test(navigator.userAgent) || navigator.maxTouchPoints > 1 ? 'Откройте CRM L со значка на экране «Домой»: в обычном браузере на iPhone уведомлений нет.' : 'Этот браузер не умеет получать уведомления.';
    return Notification.permission === 'denied' ? android ? 'Уведомления для CRM L запрещены. Откройте сайт в браузере, нажмите значок слева от адреса, «Разрешения», «Уведомления», «Разрешить». И в настройках телефона: Уведомления, тот же браузер или CRM L, включить.' : 'Уведомления для CRM L запрещены. На iPhone: Настройки, Уведомления, CRM L, «Допуск уведомлений». На компьютере: значок слева от адреса сайта.' : '';
  }
  let pushKey = '';
  async function showPush() {
    const set = (text, x) => {
      const box = $('#push');
      if (!box) return;
      for (const k of ['leads', 'calls']) { $('#push-' + k).disabled = !x; $('#push-' + k).checked = !!x && x[k] && Notification.permission === 'granted'; }
      $('.hint', box).textContent = text;
    };
    if (pushBlock()) { set(pushBlock()); return; }
    try {
      const x = await store.pushInfo();
      pushKey = x.key;
      set(x.key ? 'Приходят, даже когда CRM закрыта. Включаются отдельно на каждом телефоне.' : 'Сервер ещё готовит уведомления, откройте настройки через минуту.', x.key && x);
    } catch (e) { set('Не загрузилось: ' + human(e)); }
  }
  async function pushSub(key) {
    const pm = (await navigator.serviceWorker.ready).pushManager;
    const sub = (await pm.getSubscription() || await pm.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(atob(key.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)) })).toJSON();
    const bare = (v) => v.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return { endpoint: sub.endpoint, keys: { p256dh: bare(sub.keys.p256dh), auth: bare(sub.keys.auth) } };
  }
  async function savePush() {
    const leads = $('#push-leads').checked, calls = $('#push-calls').checked, off = !leads && !calls;
    try {
      // разрешение спрашиваем первым делом: iPhone показывает вопрос только прямо в нажатии
      if (!off && await Notification.requestPermission() !== 'granted') { showPush(); return; }
      for (const k of ['leads', 'calls']) if ($('#push-' + k)) $('#push-' + k).disabled = true;
      await store.pushSet(off ? null : await pushSub(pushKey), leads, calls);
      toast(off ? 'Уведомления выключены' : 'Уведомления включены');
      if (!off) store.readSheets().catch(() => {}); // сервер сразу пришлёт пробное
    } catch (e) { toast('Не получилось: ' + human(e)); }
    showPush();
  }
  // телефон иногда сам меняет адрес для уведомлений: сверяем при каждом запуске
  async function syncPush() {
    if (!store.remote || pushBlock() || Notification.permission !== 'granted') return;
    const x = await store.pushInfo();
    if (x.key && (x.leads || x.calls)) await store.pushSet(await pushSub(x.key), x.leads, x.calls);
  }
  // нажали на уведомление
  async function openPushed(id) {
    if (!S.leads[id] && store.remote) await store.pull();
    if (S.leads[id]) openLead(id);
  }
  async function showDevices() {
    let html;
    try { html = (await store.devices()).map((d) => deviceRow(d, 'dev-drop')).join(''); } catch (e) { html = `<li><small class="bad">Не загрузилось: ${esc(human(e))}</small></li>`; }
    if ($('#acc-dev')) grow(() => { $('#acc-dev').innerHTML = html; });
  }
  async function openHistory() {
    const v = view(S.open);
    if (!v) return;
    modal(`<div class="box"><h2>История изменений</h2><p>${esc(v.name)}</p><ul class="hist" id="hist"><li>Загружаю</li></ul><div class="foot"><button class="btn primary" type="button" data-act="close">Закрыть</button></div></div>`);
    let html;
    try {
      // правки одного нажатия — одной записью
      const groups = [];
      for (const h of await store.history(v.id)) {
        const last = groups[groups.length - 1];
        if (last && last.at === h.at && last.email === h.email) last.lines.push(historyText(h, when)); else groups.push({ ...h, lines: [historyText(h, when)] });
      }
      const item = (at, who, device, lines) => `<li><p class="hist-meta"><time>${esc(when(at))}</time><b>${esc(who)}</b>${device ? `<span>${esc(device)}</span>` : ''}</p>${lines.map((l) => `<p>${esc(l)}</p>`).join('')}</li>`;
      html = groups.map((g) => item(g.at, g.email || g.device, g.email ? g.device : '', g.lines)).join('');
      if (v.lead.platform !== 'manual') html += item(v.lead.created, PLATFORM[v.lead.platform] || 'Facebook', '', ['Пришла заявка']);
    } catch (e) { html = `<li>Не загрузилось: ${esc(human(e))}</li>`; }
    if ($('#hist')) { grow(() => { $('#hist').innerHTML = html; }); play($('#hist'), { opacity: [0, 1] }, 220); }
  }
  const saveSources = (list) => store.put('meta', 'sources', { list }).catch((e) => toast('Не сохранилось: ' + human(e)));
  let toastTimer;
  // popover: поверх открытых окон, иначе на телефоне сообщение под карточкой
  function toast(text) {
    const t = $('#toast');
    clearTimeout(toastTimer);
    t.classList.remove('out');
    t.textContent = text;
    t.hidden = false;
    if (t.showPopover) { if (t.matches(':popover-open')) t.hidePopover(); t.showPopover(); }
    toastTimer = setTimeout(() => { t.classList.add('out'); toastTimer = setTimeout(() => { if (t.hidePopover) t.hidePopover(); t.hidden = true; }, 220); }, 4200);
  }
  async function copy(text) { try { await navigator.clipboard.writeText(text); toast(`Номер ${fmtPhone(text)} скопирован`); } catch { /* номер виден в карточке, его можно выделить */ } }

  /* ---------- Действия ---------- */
  const ACT = {
    open: (id) => openLead(id),
    line: (id, el) => { S.tab = id; location.hash = id; refresh(); el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: still.matches ? 'auto' : 'smooth' }); },
    col: (id) => { S.col = id; refresh(); },
    close: (id, el) => shut(el.closest('dialog')),
    sync: pullNow, new: openNew, settings: openSettings,
    copy: () => {},
    status: (id) => setStatus(S.open, id),
    ask: () => { asking = S.open; renderDrawer(); $('.d-scroll').scrollTo({ top: 0, behavior: 'smooth' }); },
    reason: async (id) => { const lead = S.open; asking = null; $('#d-reason').blur(); if (await save(lead, { status: 'lost', lost_reason: id, next: null }, `Минус: ${id}`, true)) toast('Перенёс в минус'); },
    out: async (id) => { const v = view(S.open), o = OUTCOMES[id]; asking = null; if (await save(v.id, o.go(v.status), o.label)) toast(o.label + ', записал'); },
    next: (id) => save(S.open, { next: id === 'off' ? null : (id === '2h' ? inTwoHours() : atDay(+id)).toISOString() }),
    note: async () => { const el = $('#d-note'), text = el.value.trim(); if (!text) { el.focus(); return; } if (await save(S.open, {}, text)) { $('#d-note').value = ''; toast('Записал'); } },
    logout: () => store.logout(),
    history: openHistory,
    cal: (id) => (id ? tapCal(id) : openCal()),
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
    if (t.id === 'push-leads' || t.id === 'push-calls') savePush();
    if (t.id === 'd-name') save(S.open, { name: t.value.trim() });
    if (t.id === 'd-amount') { const n = t.value.replace(/[^\d.,]/g, '').replace(',', '.'); save(S.open, { amount: n === '' ? null : Number(n) || 0 }); }
  });
  document.addEventListener('input', (e) => {
    if (e.target.id === 'cal-h' || e.target.id === 'cal-m') typeCal(e.target);
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
      shut($('#modal'));
      toast('Заявка сохранена');
    }
  });
  for (const g of ['gesturestart', 'gesturechange']) document.addEventListener(g, (e) => e.preventDefault(), { passive: false }); // щипок: одного viewport для Safari мало
  document.addEventListener('focusin', (e) => { if (e.target.id === 'cal-h' || e.target.id === 'cal-m') e.target.select(); });
  document.addEventListener('keydown', (e) => { if ((e.target.id === 'cal-h' || e.target.id === 'cal-m') && e.key === 'Enter') { const ok = $('#cal [data-id="ok"]'); if (!ok.disabled) tapCal('ok'); } });
  document.addEventListener('keydown', (e) => { if (e.target.id === 'd-note' && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) ACT.note(); });
  $('#drawer').addEventListener('close', () => { if ($('#drawer').open) return; S.open = null; drawn = null; asking = null; });
  for (const id of ['#drawer', '#modal']) $(id).addEventListener('click', (e) => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) shut(e.currentTarget); } });
  for (const id of ['#drawer', '#modal']) $(id).addEventListener('cancel', (e) => { if (e.target === e.currentTarget) { e.preventDefault(); shut(e.currentTarget); } }); // Esc и «Назад» на Android
  document.addEventListener('touchstart', () => {}, { passive: true }); // без слушателя Safari не показывает :active

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
    syncPush().catch(() => {});
    const pushed = new URLSearchParams(location.search).get('lead');
    if (pushed) { history.replaceState(null, '', location.pathname + location.hash); openPushed(pushed); }
    if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.lead) openPushed(e.data.lead); });
  })();
})();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');

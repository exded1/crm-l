
/* Чистая логика без экрана. Её же проверяет test.mjs */
const STATUSES = [['new', 'Новые'], ['work', 'В работе'], ['wait', 'Ждём'], ['client', 'Клиенты'], ['lost', 'Минус']];
const REASONS = ['Дорого', 'Не берёт трубку', 'Купил у других', 'Не наш товар', 'Не сейчас', 'Ошибся или спам', 'Неадекват', 'Хамит'];
// Цены с Rozetka на 20.11.2026
const PRICE_DATE = '20.11.2026';
const JAC = [
  { code: 'cbd15li', kind: 'truck', name: 'Электророкла JAC CBD15Li', info: '1500 кг, в наличии', price: 69216, url: 'https://rozetka.com.ua/ua/497028884/p497028884/' },
  { code: 'cbd18li', kind: 'truck', name: 'Электророкла JAC CBD18Li', info: '1800 кг, предзаказ', price: 84000, url: 'https://rozetka.com.ua/ua/497028879/p497028879/' },
  { code: 'cbd20li', kind: 'truck', name: 'Электророкла JAC CBD20Li', info: '2000 кг, в наличии', price: 87780, url: 'https://rozetka.com.ua/ua/495769504/p495769504/' },
  { code: 'cdd15', lift: '2,5', kind: 'stacker', name: 'Штабелёр JAC CDD15, подъём 2,5 м', info: '1500 кг, в наличии', price: 88200, url: 'https://rozetka.com.ua/ua/495769499/p495769499/' },
  { code: 'cdd15', lift: '3,0', kind: 'stacker', name: 'Штабелёр JAC CDD15, подъём 3,0 м', info: '1500 кг, в наличии', price: 92820, url: 'https://rozetka.com.ua/ua/495769509/p495769509/' },
];

function parseCSV(text) {
  const t = String(text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const rows = [[]];
  let cell = '', quoted = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (quoted) {
      if (c !== '"') cell += c;
      else if (t[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ',' || c === '\n') { rows[rows.length - 1].push(cell); cell = ''; if (c === '\n') rows.push([]); } else cell += c;
  }
  rows[rows.length - 1].push(cell);
  return rows;
}
// запасной путь: коннектор отдаёт таблицу текстом, а не CSV
function parseMarkdownTable(text) {
  return String(text).split('\n').filter((l) => l.startsWith('|')).map((l) => l.trim().slice(1, -1).split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\(.)/g, '$1')));
}
// CSV приходит от коннектора вложением или base64 в поле content
function csvFromResult(res) {
  const tries = [];
  for (const b of res.content || []) { const r = b.resource || b; tries.push(r.text, r.blob, r.data); }
  if (res.payload) tries.push(res.payload.content);
  for (const t of tries) {
    if (typeof t !== 'string') continue;
    if (t.includes('created_time') && !t.trim().startsWith('{')) return t;
    try {
      const d = new TextDecoder().decode(Uint8Array.from(atob(t.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));
      if (d.includes('created_time')) return d;
    } catch { /* не base64 */ }
  }
  return null;
}
const FB_COLUMNS = new Set(['id', 'created_time', 'ad_id', 'ad_name', 'adset_id', 'adset_name', 'campaign_id', 'campaign_name', 'form_id', 'form_name', 'is_organic', 'platform', 'full_name', 'phone_number', 'email', 'lead_status']);
function rowsToLeads(rows, source) {
  const h = rows.findIndex((r) => r.includes('id') && r.includes('created_time'));
  if (h < 0) throw new Error('не похоже на таблицу заявок Facebook: нет колонок id и created_time');
  const head = rows[h].map((c) => c.trim());
  const statusCol = head.indexOf('lead_status');
  const out = [];
  for (const r of rows.slice(h + 1)) {
    const get = (n) => (head.indexOf(n) < 0 ? '' : String(r[head.indexOf(n)] || '').trim());
    const id = get('id');
    if (!/^l:\d+$/.test(id) || r.some((c) => c.includes('<test lead'))) continue;
    const isNote = (i) => (statusCol >= 0 ? i > statusCol : head[i] === '');
    const join = (test) => r.map((c, i) => (test(i) ? c.trim() : '')).filter(Boolean).join(' · ');
    const at = new Date(get('created_time'));
    out.push({
      id, source, created: Number.isNaN(at.getTime()) ? '' : at.toISOString(),
      name: get('full_name'), phone: get('phone_number').replace(/^p:/, ''),
      answer: join((i) => head[i] && !FB_COLUMNS.has(head[i]) && !isNote(i)),
      note: join(isNote), platform: get('platform'), campaign: get('campaign_name'), ad: get('ad_name'), form: get('form_name'),
    });
  }
  return out;
}
function phoneDigits(p) {
  const d = String(p || '').replace(/\D/g, '');
  return /^0\d{9}$/.test(d) ? '38' + d : d;
}
function fmtPhone(p) {
  const m = phoneDigits(p).match(/^380(\d\d)(\d{3})(\d\d)(\d\d)$/);
  return m ? `+380 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : String(p || '');
}
const money = (n) => Math.round(n).toLocaleString('ru-RU') + '\u00a0₴';
// Ответ из формы Facebook в человеческий вид: что нужно, мощность, подходящие модели, цена
function describe(answer) {
  const raw = String(answer || '').trim();
  const key = raw.toLowerCase();
  const out = { text: raw.replace(/_/g, ' ').replace(/\s+/g, ' ') || 'Не указано', kind: '', bars: 0, models: [], exact: null, warn: '' };
  const kva = key.match(/(\d+)\s*[–-]\s*(\d+)_?\s*ква/);
  if (kva) return { ...out, kind: 'gen', text: `${kva[1]}–${kva[2]} кВА`, bars: +kva[2] <= 250 ? 1 : 2 };
  if (key === 'більше') return { ...out, kind: 'gen', text: 'Больше 500 кВА', bars: 3 };
  if (key.startsWith('не_знаю')) return { ...out, kind: 'gen', text: 'Не знает, нужна консультация' };
  const byCode = JAC.filter((m) => key.includes(m.code) && (!m.lift || key.includes(m.lift)));
  if (byCode.length === 1) {
    const exact = byCode[0];
    const p = key.match(/(\d[\d_ ]*)₴/);
    const form = p ? +p[1].replace(/\D/g, '') : 0;
    const warn = !form || form === exact.price ? ''
      : form === exact.price * 2 ? `В форме Facebook клиент видел ${money(form)}. По вашему прайсу это цена за 2 шт, одна стоит ${money(exact.price)}.`
        : `В форме Facebook клиент видел ${money(form)}, в прайсе ${money(exact.price)}.`;
    return { ...out, kind: exact.kind, text: exact.name, models: byCode, exact, warn };
  }
  const kind = /штабел/.test(key) ? 'stacker' : /віз|рокл/.test(key) ? 'truck' : '';
  if (!kind) return out;
  return { ...out, kind, text: kind === 'stacker' ? 'Электроштабелёр, модель не выбрана' : 'Электророкла, модель не выбрана', models: JAC.filter((m) => m.kind === kind) };
}
// пока в CRM ничего не нажимали: есть пометка в таблице — значит, с заявкой уже работали
const statusOf = (lead, crm) => (crm && crm.status) || (lead.note ? 'work' : 'new');
function ago(ms) {
  const m = Math.max(0, Math.floor(ms / 6e4));
  return m < 60 ? `${m} мин` : m < 1440 ? `${Math.floor(m / 60)} ч` : `${Math.floor(m / 1440)} дн`;
}
function atDay(days, from = new Date()) { const d = new Date(from); d.setDate(d.getDate() + days); d.setHours(10, 0, 0, 0); return d; }
// звоним с 9 до 19: поздно вечером переносим на утро
function inTwoHours(from = new Date()) {
  const d = new Date(from.getTime() + 2 * 36e5);
  if (d.getDate() !== from.getDate() || d.getHours() >= 19) return atDay(1, from);
  return d.getHours() < 9 ? atDay(0, from) : d;
}
function gidOf(link) { const m = String(link).match(/[?#&]gid=(\d+)/); return m ? m[1] : ''; }
function sheetIdOf(link) { const m = String(link).match(/docs\.google\.com\/spreadsheets\/d\/([\w-]{20,})/); return m ? m[1] : ''; }

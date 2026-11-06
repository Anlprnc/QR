// Yerel `wrangler dev` (8787) üzerinde duman + kurum izolasyonu testi.
// Kullanım: node scripts/smoke.mjs  (log dosyası: LOG=/yol/wrangler.log)
import { readFileSync } from 'node:fs';
const B = process.env.BASE ?? 'http://localhost:8787/api';
const LOG = process.env.LOG ?? '/private/tmp/claude-501/wr.log';
let fails = 0;
const check = (name, ok) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); if (!ok) fails++; };

async function login(email) {
  await fetch(`${B}/auth/request`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
  await new Promise((r) => setTimeout(r, 500));
  const code = [...readFileSync(LOG, 'utf8').matchAll(new RegExp(`giriş kodu ${email}: (\\d{6})`, 'g'))].pop()[1];
  const r = await fetch(`${B}/auth/verify`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, code }) });
  return r.headers.get('set-cookie').split(';')[0];
}
const call = (cookie) => async (path, method = 'GET', body) => {
  const r = await fetch(B + path, { method, headers: { cookie, 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  return { status: r.status, json: await r.clone().json().catch(() => null), text: await r.text() };
};

const stamp = Date.now();
const A = call(await login(`a${stamp}@smoke.test`));
const Bc = call(await login(`b${stamp}@smoke.test`));

const m = (await A('/machines', 'POST', { name: 'Test Makinesi' })).json;
const list = (await A('/machines')).json;
const token = m.qrToken;
const t = await fetch(`${B}/q/${token}/tickets`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ description: '=HYPERLINK("x")', machineStopped: true }) });
check('QR ile arıza bildirilir', t.status === 201);
const ticketId = (await A('/tickets')).json[0].id;

check('A kendi makinesini görür', list.some((x) => x.id === m.id));
check('B, A\'nın makinelerini görmez', (await Bc('/machines')).json.length === 0);
check('B, A\'nın arızalarını görmez', (await Bc('/tickets')).json.length === 0);
check('B, A\'nın arızasını değiştiremez', (await Bc(`/tickets/${ticketId}`, 'PATCH', { status: 'resolved' })).status === 404);
check('B, A\'nın arızasına not ekleyemez', (await Bc(`/tickets/${ticketId}/notes`, 'POST', { note: 'x' })).status === 404);
check('B, A\'nın arıza geçmişini göremez', (await Bc(`/tickets/${ticketId}/events`)).json.length === 0);
check('B, A\'nın makinesini göremez', (await Bc(`/machines/${m.id}`)).status === 404);
check('B, A\'nın makinesini arşivleyemez', (await Bc(`/machines/${m.id}`, 'DELETE')).status === 404);
check('B, A\'nın makinesine bakım ekleyemez', (await Bc('/maintenance', 'POST', { machineId: m.id, title: 'xx', intervalDays: 7 })).status === 404);
const task = (await A('/maintenance', 'POST', { machineId: m.id, title: 'Yağ', intervalDays: 7 })).json;
check('B, A\'nın bakım görevini işaretleyemez', (await Bc(`/maintenance/${task.id}/done`, 'POST', {})).status === 404);
check('A bakım görevini işaretler', (await A(`/maintenance/${task.id}/done`, 'POST', {})).status === 200);
check('B, A\'nın ekibini silemez', (await Bc(`/team/${(await A('/team')).json[0].id}`, 'DELETE')).status === 404);
check('CSV formül enjeksiyonu engellenir', (await A('/export/tickets.csv')).text.includes(`"'=HYPERLINK`));
check('Oturumsuz istek reddedilir', (await call('')('/tickets')).status === 401);
await A(`/tickets/${ticketId}`, 'PATCH', { status: 'resolved', resolution: 'ok' });
check('Geçersiz durum geçişi reddedilir', (await A(`/tickets/${ticketId}`, 'PATCH', { status: 'in_progress' })).status === 409);
check('Arşivlenen makinenin QR\'ı geçersiz', (await A(`/machines/${m.id}`, 'DELETE')).status === 200 && (await fetch(`${B}/q/${token}`)).status === 404);
console.log(fails ? `${fails} test başarısız` : 'Hepsi geçti');
process.exit(fails ? 1 : 0);

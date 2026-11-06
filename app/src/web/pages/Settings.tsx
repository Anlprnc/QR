import { FormEvent, useCallback, useEffect, useState } from 'react';
import Shell, { useMe } from '../components/Shell';
import { api, ApiError, clock } from '../lib/api';

type Member = { id: string; email: string; role: 'owner' | 'member'; createdAt: number; you: boolean };

function SettingsBody() {
  const me = useMe();
  const owner = me.role === 'owner';
  const [org, setOrg] = useState('');
  const [ad, setAd] = useState(() => localStorage.getItem('ad') ?? '');
  const [team, setTeam] = useState<Member[]>([]);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => { setOrg(me.org); }, [me.org]);
  const load = useCallback(() => { api<Member[]>('/team').then(setTeam); }, []);
  useEffect(() => { load(); }, [load]);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };

  async function saveOrg(e: FormEvent) {
    e.preventDefault();
    await api('/org', { method: 'PATCH', body: { name: org } });
    me.reload();
    flash('Atölye adı kaydedildi.');
  }
  function saveName(e: FormEvent) {
    e.preventDefault();
    localStorage.setItem('ad', ad.trim());
    flash('Adınız bu tarayıcıda kaydedildi.');
  }
  async function invite(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/team', { method: 'POST', body: { email } });
      setEmail(''); load(); flash('Kişi eklendi, giriş bilgisi e-postayla gönderildi.');
    } catch (err) {
      const code = err instanceof ApiError ? err.code : '';
      flash(code === 'already_member' ? 'Bu kişi zaten ekipte.' : code === 'email_taken' ? 'Bu e-posta başka bir atölyede kayıtlı.' : 'Eklenemedi, e-postayı kontrol edin.');
    }
  }
  async function remove(m: Member) {
    if (!confirm(`${m.email} ekipten çıkarılsın mı?`)) return;
    await api(`/team/${m.id}`, { method: 'DELETE' });
    load();
  }

  return (
    <>
      <h1 className="plaka text-3xl">Ayarlar</h1>
      <p role="status" className="mt-2 h-6 font-semibold text-yesil">{msg}</p>

      <div className="mt-4 grid gap-8 lg:grid-cols-2">
        <section className="kart p-5">
          <h2 className="plaka text-xl">Atölye</h2>
          <form onSubmit={saveOrg} className="mt-3 flex gap-3">
            <input required minLength={2} maxLength={80} value={org} onChange={(e) => setOrg(e.target.value)} aria-label="Atölye adı" className="alan" disabled={!owner} />
            {owner && <button className="btn">Kaydet</button>}
          </form>
          <p className="mt-2 text-sm text-gri">{owner ? 'Bu ad QR etiketlerinde ve ekibe giden e-postalarda görünür.' : 'Atölye adını yalnızca yönetici değiştirebilir.'}</p>

          <h2 className="plaka mt-8 text-xl">Benim adım</h2>
          <form onSubmit={saveName} className="mt-3 flex gap-3">
            <input maxLength={80} value={ad} onChange={(e) => setAd(e.target.value)} placeholder={me.email.split('@')[0]} aria-label="Adınız" className="alan" />
            <button className="btn">Kaydet</button>
          </form>
          <p className="mt-2 text-sm text-gri">Arızayı “Üstlen” dediğinizde ve bakımı “Yapıldı” işaretlediğinizde bu ad yazılır.</p>

          <h2 className="plaka mt-8 text-xl">Veriyi dışa aktar</h2>
          <a href="/api/export/tickets.csv" className="btn-ghost mt-3 inline-block">Arızaları Excel’e indir (CSV)</a>
        </section>

        <section className="kart p-5">
          <h2 className="plaka text-xl">Ekip</h2>
          <p className="mt-1 text-sm text-gri">Ekipteki herkes yeni arızada e-posta alır ve panoyu görür.</p>
          <ul className="mt-3 divide-y-2 divide-boya">
            {team.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                <span>{m.email}{m.you && <span className="etiket-rozet ml-2">Siz</span>}{m.role === 'owner' && <span className="etiket-rozet ml-2 !bg-gri">Yönetici</span>}
                  <span className="block text-xs text-gri">Eklendi: {clock(m.createdAt)}</span></span>
                {owner && !m.you && <button onClick={() => remove(m)} className="text-sm underline underline-offset-4">Çıkar</button>}
              </li>
            ))}
          </ul>
          {!owner && <p className="mt-4 text-sm text-gri">Ekip üyelerini yalnızca yönetici ekleyip çıkarabilir.</p>}
          {owner && <form onSubmit={invite} className="mt-4 flex gap-3">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ekip.arkadasi@firma.com" aria-label="Yeni kişinin e-postası" className="alan" />
            <button className="btn shrink-0">Ekle</button>
          </form>}
        </section>
      </div>
    </>
  );
}

// useMe, Shell'in sağladığı bağlamı okur; bu yüzden gövde Shell'in içinde render edilir
export default function Settings() {
  return <Shell><SettingsBody /></Shell>;
}

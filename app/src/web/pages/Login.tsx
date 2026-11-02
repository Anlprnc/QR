import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';

export default function Login() {
  const nav = useNavigate();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (step === 'email') {
        await api('/auth/request', { method: 'POST', body: { email } });
        setStep('code');
      } else {
        await api('/auth/verify', { method: 'POST', body: { email, code } });
        nav('/panel');
      }
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      setError(
        status === 429 ? 'Çok fazla kod istendi. Bir saat sonra tekrar deneyin.'
        : step === 'code' ? 'Kod yanlış ya da süresi dolmuş. Yeni kod isteyebilirsiniz.'
        : 'E-posta adresini kontrol edip tekrar deneyin.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-md content-center px-5">
      <h1 className="plaka text-4xl">ArızaQR</h1>
      <p className="mt-2 text-gri">Şifre yok. E-postanıza gelen kodla giriş yapın.</p>
      <form onSubmit={submit} className="mt-8 space-y-4 border-2 border-dokum bg-sac p-5">
        {step === 'email' ? (
          <label className="block">
            <span className="font-semibold">E-posta adresiniz</span>
            <input type="email" required autoFocus autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)} className="alan mt-1" />
          </label>
        ) : (
          <label className="block">
            <span className="font-semibold">{email} adresine gelen 6 haneli kod</span>
            <input inputMode="numeric" pattern="\d{6}" maxLength={6} required autoFocus autoComplete="one-time-code"
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="alan seri mt-1 text-center text-3xl tracking-[0.4em]" />
          </label>
        )}
        {error && <p role="alert" className="font-medium text-kirmizi">{error}</p>}
        <button disabled={busy} className="btn w-full">
          {step === 'email' ? 'Kod gönder' : 'Giriş yap'}
        </button>
        {step === 'code' && (
          <button type="button" onClick={() => { setStep('email'); setCode(''); setError(''); }}
            className="text-sm underline underline-offset-4">E-postayı değiştir</button>
        )}
      </form>
    </main>
  );
}

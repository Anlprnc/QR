import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useMe } from './Shell';

export function qrUrl(token: string) {
  return `${location.origin}/q/${token}`;
}

export default function Label({ name, token, big }: { name: string; token: string; big?: boolean }) {
  const { org } = useMe();
  const [svg, setSvg] = useState('');
  const url = qrUrl(token);
  useEffect(() => {
    QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }).then(setSvg);
  }, [url]);
  return (
    <li className="etiket kart list-none p-4 text-center">
      <p className="etiket-rozet">Arıza mı var?</p>
      <p className="plaka mt-2 text-xl">{name}</p>
      <div className={`mx-auto mt-2 ${big ? 'h-56 w-56' : 'h-40 w-40'}`} role="img" aria-label={`${name} için QR kod`} dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="mt-1 text-sm font-semibold">QR kodu telefonla okutun, arızayı bildirin.</p>
      <p className="text-xs text-gri">{org}</p>
      <p className="mt-1 break-all text-xs text-gri print:hidden">{url}</p>
    </li>
  );
}

import './globals.css';

export const metadata = {
  title: 'ChamuyoCheck',
  description: 'Auditor inteligente de credibilidad documental.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es"><body>{children}</body></html>;
}

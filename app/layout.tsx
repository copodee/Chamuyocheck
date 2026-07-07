import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ChamuyoCheck | La IA que detecta el chamuyo',
  description: 'Analizá textos, propuestas, promesas y discursos. Detectá humo, exageraciones y frases sin sustento antes de creer o comprar.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body>{children}</body>
    </html>
  );
}

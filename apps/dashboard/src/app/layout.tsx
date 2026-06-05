import './global.css';
import { Sidebar } from '../components/sidebar';

export const metadata = {
  title: 'Kairosis',
  description: 'Self-hosted event collection and normalization',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex h-screen bg-slate-50 text-slate-900 antialiased">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  );
}

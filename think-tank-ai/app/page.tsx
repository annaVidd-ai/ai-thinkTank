import { Header }    from '@/components/dashboard/header';
import { Footer }    from '@/components/dashboard/footer';
import { Dashboard } from '@/components/dashboard/dashboard';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100">
      <Header />
      <main className="flex flex-col flex-1 overflow-hidden">
        <Dashboard />
      </main>
      <Footer />
    </div>
  );
}

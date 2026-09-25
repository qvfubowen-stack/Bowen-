import { RfqProvider } from '@/components/rfq-context';
import { RfqBar } from '@/components/RfqBar';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <RfqProvider>
      {children}
      <RfqBar />
    </RfqProvider>
  );
}

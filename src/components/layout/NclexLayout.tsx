import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen } from 'lucide-react';

interface NclexLayoutProps {
  children: React.ReactNode;
  showBack?: boolean;
  backTo?: string;
  backLabel?: string;
}

export const NclexLayout = ({ children, showBack = true, backTo = '/nclex', backLabel = 'Back' }: NclexLayoutProps) => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-[#0c1e3c] h-14 flex items-center px-4 lg:px-6 flex-shrink-0 border-b border-white/10">
        <div className="flex items-center gap-3 flex-1">
          {showBack && (
            <Link
              to={backTo}
              className="flex items-center gap-1.5 text-sm font-medium text-blue-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{backLabel}</span>
            </Link>
          )}
          {showBack && <div className="h-5 w-px bg-white/20" />}
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 bg-blue-500/30 rounded-lg flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-blue-300" />
            </div>
            <span className="font-bold text-white text-sm">
              GritSync <span className="text-blue-400">NCLEX-RN</span> Review
            </span>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
};

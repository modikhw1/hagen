'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/analyze-rate', label: 'Analyze + Rate' },
  { href: '/rate', label: 'Quick Rate' },
  { href: '/library', label: 'Library' },
  { href: '/discern', label: 'Discern' },
  { href: '/brand-profile', label: 'Brand Profile' },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="bg-gray-900 border-b border-gray-800">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center h-14 gap-1">
          <Link 
            href="/" 
            className="text-white font-bold text-lg mr-6 hover:text-blue-400 transition-colors"
          >
            Hagen
          </Link>
          
          <div className="flex gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}

import type {Metadata} from 'next';
import { Cairo } from 'next/font/google';
import './globals.css'; // Global styles

const cairo = Cairo({
  subsets: ['arabic'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-cairo',
});

export const metadata: Metadata = {
  title: 'CenterFlow | نظام الإدارة السحابي الذكي للمراكز التعليمية',
  description: 'CenterFlow هو المنصة السحابية المبتكرة المتكاملة لخدمة المعلم والسكرتارية لإدارة قاعات الدروس؛ رصد حضور وغياب الطلاب، التسميع الشفوي، امتحانات، المدفوعات والاشتراكات، مع توليد تقارير PDF وإرسالها الفوري عبر واتساب.',
  keywords: ['CenterFlow', 'إدارة المراكز التعليمية', 'نظام المعلم', 'سنتر تعليمي', 'حضور وغياب الطلاب', 'سجل الدرجات والامتحانات', 'دفتر سداد الاشتراكات'],
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable}`} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#0f172a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (_) {}
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(reg) {
                      console.log('CenterFlow SW successfully registered with scope: ', reg.scope);
                    },
                    function(err) {
                      console.log('CenterFlow SW registration failed: ', err);
                    }
                  );
                });
              }
            `,
          }}
        />
      </head>
      <body className="bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 font-sans min-h-screen antialiased selection:bg-blue-100 selection:text-blue-800" suppressHydrationWarning>
        <div className="min-h-screen flex flex-col font-cairo" style={{ fontFamily: 'var(--font-cairo), system-ui, sans-serif' }}>
          {children}
        </div>
      </body>
    </html>
  );
}


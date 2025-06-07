import Link from 'next/link';
import Image from 'next/image';
import MainNav from './main-nav'; // MainNav now provides the SheetTrigger and Sheet

/**
 * Header component.
 * Displays the application logo/name and the main navigation trigger (mobile menu).
 * It is sticky at the top of the viewport.
 * @returns {JSX.Element} The header element.
 */
export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo and App Name Link */}
        <Link href="/" className="flex items-center space-x-2" aria-label="Daily Hacklab Home">
          <Image
            src="/images/logos/logo-icon.png"
            alt="Daily Hacklab Logo"
            width={28}
            height={28}
            className="rounded-sm"
          />
          <span className="font-bold text-xl hidden sm:inline-block font-headline">Daily Hacklab</span>
        </Link>
        {/* Main Navigation (usually a mobile menu trigger) */}
        <MainNav />
      </div>
    </header>
  );
}

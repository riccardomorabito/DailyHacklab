import React from 'react';

/**
 * Footer component.
 * Displays copyright information and other footer content.
 * @returns {JSX.Element} The footer element.
 */
export default function Footer() {
  return (
    <footer className="border-t py-6 md:py-0 bg-background mb-16 md:mb-0 relative z-0"> 
      {/* mb-16 md:mb-0 for bottom nav bar spacing */}
      {/* z-0 to ensure it's above a -z canvas if needed, though default stacking should work */}
      <div className="container flex flex-col items-center justify-between gap-4 md:h-20 md:flex-row">
        <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
          Made by Ricky Morabito with ❤️ for Hacklab Cosenza. &copy; {new Date().getFullYear()} All rights reserved.
        </p>
      </div>
    </footer>
  );
}

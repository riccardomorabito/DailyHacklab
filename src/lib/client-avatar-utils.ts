// Client-side only avatar utilities

/**
 * Default size for generated avatars
 */
const DEFAULT_AVATAR_SIZE = 40;

/**
 * Color palette used for generating boring avatars
 * These colors provide a warm, consistent aesthetic
 */
const AVATAR_COLORS = ['#F0A884', '#F0C0A4', '#F0D8C4', '#F0E8E4', '#F0F0F0'];

/**
 * Generate a boring avatar data URL for users without avatars (client-side only)
 * @param name The user's name or identifier
 * @param size The size of the avatar (default: 40)
 * @returns string A data URL for the generated SVG avatar
 */
export function generateBoringAvatarDataUrl(name: string, size: number = DEFAULT_AVATAR_SIZE): string {
  try {
    // Generate a simple SVG avatar based on the name
    // This mimics the boring-avatars "beam" style with the same colors used in the leaderboard
    
    // Simple hash function to pick colors based on name
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const color1 = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
    const color2 = AVATAR_COLORS[Math.abs(hash >> 8) % AVATAR_COLORS.length];
    const color3 = AVATAR_COLORS[Math.abs(hash >> 16) % AVATAR_COLORS.length];
    
    // Create a simple geometric SVG similar to boring-avatars beam style
    const svgString = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad${Math.abs(hash)}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
          <stop offset="50%" style="stop-color:${color2};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${color3};stop-opacity:1" />
        </linearGradient>
      </defs>
      <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="url(#grad${Math.abs(hash)})"/>
      <circle cx="${size/4}" cy="${size/3}" r="${size/8}" fill="${color2}" opacity="0.8"/>
      <circle cx="${size*3/4}" cy="${size*2/3}" r="${size/6}" fill="${color1}" opacity="0.6"/>
    </svg>`;
    
    const dataUrl = `data:image/svg+xml;base64,${btoa(svgString)}`;
    
    console.debug(`generateBoringAvatarDataUrl: Generated avatar for ${name}`);
    return dataUrl;
  } catch (error: any) {
    console.error(`generateBoringAvatarDataUrl: Error generating avatar for ${name}:`, error.message);
    // Return a simple fallback data URL
    const fallbackSvg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="#F0A884"/>
      <text x="${size/2}" y="${size/2}" text-anchor="middle" dy="0.3em" fill="white" font-family="Arial" font-size="${size/3}">${name.charAt(0).toUpperCase()}</text>
    </svg>`;
    return `data:image/svg+xml;base64,${btoa(fallbackSvg)}`;
  }
}
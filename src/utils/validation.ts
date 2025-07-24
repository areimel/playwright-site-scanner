import { URL } from 'url';

export function validateUrl(input: string): boolean | string {
  if (!input || input.trim().length === 0) {
    return 'Please enter a URL.';
  }

  try {
    const url = new URL(input);
    
    if (!['http:', 'https:'].includes(url.protocol)) {
      return 'URL must use http:// or https:// protocol.';
    }
    
    return true;
  } catch (error) {
    return 'Please enter a valid URL (e.g., https://example.com).';
  }
}

export function sanitizePageName(url: string): string {
  try {
    const urlObj = new URL(url);
    let pathname = urlObj.pathname;
    
    // Remove leading/trailing slashes and replace with meaningful names
    if (pathname === '/' || pathname === '') {
      return 'index';
    }
    
    // Remove leading slash and replace subsequent slashes with hyphens
    pathname = pathname.replace(/^\//, '').replace(/\//g, '-');
    
    // Remove file extensions
    pathname = pathname.replace(/\.[^.]*$/, '');
    
    // Replace special characters with hyphens
    pathname = pathname.replace(/[^a-zA-Z0-9-_]/g, '-');
    
    // Remove consecutive hyphens
    pathname = pathname.replace(/-+/g, '-');
    
    // Remove leading/trailing hyphens
    pathname = pathname.replace(/^-|-$/g, '');
    
    return pathname || 'index';
  } catch (error) {
    return 'invalid-url';
  }
}
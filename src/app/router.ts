import { useEffect, useState } from 'react';

export type Route = { name: 'today' } | { name: 'test'; sessionId: string } | { name: 'result'; sessionId: string };

export function parseRoute(hash: string): Route {
  const [, name, id] = hash.replace(/^#/, '').split('/');
  if ((name === 'test' || name === 'result') && id) return { name, sessionId: decodeURIComponent(id) };
  return { name: 'today' };
}

export function href(route: Route): string {
  return route.name === 'today' ? '#/' : `#/${route.name}/${encodeURIComponent(route.sessionId)}`;
}

export function navigate(route: Route): void {
  window.location.hash = href(route);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

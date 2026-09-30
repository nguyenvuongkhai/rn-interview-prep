import { useEffect, useState } from 'react';

export type Route =
  | { name: 'today' }
  | { name: 'test'; sessionId: string }
  | { name: 'result'; sessionId: string }
  | { name: 'library' }
  | { name: 'lesson'; lessonId: string }
  | { name: 'progress' }
  | { name: 'settings' };

const TODAY: Route = { name: 'today' };

function decode(id: string | undefined): string | undefined {
  if (!id) return undefined;
  try {
    return decodeURIComponent(id);
  } catch {
    // a malformed escape such as %E0 falls back to Today instead of crashing the app
    return undefined;
  }
}

export function parseRoute(hash: string): Route {
  const [, name, rawId] = hash.replace(/^#/, '').split('/');
  const id = decode(rawId);
  switch (name) {
    case 'test':
    case 'result':
      return id ? { name, sessionId: id } : TODAY;
    case 'lesson':
      return id ? { name, lessonId: id } : TODAY;
    case 'library':
    case 'progress':
    case 'settings':
      return { name };
    default:
      return TODAY;
  }
}

export function href(route: Route): string {
  switch (route.name) {
    case 'today':
      return '#/';
    case 'test':
    case 'result':
      return `#/${route.name}/${encodeURIComponent(route.sessionId)}`;
    case 'lesson':
      return `#/lesson/${encodeURIComponent(route.lessonId)}`;
    default:
      return `#/${route.name}`;
  }
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

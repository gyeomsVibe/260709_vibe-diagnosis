import { useState, useEffect, useRef } from 'react';

export function useIntersectionObserver(options = {}) {
  // Default TRUE so a diagnostic card ALWAYS renders its content. The observer
  // only culls cards once it confirms they are offscreen; if it never fires
  // (unsupported, or the list mounts fully offscreen) the card stays visible
  // instead of going permanently blank — a blank diagnostic card is worse than
  // losing the virtual-scroll optimization.
  const [isIntersecting, setIsIntersecting] = useState(true);
  const elementRef = useRef(null);

  useEffect(() => {
    const currentElement = elementRef.current;
    if (!currentElement || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, {
      rootMargin: '100px 0px',
      ...options
    });

    observer.observe(currentElement);

    return () => {
      if (currentElement) {
        observer.unobserve(currentElement);
      }
    };
  }, [options]);

  return [elementRef, isIntersecting];
}

import type { ReactNode } from 'react';

const svg = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

export const IconHome = () => svg(<><path d="M4 11l8-7 8 7" /><path d="M6 10v10h12V10" /></>);
export const IconShelf = () => svg(<path d="M5 4v16M9.5 4v16M3 20h18M13.5 7.5l3.4-1 3.3 12.6-3.4 1z" />);
export const IconPerson = () => svg(<><circle cx="12" cy="8.5" r="3.6" /><path d="M4.5 20c.8-3.8 3.7-5.8 7.5-5.8s6.7 2 7.5 5.8" /></>);
export const IconBack = () => svg(<path d="M15 18l-6-6 6-6" />);
export const IconPlus = () => svg(<path d="M12 5v14M5 12h14" />);
export const IconSearch = () => svg(<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>);
export const IconGrid = () => svg(<><rect x="4" y="4" width="6.5" height="6.5" rx="1" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" /></>);
export const IconList = () => svg(<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />);

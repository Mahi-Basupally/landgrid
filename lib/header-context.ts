import { createContext, useContext } from 'react';

export type HeaderState = { projectName: string; message: string };
export type HeaderContextType = { state: HeaderState; setState: (s: Partial<HeaderState>) => void };

export const HeaderContext = createContext<HeaderContextType>({
  state: { projectName: '', message: '' },
  setState: () => {},
});

export function useHeader() { return useContext(HeaderContext); }

import { useOutletContext } from 'react-router-dom';

export interface ConsumerOutletContext {
  openCheck: () => void;
}

export function useOpenCheck(): () => void {
  return useOutletContext<ConsumerOutletContext>().openCheck;
}
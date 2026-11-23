import { createContext, useContext } from 'react';

export const AssistantContext = createContext<{ open: (customerId?: string) => void } | null>(null);
export const useAssistant = () => useContext(AssistantContext);

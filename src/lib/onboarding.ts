import { createContext, useContext } from 'react';

export const OnboardingContext = createContext<{ finish: () => void }>({ finish: () => {} });
export const useOnboarding = () => useContext(OnboardingContext);

export type Personality = 'helpful' | 'creative' | 'technical' | 'minimalist' | 'bold';

export interface AppState {
  theme: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    radius: string;
  };
  personality: Personality;
  activeTools: string[];
  userPreferences: {
    name?: string;
    interests: string[];
    lastInteraction: string;
  };
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  type: 'text' | 'image' | 'audio' | 'system';
  metadata?: any;
}

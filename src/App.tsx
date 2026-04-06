/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Sparkles, 
  Image as ImageIcon, 
  Mic, 
  Settings, 
  User, 
  History, 
  Zap, 
  Palette, 
  Volume2, 
  Search, 
  Loader2,
  Plus,
  Trash2,
  Moon,
  Sun,
  Monitor,
  Cpu,
  BrainCircuit,
  MessageSquare,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { cn } from './lib/utils';
import { GeminiService } from './services/geminiService';
import { AppState, Message, Personality } from './types';

const INITIAL_STATE: AppState = {
  theme: {
    primary: '#3b82f6',
    secondary: '#1e293b',
    accent: '#8b5cf6',
    background: '#0f172a',
    text: '#f8fafc',
    radius: '1rem',
  },
  personality: 'helpful',
  activeTools: ['chat', 'search'],
  userPreferences: {
    interests: [],
    lastInteraction: new Date().toISOString(),
  },
};

const gemini = new GeminiService();

export default function App() {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem('nexus_state');
    return saved ? JSON.parse(saved) : INITIAL_STATE;
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [pendingAdaptation, setPendingAdaptation] = useState<Partial<AppState> | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [newInterest, setNewInterest] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('nexus_state', JSON.stringify(state));
    // Apply theme variables to document
    const root = document.documentElement;
    root.style.setProperty('--primary', state.theme.primary);
    root.style.setProperty('--secondary', state.theme.secondary);
    root.style.setProperty('--accent', state.theme.accent);
    root.style.setProperty('--background', state.theme.background);
    root.style.setProperty('--text', state.theme.text);
    root.style.setProperty('--radius', state.theme.radius);
  }, [state]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() && !selectedImage) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      type: selectedImage ? 'image' : 'text',
      metadata: selectedImage ? { image: selectedImage } : undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      let responseText = '';
      
      if (selectedImage) {
        responseText = await gemini.analyzeImage(selectedImage, input || "What is in this image?");
        setSelectedImage(null);
      } else {
        const history = messages.map(m => ({
          role: m.role,
          parts: [{ text: m.content }]
        }));
        
        const response = await gemini.generateAdaptiveResponse(input, history, state);
        responseText = response.text || "I'm sorry, I couldn't generate a response.";
      }

      // Parse adaptation block
      const adaptMatch = responseText.match(/\[ADAPT: (.*?)\]/);
      if (adaptMatch) {
        try {
          const adaptation = JSON.parse(adaptMatch[1]);
          setPendingAdaptation(adaptation);
          responseText = responseText.replace(/\[ADAPT: (.*?)\]/, '').trim();
        } catch (e) {
          console.error("Failed to parse adaptation:", e);
        }
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: responseText,
        type: 'text',
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        content: "An error occurred while processing your request.",
        type: 'system'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateImage = async (prompt: string) => {
    setIsLoading(true);
    try {
      const imageUrl = await gemini.generateImage(prompt);
      if (imageUrl) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'model',
          content: `Generated image for: ${prompt}`,
          type: 'image',
          metadata: { image: imageUrl }
        }]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const playTTS = async (text: string) => {
    try {
      const audioUrl = await gemini.textToSpeech(text);
      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audio.play();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const applyAdaptation = () => {
    if (!pendingAdaptation) return;
    setState(prev => ({
      ...prev,
      ...pendingAdaptation,
      theme: { ...prev.theme, ...(pendingAdaptation.theme || {}) },
      userPreferences: {
        ...prev.userPreferences,
        ...(pendingAdaptation.userPreferences || {})
      }
    }));
    setPendingAdaptation(null);
  };

  const updateProfile = (updates: Partial<AppState['userPreferences']>) => {
    setState(prev => ({
      ...prev,
      userPreferences: {
        ...prev.userPreferences,
        ...updates
      }
    }));
  };

  const addInterest = () => {
    if (!newInterest.trim()) return;
    if (!state.userPreferences.interests.includes(newInterest.trim())) {
      updateProfile({
        interests: [...state.userPreferences.interests, newInterest.trim()]
      });
    }
    setNewInterest('');
  };

  const removeInterest = (interest: string) => {
    updateProfile({
      interests: state.userPreferences.interests.filter(i => i !== interest)
    });
  };

  return (
    <div 
      className="flex h-screen w-full overflow-hidden transition-colors duration-500"
      style={{ backgroundColor: 'var(--background)', color: 'var(--text)' }}
    >
      {/* Sidebar */}
      <AnimatePresence>
        {showSidebar && (
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className="w-72 border-r border-white/10 flex flex-col bg-black/20 backdrop-blur-xl"
          >
            <div className="p-6 flex items-center gap-3 border-b border-white/10">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
                <BrainCircuit className="w-6 h-6 text-white" />
              </div>
              <h1 className="font-bold text-xl tracking-tight">Nexus AI</h1>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <section>
                <div className="flex items-center justify-between mb-3 px-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">User Profile</h2>
                  <button 
                    onClick={() => setIsEditingProfile(!isEditingProfile)}
                    className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {isEditingProfile ? 'Done' : 'Edit'}
                  </button>
                </div>
                
                <div className="space-y-3 p-3 rounded-2xl bg-white/5 border border-white/5">
                  <div>
                    <label className="text-[10px] text-white/40 block mb-1">Name</label>
                    {isEditingProfile ? (
                      <input 
                        type="text"
                        value={state.userPreferences.name || ''}
                        onChange={(e) => updateProfile({ name: e.target.value })}
                        placeholder="Your name"
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-blue-500/50"
                      />
                    ) : (
                      <p className="text-sm font-medium">{state.userPreferences.name || 'Anonymous'}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] text-white/40 block mb-1">Interests</label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {state.userPreferences.interests.map(interest => (
                        <span 
                          key={interest}
                          className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-400 flex items-center gap-1"
                        >
                          {interest}
                          {isEditingProfile && (
                            <button onClick={() => removeInterest(interest)}>
                              <Plus className="w-2.5 h-2.5 rotate-45" />
                            </button>
                          )}
                        </span>
                      ))}
                      {state.userPreferences.interests.length === 0 && !isEditingProfile && (
                        <span className="text-[10px] text-white/20 italic">No interests listed</span>
                      )}
                    </div>
                    {isEditingProfile && (
                      <div className="flex gap-1">
                        <input 
                          type="text"
                          value={newInterest}
                          onChange={(e) => setNewInterest(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addInterest()}
                          placeholder="Add interest..."
                          className="flex-1 bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-xs focus:outline-none"
                        />
                        <button 
                          onClick={addInterest}
                          className="p-1 rounded-lg bg-blue-600 hover:bg-blue-500 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3 px-2">System Status</h2>
                <div className="space-y-1">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-400" />
                      <span className="text-sm">Personality</span>
                    </div>
                    <span className="text-xs font-mono capitalize text-blue-400">{state.personality}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                    <div className="flex items-center gap-2">
                      <Palette className="w-4 h-4 text-pink-400" />
                      <span className="text-sm">Adaptive Theme</span>
                    </div>
                    <div className="flex gap-1">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--primary)' }} />
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3 px-2">Active Modules</h2>
                <div className="grid grid-cols-2 gap-2">
                  {['chat', 'vision', 'image_gen', 'search', 'tts'].map(tool => {
                    const isActive = state.activeTools.includes(tool);
                    return (
                      <div 
                        key={tool} 
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-lg text-xs transition-all duration-500",
                          isActive ? "bg-white/10 text-white" : "bg-white/5 text-white/20"
                        )}
                      >
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          isActive ? "bg-green-500 animate-pulse" : "bg-white/10"
                        )} />
                        <span className="capitalize">{tool.replace('_', ' ')}</span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3 px-2">Quick Actions</h2>
                {state.activeTools.includes('image_gen') && (
                  <button 
                    onClick={() => generateImage("A futuristic city floating in the clouds, neon lights, cinematic style")}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-sm mb-2"
                  >
                    <ImageIcon className="w-4 h-4 text-blue-400" />
                    Generate Art
                  </button>
                )}
                <button 
                  onClick={() => setMessages([])}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-red-500/20 transition-colors text-sm text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear Memory
                </button>
              </section>
            </div>

            <div className="p-4 border-t border-white/10">
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                  {state.userPreferences.name ? state.userPreferences.name[0].toUpperCase() : <User className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{state.userPreferences.name || 'User Session'}</p>
                  <p className="text-xs text-white/40">Nexus v2.5</p>
                </div>
                <Settings className="w-4 h-4 text-white/40 cursor-pointer hover:text-white" />
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-white/10 bg-black/10 backdrop-blur-md z-10">
          <button 
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <History className="w-5 h-5" />
          </button>
          
          <div className="flex-1 px-6">
            <AnimatePresence>
              {pendingAdaptation && (
                <motion.div 
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-xl max-w-md mx-auto"
                >
                  <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
                  <p className="text-xs text-blue-200 truncate">Nexus suggests an interface adaptation</p>
                  <div className="flex gap-2 ml-auto">
                    <button 
                      onClick={() => setPendingAdaptation(null)}
                      className="text-[10px] font-bold text-white/40 hover:text-white"
                    >
                      Ignore
                    </button>
                    <button 
                      onClick={applyAdaptation}
                      className="text-[10px] font-bold text-blue-400 hover:text-blue-300"
                    >
                      Apply
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowClearConfirm(true)}
              className="p-2 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors flex items-center gap-2 text-xs font-medium"
              title="Reset Conversation"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Reset</span>
            </button>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
              Gemini 3.1 Pro
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto space-y-6">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="p-6 rounded-3xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 border border-white/10"
              >
                <BrainCircuit className="w-16 h-16 text-blue-400 mb-4 mx-auto" />
                <h2 className="text-3xl font-bold mb-2">Welcome to Nexus</h2>
                <p className="text-white/60">
                  I am an adaptive AI that evolves with you. Ask me anything, share an image, 
                  or tell me how you want this interface to look.
                </p>
              </motion.div>
              
              <div className="grid grid-cols-2 gap-4 w-full">
                {[
                  "Change the theme to Cyberpunk",
                  "Analyze my latest photo",
                  "What's the news in AI today?",
                  "Write a creative story"
                ].map((suggestion, i) => (
                  <button 
                    key={i}
                    onClick={() => setInput(suggestion)}
                    className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/20 hover:bg-white/10 transition-all text-left text-sm"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex gap-4 max-w-4xl",
                msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                msg.role === 'user' ? "bg-blue-600" : "bg-purple-600"
              )}>
                {msg.role === 'user' ? <User className="w-4 h-4" /> : <Cpu className="w-4 h-4" />}
              </div>
              
              <div className={cn(
                "flex flex-col gap-2",
                msg.role === 'user' ? "items-end" : "items-start"
              )}>
                <div className={cn(
                  "px-4 py-3 rounded-2xl text-sm leading-relaxed",
                  msg.role === 'user' 
                    ? "bg-blue-600 text-white rounded-tr-none" 
                    : "bg-white/10 text-white/90 rounded-tl-none border border-white/5"
                )}>
                  {msg.type === 'image' && msg.metadata?.image && (
                    <img 
                      src={msg.metadata.image} 
                      alt="Uploaded content" 
                      className="rounded-xl mb-3 max-w-full h-auto border border-white/10"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="prose prose-invert max-w-none">
                    <ReactMarkdown>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
                
                {msg.role === 'model' && msg.type === 'text' && state.activeTools.includes('tts') && (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => playTTS(msg.content)}
                      className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors"
                      title="Speak response"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center animate-pulse">
                <Cpu className="w-4 h-4" />
              </div>
              <div className="px-4 py-3 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                <span className="text-sm text-white/40">Nexus is thinking...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-6 bg-gradient-to-t from-black/20 to-transparent">
          <div className="max-w-4xl mx-auto relative">
            {selectedImage && (
              <div className="absolute bottom-full mb-4 left-0 p-2 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/10 flex items-center gap-3">
                <img src={selectedImage} alt="Preview" className="w-12 h-12 rounded-lg object-cover" />
                <button 
                  onClick={() => setSelectedImage(null)}
                  className="p-1 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/40"
                >
                  <Plus className="w-4 h-4 rotate-45" />
                </button>
              </div>
            )}
            
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-600/20 rounded-2xl blur-xl group-focus-within:opacity-100 opacity-0 transition-opacity" />
              <div className="relative flex items-end gap-2 p-2 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl focus-within:border-white/20 transition-all">
                {state.activeTools.includes('vision') && (
                  <label className="p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors">
                    <ImageIcon className="w-5 h-5 text-white/40" />
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                )}
                
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask Nexus anything..."
                  className="flex-1 bg-transparent border-none focus:ring-0 resize-none py-3 text-sm max-h-40 min-h-[44px]"
                  rows={1}
                />

                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setIsRecording(!isRecording)}
                    className={cn(
                      "p-3 rounded-xl transition-all",
                      isRecording ? "bg-red-500/20 text-red-500 animate-pulse" : "hover:bg-white/5 text-white/40"
                    )}
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={handleSend}
                    disabled={isLoading || (!input.trim() && !selectedImage)}
                    className="p-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 transition-all"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-center mt-3 text-white/20 uppercase tracking-[0.2em]">
              Powered by Gemini 3.1 Pro & 2.5 Flash
            </p>
          </div>
        </div>
      </main>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center mb-4">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-xl font-bold mb-2">Clear History?</h3>
              <p className="text-white/60 text-sm mb-6">
                This will permanently delete all messages in this conversation. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    setMessages([]);
                    setShowClearConfirm(false);
                  }}
                  className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 transition-colors text-sm font-medium"
                >
                  Clear All
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        :root {
          --primary: #3b82f6;
          --secondary: #1e293b;
          --accent: #8b5cf6;
          --background: #0f172a;
          --text: #f8fafc;
          --radius: 1rem;
        }

        .prose pre {
          background: rgba(255, 255, 255, 0.05) !important;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.75rem;
        }

        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}

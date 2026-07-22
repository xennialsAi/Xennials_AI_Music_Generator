import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, logout } from '../services/googleAuth';
import { createMeetSpace, updateMeetSpaceConfig, MeetSpace } from '../services/googleMeetService';
import { Video, Copy, ExternalLink, Plus, Trash2, Check, AlertCircle, Loader2, Settings2, Shield, Share2, LogOut } from 'lucide-react';

interface SavedSession {
  id: string; // resource name, e.g. "spaces/abc-defg-hij"
  title: string;
  url: string;
  code: string;
  accessType: 'OPEN' | 'TRUSTED' | 'RESTRICTED';
  createdAt: string;
}

interface GoogleMeetIntegrationProps {
  defaultTitle?: string;
  onAuthChange?: (token: string | null) => void;
}

export const GoogleMeetIntegration: React.FC<GoogleMeetIntegrationProps> = ({
  defaultTitle = '',
  onAuthChange
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [sessionTitle, setSessionTitle] = useState(defaultTitle ? `${defaultTitle} Jam` : 'Co-Writing Session');
  const [accessType, setAccessType] = useState<'OPEN' | 'TRUSTED' | 'RESTRICTED'>('OPEN');
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Advanced configuration state for a specific selected space
  const [editingSession, setEditingSession] = useState<SavedSession | null>(null);
  const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);

  // Initialize auth
  useEffect(() => {
    const unsubscribe = initAuth(
      (firebaseUser, accessToken) => {
        setUser(firebaseUser);
        setToken(accessToken);
        setNeedsAuth(false);
        if (onAuthChange) onAuthChange(accessToken);
      },
      () => {
        setUser(null);
        setToken(null);
        setNeedsAuth(true);
        if (onAuthChange) onAuthChange(null);
      }
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [onAuthChange]);

  // Load saved sessions from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('xennials_meet_sessions');
    if (stored) {
      try {
        setSavedSessions(JSON.parse(stored));
      } catch (err) {
        console.error('Error parsing stored Meet sessions:', err);
      }
    }
  }, []);

  const saveSessionsToStorage = (updated: SavedSession[]) => {
    setSavedSessions(updated);
    localStorage.setItem('xennials_meet_sessions', JSON.stringify(updated));
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setNeedsAuth(false);
        if (onAuthChange) onAuthChange(result.accessToken);
        setSuccess('Successfully connected to Google Workspace!');
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Google authentication failed.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setToken(null);
      setNeedsAuth(true);
      if (onAuthChange) onAuthChange(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setIsCreating(true);
    setError(null);
    try {
      const space = await createMeetSpace(token, accessType);
      
      const newSession: SavedSession = {
        id: space.name,
        title: sessionTitle || 'Untitled Studio Room',
        url: space.meetingUri,
        code: space.meetingCode,
        accessType: accessType,
        createdAt: new Date().toISOString()
      };

      const updated = [newSession, ...savedSessions];
      saveSessionsToStorage(updated);
      setSuccess(`Studio Room "${newSession.title}" created!`);
      setSessionTitle(''); // Clear input
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to initialize Meet Space.');
      // Re-login check if 401
      if (err.message && err.message.includes('401')) {
        handleLogout();
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteSession = (id: string, name: string) => {
    const confirmDelete = window.confirm(`Remove session "${name}" from your studio history?`);
    if (!confirmDelete) return;

    const updated = savedSessions.filter(s => s.id !== id);
    saveSessionsToStorage(updated);
    if (editingSession?.id === id) {
      setEditingSession(null);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleUpdateSpaceConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingSession) return;

    setIsUpdatingConfig(true);
    setError(null);
    try {
      const updatedSpace = await updateMeetSpaceConfig(
        token,
        editingSession.id,
        editingSession.accessType
      );

      // Update in saved list
      const updated = savedSessions.map(s => {
        if (s.id === editingSession.id) {
          return {
            ...s,
            accessType: editingSession.accessType
          };
        }
        return s;
      });
      saveSessionsToStorage(updated);
      setSuccess(`Updated access policy for "${editingSession.title}"`);
      setEditingSession(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error(err);
      setError(`Failed to update settings: ${err.message || err}`);
    } finally {
      setIsUpdatingConfig(false);
    }
  };

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-[28px] p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-950/40 border border-red-900/40 rounded-xl text-rose-400">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-100 text-sm">Google Meet Collaborative Suite</h3>
            <p className="text-[11px] text-zinc-500">Live remote studio co-writing & feedback loops</p>
          </div>
        </div>

        {/* User state connection */}
        {!needsAuth && user ? (
          <div className="flex items-center gap-3 bg-zinc-950 p-1.5 pl-3 pr-2.5 rounded-xl border border-zinc-850">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              <span className="text-[11px] font-mono text-zinc-400 max-w-[120px] truncate" title={user.email || ''}>
                {user.email}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
              title="Disconnect Google Meet"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : null}
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-start gap-2.5 bg-red-950/20 border border-red-900/40 text-red-400 text-xs p-3.5 rounded-xl animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2.5 bg-emerald-950/20 border border-emerald-900/40 text-emerald-400 text-xs p-3.5 rounded-xl animate-in fade-in duration-200">
          <Check className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Connection panel if needed */}
      {needsAuth ? (
        <div className="py-6 flex flex-col items-center justify-center text-center space-y-4">
          <p className="text-xs text-zinc-400 max-w-sm">
            Unlock real-time studio feedback. Create instantly-sharable Google Meet video/audio rooms to collaborate live with other producers on lyrics, arrangements, and mixing decisions.
          </p>

          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="gsi-material-button hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: '#fff',
              color: '#1f1f1f',
              border: '1px solid #dadce0',
              borderRadius: '12px',
              padding: '10px 18px',
              fontFamily: '"Google Sans", Roboto, Arial, sans-serif',
              fontSize: '14px',
              fontWeight: '500',
              gap: '12px'
            }}
          >
            {isLoggingIn ? (
              <Loader2 className="w-4 h-4 animate-spin text-zinc-600" />
            ) : (
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: "block", width: "18px", height: "18px" }}>
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              </svg>
            )}
            <span>{isLoggingIn ? 'Connecting...' : 'Authorize Google Meet'}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Create space form */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                🎙️ Spawn New Studio Session
              </label>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-4">
              <div className="space-y-1.5">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Session Name / Project Label</span>
                <input
                  type="text"
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                  placeholder="Xennials Studio Live Review"
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-zinc-700 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Privacy / Access Policy</span>
                <div className="grid grid-cols-3 gap-2 bg-zinc-950 p-1 rounded-xl border border-zinc-850">
                  {(['OPEN', 'TRUSTED', 'RESTRICTED'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setAccessType(type)}
                      className={`py-1.5 rounded-lg text-[10px] font-bold tracking-wider transition-all cursor-pointer ${
                        accessType === type
                          ? 'bg-zinc-800 text-white shadow-sm'
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isCreating}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Configuring Meet Infrastructure...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Session Room</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Session History and Active Spaces */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                📁 Studio Meet Rooms Catalog
              </label>
            </div>

            {editingSession ? (
              <form onSubmit={handleUpdateSpaceConfig} className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                  <span className="text-xs font-bold text-zinc-300">Room Settings: {editingSession.title}</span>
                  <button 
                    type="button" 
                    onClick={() => setEditingSession(null)}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Access policy</span>
                  <div className="grid grid-cols-3 gap-2 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                    {(['OPEN', 'TRUSTED', 'RESTRICTED'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setEditingSession({ ...editingSession, accessType: type })}
                        className={`py-1.5 rounded-md text-[9px] font-bold tracking-wider transition-all cursor-pointer ${
                          editingSession.accessType === type
                            ? 'bg-zinc-800 text-white shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isUpdatingConfig}
                  className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  {isUpdatingConfig ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Shield className="w-3 h-3" />
                  )}
                  Save New Settings
                </button>
              </form>
            ) : (
              <div className="border border-zinc-850 rounded-xl max-h-[220px] overflow-y-auto bg-zinc-950 divide-y divide-zinc-900 custom-scrollbar">
                {savedSessions.length > 0 ? (
                  savedSessions.map((session) => (
                    <div key={session.id} className="p-3.5 flex flex-col gap-2 hover:bg-zinc-900/40 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs text-zinc-200 font-bold truncate">
                            {session.title}
                          </p>
                          <p className="text-[9px] text-zinc-500 font-mono">
                            Created: {new Date(session.createdAt).toLocaleDateString()} at {new Date(session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => setEditingSession(session)}
                            className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-lg transition-all cursor-pointer"
                            title="Edit meeting access settings"
                          >
                            <Settings2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSession(session.id, session.title)}
                            className="p-1.5 bg-zinc-900 hover:bg-red-950/40 text-zinc-400 hover:text-red-400 rounded-lg transition-all cursor-pointer"
                            title="Remove Room"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-1 border-t border-zinc-900/60">
                        <div className="flex items-center gap-1.5 font-mono text-[9px] text-zinc-400">
                          <span className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 rounded font-semibold text-rose-400">
                            {session.code}
                          </span>
                          <span className="text-[8px] uppercase font-bold text-zinc-500 px-1 py-0.5 border border-zinc-800 rounded">
                            {session.accessType}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyToClipboard(session.url, session.id)}
                            className="px-2 py-1 bg-zinc-900 hover:bg-zinc-850 text-[9px] font-bold text-zinc-300 rounded transition-all flex items-center gap-1 cursor-pointer"
                            title="Copy invite link to clipboard"
                          >
                            {copiedId === session.id ? (
                              <Check className="w-3 h-3 text-emerald-400 animate-in zoom-in-50" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span>{copiedId === session.id ? 'Copied' : 'Copy'}</span>
                          </button>

                          <a
                            href={session.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 hover:text-rose-300 border border-rose-500/20 rounded text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-1"
                          >
                            <span>Join</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-12 text-center text-zinc-500 space-y-2">
                    <Video className="w-6 h-6 mx-auto text-zinc-700 animate-pulse" />
                    <p className="text-xs">No collaborative Meet spaces created yet.</p>
                    <p className="text-[10px] text-zinc-600">Click "Create Session Room" above to set one up.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

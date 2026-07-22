import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, logout, getAccessToken } from '../services/googleAuth';
import { listGoogleDocs, importGoogleDoc, exportToGoogleDoc, GoogleDocFile } from '../services/googleDocsService';
import { FileText, Download, Upload, LogOut, Search, Loader2, Check, ExternalLink, AlertCircle } from 'lucide-react';

interface GoogleDocsIntegrationProps {
  currentLyrics: string;
  onImportLyrics: (lyrics: string) => void;
  defaultTitle?: string;
  onAuthChange?: (token: string | null) => void;
}

export const GoogleDocsIntegration: React.FC<GoogleDocsIntegrationProps> = ({
  currentLyrics,
  onImportLyrics,
  defaultTitle = '',
  onAuthChange
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [docs, setDocs] = useState<GoogleDocFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [importingDocId, setImportingDocId] = useState<string | null>(null);
  const [exportTitle, setExportTitle] = useState(defaultTitle || 'My Song Lyrics');
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ id: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  // Load documents when authenticated
  useEffect(() => {
    if (token) {
      handleListDocs();
    } else {
      setDocs([]);
    }
  }, [token]);

  // Refresh search/list
  const handleListDocs = async (search = searchQuery) => {
    if (!token) return;
    setIsLoadingDocs(true);
    setError(null);
    try {
      const files = await listGoogleDocs(token, search);
      setDocs(files);
    } catch (err: any) {
      console.error(err);
      setError('Could not retrieve Google Docs. Your session may have expired.');
      // If token expired, trigger re-auth
      if (err.message && err.message.includes('401')) {
        handleLogout();
      }
    } finally {
      setIsLoadingDocs(false);
    }
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
        setSuccessMessage('Successfully connected to Google Workspace!');
        setTimeout(() => setSuccessMessage(null), 3000);
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
      setDocs([]);
      if (onAuthChange) onAuthChange(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleImport = async (docId: string, docName: string) => {
    if (!token) return;
    
    const confirmImport = window.confirm(`Import lyrics from "${docName}"? This will overwrite your current Custom Lyrics input.`);
    if (!confirmImport) return;

    setImportingDocId(docId);
    setError(null);
    try {
      const content = await importGoogleDoc(token, docId);
      if (content) {
        onImportLyrics(content);
        setSuccessMessage(`Lyrics imported from "${docName}"!`);
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        setError('Selected document appears to be empty.');
      }
    } catch (err: any) {
      console.error(err);
      setError(`Failed to import document: ${err.message || err}`);
    } finally {
      setImportingDocId(null);
    }
  };

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!currentLyrics || currentLyrics.trim() === '') {
      setError('Please write or generate some lyrics before exporting.');
      return;
    }

    setIsExporting(true);
    setError(null);
    setExportResult(null);

    try {
      const result = await exportToGoogleDoc(token, exportTitle, currentLyrics);
      setExportResult(result);
      setSuccessMessage(`Successfully created Google Doc: "${exportTitle}"!`);
    } catch (err: any) {
      console.error(err);
      setError(`Failed to export lyrics: ${err.message || err}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-[28px] p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-950/40 border border-blue-900/40 rounded-xl text-blue-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-100 text-sm">Google Docs Studio Suite</h3>
            <p className="text-[11px] text-zinc-500">Import stanzas or export your engineered lyrics</p>
          </div>
        </div>

        {/* User login state */}
        {!needsAuth && user ? (
          <div className="flex items-center gap-3 bg-zinc-950 p-1.5 pl-3 pr-2.5 rounded-xl border border-zinc-850">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[11px] font-mono text-zinc-400 max-w-[120px] truncate" title={user.email || ''}>
                {user.email}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
              title="Disconnect Google Docs"
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

      {successMessage && (
        <div className="flex items-start gap-2.5 bg-emerald-950/20 border border-emerald-900/40 text-emerald-400 text-xs p-3.5 rounded-xl animate-in fade-in duration-200">
          <Check className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Connected and authenticated tools */}
      {needsAuth ? (
        <div className="py-6 flex flex-col items-center justify-center text-center space-y-4">
          <p className="text-xs text-zinc-400 max-w-sm">
            Sign in with your Google account to select from your existing Google Docs or directly export custom-tailored song lyrics to a new document.
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
            <span>{isLoggingIn ? 'Connecting...' : 'Sign in with Google'}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* List and Import Section */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                📥 Import from Google Docs
              </label>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  handleListDocs(e.target.value);
                }}
                placeholder="Search documents..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-zinc-700 outline-none"
              />
            </div>

            <div className="border border-zinc-850 rounded-xl max-h-[190px] overflow-y-auto bg-zinc-950 divide-y divide-zinc-900 custom-scrollbar">
              {isLoadingDocs ? (
                <div className="p-8 text-center space-y-2">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-zinc-500" />
                  <p className="text-[11px] text-zinc-500 font-mono">Querying Drive catalog...</p>
                </div>
              ) : docs.length > 0 ? (
                docs.map((doc) => (
                  <div key={doc.id} className="p-3 flex items-center justify-between hover:bg-zinc-900/50 transition-colors">
                    <div className="min-w-0 pr-2">
                      <p className="text-xs text-zinc-200 font-medium truncate" title={doc.name}>
                        {doc.name}
                      </p>
                      <p className="text-[9px] text-zinc-500 font-mono">
                        Modified: {new Date(doc.modifiedTime).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {doc.webViewLink && (
                        <a
                          href={doc.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-lg transition-all"
                          title="Open document in new tab"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        onClick={() => handleImport(doc.id, doc.name)}
                        disabled={importingDocId !== null}
                        className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-900 text-[10px] font-bold uppercase tracking-wider text-white rounded-lg transition-all flex items-center gap-1 active:scale-[0.97] cursor-pointer"
                      >
                        {importingDocId === doc.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Upload className="w-3 h-3" />
                        )}
                        Import
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-zinc-500">
                  <p className="text-xs">No Google Docs found.</p>
                  <button
                    onClick={() => handleListDocs('')}
                    className="text-[10px] font-mono text-blue-400 hover:underline mt-1 cursor-pointer"
                  >
                    Clear search filter
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Create and Export Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                📤 Export to Google Doc
              </label>
            </div>

            <form onSubmit={handleExport} className="space-y-3">
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Document Title</span>
                <input
                  type="text"
                  value={exportTitle}
                  onChange={(e) => setExportTitle(e.target.value)}
                  placeholder="Xennials Lyrics - Sunset Jam"
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-zinc-700 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isExporting || !currentLyrics || currentLyrics.trim() === ''}
                className={`w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  !currentLyrics || currentLyrics.trim() === ''
                    ? 'bg-zinc-950 border border-zinc-900 text-zinc-600 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-[0.98]'
                }`}
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Writing Document...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Custom Lyrics</span>
                  </>
                )}
              </button>
            </form>

            {/* Export Success Result */}
            {exportResult && (
              <div className="p-3.5 bg-emerald-950/20 border border-emerald-900/40 rounded-xl space-y-2 animate-in slide-in-from-top-1 duration-200">
                <p className="text-[11px] text-zinc-400">
                  Document successfully created! Open it to edit, share, or download.
                </p>
                <a
                  href={exportResult.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-bold tracking-wider"
                >
                  <span>Open "{exportTitle}" on Google Docs</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

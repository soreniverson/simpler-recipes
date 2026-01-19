import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { signInWithGoogle, signInWithEmail, isSupabaseConfigured } from '../utils/supabase';

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

export default function AuthModal({
  isOpen,
  onClose,
  title = "Create a free account",
  description = "Sign up to unlock unlimited recipe saving and sync across devices."
}) {
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const configured = isSupabaseConfigured();

  const handleGoogleSignIn = async () => {
    if (!configured) {
      alert('Auth not configured yet');
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await signInWithGoogle();
    if (error) {
      setError(error.message);
      setLoading(false);
    }
    // If successful, user will be redirected to Google
  };

  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    if (!configured || !email) return;

    setLoading(true);
    setError(null);
    const { error } = await signInWithEmail(email);
    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setEmailSent(true);
    }
  };

  const handleClose = () => {
    setShowEmailForm(false);
    setEmail('');
    setEmailSent(false);
    setError(null);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="bg-surface rounded-2xl shadow-xl max-w-md w-full p-6">
        {/* Close button */}
        <div className="flex justify-end mb-2">
          <button
            onClick={handleClose}
            className="text-sand-400 hover:text-sand-600 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="text-center">
          <div className="w-12 h-12 bg-sand-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-sand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-sand-900 mb-2">
            {title}
          </h2>
          <p className="text-sand-600 mb-6">
            {description}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {emailSent ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-sand-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-sand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="font-medium text-sand-900 mb-2">Check your email</h3>
            <p className="text-sand-600 text-sm">
              We sent a sign-in link to <strong>{email}</strong>
            </p>
            <button
              onClick={handleClose}
              className="mt-4 text-sand-500 hover:text-sand-700 text-sm"
            >
              Close
            </button>
          </div>
        ) : showEmailForm ? (
          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-sand-700 mb-1">
                Email address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 border border-sand-300 rounded-xl text-sand-900 placeholder:text-sand-400 focus:outline-none focus:ring-2 focus:ring-sand-500 focus:border-sand-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-3 px-4 bg-sand-900 text-white rounded-xl font-medium hover:bg-sand-800 transition-colors disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send sign-in link'}
            </button>
            <button
              type="button"
              onClick={() => setShowEmailForm(false)}
              className="w-full py-2 px-4 text-sand-500 hover:text-sand-700 transition-colors text-sm"
            >
              Back to options
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white border border-sand-300 rounded-xl font-medium text-sand-700 hover:bg-sand-50 transition-colors disabled:opacity-50"
            >
              <GoogleIcon />
              Continue with Google
            </button>
            <button
              onClick={() => setShowEmailForm(true)}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-sand-900 text-white rounded-xl font-medium hover:bg-sand-800 transition-colors"
            >
              <EmailIcon />
              Continue with email
            </button>
            <button
              onClick={handleClose}
              className="w-full py-2 px-4 text-sand-500 hover:text-sand-700 transition-colors text-sm"
            >
              Maybe later
            </button>
          </div>
        )}
        </div>
      </div>
    </div>,
    document.body
  );
}

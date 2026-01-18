import { useState, useEffect, useCallback, useRef } from 'react';

function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

export default function CookMode({ instructions, recipeName, onClose }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [wakeLock, setWakeLock] = useState(null);
  const dialogRef = useRef(null);
  const previousActiveElement = useRef(null);
  const closeButtonRef = useRef(null);

  const totalSteps = instructions.length;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  // Store previously focused element and focus dialog on mount
  useEffect(() => {
    previousActiveElement.current = document.activeElement;

    // Focus the close button when dialog opens
    if (closeButtonRef.current) {
      closeButtonRef.current.focus();
    }

    // Restore focus when dialog closes
    return () => {
      if (previousActiveElement.current && previousActiveElement.current.focus) {
        previousActiveElement.current.focus();
      }
    };
  }, []);

  // Focus trap - keep focus within the dialog
  useEffect(() => {
    function handleFocusTrap(e) {
      if (!dialogRef.current) return;

      const focusableElements = dialogRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }

    document.addEventListener('keydown', handleFocusTrap);
    return () => document.removeEventListener('keydown', handleFocusTrap);
  }, []);

  // Request wake lock to keep screen on
  useEffect(() => {
    async function requestWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          const lock = await navigator.wakeLock.request('screen');
          setWakeLock(lock);
        }
      } catch (err) {
        console.log('Wake lock not available:', err);
      }
    }

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) {
        wakeLock.release();
      }
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        if (e.target.tagName !== 'BUTTON') {
          e.preventDefault();
          if (!isLastStep) setCurrentStep(s => s + 1);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (!isFirstStep) setCurrentStep(s => s - 1);
      } else if (e.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFirstStep, isLastStep, onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const goToPrevious = useCallback(() => {
    if (!isFirstStep) setCurrentStep(s => s - 1);
  }, [isFirstStep]);

  const goToNext = useCallback(() => {
    if (!isLastStep) setCurrentStep(s => s + 1);
  }, [isLastStep]);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cook-mode-title"
      aria-describedby="cook-mode-step"
      className="fixed inset-0 z-50 bg-background flex flex-col"
    >
      {/* Visually hidden title for screen readers */}
      <h1 id="cook-mode-title" className="sr-only">
        Cook Mode: {recipeName}
      </h1>

      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-4">
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="p-3 -ml-2 text-sand-500 hover:text-sand-700 hover:bg-sand-100 rounded-lg transition-colors"
          aria-label="Exit cook mode"
        >
          <CloseIcon />
        </button>
        {/* Live region for step announcements */}
        <span
          className="text-sand-500 text-sm"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          Step {currentStep + 1} of {totalSteps}
        </span>
        <div className="w-12" /> {/* Spacer for centering */}
      </header>

      {/* Progress bar */}
      <div
        className="flex-shrink-0 h-1 bg-sand-200 mx-4 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={currentStep + 1}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
        aria-label={`Step ${currentStep + 1} of ${totalSteps}`}
      >
        <div
          className="h-full bg-sand-500 rounded-full"
          style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 min-h-0 overflow-auto">
        <div className="max-w-2xl w-full text-center">
          <p className="text-sand-500 text-sm font-medium uppercase tracking-wider mb-4">
            Step {currentStep + 1}
          </p>
          <p
            id="cook-mode-step"
            className="text-xl sm:text-2xl md:text-3xl text-sand-800 leading-relaxed"
          >
            {instructions[currentStep]}
          </p>
        </div>
      </div>

      {/* Footer navigation */}
      <footer className="flex-shrink-0 px-4 pb-6 pt-4">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button
            onClick={goToPrevious}
            disabled={isFirstStep}
            className={`
              flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-medium transition-colors
              ${isFirstStep
                ? 'bg-sand-200 dark:bg-sand-400 text-sand-400 dark:text-sand-500 cursor-not-allowed'
                : 'bg-sand-200 dark:bg-sand-400 text-sand-700 dark:text-sand-900 hover:bg-sand-300 dark:hover:bg-sand-500'
              }
            `}
            aria-label={isFirstStep ? "No previous step" : "Go to previous step"}
          >
            <ChevronLeftIcon />
            <span>Back</span>
          </button>

          {isLastStep ? (
            <button
              onClick={onClose}
              className="flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-medium bg-sand-800 dark:bg-sand-200 text-sand-50 dark:text-sand-900 hover:bg-sand-700 dark:hover:bg-sand-300 transition-colors"
              aria-label="Finish cooking and exit"
            >
              <span>Done</span>
            </button>
          ) : (
            <button
              onClick={goToNext}
              className="flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-medium bg-sand-800 dark:bg-sand-200 text-sand-50 dark:text-sand-900 hover:bg-sand-700 dark:hover:bg-sand-300 transition-colors"
              aria-label="Go to next step"
            >
              <span>Next</span>
              <ChevronRightIcon />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

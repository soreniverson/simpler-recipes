import { useState, useEffect, useCallback } from 'react';

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

  const totalSteps = instructions.length;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

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
        e.preventDefault();
        if (!isLastStep) setCurrentStep(s => s + 1);
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
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-4">
        <button
          onClick={onClose}
          className="p-2 -ml-2 text-sand-400 hover:text-sand-600 hover:bg-sand-100 rounded-lg transition-colors"
          aria-label="Exit cook mode"
        >
          <CloseIcon />
        </button>
        <span className="text-sand-500 text-sm">
          {currentStep + 1} / {totalSteps}
        </span>
        <div className="w-9" /> {/* Spacer for centering */}
      </header>

      {/* Progress bar */}
      <div className="flex-shrink-0 h-1 bg-sand-200 mx-4 rounded-full overflow-hidden">
        <div
          className="h-full bg-sand-500 transition-all duration-300 rounded-full"
          style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 min-h-0 overflow-auto">
        <div className="max-w-2xl w-full text-center">
          <p className="text-sand-400 text-sm font-medium uppercase tracking-wider mb-4">
            Step {currentStep + 1}
          </p>
          <p className="text-xl sm:text-2xl md:text-3xl text-sand-800 leading-relaxed">
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
              flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-medium transition-all
              ${isFirstStep
                ? 'bg-sand-200 dark:bg-sand-400 text-sand-400 dark:text-sand-500 cursor-not-allowed'
                : 'bg-sand-200 dark:bg-sand-400 text-sand-700 dark:text-sand-900 hover:bg-sand-300 dark:hover:bg-sand-500 active:scale-[0.98]'
              }
            `}
            aria-label="Previous step"
          >
            <ChevronLeftIcon />
            <span>Back</span>
          </button>

          {isLastStep ? (
            <button
              onClick={onClose}
              className="flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-medium bg-sand-800 dark:bg-sand-200 text-sand-50 dark:text-sand-900 hover:bg-sand-700 dark:hover:bg-sand-300 active:scale-[0.98] transition-all"
            >
              <span>Done</span>
            </button>
          ) : (
            <button
              onClick={goToNext}
              className="flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-medium bg-sand-800 dark:bg-sand-200 text-sand-50 dark:text-sand-900 hover:bg-sand-700 dark:hover:bg-sand-300 active:scale-[0.98] transition-all"
              aria-label="Next step"
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

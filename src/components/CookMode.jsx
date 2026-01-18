import { useState, useEffect, useCallback } from 'react';

function CloseIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
        // Wake lock not supported or denied - continue without it
        console.log('Wake lock not available:', err);
      }
    }

    requestWakeLock();

    // Re-acquire wake lock if page becomes visible again
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

  // Prevent body scroll when cook mode is open
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
    <div className="fixed inset-0 z-50 bg-sand-50 flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-sand-200">
        <div className="flex-1 min-w-0">
          <p className="text-sand-500 text-sm truncate">{recipeName}</p>
        </div>
        <div className="flex-shrink-0 text-sand-600 text-sm font-medium mx-4">
          Step {currentStep + 1} of {totalSteps}
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 p-2 -mr-2 text-sand-500 hover:text-sand-700 hover:bg-sand-100 rounded-lg transition-colors"
          aria-label="Exit cook mode"
        >
          <CloseIcon />
        </button>
      </header>

      {/* Progress bar */}
      <div className="flex-shrink-0 h-1 bg-sand-200">
        <div
          className="h-full bg-sand-600 transition-all duration-300"
          style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
        />
      </div>

      {/* Main content area - tap zones for navigation */}
      <div className="flex-1 flex min-h-0">
        {/* Left tap zone (previous) */}
        <button
          onClick={goToPrevious}
          disabled={isFirstStep}
          className={`
            flex-shrink-0 w-16 sm:w-24 flex items-center justify-center
            transition-colors
            ${isFirstStep
              ? 'text-sand-200 cursor-default'
              : 'text-sand-300 hover:text-sand-500 hover:bg-sand-100 active:bg-sand-200'
            }
          `}
          aria-label="Previous step"
        >
          <ChevronLeftIcon />
        </button>

        {/* Instruction text */}
        <div className="flex-1 flex items-center justify-center px-4 py-8 overflow-auto">
          <p className="text-xl sm:text-2xl md:text-3xl lg:text-4xl text-sand-800 leading-relaxed text-center max-w-3xl">
            {instructions[currentStep]}
          </p>
        </div>

        {/* Right tap zone (next) */}
        <button
          onClick={goToNext}
          disabled={isLastStep}
          className={`
            flex-shrink-0 w-16 sm:w-24 flex items-center justify-center
            transition-colors
            ${isLastStep
              ? 'text-sand-200 cursor-default'
              : 'text-sand-300 hover:text-sand-500 hover:bg-sand-100 active:bg-sand-200'
            }
          `}
          aria-label="Next step"
        >
          <ChevronRightIcon />
        </button>
      </div>

      {/* Footer with step dots */}
      <footer className="flex-shrink-0 px-4 py-4 border-t border-sand-200">
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {instructions.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentStep(index)}
              className={`
                w-2.5 h-2.5 rounded-full transition-all
                ${index === currentStep
                  ? 'bg-sand-600 scale-125'
                  : 'bg-sand-300 hover:bg-sand-400'
                }
              `}
              aria-label={`Go to step ${index + 1}`}
              aria-current={index === currentStep ? 'step' : undefined}
            />
          ))}
        </div>

        {isLastStep && (
          <div className="mt-4 text-center">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-sand-900 text-white rounded-lg hover:bg-sand-800 transition-colors text-sm font-medium"
            >
              Done Cooking
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}

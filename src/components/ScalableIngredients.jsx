import { useState, useMemo } from 'react'
import { scaleIngredients, parseServings } from '../utils/scaleIngredient'
import { formatFraction } from '../utils/formatFraction'

function CopyIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  )
}

function PrintIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
  )
}

function MinusIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  )
}

export default function ScalableIngredients({
  ingredients,
  servings,
  onPrint,
}) {
  const originalServings = parseServings(servings) || 4
  const [currentServings, setCurrentServings] = useState(originalServings)
  const [copyStatus, setCopyStatus] = useState('')

  const isScaled = currentServings !== originalServings

  // Scale ingredients when servings change
  const scaledIngredients = useMemo(() => {
    if (!isScaled) {
      return ingredients.map(formatFraction)
    }
    const scaled = scaleIngredients(ingredients, originalServings, currentServings)
    return scaled.map(formatFraction)
  }, [ingredients, originalServings, currentServings, isScaled])

  const handleDecrement = () => {
    if (currentServings > 1) {
      setCurrentServings(prev => prev - 1)
    }
  }

  const handleIncrement = () => {
    if (currentServings < 99) {
      setCurrentServings(prev => prev + 1)
    }
  }

  const handleCopy = async () => {
    const text = scaledIngredients.join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus('Copied!')
      setTimeout(() => setCopyStatus(''), 2000)
    } catch {
      setCopyStatus('Failed')
      setTimeout(() => setCopyStatus(''), 2000)
    }
  }

  const handlePrint = () => {
    if (onPrint) {
      onPrint()
    } else {
      window.print()
    }
  }

  return (
    <div className="bg-sand-50 rounded-2xl shadow-sm p-6 print:shadow-none print:rounded-none">
      {/* Header with title and actions */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-sand-900 uppercase tracking-wide">
          Ingredients
        </h2>
        <div className="flex items-center gap-1 print:hidden">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-sand-600 hover:text-sand-900 hover:bg-sand-100 rounded-lg transition-colors"
            aria-label="Copy ingredients to clipboard"
          >
            <CopyIcon />
            <span>{copyStatus || 'Copy'}</span>
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-sand-600 hover:text-sand-900 hover:bg-sand-100 rounded-lg transition-colors"
            aria-label="Print recipe"
          >
            <PrintIcon />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Servings adjuster */}
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-sand-200 print:hidden">
        <div className="flex items-center">
          <button
            onClick={handleDecrement}
            disabled={currentServings <= 1}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-sand-100 hover:bg-sand-200 text-sand-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Decrease servings"
          >
            <MinusIcon />
          </button>
          <span className="w-10 text-center text-sand-900 font-medium tabular-nums">
            {currentServings}
          </span>
          <button
            onClick={handleIncrement}
            disabled={currentServings >= 99}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-sand-100 hover:bg-sand-200 text-sand-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Increase servings"
          >
            <PlusIcon />
          </button>
        </div>
        <span className="text-sm text-sand-600">
          servings
          {isScaled && (
            <span className="text-sand-400 ml-1">
              (from {originalServings})
            </span>
          )}
        </span>
      </div>

      {/* Print-only servings display */}
      <div className="hidden print:block mb-4 pb-4 border-b border-sand-300">
        <span className="text-sm text-sand-700">
          {currentServings} servings
          {isScaled && ` (scaled from ${originalServings})`}
        </span>
      </div>

      {/* Ingredients list */}
      <ul className="space-y-2.5">
        {scaledIngredients.map((ingredient, index) => (
          <li
            key={index}
            className="flex items-start gap-2.5 text-sand-700 text-sm leading-relaxed"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-sand-400 mt-1.5 flex-shrink-0" aria-hidden="true" />
            <span>{ingredient}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

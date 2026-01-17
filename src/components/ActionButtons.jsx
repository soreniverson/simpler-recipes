import { useState } from 'react'

function ActionButtons({ recipe, sourceUrl }) {
  const [copyStatus, setCopyStatus] = useState('')
  const [shareUrl, setShareUrl] = useState('')
  const [shareLoading, setShareLoading] = useState(false)

  const handlePrint = () => {
    window.print()
  }

  const handleCopyIngredients = async () => {
    const text = recipe.ingredients.join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus('Copied!')
      setTimeout(() => setCopyStatus(''), 2000)
    } catch {
      setCopyStatus('Failed to copy')
      setTimeout(() => setCopyStatus(''), 2000)
    }
  }

  const handleShare = async () => {
    setShareLoading(true)
    try {
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recipe, sourceUrl }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create share link')
      }

      const url = `${window.location.origin}/r/${data.id}`
      setShareUrl(url)

      // Also copy to clipboard
      try {
        await navigator.clipboard.writeText(url)
      } catch {
        // Clipboard copy failed, but we still have the URL to show
      }
    } catch (err) {
      console.error('Share failed:', err)
    } finally {
      setShareLoading(false)
    }
  }

  return (
    <div className="no-print flex flex-wrap gap-3 mt-10 pt-8 border-t border-sand-200">
      <button
        onClick={handlePrint}
        className="flex items-center gap-2 bg-sand-100 hover:bg-sand-200 text-sand-700 font-medium py-2.5 px-4 rounded-lg transition-all text-sm"
        aria-label="Print recipe"
      >
        <PrintIcon />
        Print
      </button>

      <button
        onClick={handleCopyIngredients}
        className="flex items-center gap-2 bg-sand-100 hover:bg-sand-200 text-sand-700 font-medium py-2.5 px-4 rounded-lg transition-all text-sm"
        aria-label="Copy ingredients to clipboard"
      >
        <CopyIcon />
        {copyStatus || 'Copy Ingredients'}
      </button>

      <button
        onClick={handleShare}
        disabled={shareLoading}
        className="flex items-center gap-2 bg-sand-950 hover:bg-sand-900 text-sand-50 font-medium py-2.5 px-4 rounded-lg transition-all text-sm shadow-sm hover:shadow-md disabled:opacity-50"
        aria-label="Share recipe"
      >
        <ShareIcon />
        {shareLoading ? 'Creating...' : 'Share'}
      </button>

      {shareUrl && (
        <div className="w-full mt-3 p-4 bg-sand-100 border border-sand-200 rounded-lg">
          <p className="text-sand-700 text-sm mb-2">Link copied to clipboard</p>
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="w-full text-sm py-2 px-3 border border-sand-300 rounded-md bg-sand-50 text-sand-700"
            onFocus={(e) => e.target.select()}
          />
        </div>
      )}
    </div>
  )
}

function PrintIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  )
}

export default ActionButtons

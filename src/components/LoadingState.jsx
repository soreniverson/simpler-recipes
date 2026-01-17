function LoadingState({ message = 'Loading...' }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="text-center" role="status" aria-live="polite">
        <div className="inline-block w-8 h-8 border-2 border-sand-300 border-t-sand-700 rounded-full animate-spin mb-4"></div>
        <p className="text-sand-600 text-base">{message}</p>
      </div>
    </main>
  )
}

export default LoadingState

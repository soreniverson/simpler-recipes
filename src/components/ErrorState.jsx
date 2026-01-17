import { Link } from 'react-router-dom'

function ErrorState({ message, id, inline = false }) {
  if (inline) {
    return (
      <p id={id} className="text-red-600 text-sm" role="alert">
        {message}
      </p>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="text-sand-400 text-4xl mb-6">:/</p>
        <h1 className="text-xl font-medium text-sand-900 mb-2">
          Something went wrong
        </h1>
        <p className="text-sand-600 mb-8" role="alert">
          {message}
        </p>
        <Link
          to="/"
          className="inline-block bg-sand-950 hover:bg-sand-900 text-sand-50 font-medium py-3 px-6 rounded-lg transition-all text-sm shadow-sm hover:shadow-md"
        >
          Try another recipe
        </Link>
      </div>
    </main>
  )
}

export default ErrorState

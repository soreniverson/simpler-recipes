import { Routes, Route } from 'react-router-dom'
import HomePage from './components/HomePage'
import RecipeDisplay from './components/RecipeDisplay'
import SharedRecipe from './components/SharedRecipe'
import PrivacyPolicy from './components/PrivacyPolicy'

function App() {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/recipe" element={<RecipeDisplay />} />
        <Route path="/r/:id" element={<SharedRecipe />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
      </Routes>
    </>
  )
}

export default App

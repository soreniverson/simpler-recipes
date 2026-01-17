/**
 * Icon system for recipe collections.
 * Uses simple, subtle line icons that scale with the design.
 *
 * To add a new collection, add an entry to COLLECTION_ICONS with the slug as key.
 * Falls back to a generic cookbook icon for unknown collections.
 */

const COLLECTION_ICONS = {
  'quick-weeknight-dinners': TimerIcon,
  'baking-basics': WhiskIcon,
  'one-pot-meals': PotIcon,
  'healthy-lunches': LeafIcon,
  'comfort-food-classics': HeartIcon,
  // Add new collections here as they're created
  // 'breakfast-favorites': SunIcon,
  // 'vegetarian': PlantIcon,
  // 'desserts': CakeIcon,
}

export function getCollectionIcon(slug, className = "w-5 h-5") {
  const IconComponent = COLLECTION_ICONS[slug] || BookIcon
  return <IconComponent className={className} />
}

// Icon components - all use consistent 24x24 viewBox with 1.5 stroke width

function TimerIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
    </svg>
  )
}

function WhiskIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v4m0 0c-2 0-4 2-4 5s2 5 4 5 4-2 4-5-2-5-4-5zm0 14v4m-3-4h6" />
    </svg>
  )
}

function PotIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 10h16v9a2 2 0 01-2 2H6a2 2 0 01-2-2v-9zm0 0V8a2 2 0 012-2h12a2 2 0 012 2v2M8 6V4m8 2V4m-4 2V3" />
    </svg>
  )
}

function LeafIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 20c0-7 5-13 14-14-1 9-7 14-14 14zm0 0v-4m7-3c-3 0-5 2-7 7" />
    </svg>
  )
}

function HeartIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  )
}

function BookIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  )
}

export default getCollectionIcon

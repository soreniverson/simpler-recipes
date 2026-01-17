import { Link } from 'react-router-dom'

function PrivacyPolicy() {
  return (
    <main id="main-content" className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <nav className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center text-sand-600 hover:text-sand-900 transition-colors text-sm"
          >
            <BackIcon />
            <span className="ml-1">Back</span>
          </Link>
        </nav>

        <article className="bg-sand-50 rounded-2xl shadow-md p-6 md:p-10">
          <header className="mb-8 pb-6 border-b border-sand-200">
            <h1 className="text-2xl md:text-3xl font-medium tracking-tight-headline text-sand-900 mb-2">
              Privacy Policy
            </h1>
            <p className="text-sand-500 text-sm">Last updated: January 17, 2025</p>
          </header>

          <div className="prose">
            <Section title="Introduction">
              <p>
                <strong>Simpler Recipes</strong> is committed to respecting your privacy. This policy explains
                how we handle information when you use our website at simpler.recipes and our browser extension.
              </p>
              <p>
                The short version: <strong>We collect minimal data and don't sell or share your personal information.</strong>
              </p>
            </Section>

            <Section title="What we collect">
              <h3>Website (simpler.recipes)</h3>
              <p>When you use our website, we collect:</p>
              <ul>
                <li>
                  <strong>Recipe URLs you submit</strong> — These are processed on our servers to extract recipe
                  data. We do not store the URLs or extracted recipes beyond the immediate request.
                </li>
                <li>
                  <strong>Anonymous analytics</strong> — We use Google Analytics to understand how people use the
                  site (page views, general location, device type). This data is aggregated and cannot identify you personally.
                </li>
              </ul>

              <h3>Browser Extension</h3>
              <p>
                The Simpler Recipes browser extension processes recipes <strong>entirely on your device</strong>.
                No data is sent to our servers or any third party. We do not collect, store, or transmit:
              </p>
              <ul>
                <li>The pages you visit</li>
                <li>The recipes you extract</li>
                <li>Any personal information</li>
              </ul>
              <p>
                The extension only activates when you click its icon and only reads recipe data (Schema.org markup)
                from the current page.
              </p>
            </Section>

            <Section title="What we don't collect">
              <p>We do not collect or have access to:</p>
              <ul>
                <li>Your name, email, or contact information (we don't have accounts)</li>
                <li>Payment information (our service is free)</li>
                <li>Browsing history</li>
                <li>Cookies for tracking or advertising</li>
              </ul>
            </Section>

            <Section title="How we use data">
              <p>The limited data we collect is used only to:</p>
              <ul>
                <li>Process your recipe extraction requests (website only)</li>
                <li>Understand aggregate usage patterns to improve the service</li>
                <li>Maintain and secure the service</li>
              </ul>
              <p>
                We do not sell, rent, or share your data with third parties for marketing or advertising purposes.
              </p>
            </Section>

            <Section title="Third-party services">
              <p>Our website uses:</p>
              <ul>
                <li>
                  <strong>Google Analytics</strong> — For anonymous usage statistics. You can opt out using a
                  browser extension like{' '}
                  <a
                    href="https://tools.google.com/dlpage/gaoptout"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sand-700 underline underline-offset-2 hover:text-sand-900"
                  >
                    Google Analytics Opt-out
                  </a>.
                </li>
                <li>
                  <strong>Vercel</strong> — For hosting. See{' '}
                  <a
                    href="https://vercel.com/legal/privacy-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sand-700 underline underline-offset-2 hover:text-sand-900"
                  >
                    Vercel's Privacy Policy
                  </a>.
                </li>
              </ul>
              <p>The browser extension does not use any third-party services.</p>
            </Section>

            <Section title="Data retention">
              <p>
                Recipe URLs submitted to our website are processed in real-time and not stored. Shared recipe
                links expire after 7 days. Analytics data is retained according to Google Analytics' standard
                retention policies.
              </p>
            </Section>

            <Section title="Your rights">
              <p>
                Since we collect minimal data and don't maintain user accounts, there is little personal data
                to access or delete. If you have questions about your data, contact us and we'll help however we can.
              </p>
            </Section>

            <Section title="Changes to this policy">
              <p>
                We may update this policy from time to time. We'll note the date of the latest revision at the
                top of this page.
              </p>
            </Section>

            <Section title="Contact">
              <p>
                Questions about this privacy policy? Reach out at{' '}
                <a
                  href="mailto:privacy@simpler.recipes"
                  className="text-sand-700 underline underline-offset-2 hover:text-sand-900"
                >
                  privacy@simpler.recipes
                </a>
              </p>
            </Section>
          </div>
        </article>
      </div>
    </main>
  )
}

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-medium text-sand-900 mb-3">{title}</h2>
      <div className="text-sand-700 text-[15px] leading-relaxed space-y-3 [&_ul]:list-none [&_ul]:space-y-2 [&_li]:flex [&_li]:items-start [&_li]:gap-2 [&_li]:before:content-['–'] [&_li]:before:text-sand-400 [&_li]:before:flex-shrink-0 [&_h3]:text-sand-800 [&_h3]:font-medium [&_h3]:text-sm [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:uppercase [&_h3]:tracking-wide">
        {children}
      </div>
    </section>
  )
}

function BackIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
    </svg>
  )
}

export default PrivacyPolicy

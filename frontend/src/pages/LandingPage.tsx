import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                codepair
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/pricing')}
                className="text-gray-700 hover:text-gray-900 px-4 py-2 font-medium transition-colors"
              >
                Pricing
              </button>
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="text-gray-700 hover:text-gray-900 px-4 py-2 font-medium transition-colors">
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity">
                    Get Started Free
                  </button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
                >
                  Go to Dashboard
                </button>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-gray-900 mb-6">
              Screen Candidates
              <br />
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Efficiently
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-4 max-w-3xl mx-auto">
              Save your senior engineers' time with AI-powered technical screening. 
              Tailored interviews for your specific role—not generic coding challenges.
            </p>
            <p className="text-lg md:text-xl text-gray-500 mb-8 max-w-3xl mx-auto">
              By the time candidates reach your engineers, they're already well-vetted.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <SignedOut>
                <SignUpButton mode="modal">
                  <button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:opacity-90 transition-opacity shadow-lg">
                    Start Free Trial
                  </button>
                </SignUpButton>
                <button
                  onClick={() => navigate('/pricing')}
                  className="bg-white text-gray-700 px-8 py-4 rounded-lg text-lg font-semibold border-2 border-gray-300 hover:border-gray-400 transition-colors"
                >
                  View Pricing
                </button>
              </SignedOut>
              <SignedIn>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:opacity-90 transition-opacity shadow-lg"
                >
                  Go to Dashboard
                </button>
              </SignedIn>
            </div>
          </div>
        </div>
      </div>

      {/* How it Works Section */}
      <div className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-16">
            How it works
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4">
                1
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Create Interview</h3>
              <p className="text-gray-600">
                Set job-specific questions and requirements tailored to your role, not generic coding challenges.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4">
                2
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Share Link</h3>
              <p className="text-gray-600">
                Candidate receives unique interview link. No account needed—they just click and start coding.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-pink-600 to-red-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4">
                3
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">AI Screens</h3>
              <p className="text-gray-600">
                Real-time AI evaluates code, asks follow-up questions, and provides feedback—all automatically.
              </p>
            </div>

            {/* Step 4 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-red-600 to-orange-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4">
                4
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Review Results</h3>
              <p className="text-gray-600">
                Get AI-generated evaluation with scores and insights before candidates reach your engineers.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-16">
            Why choose tailored screening over generic interviews?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg mb-4 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Job-Tailored Questions</h3>
              <p className="text-gray-600">
                Create interviews specific to your role and tech stack. No more generic coding challenges that don't reflect real work.
              </p>
            </div>
            <div className="p-6 rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg mb-4 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Efficient Pre-Screening</h3>
              <p className="text-gray-600">
                AI handles initial screening automatically. Engineers only see qualified candidates who've already been vetted.
              </p>
            </div>
            <div className="p-6 rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-red-500 rounded-lg mb-4 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Save Engineer Time</h3>
              <p className="text-gray-600">
                Reduce interview load on senior engineers by 70%+. Focus their time on candidates who've already passed technical screening.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Save your senior engineers' time
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Start screening candidates efficiently with job-tailored interviews. 3 free interviews, no credit card required.
          </p>
          <SignedOut>
            <SignUpButton mode="modal">
              <button className="bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-50 transition-colors shadow-lg">
                Start Free Trial
              </button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-50 transition-colors shadow-lg"
            >
              Go to Dashboard
            </button>
          </SignedIn>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <p>&copy; 2025 codepair. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}


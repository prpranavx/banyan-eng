import { SignUpButton, SignedIn, SignedOut } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'

export default function Pricing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <button
              onClick={() => navigate('/')}
              className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent cursor-pointer"
            >
              codepair
            </button>
            <div className="flex items-center gap-4">
              <SignedOut>
                <button
                  onClick={() => navigate('/')}
                  className="text-gray-700 hover:text-gray-900 px-4 py-2 font-medium transition-colors"
                >
                  Sign In
                </button>
              </SignedOut>
              <SignedIn>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
                >
                  Dashboard
                </button>
              </SignedIn>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-gray-900 mb-6">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-600 mb-12">
            Start with a free trial. No credit card required.
          </p>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid md:grid-cols-3 gap-8 items-stretch">
          {/* Free Plan */}
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-8 flex flex-col h-full">
            <div className="text-center flex-grow flex flex-col">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Free Trial</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">$0</span>
                <span className="text-gray-600">/forever</span>
              </div>
              <ul className="text-left space-y-4 mb-8 flex-grow">
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-green-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">3 interview credits</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-green-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">14-day trial period</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-green-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Basic AI evaluation</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-green-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Code execution</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-green-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">No credit card required</span>
                </li>
              </ul>
              <div className="mt-auto">
                <SignedOut>
                  <SignUpButton mode="modal">
                    <button className="w-full bg-gray-200 text-gray-900 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors">
                      Get Started Free
                    </button>
                  </SignUpButton>
                </SignedOut>
                <SignedIn>
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="w-full bg-gray-200 text-gray-900 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                  >
                    Go to Dashboard
                  </button>
                </SignedIn>
              </div>
            </div>
          </div>

          {/* Pro Plan */}
          <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-xl border-2 border-blue-500 p-8 transform scale-105 relative flex flex-col h-full">
            <div className="absolute top-4 right-4">
              <span className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-bold">
                POPULAR
              </span>
            </div>
            <div className="text-center text-white flex-grow flex flex-col">
              <h3 className="text-2xl font-bold mb-2">Pro</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold">$29</span>
                <span className="text-blue-100">/month</span>
              </div>
              <ul className="text-left space-y-4 mb-8 flex-grow">
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-yellow-300 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>30 interview credits per month</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-yellow-300 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Credits reset monthly</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-yellow-300 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Advanced AI evaluation</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-yellow-300 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Custom instructions</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-yellow-300 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Starter code support</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-yellow-300 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Priority support</span>
                </li>
              </ul>
              <div className="mt-auto">
                <button
                  onClick={() => {
                    // TODO: Replace with Lemon Squeezy checkout when approved
                    alert('Lemon Squeezy checkout coming soon!')
                  }}
                  className="w-full bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
                >
                  Upgrade to Pro
                </button>
                <p className="text-sm text-blue-100 mt-4">Cancel anytime</p>
              </div>
            </div>
          </div>

          {/* Enterprise Plan */}
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-900 p-8 flex flex-col h-full">
            <div className="text-center flex-grow flex flex-col">
              <h3 className="text-2xl font-bold text-black mb-2">Enterprise</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold text-black">$100</span>
                <span className="text-gray-600">/month</span>
              </div>
              <ul className="text-left space-y-4 mb-8 flex-grow">
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-blue-600 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Unlimited interviews</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-blue-600 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Priority support</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-blue-600 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Custom integrations</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-blue-600 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Dedicated account manager</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-blue-600 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">All Pro features</span>
                </li>
              </ul>
              <div className="mt-auto">
                <button
                  onClick={() => {
                    // TODO: Replace with Lemon Squeezy checkout when approved
                    alert('Contact sales for Enterprise plan')
                  }}
                  className="w-full bg-gray-900 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
                >
                  Contact Sales
                </button>
                <p className="text-sm text-gray-500 mt-4">For high-volume teams</p>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-20 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <div className="bg-white rounded-lg p-6 shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">What happens when I run out of credits?</h3>
              <p className="text-gray-600">You'll be prompted to upgrade to Pro. Credits reset monthly for Pro users.</p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Do credits roll over?</h3>
              <p className="text-gray-600">No, credits reset monthly for Pro users. Unused credits don't accumulate.</p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Can I cancel anytime?</h3>
              <p className="text-gray-600">Yes, you can cancel your Pro subscription at any time. You'll retain access until the end of your billing period.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


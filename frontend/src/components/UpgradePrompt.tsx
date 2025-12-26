import { useNavigate } from 'react-router-dom'

interface UpgradePromptProps {
  message?: string
  showButton?: boolean
}

export default function UpgradePrompt({ 
  message = "You've used all your free interviews. Upgrade to continue.",
  showButton = true 
}: UpgradePromptProps) {
  const navigate = useNavigate()

  return (
    <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-lg mb-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="font-semibold mb-1">{message}</p>
          <p className="text-sm text-blue-100">Upgrade to Pro for $29/month and get 30 interviews per month.</p>
        </div>
        {showButton && (
          <button
            onClick={() => navigate('/pricing')}
            className="ml-4 bg-white text-blue-600 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors whitespace-nowrap"
          >
            View Pricing
          </button>
        )}
      </div>
    </div>
  )
}


import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import LandingPage from './pages/LandingPage.tsx'
import Dashboard from './pages/Dashboard.tsx'
import SignInPage from './pages/SignInPage.tsx'
import CreateInterview from './pages/CreateInterview.tsx'
import CandidateInterview from './pages/CandidateInterview.tsx'
import CandidateList from './pages/CandidateList.tsx'
import CandidateReport from './pages/CandidateReport.tsx'
import InterviewDetails from './pages/InterviewDetails.tsx'
import Pricing from './pages/Pricing.tsx'

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY')
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <ClerkProvider 
        publishableKey={clerkPubKey}
      >
        <BrowserRouter>
          <Routes>
            <Route path="/sign-in/*" element={<SignInPage />} />
            <Route path="/" element={<LandingPage />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/create-interview"
              element={
                <ProtectedRoute>
                  <CreateInterview />
                </ProtectedRoute>
              }
            />
            <Route path="/interview/:uniqueLink" element={<CandidateInterview />} />
            <Route
              path="/interview/:interviewId/candidates"
              element={
                <ProtectedRoute>
                  <CandidateList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/interview/:interviewId/submission/:submissionId"
              element={
                <ProtectedRoute>
                  <CandidateReport />
                </ProtectedRoute>
              }
            />
            <Route
              path="/interview/:interviewId/details"
              element={
                <ProtectedRoute>
                  <InterviewDetails />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </ClerkProvider>
    </ErrorBoundary>
  )
}

export default App

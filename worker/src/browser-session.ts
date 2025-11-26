import { chromium, Browser, Page } from 'playwright'
import { getSession } from './session-store.js'
import { generateChatInjectionScript } from './inject-chat.js'

interface BrowserSession {
  sessionId: string
  browser: Browser
  page: Page
  url: string
  createdAt: number
}

const activeSessions = new Map<string, BrowserSession>()

// Shared browser instance (reused across sessions for efficiency)
let sharedBrowser: Browser | null = null

const DEFAULT_CHROMIUM_ARGS = ['--no-sandbox', '--disable-setuid-sandbox']
const rawHeadlessValue =
  process.env.WORKER_HEADLESS ??
  process.env.PLAYWRIGHT_HEADLESS ??
  (process.env.NODE_ENV === 'production' ? 'true' : 'false')
const rawHeadless = rawHeadlessValue.toString().toLowerCase()
const HEADLESS_MODE = rawHeadless !== 'false'
const extraArgs = (process.env.WORKER_CHROMIUM_ARGS || '')
  .split(',')
  .map(arg => arg.trim())
  .filter(Boolean)
const CHROMIUM_ARGS = Array.from(new Set([...DEFAULT_CHROMIUM_ARGS, ...extraArgs]))

async function getSharedBrowser(): Promise<Browser> {
  if (!sharedBrowser) {
    sharedBrowser = await chromium.launch({
      headless: HEADLESS_MODE,
      args: CHROMIUM_ARGS
    })
    console.log(`Playwright Chromium launched (headless=${HEADLESS_MODE}) with args: ${CHROMIUM_ARGS.join(' ')}`)
  }
  return sharedBrowser
}

export async function getOrCreateBrowserSession(sessionId: string): Promise<BrowserSession> {
  // Check if session already exists
  const existing = activeSessions.get(sessionId)
  if (existing) {
    // Check if page is still alive
    try {
      await existing.page.evaluate(() => document.title)
      return existing
    } catch {
      // Page closed, remove and recreate
      activeSessions.delete(sessionId)
    }
  }

  // Get session data
  const session = await getSession(sessionId)
  if (!session || !session.codingPlatformUrl) {
    throw new Error(`Session ${sessionId} not found or missing coding platform URL`)
  }

  console.log(`Creating browser session for ${sessionId} -> ${session.codingPlatformUrl}`)

  // Create new browser session
  const browser = await getSharedBrowser()
  const page = await browser.newPage()
  
  page.setDefaultTimeout(60000)

  try {
    // Navigate to the coding platform
    await page.goto(session.codingPlatformUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    })

    // Wait for page to be ready
    await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {
      // Continue even if load times out
    })
    
    // Wait a bit for dynamic content
    await page.waitForTimeout(2000)

    // Inject chat script directly into the browser
    const chatScript = generateChatInjectionScript(sessionId)
    await page.addScriptTag({ content: chatScript })

    console.log(`Chat script injected for session ${sessionId}`)

    // Store session
    const browserSession: BrowserSession = {
      sessionId,
      browser,
      page,
      url: session.codingPlatformUrl,
      createdAt: Date.now()
    }

    activeSessions.set(sessionId, browserSession)

    // Cleanup when page closes
    page.on('close', () => {
      activeSessions.delete(sessionId)
      console.log(`Browser session closed for ${sessionId}`)
    })

    return browserSession
  } catch (error) {
    await page.close()
    throw error
  }
}

export function getBrowserSession(sessionId: string): BrowserSession | undefined {
  return activeSessions.get(sessionId)
}

export async function cleanup() {
  // Close all pages but keep browser alive for reuse
  for (const [sessionId, session] of activeSessions.entries()) {
    try {
      await session.page.close()
    } catch (error) {
      console.error(`Error closing page for session ${sessionId}:`, error)
    }
  }
  activeSessions.clear()

  // Close shared browser
  if (sharedBrowser) {
    await sharedBrowser.close()
    sharedBrowser = null
  }
}

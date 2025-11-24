import { chromium, Browser, Page } from 'playwright'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000'
const POLL_INTERVAL = 5000
const CODE_CAPTURE_INTERVAL = 2000

interface ActiveSession {
  sessionId: string
  browser: Browser
  page: Page
}

const activeSessions = new Map<string, ActiveSession>()

async function pollForNewSessions() {
  console.log('Worker polling for new sessions...')
}

async function attachToSession(sessionId: string) {
  console.log(`Attaching worker to session: ${sessionId}`)
  
  try {
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    
    const page = await browser.newPage()
    
    await page.goto('https://coderpad.io')
    
    await page.addScriptTag({
      content: `
        (function() {
          const chatBox = document.createElement('div');
          chatBox.id = 'ai-interview-chat';
          chatBox.style.cssText = \`
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 350px;
            height: 400px;
            background: white;
            border: 2px solid #4F46E5;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            display: flex;
            flex-direction: column;
            z-index: 10000;
            font-family: sans-serif;
          \`;
          
          chatBox.innerHTML = \`
            <div style="padding: 16px; background: #4F46E5; color: white; font-weight: bold; border-radius: 10px 10px 0 0;">
              AI Interview Assistant
            </div>
            <div id="chat-messages" style="flex: 1; overflow-y: auto; padding: 12px;">
              <div style="color: #666; text-align: center; padding: 20px;">
                Interview session active
              </div>
            </div>
            <div style="padding: 12px; border-top: 1px solid #ddd;">
              <input 
                id="chat-input" 
                type="text" 
                placeholder="Type a message..."
                style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; outline: none;"
              />
            </div>
          \`;
          
          document.body.appendChild(chatBox);
          
          window.aiInterviewAddMessage = function(role, content) {
            const messagesDiv = document.getElementById('chat-messages');
            const msgDiv = document.createElement('div');
            msgDiv.style.cssText = \`
              margin-bottom: 8px;
              padding: 8px 12px;
              border-radius: 8px;
              background: \${role === 'user' ? '#4F46E5' : '#f3f4f6'};
              color: \${role === 'user' ? 'white' : '#333'};
              font-size: 14px;
            \`;
            msgDiv.textContent = content;
            messagesDiv.appendChild(msgDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
          };
        })();
      `
    })
    
    activeSessions.set(sessionId, { sessionId, browser, page })
    
    const captureInterval = setInterval(async () => {
      try {
        const codeContent = await page.evaluate(() => {
          const editor = document.querySelector('.CodeMirror, .monaco-editor, textarea');
          return editor ? (editor as any).innerText || '' : 'No code editor found';
        })
        
        if (codeContent && codeContent !== 'No code editor found') {
          console.log(`Captured code snapshot for ${sessionId}:`, codeContent.slice(0, 50))
        }
      } catch (error) {
        console.error('Error capturing code:', error)
      }
    }, CODE_CAPTURE_INTERVAL)
    
    page.on('close', () => {
      clearInterval(captureInterval)
      activeSessions.delete(sessionId)
      browser.close()
    })
    
    console.log(`Worker successfully attached to session ${sessionId}`)
  } catch (error) {
    console.error(`Error attaching to session ${sessionId}:`, error)
  }
}

async function sendMessageToBackend(sessionId: string, message: string, codeSnapshot?: string) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/send-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, message, codeSnapshot })
    })
    
    const data = await response.json() as { message: string }
    return data.message
  } catch (error) {
    console.error('Error sending message to backend:', error)
    return null
  }
}

async function injectAIResponse(sessionId: string, message: string) {
  const session = activeSessions.get(sessionId)
  if (!session) return
  
  try {
    await session.page.evaluate((msg) => {
      (window as any).aiInterviewAddMessage('assistant', msg)
    }, message)
  } catch (error) {
    console.error('Error injecting AI response:', error)
  }
}

async function main() {
  console.log('AI Interview Worker starting...')
  console.log(`Backend URL: ${BACKEND_URL}`)
  
  setInterval(pollForNewSessions, POLL_INTERVAL)
  
  console.log('Worker is running. Press Ctrl+C to stop.')
}

main().catch(console.error)

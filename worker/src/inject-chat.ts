const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:3000').replace(/\/$/, '')
const WORKER_URL = (process.env.WORKER_URL || 'http://localhost:3001').replace(/\/$/, '')

const escapeForTemplateLiteral = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')

export function generateChatInjectionScript(sessionId: string): string {
  const apiBasePath = `/proxy/${sessionId}/api`

  const apiBasePathEscaped = escapeForTemplateLiteral(apiBasePath)
  const workerOriginEscaped = escapeForTemplateLiteral(WORKER_URL)
  const backendOriginEscaped = escapeForTemplateLiteral(BACKEND_URL)
  
  return `(function() {
  try {
    console.log('[AI Assistant] Script loaded, initializing...');
    console.log('[AI Assistant] Session ID:', '${sessionId}');
    console.log('[AI Assistant] Worker origin:', '${workerOriginEscaped}');
    console.log('[AI Assistant] Backend origin:', '${backendOriginEscaped}');
    
    // Test: Try to create a visible test element first
    const testDiv = document.createElement('div');
    testDiv.id = 'ai-assistant-test';
    testDiv.style.cssText = 'position:fixed;top:10px;right:10px;background:red;color:white;padding:10px;z-index:999999;';
    testDiv.textContent = 'AI Assistant Script Loaded!';
    document.body.appendChild(testDiv);
    setTimeout(() => testDiv.remove(), 3000);
    
    const SESSION_ID = '${sessionId}';
    const WORKER_ORIGIN = '${workerOriginEscaped}';
    const BACKEND_ORIGIN = '${backendOriginEscaped}';
    const API_BASE_PATH = '${apiBasePathEscaped}';
    
    const resolveApiUrl = () => {
      // Prefer worker proxy so sessionId stays in URL and cookies stay scoped
      if (WORKER_ORIGIN) {
        if (window.location.origin === WORKER_ORIGIN) {
          return API_BASE_PATH;
        }
        if (window.location.protocol === 'https:' && !WORKER_ORIGIN.startsWith('https:')) {
          console.warn('[AI Assistant] Mixed-content risk: worker origin is not HTTPS');
        }
        console.warn('[AI Assistant] Page is running on', window.location.origin, 'but worker origin is', WORKER_ORIGIN, '- using absolute worker URL for API calls.');
        return WORKER_ORIGIN + API_BASE_PATH;
      }
      
      if (BACKEND_ORIGIN) {
        console.warn('[AI Assistant] WORKER_URL not set; falling back to backend origin which requires permissive CORS.');
        return BACKEND_ORIGIN + '/api';
      }
      
      console.warn('[AI Assistant] No worker or backend origin defined; defaulting to relative path (may fail).');
      return API_BASE_PATH;
    };

    function initChat() {
    console.log('[AI Assistant] initChat called');
    
    // Check if chat already exists
    if (document.getElementById('ai-interview-chat')) {
      console.log('[AI Assistant] Chat already exists');
      return;
    }
    
    // Ensure body exists
    if (!document.body) {
      console.log('[AI Assistant] Body not ready, retrying...');
      setTimeout(initChat, 100);
      return;
    }

    console.log('[AI Assistant] Creating chat UI...');

    // Create chat UI
    const chatBox = document.createElement('div');
    chatBox.id = 'ai-interview-chat';
    chatBox.style.cssText = \`
      position: fixed !important;
      bottom: 20px !important;
      right: 20px !important;
      width: 350px !important;
      height: 400px !important;
      background: white !important;
      border: 2px solid #4F46E5 !important;
      border-radius: 12px !important;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1) !important;
      display: flex !important;
      flex-direction: column !important;
      z-index: 999999 !important;
      font-family: sans-serif !important;
    \`;

  chatBox.innerHTML = \`
    <div style="padding: 16px; background: #4F46E5; color: white; font-weight: bold; border-radius: 10px 10px 0 0;">
      AI Interview Assistant
    </div>
    <div id="chat-messages" style="flex: 1; overflow-y: auto; padding: 12px;">
      <div style="color: #666; text-align: center; padding: 20px;">
        Type a message to start the interview!
      </div>
    </div>
    <div style="padding: 12px; border-top: 1px solid #ddd; display: flex; gap: 8px;">
      <input
        id="chat-input"
        type="text"
        placeholder="Ask about your code..."
        style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 6px; outline: none;"
      />
      <button
        id="chat-send-btn"
        style="padding: 8px 16px; background: #4F46E5; color: white; border: none; border-radius: 6px; cursor: pointer;"
      >
        Send
      </button>
    </div>
  \`;

  document.body.appendChild(chatBox);

  // Message display function
  window.aiInterviewAddMessage = function(role, content) {
    const messagesDiv = document.getElementById('chat-messages');
    if (!messagesDiv) return;

    // Remove welcome message if present
    const welcomeMsg = messagesDiv.querySelector('div[style*="text-align: center"]');
    if (welcomeMsg) welcomeMsg.remove();

    const msgDiv = document.createElement('div');
    msgDiv.style.cssText = \`
      margin-bottom: 8px;
      padding: 8px 12px;
      border-radius: 8px;
      background: \${role === 'user' ? '#4F46E5' : '#f3f4f6'};
      color: \${role === 'user' ? 'white' : '#333'};
      font-size: 14px;
      max-width: 80%;
      word-wrap: break-word;
      \${role === 'user' ? 'margin-left: auto;' : ''}
    \`;
    msgDiv.textContent = content;
    messagesDiv.appendChild(msgDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  };

  // Send message function
  async function sendMessage() {
    const input = document.getElementById('chat-input');
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    // Add user message to chat
    window.aiInterviewAddMessage('user', message);
    input.value = '';

    // Show typing indicator
    const messagesDiv = document.getElementById('chat-messages');
    if (!messagesDiv) return;

    const typingDiv = document.createElement('div');
    typingDiv.id = 'typing-indicator';
    typingDiv.style.cssText = 'color: #666; font-size: 14px; padding: 8px;';
    typingDiv.textContent = 'AI is thinking...';
    messagesDiv.appendChild(typingDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    try {
      // Get current code from the page
      let codeSnapshot = '';
      try {
        const codeElement = document.querySelector('.CodeMirror, .monaco-editor, textarea, .ace_editor, [contenteditable="true"]');
        if (codeElement) {
          codeSnapshot = codeElement.textContent || codeElement.value || codeElement.innerText || 'Code editor found but could not extract content';
        } else {
          codeSnapshot = 'No code editor detected on this page';
        }
      } catch (e) {
        codeSnapshot = 'Error extracting code: ' + (e.message || String(e));
      }

      // Use relative URL (same origin) to avoid CSP issues
      const apiEndpoint = resolveApiUrl() + '/send-message';
      console.log('[AI Assistant] Sending message to:', apiEndpoint);
      console.log('[AI Assistant] Session ID:', SESSION_ID);
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          sessionId: SESSION_ID,
          message: message,
          codeSnapshot: codeSnapshot
        })
      });

      console.log('[AI Assistant] Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AI Assistant] API error:', response.status, errorText);
        throw new Error('API returned ' + response.status + ': ' + errorText);
      }

      const data = await response.json();
      console.log('[AI Assistant] Received response:', data);

      // Remove typing indicator
      const typingIndicator = document.getElementById('typing-indicator');
      if (typingIndicator) typingIndicator.remove();

      // Add AI response
      if (data.message) {
        window.aiInterviewAddMessage('assistant', data.message);
      } else {
        window.aiInterviewAddMessage('assistant', 'Sorry, I could not generate a response.');
      }
    } catch (error) {
      console.error('[AI Assistant] Error sending message:', error);
      console.error('[AI Assistant] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // Remove typing indicator
      const typingIndicator = document.getElementById('typing-indicator');
      if (typingIndicator) typingIndicator.remove();
      
      // Show more helpful error message
      let errorMsg = 'Error communicating with AI. Please try again.';
      if (error.message && error.message.includes('Failed to fetch')) {
        errorMsg = 'Network error: Could not reach AI server. Please check your connection.';
      } else if (error.message) {
        errorMsg = 'Error: ' + error.message;
      }
      
      window.aiInterviewAddMessage('assistant', errorMsg);
    }
  }

  // Attach event listeners
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send-btn');

  if (input) {
    input.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
  }
    
    console.log('[AI Assistant] Chat initialized successfully');
  }
  
  // Start initialization - try multiple strategies
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      console.log('[AI Assistant] DOMContentLoaded fired');
      setTimeout(initChat, 100);
    });
  } else {
    // DOM already loaded
    console.log('[AI Assistant] DOM already loaded, initializing...');
    setTimeout(initChat, 500); // Small delay to ensure page is ready
  }
  
  // Also try after a longer delay as fallback
  setTimeout(function() {
    if (!document.getElementById('ai-interview-chat')) {
      console.log('[AI Assistant] Fallback initialization');
      initChat();
    }
  }, 2000);
  } catch (error) {
    console.error('[AI Assistant] Error in script:', error);
    // Try to show error on page
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position:fixed;top:10px;right:10px;background:red;color:white;padding:10px;z-index:999999;';
    errorDiv.textContent = 'AI Assistant Error: ' + error.message;
    document.body.appendChild(errorDiv);
  }
})();`
}


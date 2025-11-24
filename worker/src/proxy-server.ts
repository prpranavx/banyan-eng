import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { getOrCreateBrowserSession, cleanup } from './browser-session.js'
import { generateChatInjectionScript } from './inject-chat.js'

const WORKER_PORT = parseInt(process.env.WORKER_PORT || '3001')

export function createProxyServer() {
  const app = express()

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' })
  })

  // Proxy API calls to backend (avoids CSP issues)
  // This must come BEFORE the main proxy route to match first
  app.use('/proxy/:sessionId/api', async (req, res, next) => {
    const { sessionId } = req.params
    const uuidMatch = sessionId.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
    const cleanSessionId = uuidMatch ? uuidMatch[1] : sessionId
    
    // Extract API path (e.g., /send-message)
    const originalPath = req.path
    // Remove /proxy/{sessionId}/api prefix, keep the rest (e.g., /send-message)
    const apiPath = originalPath.replace(new RegExp(`^/proxy/${req.params.sessionId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/api`), '') || '/'
    
    console.log(`Proxying API call: path=${apiPath}, original=${originalPath}, session=${cleanSessionId}`)
    
    // Proxy to backend
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000'
    
    const proxy = createProxyMiddleware({
      target: backendUrl,
      changeOrigin: true,
      pathRewrite: function(path, req) {
        // Rewrite /proxy/{sessionId}/api/send-message -> /api/send-message
        const rewritten = path.replace(new RegExp(`^/proxy/${req.params.sessionId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/api`), '/api')
        console.log(`Path rewrite: ${path} -> ${rewritten}`)
        return rewritten
      },
      onProxyReq: (proxyReq, req, res) => {
        // Forward original headers
        if (req.headers['content-type']) {
          proxyReq.setHeader('Content-Type', req.headers['content-type'])
        }
      },
      onError: (err, req, res) => {
        console.error(`API proxy error for ${req.path}:`, err)
        if (!res.headersSent) {
          res.status(500).json({ error: 'Proxy error', message: err.message })
        }
      }
    })
    
    proxy(req, res, next)
  })

  // Main proxy endpoint - proxies all requests and injects chat script
  app.use('/proxy/:sessionId*', async (req, res, next) => {
    // Extract sessionId - ensure we only get the UUID part (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    let sessionId = req.params.sessionId
    // UUIDs are 36 characters with dashes, extract just that part
    const uuidMatch = sessionId.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
    if (uuidMatch) {
      sessionId = uuidMatch[1]
    }
    
    console.log(`Proxying request for session: ${sessionId}, original param: ${req.params.sessionId}, path: ${req.path}`)
    
    try {
      // Get target URL from session first
      const { getSession } = await import('./session-store.js')
      const session = await getSession(sessionId)
      if (!session || !session.codingPlatformUrl) {
        return res.status(404).send(`Session ${sessionId} not found or missing coding platform URL`)
      }
      
      // Ensure browser session exists (creates browser, navigates, injects chat)
      await getOrCreateBrowserSession(sessionId)
      
      const targetUrl = new URL(session.codingPlatformUrl)
      
      // Extract the path after /proxy/:sessionId
      const proxyPath = `/proxy/${req.params.sessionId}`
      const remainingPath = req.path.startsWith(proxyPath) 
        ? req.path.substring(proxyPath.length) || '/'
        : '/'
      const fullPath = remainingPath + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '')
      
      // Create proxy that forwards all requests to the target
      const proxy = createProxyMiddleware({
        target: targetUrl.origin,
        changeOrigin: true,
        ws: true,
        pathRewrite: {
          [`^/proxy/${req.params.sessionId}`]: fullPath
        },
        onProxyRes: (proxyRes, req, res) => {
          // Inject chat script into HTML responses only
          const contentType = proxyRes.headers['content-type'] || ''
          if (contentType.includes('text/html')) {
            // Remove content-encoding header so we can modify the body
            delete proxyRes.headers['content-encoding']
            delete proxyRes.headers['content-length']
            
            let body = Buffer.alloc(0)
            const originalWrite = res.write.bind(res)
            const originalEnd = res.end.bind(res)
            
            // Prevent the proxy from writing directly
            res.write = () => true
            res.end = () => true
            
            // Collect response body
            proxyRes.on('data', (chunk: Buffer) => {
              body = Buffer.concat([body, chunk])
            })
            
            proxyRes.on('end', () => {
              try {
                let html = body.toString('utf-8')
                
                // Inject chat script if not already present
                if (!html.includes('ai-interview-chat')) {
                  const chatScript = generateChatInjectionScript(sessionId)
                  // Try to inject before </body> first, then </html>, then append
                  if (html.includes('</body>')) {
                    html = html.replace('</body>', `<script>${chatScript}</script></body>`)
                  } else if (html.includes('</html>')) {
                    html = html.replace('</html>', `<script>${chatScript}</script></html>`)
                  } else {
                    // Append to end if no closing tags found
                    html += `<script>${chatScript}</script>`
                  }
                  console.log(`Injected chat script for session ${sessionId}, script length: ${chatScript.length}`)
                  
                  // Verify injection
                  if (!html.includes('AI Assistant')) {
                    console.error(`WARNING: Script injection may have failed for session ${sessionId}`)
                  }
                } else {
                  console.log(`Chat script already present for session ${sessionId}`)
                }
                
                // Set headers before writing
                const newBody = Buffer.from(html)
                res.setHeader('Content-Length', newBody.length.toString())
                res.setHeader('Content-Type', 'text/html; charset=utf-8')
                
                // Write the modified body
                originalWrite(newBody)
                originalEnd()
              } catch (error) {
                console.error('Error processing HTML response:', error)
                originalEnd()
              }
            })
          }
        }
      })
      
      proxy(req, res, next)
    } catch (error) {
      console.error(`Proxy error for session ${sessionId}:`, error)
      res.status(500).send(`Error: ${(error as Error).message}`)
    }
  })

  app.listen(WORKER_PORT, () => {
    console.log(`Worker proxy server running on port ${WORKER_PORT}`)
  })

  process.on('SIGTERM', cleanup)
  process.on('SIGINT', cleanup)

  return app
}
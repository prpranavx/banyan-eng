const escapeForTemplateLiteral = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')

export function generateNavigationGuardScript(sessionParam: string, targetPlatformUrl?: string): string {
  const proxyBasePath = `/proxy/${sessionParam}`
  const proxyBasePathEscaped = escapeForTemplateLiteral(proxyBasePath)

  let targetOriginEscaped = ''
  let targetHostEscaped = ''
  if (targetPlatformUrl) {
    try {
      const parsed = new URL(targetPlatformUrl)
      targetOriginEscaped = escapeForTemplateLiteral(parsed.origin)
      targetHostEscaped = escapeForTemplateLiteral(parsed.hostname)
    } catch (error) {
      console.warn('Unable to parse target platform URL for navigation guard', error)
    }
  }

  return `(function() {
  try {
    if (window.__aiNavGuardInstalled) {
      return;
    }
    window.__aiNavGuardInstalled = true;
    
    const TARGET_PLATFORM_ORIGIN = '${targetOriginEscaped}';
    const TARGET_PLATFORM_HOST = '${targetHostEscaped}';
    const PROXY_BASE_PATH = '${proxyBasePathEscaped}';
    
    const isTargetUrl = (parsed) => {
      if (!parsed) return false;
      if (parsed.origin === window.location.origin) return false;
      if (TARGET_PLATFORM_ORIGIN) {
        return parsed.origin === TARGET_PLATFORM_ORIGIN;
      }
      if (TARGET_PLATFORM_HOST) {
        return parsed.hostname === TARGET_PLATFORM_HOST;
      }
      return false;
    };
    
    const rewriteToProxy = (url) => {
      if (!url || typeof url !== 'string') return url;
      try {
        const parsed = new URL(url, TARGET_PLATFORM_ORIGIN || window.location.origin);
        if (!isTargetUrl(parsed) && parsed.origin !== window.location.origin) {
          return url;
        }
        
        const pathWithQuery = parsed.pathname + parsed.search + parsed.hash;
        const proxiedPath = PROXY_BASE_PATH + pathWithQuery;
        const absolute = window.location.origin + proxiedPath;
        return absolute;
      } catch (error) {
        console.warn('[AI Worker Nav Guard] Failed to rewrite URL', url, error);
        return url;
      }
    };
    
    const interceptLocationAssignReplace = (methodName) => {
      if (typeof window.location[methodName] !== 'function') return;
      const original = window.location[methodName].bind(window.location);
      window.location[methodName] = function(url) {
        const rewritten = rewriteToProxy(url);
        if (rewritten !== url) {
          console.log('[AI Worker Nav Guard]', methodName, 'rewritten to', rewritten);
        }
        return original(rewritten);
      };
    };
    
    const interceptWindowOpen = () => {
      if (typeof window.open !== 'function') return;
      const originalOpen = window.open;
      window.open = function(url, target, features) {
        const rewritten = rewriteToProxy(url);
        if (rewritten !== url) {
          console.log('[AI Worker Nav Guard] window.open rewritten to', rewritten);
        }
        return originalOpen.call(window, rewritten, target, features);
      };
    };
    
    const interceptHistoryUpdates = () => {
      ['pushState', 'replaceState'].forEach(method => {
        if (typeof history[method] !== 'function') return;
        const original = history[method];
        history[method] = function(state, title, url) {
          const rewritten = typeof url === 'string' ? rewriteToProxy(url) : url;
          if (rewritten !== url) {
            console.log('[AI Worker Nav Guard]', method, 'rewritten to', rewritten);
          }
          return original.call(history, state, title, rewritten);
        };
      });
    };
    
    const interceptLocationSetter = () => {
      const descriptor = Object.getOwnPropertyDescriptor(Window.prototype, 'location');
      if (!descriptor || !descriptor.set) return;
      Object.defineProperty(window, 'location', {
        configurable: true,
        enumerable: true,
        get: descriptor.get ? descriptor.get.bind(window) : () => descriptor.value,
        set(value) {
          const rewritten = rewriteToProxy(value);
          if (rewritten !== value) {
            console.log('[AI Worker Nav Guard] window.location setter rewritten to', rewritten);
          }
          return descriptor.set.call(window, rewritten);
        }
      });
    };
    
    const interceptAnchorClicks = () => {
      document.addEventListener('click', function(event) {
        let el = event.target;
        while (el && el !== document.documentElement && el.tagName && el.tagName.toLowerCase() !== 'a') {
          el = el.parentElement;
        }
        if (!el || !el.tagName || el.tagName.toLowerCase() !== 'a') return;
        const href = el.getAttribute('href');
        if (!href) return;
        const rewritten = rewriteToProxy(href);
        if (rewritten !== href) {
          el.setAttribute('href', rewritten);
        }
      }, true);
    };
    
    interceptLocationAssignReplace('assign');
    interceptLocationAssignReplace('replace');
    interceptWindowOpen();
    interceptHistoryUpdates();
    interceptLocationSetter();
    interceptAnchorClicks();
    
    console.log('[AI Worker Nav Guard] Navigation guard installed.');
  } catch (error) {
    console.warn('[AI Worker Nav Guard] Failed to install navigation guard:', error);
  }
})();`
}


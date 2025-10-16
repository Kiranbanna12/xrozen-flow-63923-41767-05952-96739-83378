// Console Filter to Hide GoTrue Logs and Verbose API Client Logs
// This will filter out annoying debug logs in production and development

const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

// Filter function to hide unnecessary logs
const shouldHideLog = (message: any) => {
  const messageStr = String(message);
  return (
    // GoTrue/Supabase logs
    messageStr.includes('GoTrueClient') ||
    messageStr.includes('#_acquireLock') ||
    messageStr.includes('#_useSession') ||
    messageStr.includes('#__loadSession') ||
    messageStr.includes('#_autoRefreshTokenTick') ||
    messageStr.includes('#getSession()') ||
    messageStr.includes('session from storage') ||
    messageStr.includes('no session') ||
    messageStr.includes('lock acquired') ||
    messageStr.includes('lock released') ||
    messageStr.includes('INITIAL_SESSION callback') ||
    messageStr.includes('🔇 GoTrue logs have been silenced') ||
    // API Client logs
    messageStr.includes('🔧 ApiClient: No stored token found') ||
    messageStr.includes('🔧 ApiClient: Getting current user, auth status: false') ||
    messageStr.includes('🔧 ApiClient: No valid token for request to /profiles/me') ||
    // XrozenAI logs
    messageStr.includes('XrozenAI - Render check') ||
    messageStr.includes('XrozenAI - Component mounted') ||
    messageStr.includes('XrozenAI - Auth check result') ||
    messageStr.includes('XrozenAI - Realtime subscriptions disabled')
  );
};

// Override console.log
console.log = (...args: any[]) => {
  const messageStr = String(args[0]);
  // Filter React DevTools messages
  if (messageStr.includes('Download the React DevTools') || messageStr.includes('https://reactjs.org/link/react-devtools')) {
    return; // Silently suppress React DevTools messages
  }
  if (!shouldHideLog(args[0])) {
    originalConsoleLog.apply(console, args);
  } else {
    // Silently suppress filtered logs
    return;
  }
};

// Override console.warn  
console.warn = (...args: any[]) => {
  const messageStr = String(args[0]);
  // Filter React Router warnings in development only
  if (messageStr.includes('React Router Future Flag Warning')) {
    return; // Silently suppress these warnings as they're already addressed
  }
  if (!shouldHideLog(args[0])) {
    originalConsoleWarn.apply(console, args);
  }
};

// Override console.error
console.error = (...args: any[]) => {
  if (!shouldHideLog(args[0])) {
    originalConsoleError.apply(console, args);
  }
};

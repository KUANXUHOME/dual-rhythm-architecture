// Google 登录入口 — 必须有 clientId 检查
function handleGoogleLogin(request, env) {
  const clientId = env.GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID;
  if (!clientId) {
    return authErrorRedirect('Server login is not configured yet (missing GOOGLE_CLIENT_ID in Cloudflare).', request);
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',   // ← 不是 prompt: 'consent'
    state: crypto.randomUUID(),
  });
  ...
}

// ============================================================
// Dual-Rhythm Architecture™ — Worker 主入口
// 处理静态文件、OAuth 登录、会话管理
// ============================================================

import { jwtVerify, jwtSign } from './jwt-utils'; // 简单的 JWT 工具（见附录）

// ============================================================
// 所有私密信息从环境变量读取
// 代码中不写任何真实密钥
// ============================================================
const GOOGLE_CLIENT_ID = '';        // 留空，通过 env 获取
const GOOGLE_CLIENT_SECRET = '';    // 留空
const REDIRECT_URI = 'https://dualrhythmsystems.com/api/auth/callback/google';

const APPLE_CLIENT_ID = '';
const APPLE_TEAM_ID = '';
const APPLE_KEY_ID = '';
const APPLE_PRIVATE_KEY = '';

const JWT_SECRET = '';              // 留空
const COOKIE_NAME = 'dr_auth';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7天

// 路由表
const ROUTES = {
  STATIC: ['/', '/licensing', '/index.html', '/licensing.html'],
  API: {
    LOGIN_GOOGLE: '/api/auth/google',
    LOGIN_APPLE: '/api/auth/apple',
    CALLBACK_GOOGLE: '/api/auth/callback/google',
    CALLBACK_APPLE: '/api/auth/callback/apple',
    ME: '/api/auth/me',
    LOGOUT: '/api/auth/logout',
  },
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // 1. 处理 OAuth API 路由
    if (method === 'GET' && path === ROUTES.API.LOGIN_GOOGLE) {
      return handleGoogleLogin(env);
    }
    if (method === 'GET' && path === ROUTES.API.LOGIN_APPLE) {
      return handleAppleLogin(env);
    }
    if (method === 'GET' && path === ROUTES.API.CALLBACK_GOOGLE) {
      return handleGoogleCallback(request, env);
    }
    if (method === 'POST' && path === ROUTES.API.CALLBACK_APPLE) {
      return handleAppleCallback(request, env);
    }
    if (method === 'GET' && path === ROUTES.API.ME) {
      return handleMe(request, env);
    }
    if (method === 'POST' && path === ROUTES.API.LOGOUT) {
      return handleLogout();
    }

    // 2. 静态文件服务
    if (ROUTES.STATIC.includes(path) || path.endsWith('.html')) {
      return serveStatic(path, env);
    }

    // 3. 404
    return new Response('Not Found', { status: 404 });
  },
};

// ============================================================
// 静态文件服务
// ============================================================
async function serveStatic(path, env) {
  let filePath = path;
  if (filePath === '/') filePath = '/index.html';
  if (filePath === '/licensing') filePath = '/licensing.html';
  if (!filePath.startsWith('/')) filePath = '/' + filePath;

  // 从 Worker 的静态资源中读取（需要 wrangler.jsonc 中配置 assets.directory）
  try {
    const asset = await env.ASSETS.fetch(new URL(filePath, 'https://dummy.local'));
    if (asset.ok) {
      return asset;
    }
  } catch (e) {
    // 忽略
  }
  return new Response('File not found', { status: 404 });
}

// ============================================================
// Google OAuth 登录流程
// ============================================================
function handleGoogleLogin(env) {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'email profile',
    access_type: 'offline',
    prompt: 'consent',
    state: crypto.randomUUID(), // 防 CSRF，可存储到 KV 验证
  });
  return Response.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    302
  );
}

async function handleGoogleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code) return new Response('Missing code', { status: 400 });

  // 用 code 交换 token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET || GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  const tokens = await tokenRes.json();
  if (tokens.error) return new Response(tokens.error_description || 'Token Error', { status: 400 });

  // 获取用户信息
  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await userRes.json();
  if (profile.error) return new Response(profile.error.message || 'User Info Error', { status: 400 });

  // 存储用户信息到 KV（以 email 为 key，可更复杂）
  const userKey = `user:${profile.email}`;
  await env.USER_STORE.put(userKey, JSON.stringify({
    email: profile.email,
    name: profile.name,
    picture: profile.picture,
    provider: 'google',
    lastLogin: Date.now(),
  }));

  // 生成 JWT 并设置 Cookie
  const token = await createJWT(profile.email, env);
  return new Response(null, {
    status: 302,
    headers: {
      'Location': '/',
      'Set-Cookie': `${COOKIE_NAME}=${token}; HttpOnly; Secure; Path=/; Max-Age=${SESSION_MAX_AGE}; SameSite=Lax`,
    },
  });
}

// ============================================================
// Apple 登录流程
// ============================================================
function handleAppleLogin(env) {
  const params = new URLSearchParams({
    client_id: env.APPLE_CLIENT_ID || APPLE_CLIENT_ID,
    redirect_uri: 'https://dualrhythmsystems.com/api/auth/callback/apple',
    response_type: 'code id_token',
    scope: 'name email',
    response_mode: 'form_post',
    state: crypto.randomUUID(),
  });
  return Response.redirect(
    `https://appleid.apple.com/auth/authorize?${params.toString()}`,
    302
  );
}

async function handleAppleCallback(request, env) {
  // Apple 使用 POST 回调，需要在 body 中获取 code 和 id_token
  const contentType = request.headers.get('content-type') || '';
  let code, id_token, state;
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const body = await request.formData();
    code = body.get('code');
    id_token = body.get('id_token');
    state = body.get('state');
  } else {
    // 也可支持 query 参数（开发时可能用到）
    const url = new URL(request.url);
    code = url.searchParams.get('code');
    id_token = url.searchParams.get('id_token');
    state = url.searchParams.get('state');
  }
  if (!code && !id_token) return new Response('Missing credentials', { status: 400 });

  // 生成 client_secret (JWT)
  const clientSecret = await generateAppleClientSecret(env);
  
  // 交换 token
  const tokenRes = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.APPLE_CLIENT_ID || APPLE_CLIENT_ID,
      client_secret: clientSecret,
      code: code || '',
      grant_type: 'authorization_code',
      redirect_uri: 'https://dualrhythmsystems.com/api/auth/callback/apple',
    }),
  });
  const tokens = await tokenRes.json();
  if (tokens.error) return new Response(tokens.error_description || 'Apple Token Error', { status: 400 });

  // 解析 id_token 获取用户信息（如果苹果没有直接返回 email，则需从 id_token 解析）
  let email, name;
  if (tokens.id_token) {
    const payload = parseJwtPayload(tokens.id_token);
    email = payload.email;
    // 苹果只在首次授权时返回用户姓名，我们可以从 id_token 的 email 提取，姓名可留空
    name = payload.name || '';
  } else {
    // 降级
    return new Response('Unable to retrieve user email', { status: 400 });
  }

  // 存储用户
  const userKey = `user:${email}`;
  await env.USER_STORE.put(userKey, JSON.stringify({
    email,
    name: name || 'Apple User',
    provider: 'apple',
    lastLogin: Date.now(),
  }));

  // 生成 JWT 并设置 Cookie
  const token = await createJWT(email, env);
  return new Response(null, {
    status: 302,
    headers: {
      'Location': '/',
      'Set-Cookie': `${COOKIE_NAME}=${token}; HttpOnly; Secure; Path=/; Max-Age=${SESSION_MAX_AGE}; SameSite=Lax`,
    },
  });
}

// ============================================================
// 生成 Apple 客户端密钥 (client_secret)
// ============================================================
async function generateAppleClientSecret(env) {
  const privateKey = env.APPLE_PRIVATE_KEY || APPLE_PRIVATE_KEY;
  const teamId = env.APPLE_TEAM_ID || APPLE_TEAM_ID;
  const keyId = env.APPLE_KEY_ID || APPLE_KEY_ID;
  const clientId = env.APPLE_CLIENT_ID || APPLE_CLIENT_ID;

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: teamId,
    iat: now,
    exp: now + 60 * 60, // 1小时
    aud: 'https://appleid.apple.com',
    sub: clientId,
  };
  const header = { alg: 'ES256', kid: keyId };

  // 使用 Web Crypto API 签名 ES256
  const encoder = new TextEncoder();
  const keyData = encoder.encode(privateKey);
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBinary(privateKey),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const token = await signJwtWithKey(payload, header, key);
  return token;
}

// ============================================================
// JWT 相关工具函数
// ============================================================
async function createJWT(email, env) {
  const secret = env.JWT_SECRET || JWT_SECRET;
  const payload = { email, iat: Math.floor(Date.now() / 1000) };
  return await jwtSign(payload, secret);
}

async function verifyJWT(token, env) {
  const secret = env.JWT_SECRET || JWT_SECRET;
  return await jwtVerify(token, secret);
}

function parseJwtPayload(jwt) {
  const parts = jwt.split('.');
  if (parts.length !== 3) return {};
  const payload = parts[1];
  const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(decoded);
}

// 辅助：PEM to ArrayBuffer
function pemToBinary(pem) {
  const lines = pem.split('\n');
  let encoded = '';
  for (let line of lines) {
    if (line.includes('BEGIN') || line.includes('END')) continue;
    encoded += line.trim();
  }
  return Uint8Array.from(atob(encoded), c => c.charCodeAt(0)).buffer;
}

// 使用 Web Crypto 签名 JWT (ES256)
async function signJwtWithKey(payload, header, key) {
  const encoder = new TextEncoder();
  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const toSign = `${headerEncoded}.${payloadEncoded}`;
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    key,
    encoder.encode(toSign)
  );
  const signatureEncoded = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
  return `${toSign}.${signatureEncoded}`;
}

function base64UrlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ============================================================
// 会话检查 / 登出
// ============================================================
async function handleMe(request, env) {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return new Response('{"user":null}', { status: 401 });
  const token = getCookieValue(cookieHeader, COOKIE_NAME);
  if (!token) return new Response('{"user":null}', { status: 401 });
  try {
    const payload = await verifyJWT(token, env);
    // 从 KV 取用户详情
    const userKey = `user:${payload.email}`;
    const userData = await env.USER_STORE.get(userKey, 'json');
    return new Response(JSON.stringify({ user: userData }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response('{"user":null}', { status: 401 });
  }
}

function handleLogout() {
  return new Response(null, {
    status: 302,
    headers: {
      'Location': '/',
      'Set-Cookie': `${COOKIE_NAME}=; HttpOnly; Secure; Path=/; Max-Age=0`,
    },
  });
}

// Cookie 工具
function getCookieValue(cookieStr, name) {
  const match = cookieStr.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}






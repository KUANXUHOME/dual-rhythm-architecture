// jwt-utils.js
export async function jwtSign(payload, secret) {
  const encoder = new TextEncoder();
  const header = { alg: 'HS256', typ: 'JWT' };
  const base64Header = base64Url(JSON.stringify(header));
  const base64Payload = base64Url(JSON.stringify(payload));
  const toSign = `${base64Header}.${base64Payload}`;
  
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: { name: 'SHA-256' } },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(toSign));
  const base64Signature = base64Url(String.fromCharCode(...new Uint8Array(signature)));
  return `${toSign}.${base64Signature}`;
}

export async function jwtVerify(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const [base64Header, base64Payload, signature] = parts;
  const toSign = `${base64Header}.${base64Payload}`;
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: { name: 'SHA-256' } },
    false,
    ['verify']
  );
  const sigBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(toSign));
  if (!valid) throw new Error('Invalid signature');
  const payloadJson = atob(base64Payload);
  return JSON.parse(payloadJson);
}

function base64Url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

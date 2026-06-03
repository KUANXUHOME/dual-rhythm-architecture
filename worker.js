export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // ============ 路由 ============
    
    // 诊断计算 API
    if (url.pathname === '/api/diagnose' && request.method === 'POST') {
      return handleDiagnose(request, corsHeaders);
    }
    
    // 发送验证码
    if (url.pathname === '/api/send-code' && request.method === 'POST') {
      return handleSendCode(request, env, corsHeaders);
    }
    
    // 验证验证码 + 登录
    if (url.pathname === '/api/verify-code' && request.method === 'POST') {
      return handleVerifyCode(request, env, corsHeaders);
    }
    
    // 404
    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

// ============ 诊断计算 ============
async function handleDiagnose(request, corsHeaders) {
  const { er, pr, ri, a } = await request.json();
  
  const ssc = Math.cbrt(er * pr * ri);
  const score = Math.round(ssc / (1 + a / 100));
  
  let zone, zoneName, color, actions;
  
  if (score >= 80) {
    zone = 'structural_advantage';
    zoneName = 'Structural Advantage';
    color = '#059669';
    actions = [
      { action: 'Maintain current rhythm', status: 'normal' },
      { action: 'Monitor acceleration exposure', status: 'normal' },
    ];
  } else if (score >= 65) {
    zone = 'controlled_stability';
    zoneName = 'Controlled Stability';
    color = '#22C55E';
    actions = [
      { action: 'Acceleration manageable', status: 'normal' },
      { action: 'Review recovery windows', status: 'pending' },
    ];
  } else if (score >= 50) {
    zone = 'fragile_balance';
    zoneName = 'Fragile Balance';
    color = '#EAB308';
    actions = [
      { action: 'Restrict non-core expansion', status: 'required' },
      { action: 'Reinforce recovery functions', status: 'required' },
    ];
  } else if (score >= 35) {
    zone = 'destabilization_risk';
    zoneName = 'Destabilization Risk';
    color = '#F97316';
    actions = [
      { action: 'Freeze non-core growth', status: 'required' },
      { action: 'Initiate structural intervention', status: 'required' },
      { action: 'Declare stabilization window', status: 'pending' },
    ];
  } else {
    zone = 'structural_instability';
    zoneName = 'Structural Instability';
    color = '#EF4444';
    actions = [
      { action: 'Mandatory stabilization cycle', status: 'required' },
      { action: 'Freeze all discretionary expansion', status: 'required' },
      { action: 'Deploy governance override', status: 'required' },
    ];
  }
  
  return new Response(JSON.stringify({
    score, zone, zoneName, color, er, pr, ri, a, actions,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============ 发送验证码 ============
async function handleSendCode(request, env, corsHeaders) {
  const { email } = await request.json();
  
  if (!email || !email.includes('@')) {
    return new Response(JSON.stringify({ error: 'Invalid email' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  // MVP: 生成 6 位随机验证码
  const code = String(Math.floor(100000 + Math.random() * 900000));
  
  // 存储验证码（5分钟过期）
  if (env.USER_STORE) {
    await env.USER_STORE.put(`code:${email}`, code, { expirationTtl: 300 });
  }
  
  // TODO: 接入真实邮件服务发送验证码
  console.log(`Code for ${email}: ${code}`);
  
  return new Response(JSON.stringify({
    success: true,
    message: 'Verification code sent',
    code: code, // MVP: 返回验证码（上线后删除此行）
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============ 验证验证码 + 登录 ============
async function handleVerifyCode(request, env, corsHeaders) {
  const { email, code } = await request.json();
  
  if (!email || !code) {
    return new Response(JSON.stringify({ error: 'Email and code required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  // MVP: 检查存储的验证码
  let storedCode;
  if (env.USER_STORE) {
    storedCode = await env.USER_STORE.get(`code:${email}`);
  }
  
  if (!storedCode || storedCode !== code) {
    return new Response(JSON.stringify({ error: 'Invalid or expired code' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  // 登录成功，删除验证码
  if (env.USER_STORE) {
    await env.USER_STORE.delete(`code:${email}`);
    await env.USER_STORE.put(`user:${email}`, JSON.stringify({
      email,
      createdAt: new Date().toISOString(),
    }));
  }
  
  return new Response(JSON.stringify({
    success: true,
    email,
    message: 'Login successful',
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

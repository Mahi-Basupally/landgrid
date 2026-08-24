'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email,setEmail]=useState(''); const [code,setCode]=useState(''); const [sent,setSent]=useState(false); const [message,setMessage]=useState(''); const router=useRouter();
  async function sendCode(){setMessage(''); const r=await fetch('/api/auth/send-code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})}); const d=await r.json(); if(!r.ok){setMessage(d.error||'Unable to send code');return;} setSent(true); setMessage(d.message);}
  async function verify(){setMessage(''); const r=await fetch('/api/auth/verify-code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,code})}); const d=await r.json(); if(!r.ok){setMessage(d.error||'Invalid code');return;} router.push('/projects');}
  return <main className="auth"><div className="auth-card"><div className="brand-mark">LG</div><div className="eyebrow">LANDGRID ACCESS</div><h1>{sent?'Enter your code':'Sign in'}</h1><p>{sent?'Enter the verification code sent to your email.':'Use your email. No password or account enrollment required.'}</p>{!sent?<><input className="input" type="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)}/><button className="button primary full" disabled={!email} onClick={sendCode}>Email me a code</button></>:<><input className="input code" inputMode="numeric" maxLength={6} placeholder="123456" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/><button className="button primary full" disabled={code.length!==6} onClick={verify}>Continue</button></>}{message&&<div className="notice">{message}</div>}<small>For development, the configured fallback code can be used for an existing account.</small></div></main>;
}

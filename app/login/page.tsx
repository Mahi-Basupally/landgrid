'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const [email,setEmail]=useState('');
  const [code,setCode]=useState('');
  const [sent,setSent]=useState(false);
  const [message,setMessage]=useState('');
  const [loading,setLoading]=useState(false);
  const router=useRouter();

  async function sendCode(){
    const normalized=email.trim().toLowerCase();
    if(!emailPattern.test(normalized)){setMessage('Please enter a valid email address.');return;}
    setLoading(true);setMessage('');
    try{
      const r=await fetch('/api/auth/send-code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:normalized})});
      const d=await r.json();
      if(!r.ok){setMessage(d.error||'Unable to send code');return;}
      setEmail(normalized);setSent(true);setMessage(d.message);
    }catch{setMessage('Unable to contact the login service. Please try again.');}
    finally{setLoading(false);}
  }

  async function verify(){
    const normalized=email.trim().toLowerCase();
    if(!emailPattern.test(normalized)){setMessage('Please enter a valid email address.');return;}
    if(!/^\d{6}$/.test(code)){setMessage('Enter the 6-digit verification code.');return;}
    setLoading(true);setMessage('');
    try{
      const r=await fetch('/api/auth/verify-code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:normalized,code})});
      const d=await r.json();
      if(!r.ok){setMessage(d.error||'Invalid code');return;}
      router.push('/projects');
    }catch{setMessage('Unable to contact the login service. Please try again.');}
    finally{setLoading(false);}
  }

  return <main className="auth"><div className="auth-card"><div className="brand-mark">LG</div><div className="eyebrow">LANDGRID ACCESS</div><h1>{sent?'Enter your code':'Sign in'}</h1><p>{sent?'Enter the verification code sent to your email.':'Use your email. No password or account enrollment required.'}</p>{!sent?<><input className="input" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')sendCode()}} aria-invalid={Boolean(email)&&!emailPattern.test(email.trim())}/><button className="button primary full" disabled={loading||!emailPattern.test(email.trim())} onClick={sendCode}>{loading?'Sending…':'Email me a code'}</button></>:<><input className="input code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/><button className="button primary full" disabled={loading||code.length!==6} onClick={verify}>{loading?'Signing in…':'Continue'}</button><button className="button secondary full" disabled={loading} onClick={()=>{setSent(false);setCode('');setMessage('')}}>Use a different email</button></>}{message&&<div className="notice">{message}</div>}<small>Development login: the configured fallback code can be used while email delivery is not configured.</small></div></main>;
}

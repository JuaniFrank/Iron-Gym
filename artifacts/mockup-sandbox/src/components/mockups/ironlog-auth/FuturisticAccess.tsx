import './_group.css';
import { useState } from 'react';

/* ─── tiny design tokens ─────────────────────────────────────── */
const c = {
  bg:        'var(--il-bg)',
  bgDeep:    'var(--il-bg-deep)',
  surface:   'var(--il-surface)',
  surface2:  'var(--il-surface2)',
  border:    'var(--il-border)',
  borderHi:  'var(--il-border-hi)',
  ink:       'var(--il-ink)',
  inkSoft:   'var(--il-ink-soft)',
  muted:     'var(--il-muted)',
  mutedDim:  'var(--il-muted-dim)',
  lime:      'var(--il-lime)',
  limeInk:   'var(--il-lime-ink)',
  limeSoft:  'var(--il-lime-soft)',
  limeEdge:  'var(--il-lime-edge)',
  danger:    'var(--il-danger)',
};

/* ─── reusable micro-components ─────────────────────────────── */

function GridLines() {
  return (
    <svg
      aria-hidden
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.045, pointerEvents: 'none' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#C9F24D" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>
  );
}

function ScanLine() {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: 0, right: 0,
        height: 2,
        background: 'linear-gradient(90deg, transparent 0%, rgba(201,242,77,0.35) 40%, rgba(201,242,77,0.6) 50%, rgba(201,242,77,0.35) 60%, transparent 100%)',
        animation: 'scanDown 4s linear infinite',
        pointerEvents: 'none',
      }}
    />
  );
}

function LimeGlow({ style }: { style?: React.CSSProperties }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(201,242,77,0.18) 0%, rgba(201,242,77,0.06) 40%, transparent 70%)',
        pointerEvents: 'none',
        ...style,
      }}
    />
  );
}

function LogoMark() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Barbell icon */}
      <rect x="5" y="15.5" width="4" height="5" rx="1.5" fill={c.lime} />
      <rect x="27" y="15.5" width="4" height="5" rx="1.5" fill={c.lime} />
      <rect x="9" y="13.5" width="3" height="9" rx="1.5" fill={c.lime} />
      <rect x="24" y="13.5" width="3" height="9" rx="1.5" fill={c.lime} />
      <rect x="12" y="16.5" width="12" height="3" rx="1.5" fill={c.lime} />
    </svg>
  );
}

function Divider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
      <div style={{ flex: 1, height: 1, background: c.border }} />
      <span style={{ fontFamily: 'var(--font-main)', fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: c.mutedDim }}>
        o continuar con
      </span>
      <div style={{ flex: 1, height: 1, background: c.border }} />
    </div>
  );
}

function SocialButton({ logo, label }: { logo: React.ReactNode; label: string }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 48,
        borderRadius: 'var(--il-radius)',
        border: `1px solid ${pressed ? c.borderHi : c.border}`,
        background: pressed ? c.surface2 : c.surface,
        cursor: 'pointer',
        transition: 'all 0.14s ease',
        transform: pressed ? 'scale(0.975)' : 'scale(1)',
      }}
    >
      {logo}
      <span style={{ fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 600, color: c.ink, letterSpacing: -0.1 }}>
        {label}
      </span>
    </button>
  );
}

function GoogleLogo() {
  return (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
      <path d="M16.2 8.68c0-.56-.05-1.1-.14-1.61H8.5v3.05h4.31a3.68 3.68 0 0 1-1.6 2.42v2h2.6c1.52-1.4 2.39-3.46 2.39-5.86Z" fill="#4285F4"/>
      <path d="M8.5 16.5c2.16 0 3.97-.72 5.29-1.94l-2.59-2.01c-.72.48-1.63.77-2.7.77-2.08 0-3.84-1.4-4.47-3.29H1.36v2.08A8 8 0 0 0 8.5 16.5Z" fill="#34A853"/>
      <path d="M4.03 10.03a4.8 4.8 0 0 1 0-3.06V4.89H1.36a8 8 0 0 0 0 7.22l2.67-2.08Z" fill="#FBBC05"/>
      <path d="M8.5 3.68c1.17 0 2.22.4 3.05 1.2l2.28-2.28A8 8 0 0 0 1.36 4.89L4.03 6.97C4.66 5.08 6.42 3.68 8.5 3.68Z" fill="#EA4335"/>
    </svg>
  );
}

function AppleLogo() {
  return (
    <svg width="16" height="17" viewBox="0 0 16 17" fill="none">
      <path d="M12.67 8.9c-.01-1.56.87-2.76 2.27-3.52-.85-1.22-2.15-1.91-3.83-2.05-1.6-.13-3.35 1-3.99 1-.68 0-2.22-.97-3.45-.94C1.68 3.43.09 4.61.08 7.1c-.01 2.37 1.54 5.36 2.92 7.13.66.87 1.44 1.87 2.47 1.84.98-.03 1.36-.64 2.55-.64 1.18 0 1.5.64 2.54.63 1.06-.02 1.74-.91 2.39-1.79.48-.66.85-1.4 1.1-2.18a4.4 4.4 0 0 1-1.38-3.19ZM9.97 1.7C10.82.68 10.74-.44 10.71-.5A3.3 3.3 0 0 0 8.6.67a3.1 3.1 0 0 0-.84 2.22c.7.05 1.38-.27 2.21-1.2Z" fill={c.ink}/>
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="3" width="13" height="10" rx="2" stroke={c.muted} strokeWidth="1.2"/>
      <path d="M1.5 5.5 8 9.5l6.5-4" stroke={c.muted} strokeWidth="1.2"/>
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="3" y="7" width="10" height="7" rx="2" stroke={c.muted} strokeWidth="1.2"/>
      <path d="M5 7V5a3 3 0 1 1 6 0v2" stroke={c.muted} strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="8" cy="10.5" r="1" fill={c.muted}/>
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5Z" stroke={c.muted} strokeWidth="1.2"/>
      <circle cx="8" cy="8" r="2" stroke={c.muted} strokeWidth="1.2"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 2l12 12M6.5 6.7A2 2 0 0 0 9.3 9.5M4.2 4.2C2.7 5.2 1 8 1 8s2.5 5 7 5c1.4 0 2.7-.4 3.8-1M12.8 10.8C14 9.8 15 8 15 8s-2.5-5-7-5c-.8 0-1.6.1-2.3.4" stroke={c.muted} strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

function AuthInput({
  label, type = 'text', icon, rightSlot, value, onChange, placeholder,
}: {
  label: string;
  type?: string;
  icon: React.ReactNode;
  rightSlot?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontFamily: 'var(--font-main)', fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: c.muted }}>
        {label}
      </span>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          height: 52, paddingInline: 14,
          background: c.surface,
          borderRadius: 'var(--il-radius)',
          border: `1px solid ${focused ? c.limeEdge : c.border}`,
          boxShadow: focused ? `0 0 0 3px rgba(201,242,77,0.08)` : 'none',
          transition: 'border-color 0.18s, box-shadow 0.18s',
        }}
      >
        {icon}
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontFamily: 'var(--font-main)', fontSize: 15, fontWeight: 500,
            color: c.ink, letterSpacing: -0.1,
            caretColor: c.lime,
          }}
        />
        {rightSlot}
      </div>
    </div>
  );
}

/* ─── main component ────────────────────────────────────────── */

export function FuturisticAccess() {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1600);
  };

  return (
    <>
      <style>{`
        @keyframes scanDown {
          0%   { top: -2px; opacity: 0; }
          5%   { opacity: 1; }
          90%  { opacity: 0.6; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50%       { opacity: 0.55; transform: scale(1.07); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .il-fadein { animation: fadeUp 0.38s ease forwards; }
        .il-fadein-2 { animation: fadeUp 0.38s 0.06s ease forwards; opacity: 0; }
        .il-fadein-3 { animation: fadeUp 0.38s 0.12s ease forwards; opacity: 0; }
        .il-fadein-4 { animation: fadeUp 0.38s 0.18s ease forwards; opacity: 0; }
        .il-fadein-5 { animation: fadeUp 0.38s 0.24s ease forwards; opacity: 0; }
        .il-btn:hover { opacity: 0.9; transform: scale(0.995); }
        .il-btn:active { transform: scale(0.975); }
        input::placeholder { color: var(--il-muted-dim); }
      `}</style>

      {/* Shell */}
      <div style={{
        position: 'relative',
        width: 390, height: 844,
        background: c.bg,
        overflow: 'hidden',
        fontFamily: 'var(--font-main)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Background layers */}
        <GridLines />
        <ScanLine />
        <LimeGlow style={{ top: -80, left: '50%', marginLeft: -180, width: 360, height: 360, animation: 'pulseGlow 6s ease-in-out infinite' }} />
        <LimeGlow style={{ bottom: -120, right: -80, width: 280, height: 280, animationDelay: '2s', animation: 'pulseGlow 7s 2s ease-in-out infinite' }} />

        {/* Horizontal accent line at top */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent 0%, ${c.lime} 50%, transparent 100%)`, opacity: 0.8 }} />

        {/* Status bar stub */}
        <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingInline: 24, position: 'relative', zIndex: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: c.ink, letterSpacing: -0.2 }}>9:41</span>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            {/* signal bars */}
            {[3,4,5,6].map(h => (
              <div key={h} style={{ width: 3, height: h, background: c.ink, borderRadius: 1.5, opacity: 0.9 }} />
            ))}
            <div style={{ width: 16, height: 8, border: `1.5px solid ${c.ink}`, borderRadius: 2, marginLeft: 4, position: 'relative', opacity: 0.9 }}>
              <div style={{ position: 'absolute', left: 2, top: 1.5, bottom: 1.5, width: 8, background: c.ink, borderRadius: 1 }} />
              <div style={{ position: 'absolute', right: -3, top: '50%', marginTop: -3, width: 2.5, height: 6, background: c.ink, borderRadius: 1 }} />
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingInline: 28, paddingTop: 8, paddingBottom: 32, position: 'relative', zIndex: 10, overflowY: 'auto' }}>

          {/* Logo + wordmark */}
          <div className="il-fadein" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 12, paddingBottom: 28 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20,
              background: c.surface,
              border: `1px solid ${c.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 24px rgba(201,242,77,0.12), inset 0 1px 0 ${c.borderHi}`,
            }}>
              <LogoMark />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: c.ink, letterSpacing: -0.9, lineHeight: 1 }}>
                IronLog
              </div>
              <div style={{ fontSize: 10, fontWeight: 500, color: c.muted, letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 4 }}>
                Performance Tracker
              </div>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="il-fadein-2" style={{
            display: 'flex', gap: 0,
            background: c.surface, borderRadius: 'var(--il-radius)',
            border: `1px solid ${c.border}`,
            padding: 4,
            marginBottom: 22,
          }}>
            {(['login', 'register'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1, height: 36, border: 'none', cursor: 'pointer',
                  borderRadius: 10,
                  background: tab === t ? c.lime : 'transparent',
                  color: tab === t ? c.limeInk : c.muted,
                  fontFamily: 'var(--font-main)',
                  fontSize: 13, fontWeight: 600,
                  letterSpacing: -0.1,
                  transition: 'all 0.18s ease',
                }}
              >
                {t === 'login' ? 'Acceder' : 'Registrarse'}
              </button>
            ))}
          </div>

          {/* Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {tab === 'register' && (
              <div className="il-fadein">
                <AuthInput
                  label="Nombre completo"
                  icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5.5" r="2.5" stroke={c.muted} strokeWidth="1.2"/><path d="M2 13.5c0-2.5 2.7-4 6-4s6 1.5 6 4" stroke={c.muted} strokeWidth="1.2" strokeLinecap="round"/></svg>}
                  value={name}
                  onChange={setName}
                  placeholder="Tu nombre"
                />
              </div>
            )}

            <div className="il-fadein-3">
              <AuthInput
                label="Correo electrónico"
                type="email"
                icon={<EmailIcon />}
                value={email}
                onChange={setEmail}
                placeholder="tu@email.com"
              />
            </div>

            <div className="il-fadein-4">
              <AuthInput
                label="Contraseña"
                type={showPw ? 'text' : 'password'}
                icon={<LockIcon />}
                rightSlot={
                  <button
                    onClick={() => setShowPw(v => !v)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
                  >
                    <EyeIcon open={showPw} />
                  </button>
                }
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
              />
            </div>

            {tab === 'login' && (
              <div style={{ textAlign: 'right', marginTop: -4 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: c.lime, cursor: 'pointer', letterSpacing: -0.1 }}>
                  ¿Olvidaste tu contraseña?
                </span>
              </div>
            )}
          </div>

          {/* CTA button */}
          <button
            className="il-btn il-fadein-5"
            onClick={handleSubmit}
            style={{
              marginTop: 24,
              width: '100%', height: 52,
              borderRadius: 'var(--il-radius)',
              border: `1px solid ${c.limeEdge}`,
              background: loading ? c.limeSoft : c.lime,
              color: c.limeInk,
              fontFamily: 'var(--font-main)',
              fontSize: 15, fontWeight: 700,
              letterSpacing: -0.2,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.18s ease',
              boxShadow: `0 0 20px rgba(201,242,77,0.20)`,
            }}
          >
            {loading ? (
              <div style={{ width: 18, height: 18, border: `2.5px solid rgba(14,14,12,0.25)`, borderTopColor: c.limeInk, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            ) : (
              <>
                {tab === 'login' ? 'Entrar al sistema' : 'Crear cuenta'}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7h8M8 4l3 3-3 3" stroke={c.limeInk} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </>
            )}
          </button>

          {/* Divider + socials */}
          <div style={{ marginTop: 20 }}>
            <Divider />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <SocialButton logo={<GoogleLogo />} label="Google" />
            <SocialButton logo={<AppleLogo />} label="Apple" />
          </div>

          {/* Footer link */}
          <div style={{ marginTop: 'auto', paddingTop: 28, textAlign: 'center' }}>
            <span style={{ fontSize: 13, color: c.muted }}>
              {tab === 'login' ? '¿No tenés cuenta? ' : '¿Ya tenés cuenta? '}
              <span
                onClick={() => setTab(tab === 'login' ? 'register' : 'login')}
                style={{ color: c.lime, fontWeight: 600, cursor: 'pointer' }}
              >
                {tab === 'login' ? 'Registrate' : 'Accedé'}
              </span>
            </span>
          </div>

          {/* System fingerprint */}
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 9, color: c.mutedDim, letterSpacing: '0.08em' }}>
              SYS_AUTH v2.1 · TLS 1.3 · E2E
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

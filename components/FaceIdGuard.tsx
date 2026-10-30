'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import {
  Lock,
  Check,
  Delete,
  ShieldAlert,
  Sparkles,
  Smartphone,
  ChevronLeft,
  KeyRound,
  RefreshCw,
} from 'lucide-react';

interface FaceIdContextType {
  isLocked: boolean;
  lockDashboard: () => void;
  unlockDashboard: () => void;
  resetPasskey: () => void;
}

const FaceIdContext = createContext<FaceIdContextType>({
  isLocked: false,
  lockDashboard: () => {},
  unlockDashboard: () => {},
  resetPasskey: () => {},
});

export const useFaceId = () => useContext(FaceIdContext);

type AuthStatus = 'idle' | 'unregistered' | 'scanning' | 'success' | 'error';
type ViewMode = 'faceid' | 'pin';

const STORAGE_KEY_CRED = 'leads_machine_faceid_cred_id';
const STORAGE_KEY_SESSION = 'leads_machine_session_auth';
const STORAGE_KEY_PIN = 'leads_machine_emergency_pin';
const DEFAULT_PIN = '2026';

// Utilities for Base64URL ArrayBuffer conversion
function bufferToBase64URL(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64URLToBuffer(base64url: string): ArrayBuffer {
  let str = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Apple iOS audio & haptic feedback synthesis
function playAppleTone(type: 'success' | 'error') {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (type === 'success') {
      // Apple Pay / Face ID 2-tone harmonic chime
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';

      // First note: C5 (523.25 Hz)
      osc1.frequency.setValueAtTime(523.25, now);
      // Second note: G5 (783.99 Hz)
      osc1.frequency.setValueAtTime(783.99, now + 0.08);

      // Harmony note: E5 (659.25 Hz)
      osc2.frequency.setValueAtTime(659.25, now + 0.08);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now + 0.08);
      osc1.stop(now + 0.35);
      osc2.stop(now + 0.35);
    } else {
      // Subtle failure double thud
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.setValueAtTime(110, now + 0.08);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch {
    // Audio might be restricted by browser policy before user interaction
  }
}

function triggerHaptic(type: 'success' | 'error') {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    if (type === 'success') {
      navigator.vibrate([35, 45, 35]);
    } else {
      navigator.vibrate([60, 80, 60, 80]);
    }
  }
}

// Apple Face ID Vector Glyph
function AppleFaceIdGlyph({
  status,
  className = 'w-24 h-24',
}: {
  status: AuthStatus;
  className?: string;
}) {
  const isError = status === 'error';
  const isScanning = status === 'scanning';

  return (
    <svg
      viewBox="0 0 100 100"
      className={`${className} transition-all duration-300 ${
        isError
          ? 'text-[#FF453A]'
          : isScanning
          ? 'text-white'
          : 'text-white/80'
      }`}
      fill="none"
      stroke="currentColor"
      strokeWidth="3.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* 4 Corner Viewfinder Brackets */}
      <path d="M 16 32 V 22 A 7 7 0 0 1 23 15 H 33" />
      <path d="M 67 15 H 77 A 7 7 0 0 1 84 22 V 32" />
      <path d="M 84 68 V 78 A 7 7 0 0 1 77 85 H 67" />
      <path d="M 33 85 H 23 A 7 7 0 0 1 16 78 V 68" />

      {/* Eyes */}
      <path d="M 36 39 V 43" strokeWidth="4.5" />
      <path d="M 64 39 V 43" strokeWidth="4.5" />

      {/* Nose */}
      <path d="M 50 41 V 54 H 56" strokeWidth="3.5" />

      {/* Smile */}
      <path d="M 36 67 C 42 74, 58 74, 64 67" strokeWidth="3.5" />
    </svg>
  );
}

export default function FaceIdGuard({ children }: { children: React.ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);
  const [isLocked, setIsLocked] = useState(true);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('Face ID');
  const [viewMode, setViewMode] = useState<ViewMode>('faceid');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const isAuthenticatingRef = useRef(false);

  // Check initial session & biometrics availability
  useEffect(() => {
    setIsMounted(true);
    const sessionAuth = sessionStorage.getItem(STORAGE_KEY_SESSION);
    if (sessionAuth === 'authenticated') {
      setIsLocked(false);
      return;
    }

    setIsLocked(true);
    const credId = localStorage.getItem(STORAGE_KEY_CRED);
    if (!credId) {
      setAuthStatus('unregistered');
      setStatusMessage('Biometrik Belum Didaftarkan');
    } else {
      setAuthStatus('idle');
      setStatusMessage('Sentuh untuk Pindai Wajah');
      // Auto-trigger biometric prompt on clean page load
      const timer = setTimeout(() => {
        handleAuthenticate();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, []);

  const triggerShake = useCallback(() => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 450);
  }, []);

  // WebAuthn Passkey Registration
  const handleRegister = async () => {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) {
      setAuthStatus('error');
      setStatusMessage('Biometrik tidak didukung pada browser ini');
      triggerShake();
      return;
    }

    try {
      setAuthStatus('scanning');
      setStatusMessage('Menghubungkan Platform Authenticator…');

      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const userId = new Uint8Array(16);
      window.crypto.getRandomValues(userId);

      const hostname = window.location.hostname;

      const creationOptions: CredentialCreationOptions = {
        publicKey: {
          challenge,
          rp: {
            name: 'Leads Machine OS',
            id: hostname === 'localhost' ? 'localhost' : hostname,
          },
          user: {
            id: userId,
            name: 'kevin@leads-machine',
            displayName: 'Kevin (Owner)',
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' }, // ES256
            { alg: -257, type: 'public-key' }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
          },
          timeout: 60000,
          attestation: 'none',
        },
      };

      const credential = (await navigator.credentials.create(creationOptions)) as PublicKeyCredential;
      if (credential && credential.id) {
        localStorage.setItem(STORAGE_KEY_CRED, credential.id);
        handleUnlockSuccess('Wajah Berhasil Didaftarkan');
      } else {
        throw new Error('Pendaftaran biometrik gagal');
      }
    } catch (err: unknown) {
      const error = err as Error;
      setAuthStatus('error');
      setStatusMessage(error.message || 'Pendaftaran biometrik dibatalkan');
      triggerShake();
      playAppleTone('error');
      triggerHaptic('error');
    }
  };

  // WebAuthn Passkey Verification
  const handleAuthenticate = async () => {
    if (isAuthenticatingRef.current) return;

    const credId = localStorage.getItem(STORAGE_KEY_CRED);
    if (!credId) {
      setAuthStatus('unregistered');
      setStatusMessage('Biometrik Belum Didaftarkan');
      return;
    }

    if (typeof window === 'undefined' || !window.PublicKeyCredential) {
      setAuthStatus('error');
      setStatusMessage('WebAuthn tidak didukung. Gunakan PIN.');
      triggerShake();
      return;
    }

    try {
      isAuthenticatingRef.current = true;
      setAuthStatus('scanning');
      setStatusMessage('Mencari Wajah…');

      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const hostname = window.location.hostname;

      const getOptions: CredentialRequestOptions = {
        publicKey: {
          challenge,
          rpId: hostname === 'localhost' ? 'localhost' : hostname,
          userVerification: 'required',
          allowCredentials: [
            {
              id: base64URLToBuffer(credId),
              type: 'public-key',
              transports: ['internal'],
            },
          ],
          timeout: 60000,
        },
      };

      const assertion = await navigator.credentials.get(getOptions);
      if (assertion) {
        handleUnlockSuccess('Wajah Terverifikasi');
      } else {
        throw new Error('Verifikasi gagal');
      }
    } catch (err: unknown) {
      const error = err as Error;
      setAuthStatus('error');
      setStatusMessage(
        error.name === 'NotAllowedError'
          ? 'Wajah Tidak Dikenali'
          : 'Verifikasi dibatalkan atau tidak cocok'
      );
      triggerShake();
      playAppleTone('error');
      triggerHaptic('error');
    } finally {
      isAuthenticatingRef.current = false;
    }
  };

  // Successful Unlock Handler
  const handleUnlockSuccess = (msg: string) => {
    setAuthStatus('success');
    setStatusMessage(msg);
    playAppleTone('success');
    triggerHaptic('success');
    sessionStorage.setItem(STORAGE_KEY_SESSION, 'authenticated');

    setTimeout(() => {
      setIsLocked(false);
      setAuthStatus('idle');
    }, 650);
  };

  // Emergency PIN verification
  const handlePinInput = (digit: string) => {
    if (pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);

    if (newPin.length === 4) {
      const storedPin = localStorage.getItem(STORAGE_KEY_PIN) || DEFAULT_PIN;
      if (newPin === storedPin) {
        handleUnlockSuccess('PIN Terverifikasi');
        setPin('');
      } else {
        setPinError(true);
        triggerShake();
        playAppleTone('error');
        triggerHaptic('error');
        setTimeout(() => {
          setPin('');
          setPinError(false);
        }, 500);
      }
    }
  };

  const handlePinDelete = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  // Keyboard navigation for PIN mode
  useEffect(() => {
    if (!isLocked || viewMode !== 'pin') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handlePinInput(e.key);
      } else if (e.key === 'Backspace') {
        handlePinDelete();
      } else if (e.key === 'Escape') {
        setViewMode('faceid');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocked, viewMode, pin]);

  // Lock Dashboard Function (accessible across app)
  const lockDashboard = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY_SESSION);
    setIsLocked(true);
    setViewMode('faceid');
    const credId = localStorage.getItem(STORAGE_KEY_CRED);
    if (!credId) {
      setAuthStatus('unregistered');
      setStatusMessage('Biometrik Belum Didaftarkan');
    } else {
      setAuthStatus('idle');
      setStatusMessage('Sentuh untuk Pindai Wajah');
      setTimeout(() => {
        handleAuthenticate();
      }, 200);
    }
  }, []);

  const unlockDashboard = useCallback(() => {
    sessionStorage.setItem(STORAGE_KEY_SESSION, 'authenticated');
    setIsLocked(false);
  }, []);

  const resetPasskey = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_CRED);
    setAuthStatus('unregistered');
    setStatusMessage('Biometrik Belum Didaftarkan');
  }, []);

  return (
    <FaceIdContext.Provider
      value={{
        isLocked,
        lockDashboard,
        unlockDashboard,
        resetPasskey,
      }}
    >
      {/* Protected Dashboard Content */}
      <div
        className={`w-full h-full transition-all duration-500 ${
          isLocked
            ? 'filter blur-2xl pointer-events-none select-none opacity-40 scale-98'
            : 'filter-none pointer-events-auto opacity-100 scale-100'
        }`}
      >
        {children}
      </div>

      {/* Apple OLED Black Face ID Lock Screen */}
      {isLocked && (
        <div className="fixed inset-0 z-[9999] bg-[#000000] text-white flex flex-col justify-between items-center px-6 py-10 sm:py-14 select-none font-sans overflow-hidden">
          {/* Top Bar: Padlock & Status */}
          <div className="flex flex-col items-center gap-2 pt-2 animate-fade-in">
            <div className="w-10 h-10 rounded-full bg-white/[0.08] backdrop-blur-md flex items-center justify-center border border-white/[0.06] shadow-inner">
              {authStatus === 'success' ? (
                <Check className="w-5 h-5 text-[#30D158] animate-apple-spring stroke-[3]" />
              ) : (
                <Lock
                  className={`w-5 h-5 transition-all duration-300 ${
                    authStatus === 'error'
                      ? 'text-[#FF453A]'
                      : authStatus === 'scanning'
                      ? 'text-[#30D158]'
                      : 'text-white/80'
                  }`}
                />
              )}
            </div>
            <span className="text-[11px] tracking-widest uppercase font-semibold text-white/40">
              Leads Machine Security
            </span>
          </div>

          {/* Center Stage: Face ID Viewfinder OR PIN Keypad */}
          {viewMode === 'faceid' ? (
            <div
              className={`flex flex-col items-center justify-center my-auto transition-all ${
                isShaking ? 'animate-shake' : ''
              }`}
            >
              {/* Apple Circular Face ID Viewfinder */}
              <div
                onClick={() => {
                  if (authStatus === 'unregistered') {
                    handleRegister();
                  } else {
                    handleAuthenticate();
                  }
                }}
                className={`relative w-48 h-48 sm:w-56 sm:h-56 rounded-full flex items-center justify-center cursor-pointer transition-all duration-500 group ${
                  authStatus === 'success'
                    ? 'bg-[#30D158]/10 shadow-[0_0_50px_rgba(48,209,88,0.35)]'
                    : authStatus === 'error'
                    ? 'bg-[#FF453A]/10 shadow-[0_0_50px_rgba(255,69,58,0.25)]'
                    : authStatus === 'scanning'
                    ? 'bg-white/[0.03] shadow-[0_0_40px_rgba(48,209,88,0.15)]'
                    : 'bg-white/[0.02] hover:bg-white/[0.05]'
                }`}
              >
                {/* Rotating Circular Track / Radar Scanner */}
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox="0 0 100 100"
                >
                  {/* Subtle Background Track */}
                  <circle
                    cx="50"
                    cy="50"
                    r="46"
                    className="stroke-white/[0.1] fill-none"
                    strokeWidth="1.8"
                  />

                  {/* Active Scanning / Success Ring */}
                  {authStatus === 'scanning' && (
                    <circle
                      cx="50"
                      cy="50"
                      r="46"
                      className="stroke-[#30D158] fill-none animate-spin origin-center"
                      strokeWidth="2.8"
                      strokeDasharray="90 200"
                      strokeLinecap="round"
                    />
                  )}

                  {authStatus === 'success' && (
                    <circle
                      cx="50"
                      cy="50"
                      r="46"
                      className="stroke-[#30D158] fill-none animate-apple-spring"
                      strokeWidth="3.2"
                      strokeDasharray="300"
                      strokeDashoffset="0"
                    />
                  )}

                  {authStatus === 'error' && (
                    <circle
                      cx="50"
                      cy="50"
                      r="46"
                      className="stroke-[#FF453A] fill-none"
                      strokeWidth="2.8"
                    />
                  )}
                </svg>

                {/* Laser Scanning Beam (Apple green sweep) */}
                {authStatus === 'scanning' && (
                  <div className="absolute inset-x-8 h-[2px] bg-gradient-to-r from-transparent via-[#30D158] to-transparent shadow-[0_0_14px_#30D158] animate-scan-laser pointer-events-none" />
                )}

                {/* Center Content: Face Glyph or Success Checkmark */}
                {authStatus === 'success' ? (
                  <div className="w-20 h-20 rounded-full bg-[#30D158] flex items-center justify-center text-black shadow-[0_0_35px_rgba(48,209,88,0.7)] animate-apple-spring">
                    <Check className="w-10 h-10 stroke-[3.5]" />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <AppleFaceIdGlyph status={authStatus} className="w-24 h-24" />
                  </div>
                )}
              </div>

              {/* Status Indicator Typography */}
              <div className="mt-8 flex flex-col items-center gap-1.5 text-center">
                <h2
                  className={`text-[19px] sm:text-[21px] font-semibold tracking-tight transition-colors duration-200 ${
                    authStatus === 'success'
                      ? 'text-[#30D158]'
                      : authStatus === 'error'
                      ? 'text-[#FF453A]'
                      : 'text-white'
                  }`}
                >
                  {statusMessage}
                </h2>

                <p className="text-[13px] text-white/50 max-w-xs leading-relaxed">
                  {authStatus === 'unregistered'
                    ? 'Daftarkan Face ID atau Windows Hello perangkat ini untuk login biometrik cepat.'
                    : authStatus === 'scanning'
                    ? 'Arahkan wajah ke kamera atau sentuh sensor biometrik Anda.'
                    : authStatus === 'error'
                    ? 'Pastikan wajah berada di dalam lingkaran, atau gunakan PIN darurat.'
                    : 'Sentuh ikon di atas atau tekan tombol untuk memindai wajah.'}
                </p>
              </div>

              {/* Action Buttons for Face ID */}
              <div className="mt-6 flex flex-col items-center gap-3 w-full max-w-xs">
                {authStatus === 'unregistered' ? (
                  <button
                    type="button"
                    onClick={handleRegister}
                    className="w-full h-12 rounded-full bg-[#30D158] hover:bg-[#28B84D] active:scale-98 text-black font-semibold text-[14px] flex items-center justify-center gap-2 transition shadow-[0_0_25px_rgba(48,209,88,0.35)] cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 fill-black" />
                    <span>Daftarkan Perangkat Ini</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleAuthenticate}
                    className="w-full h-11 rounded-full bg-white/[0.12] hover:bg-white/[0.2] active:scale-98 text-white font-medium text-[13px] flex items-center justify-center gap-2 transition border border-white/[0.1] backdrop-blur-md cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${
                        authStatus === 'scanning' ? 'animate-spin text-[#30D158]' : ''
                      }`}
                    />
                    <span>
                      {authStatus === 'error'
                        ? 'Coba Pindai Lagi'
                        : authStatus === 'scanning'
                        ? 'Sedang Memindai…'
                        : 'Pindai Wajah Sekarang'}
                    </span>
                  </button>
                )}

                {authStatus === 'error' && (
                  <button
                    type="button"
                    onClick={resetPasskey}
                    className="text-[11px] text-white/40 hover:text-white/70 transition cursor-pointer underline underline-offset-4"
                  >
                    Daftarkan ulang biometrik perangkat ini
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Apple iOS Numeric PIN Keypad Screen */
            <div className="flex flex-col items-center justify-center my-auto w-full max-w-xs animate-fade-in">
              <div className="text-center mb-6">
                <h2 className="text-[20px] font-semibold tracking-tight text-white mb-1">
                  Masukkan Kode Sandi
                </h2>
                <p className="text-[12px] text-white/50">
                  Gunakan PIN 4 digit untuk membuka akses dashboard
                </p>
              </div>

              {/* 4 Passcode Dots */}
              <div
                className={`flex items-center justify-center gap-4 mb-8 ${
                  isShaking || pinError ? 'animate-shake' : ''
                }`}
              >
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                      pin.length > idx
                        ? pinError
                          ? 'bg-[#FF453A] scale-110 shadow-[0_0_12px_#FF453A]'
                          : 'bg-white scale-100 shadow-[0_0_8px_rgba(255,255,255,0.7)]'
                        : 'border border-white/40 bg-transparent'
                    }`}
                  />
                ))}
              </div>

              {/* iOS Circular Keypad Grid */}
              <div className="grid grid-cols-3 gap-x-5 gap-y-4 mb-4">
                {[
                  { n: '1', sub: '' },
                  { n: '2', sub: 'ABC' },
                  { n: '3', sub: 'DEF' },
                  { n: '4', sub: 'GHI' },
                  { n: '5', sub: 'JKL' },
                  { n: '6', sub: 'MNO' },
                  { n: '7', sub: 'PQRS' },
                  { n: '8', sub: 'TUV' },
                  { n: '9', sub: 'WXYZ' },
                ].map((item) => (
                  <button
                    key={item.n}
                    type="button"
                    onClick={() => handlePinInput(item.n)}
                    className="w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-white/[0.08] hover:bg-white/[0.18] active:bg-white/[0.28] active:scale-95 backdrop-blur-md text-white font-normal flex flex-col items-center justify-center transition border border-white/[0.06] cursor-pointer"
                  >
                    <span className="text-[24px] leading-tight font-light">{item.n}</span>
                    {item.sub && (
                      <span className="text-[9px] tracking-widest text-white/40 font-medium">
                        {item.sub}
                      </span>
                    )}
                  </button>
                ))}

                {/* Bottom Row */}
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('faceid');
                    setPin('');
                  }}
                  className="w-18 h-18 sm:w-20 sm:h-20 rounded-full text-white/60 hover:text-white text-[12px] font-medium flex items-center justify-center transition cursor-pointer"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={() => handlePinInput('0')}
                  className="w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-white/[0.08] hover:bg-white/[0.18] active:bg-white/[0.28] active:scale-95 backdrop-blur-md text-white font-normal flex flex-col items-center justify-center transition border border-white/[0.06] cursor-pointer"
                >
                  <span className="text-[24px] leading-tight font-light">0</span>
                </button>

                <button
                  type="button"
                  onClick={handlePinDelete}
                  className="w-18 h-18 sm:w-20 sm:h-20 rounded-full text-white/70 hover:text-white flex items-center justify-center transition cursor-pointer active:scale-95"
                >
                  <Delete className="w-6 h-6 stroke-[1.8]" />
                </button>
              </div>

              <div className="text-center text-[11px] text-white/30">
                PIN bawaan: <span className="font-mono text-white/60">{DEFAULT_PIN}</span>
              </div>
            </div>
          )}

          {/* Bottom Footer: Fallback Selector */}
          <div className="w-full flex justify-center pb-2 animate-fade-in">
            {viewMode === 'faceid' ? (
              <button
                type="button"
                onClick={() => setViewMode('pin')}
                className="text-[13px] text-white/60 hover:text-white transition flex items-center gap-2 py-2 px-4 rounded-full hover:bg-white/[0.06] cursor-pointer"
              >
                <KeyRound className="w-4 h-4 text-white/50" />
                <span>Gunakan PIN Darurat</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setViewMode('faceid')}
                className="text-[13px] text-[#30D158] hover:text-[#28B84D] transition flex items-center gap-1.5 py-2 px-4 rounded-full hover:bg-white/[0.06] cursor-pointer font-medium"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Kembali ke Pindai Face ID</span>
              </button>
            )}
          </div>
        </div>
      )}
    </FaceIdContext.Provider>
  );
}

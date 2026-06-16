import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Copy, Check, Trash2, Square, AlertCircle } from 'lucide-react';
import { useClipboard } from '@/hooks/useClipboard';

const LANGUAGES = [
  { label: 'English (US)',      value: 'en-US' },
  { label: 'English (UK)',      value: 'en-GB' },
  { label: 'Urdu',              value: 'ur-PK' },
  { label: 'Spanish',           value: 'es-ES' },
  { label: 'French',            value: 'fr-FR' },
  { label: 'German',            value: 'de-DE' },
  { label: 'Arabic',            value: 'ar-SA' },
  { label: 'Chinese (Mandarin)',value: 'zh-CN' },
  { label: 'Hindi',             value: 'hi-IN' },
  { label: 'Portuguese',        value: 'pt-BR' },
];

const SpeechRecognition =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

export default function SpeechToText() {
  const [isRecording, setIsRecording]   = useState(false);
  const [transcript, setTranscript]     = useState('');
  const [interim, setInterim]           = useState('');
  const [lang, setLang]                 = useState('en-US');
  const [error, setError]               = useState('');
  const [wordCount, setWordCount]       = useState(0);
  const recogRef = useRef(null);
  const { copied, copy } = useClipboard();

  const supported = !!SpeechRecognition;

  useEffect(() => {
    const words = transcript.trim().split(/\s+/).filter(Boolean).length;
    setWordCount(words);
  }, [transcript]);

  function startRecording() {
    if (!SpeechRecognition) return;
    setError('');
    const recog = new SpeechRecognition();
    recog.continuous    = true;
    recog.interimResults = true;
    recog.lang          = lang;
    recog.maxAlternatives = 1;

    recog.onstart  = () => setIsRecording(true);
    recog.onend    = () => { setIsRecording(false); setInterim(''); };
    recog.onerror  = (e) => {
      setIsRecording(false);
      setInterim('');
      if (e.error === 'not-allowed') setError('Microphone access denied. Please allow microphone access in your browser settings.');
      else if (e.error === 'no-speech') setError('No speech detected. Please speak louder or check your microphone.');
      else setError(`Error: ${e.error}. Please try again.`);
    };

    recog.onresult = (e) => {
      let finalText = '';
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += text + ' ';
        else interimText += text;
      }
      if (finalText) setTranscript(prev => prev + finalText);
      setInterim(interimText);
    };

    recogRef.current = recog;
    recog.start();
  }

  function stopRecording() {
    recogRef.current?.stop();
    setIsRecording(false);
    setInterim('');
  }

  function clearAll() {
    stopRecording();
    setTranscript('');
    setInterim('');
    setError('');
  }

  return (
    <div className="panel-card shadow-lg">
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">

        {/* ── LEFT: Controls ────────────────────────────────── */}
        <div className="flex flex-col">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <Mic className="w-4 h-4 text-text-muted" />
              <span className="text-sm font-semibold text-text-primary">Recording Controls</span>
            </div>
          </div>

          <div className="flex-1 p-6 flex flex-col items-center justify-center gap-6">
            {!supported && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm flex items-start gap-2.5 w-full">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Speech recognition is not supported in your browser. Please use Chrome or Edge for best results.</span>
              </div>
            )}

            {/* Language selector */}
            <div className="w-full">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2 block">
                Language
              </label>
              <select
                value={lang}
                onChange={e => setLang(e.target.value)}
                disabled={isRecording}
                className="input-field"
              >
                {LANGUAGES.map(l => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>

            {/* Record button */}
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={!supported}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg ${
                  isRecording
                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-200 scale-110 ring-4 ring-red-200'
                    : 'bg-accent hover:bg-accent-hover text-white hover:shadow-xl'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
                aria-label={isRecording ? 'Stop recording' : 'Start recording'}
              >
                {isRecording
                  ? <Square className="w-7 h-7 fill-current" />
                  : <Mic className="w-7 h-7" />
                }
              </button>
              <span className={`text-sm font-semibold ${isRecording ? 'text-red-500' : 'text-text-secondary'}`}>
                {isRecording ? 'Recording… click to stop' : 'Click to start'}
              </span>
              {isRecording && (
                <span className="flex items-center gap-1.5 text-xs text-red-400">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  Live
                </span>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs flex items-start gap-2 w-full">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Transcript ─────────────────────────────── */}
        <div className="flex flex-col">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-text-primary">Transcript</span>
              {wordCount > 0 && (
                <span className="text-xs text-text-muted bg-surface-2 border border-border px-2 py-0.5 rounded-full">
                  {wordCount} words
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {transcript && (
                <>
                  <button onClick={() => copy(transcript)} className="btn-ghost">
                    {copied ? <><Check className="w-3.5 h-3.5 text-violet-600" />Copied!</> : <><Copy className="w-3.5 h-3.5" />Copy</>}
                  </button>
                  <button onClick={clearAll} className="btn-ghost text-red-400 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex-1 p-4" style={{ minHeight: '300px' }}>
            {!transcript && !interim && (
              <div className="h-full flex flex-col items-center justify-center text-center py-8">
                <div className="w-14 h-14 bg-surface-2 rounded-2xl flex items-center justify-center mb-3 border border-border">
                  <MicOff className="w-6 h-6 text-text-light" />
                </div>
                <p className="text-sm font-semibold text-text-secondary">Transcript appears here</p>
                <p className="text-xs text-text-muted mt-1">Start recording to begin</p>
              </div>
            )}

            {(transcript || interim) && (
              <div className="h-full">
                <textarea
                  readOnly
                  value={transcript + (interim ? interim : '')}
                  className="tool-textarea bg-accent-subtle/25 border-accent/20 h-full"
                  style={{ minHeight: '260px' }}
                  aria-live="polite"
                />
                {interim && (
                  <p className="text-xs text-text-muted mt-2 italic">
                    Listening…
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

"""
Whisper transcription script — called by server/routes/subtitles.js
Outputs a single JSON line to stdout, then exits.

Usage:
  python transcribe.py --audio <path.wav> --language <en|ur> --model <base|small>
"""
import sys
import io
import json
import argparse

# Force UTF-8 on Windows (default console is CP1252, which can't encode Arabic script)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')


def fmt_srt(s):
    h = int(s // 3600)
    m = int((s % 3600) // 60)
    sec = int(s % 60)
    ms = int((s % 1) * 1000)
    return f"{h:02d}:{m:02d}:{sec:02d},{ms:03d}"


def fmt_vtt(s):
    h = int(s // 3600)
    m = int((s % 3600) // 60)
    sec = int(s % 60)
    ms = int((s % 1) * 1000)
    return f"{h:02d}:{m:02d}:{sec:02d}.{ms:03d}"


def to_srt(segments):
    lines = []
    for i, seg in enumerate(segments, 1):
        lines.append(f"{i}")
        lines.append(f"{fmt_srt(seg['start'])} --> {fmt_srt(seg['end'])}")
        lines.append(seg['text'].strip())
        lines.append("")
    return "\n".join(lines).strip()


def to_vtt(segments):
    lines = ["WEBVTT", ""]
    for seg in segments:
        lines.append(f"{fmt_vtt(seg['start'])} --> {fmt_vtt(seg['end'])}")
        lines.append(seg['text'].strip())
        lines.append("")
    return "\n".join(lines).strip()


def out(data):
    print(json.dumps(data, ensure_ascii=False), flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--audio',         default='')
    parser.add_argument('--language',      default='en')
    parser.add_argument('--model',         default='base')
    parser.add_argument('--download-only', action='store_true',
                        help='Just download/cache the model then exit')
    args = parser.parse_args()

    # ── Pre-download mode (server warmup) ─────────────────────────
    if args.download_only:
        try:
            import whisper
            whisper.load_model(args.model)
            out({'status': 'ready', 'model': args.model})
        except ImportError:
            out({'error': 'WHISPER_NOT_INSTALLED'})
            sys.exit(1)
        except Exception as e:
            out({'error': 'DOWNLOAD_FAILED', 'detail': str(e)})
            sys.exit(1)
        sys.exit(0)

    try:
        import whisper
    except ImportError:
        out({'error': 'WHISPER_NOT_INSTALLED'})
        sys.exit(1)

    try:
        model  = whisper.load_model(args.model)
        result = model.transcribe(
            args.audio,
            language=args.language,
            task='transcribe',
            fp16=False,
            beam_size=5,
            best_of=5,
            temperature=0,
            condition_on_previous_text=True,
            verbose=False,
        )
    except FileNotFoundError:
        out({'error': 'AUDIO_NOT_FOUND'})
        sys.exit(1)
    except Exception as e:
        msg = str(e).lower()
        if 'no audio' in msg or 'invalid data' in msg or 'moov atom' in msg:
            out({'error': 'NO_AUDIO'})
        else:
            out({'error': 'TRANSCRIPTION_FAILED', 'detail': str(e)})
        sys.exit(1)

    segments = result.get('segments', [])
    if not segments:
        out({'error': 'NO_SPEECH'})
        sys.exit(2)

    out({
        'srt':  to_srt(segments),
        'vtt':  to_vtt(segments),
        'text': result.get('text', '').strip(),
    })
    sys.exit(0)


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Record the game's voice lines (js/lines.js) as voice/<id>.mp3, in Slop Skies' format.

Slop Skies' radio lines (reference/slop-skies/voice/) are short mono mp3s: 32 kHz, 56 kbps, 1.5 to 3 seconds,
loudness-matched, with no silence at either end. This script asks a text-to-speech service for each line, then uses
ffmpeg to trim, normalise and encode it the same way, and writes voice/index.json (the list the game checks before it
tries to play a file; lines without a file fall back to the "babble" placeholder voice).

Providers (pick one with --provider):
  elevenlabs  ELEVENLABS_API_KEY; voices are ids from your ElevenLabs voice library (or Voice Design)
  openai      OPENAI_API_KEY; gpt-4o-mini-tts, with a speaking-style instruction per speaker

Usage:
  python3 tools/gen_voice.py --provider openai                 # every line that has no file yet
  python3 tools/gen_voice.py --provider openai --only disp.good # lines whose id starts with disp.good
  python3 tools/gen_voice.py --provider elevenlabs --force      # re-record everything
  python3 tools/gen_voice.py --index-only                       # just rebuild voice/index.json

Edit SPEAKERS below to choose the voices. Use designed or stock voices, not clones of real people.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LINES_JS = os.path.join(ROOT, "js", "lines.js")
OUT = os.path.join(ROOT, "voice")

# who says what: a voice per speaker for each provider, and how they should sound
SPEAKERS = {
    "DISPATCH": {
        "style": "A bubbly, kind fleet dispatcher on a two-way radio, like Karl, the friendly radio voice of Slop Skies. "
        "Bright and playful, a little cheeky, always encouraging and never bossy or shouty, smiling as they talk.",
        "openai": {"voice": "coral"},
        "elevenlabs": {"voice_id": os.environ.get("VOICE_DISPATCH", "")},
    },
    "RIDER": {
        "style": "A robotaxi passenger in San Francisco, comic and expressive. Play the character the line suggests: "
        "a delighted tourist, a sweet grandma, a stressed founder late for standup, a deadpan local.",
        "openai": {"voice": "ballad"},
        "elevenlabs": {"voice_id": os.environ.get("VOICE_RIDER", "")},
    },
}


def load_lines():
    s = open(LINES_JS, encoding="utf-8").read()
    a, b = s.index("/*LINES*/") + len("/*LINES*/"), s.index("/*END*/")
    return json.loads(s[a:b])


def post(url, headers, body):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def tts_openai(text, spk):
    key = os.environ["OPENAI_API_KEY"]
    return post(
        "https://api.openai.com/v1/audio/speech",
        {"Authorization": "Bearer " + key, "Content-Type": "application/json"},
        {
            "model": "gpt-4o-mini-tts",
            "voice": spk["openai"]["voice"],
            "input": text,
            "instructions": spk["style"],
            "response_format": "wav",
        },
    )


def tts_elevenlabs(text, spk):
    key = os.environ["ELEVENLABS_API_KEY"]
    vid = spk["elevenlabs"]["voice_id"]
    if not vid:
        sys.exit("Set VOICE_DISPATCH / VOICE_RIDER to ElevenLabs voice ids (or edit SPEAKERS).")
    return post(
        "https://api.elevenlabs.io/v1/text-to-speech/" + vid + "?output_format=mp3_44100_128",
        {"xi-api-key": key, "Content-Type": "application/json"},
        {
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {"stability": 0.35, "similarity_boost": 0.8, "style": 0.55, "use_speaker_boost": True},
        },
    )


def encode(raw, dest):
    """Trim the silence at both ends, match loudness, and encode like Slop's: 32 kHz mono mp3 at 56 kbps."""
    with tempfile.NamedTemporaryFile(suffix=".bin", delete=False) as f:
        f.write(raw)
        src = f.name
    trim = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03"
    af = ",".join([trim, "areverse", trim, "areverse", "loudnorm=I=-16:TP=-1.5:LRA=7", "apad=pad_dur=0.08"])
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-af", af, "-ac", "1", "-ar", "32000",
             "-codec:a", "libmp3lame", "-b:a", "56k", dest],
            check=True,
        )
    finally:
        os.unlink(src)


def write_index(lines):
    have = sorted(k for k in lines if os.path.exists(os.path.join(OUT, k + ".mp3")))
    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as f:
        json.dump({"lines": have}, f, indent=1)
        f.write("\n")
    print(f"voice/index.json: {len(have)} of {len(lines)} lines recorded")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--provider", choices=["openai", "elevenlabs"])
    ap.add_argument("--only", default="", help="only ids starting with this")
    ap.add_argument("--force", action="store_true", help="re-record lines that already have a file")
    ap.add_argument("--index-only", action="store_true")
    args = ap.parse_args()
    lines = load_lines()
    os.makedirs(OUT, exist_ok=True)
    if not args.index_only:
        if not args.provider:
            ap.error("--provider is required (or pass --index-only)")
        if not shutil.which("ffmpeg"):
            sys.exit("ffmpeg is needed to trim and encode the lines")
        tts = tts_openai if args.provider == "openai" else tts_elevenlabs
        for k, (who, text) in lines.items():
            dest = os.path.join(OUT, k + ".mp3")
            if not k.startswith(args.only) or (os.path.exists(dest) and not args.force):
                continue
            print(f"{k:24} {who:9} {text}")
            encode(tts(text, SPEAKERS[who]), dest)
    write_index(lines)


if __name__ == "__main__":
    main()

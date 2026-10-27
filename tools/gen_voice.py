#!/usr/bin/env python3
"""Record the game's voice lines (js/lines.js) as voice/<id>.mp3, in Slop Skies' format.

Slop Skies' radio lines (reference/slop-skies/voice/) are short mono mp3s: 32 kHz, 56 kbps, 1.5 to 3 seconds,
loudness-matched, with no silence at either end. This script asks a text-to-speech service for each line, then uses
ffmpeg to trim, normalise and encode it the same way, and writes voice/index.json (the list the game checks before it
tries to play a file; lines without a file fall back to the "babble" placeholder voice).

Providers (pick one with --provider):
  elevenlabs  ELEVENLABS_API_KEY; eleven_v3, acting out the [audio tags] in tools/voice_direction.json
  openai      OPENAI_API_KEY; gpt-4o-mini-tts, with a speaking-style instruction per speaker

Each speaker in js/lines.js (Dispatch and the seven riders) has their own voice and personality: see SPEAKERS below.

Usage:
  python3 tools/gen_voice.py --provider openai                 # every line that has no file yet
  python3 tools/gen_voice.py --provider openai --only disp.good # lines whose id starts with disp.good
  python3 tools/gen_voice.py --provider elevenlabs --force      # re-record everything
  python3 tools/gen_voice.py --index-only                       # just rebuild voice/index.json
  python3 tools/gen_voice.py --from-dir takes/                  # encode takes saved as takes/<id>.mp3 (e.g. from
                                                                # the ElevenLabs app) instead of calling a service

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

# who says what: a voice per speaker for each provider, and how they should sound. The ElevenLabs voices are the ones
# the recorded lines in voice/ use: Dispatch, Tourist and Influencer were made with Voice Design (the plan's three
# custom voices), the rest are ElevenLabs' pre-made voices. Override any of them with VOICE_<SPEAKER>=<voice id>.
def _spk(name, style, openai_voice, elevenlabs_id):
    return {
        "style": style,
        "openai": {"voice": openai_voice},
        "elevenlabs": {"voice_id": os.environ.get("VOICE_" + name, elevenlabs_id)},
    }


SPEAKERS = {
    "DISPATCH": _spk(
        "DISPATCH",
        "A sarcastic, bratty young dispatcher with a high-pitched voice. Snarky, smug and teasing, a little whiny, "
        "rolling his eyes as he talks, but still cheering the crew on in his own backhanded way.",
        "echo",
        "njX9gv1g1XDQKbuzpjys",  # "Waymo Care - Dispatch (bratty)" (Voice Design)
    ),
    "TOURIST": _spk(
        "TOURIST",
        "A wide-eyed Midwestern dad from Ohio on his first trip to San Francisco. Loud, earnest and easily amazed, "
        "flustered and indignant in a harmless, lovable way.",
        "ash",
        "6ui9ZqWTggkoymSPMSag",  # "Waymo Care - Tourist" (Voice Design)
    ),
    "INFLUENCER": _spk(
        "INFLUENCER",
        "A dramatic young influencer with a Californian vocal fry. Slow and theatrical: every small inconvenience is a "
        "crisis. Exasperated and self-absorbed, but funny.",
        "shimmer",
        "paGnAuwQGTexFrQQrwfB",  # "Waymo Care - Influencer" (Voice Design)
    ),
    "GRANDMA": _spk(
        "GRANDMA",
        "A sweet, slightly confused grandmother in her late seventies. Soft, warm and polite, calls everyone dear, "
        "chuckles at her own jokes, curious rather than worried.",
        "sage",
        "XrExE9yKIg1WjnnlVkGX",  # "Matilda" (ElevenLabs stock voice), aged up with [elderly voice]
    ),
    "FOUNDER": _spk(
        "FOUNDER",
        "A stressed, over-caffeinated startup founder, always late for standup. Fast, clipped and a bit breathless; "
        "impatient but never mean.",
        "nova",
        "EXAVITQu4vr4xnSDxMaL",  # "Sarah" (ElevenLabs stock voice)
    ),
    "LOCAL": _spk(
        "LOCAL",
        "A jaded San Francisco local who has seen it all. Low, gravelly and unimpressed; flat, deadpan and dry, with "
        "weary pauses.",
        "onyx",
        "N2lVS1w4EtoT3dr4eOWO",  # "Callum" (ElevenLabs stock voice)
    ),
    "ARTIST": _spk(
        "ARTIST",
        "A dreamy, mellow Mission District artist. Airy and laid-back, slow and wondering, finds everything fascinating "
        "and a little cosmic.",
        "fable",
        "SAz9YHcvj6GT2YYXdXww",  # "River" (ElevenLabs stock voice)
    ),
    "STUDENT": _spk(
        "STUDENT",
        "A frazzled, apologetic college student. Young, fast and sheepish, with a nervous laugh; scatterbrained but "
        "good-natured.",
        "echo",
        "TX3LPaxmHKxFdv7VOQHJ",  # "Liam" (ElevenLabs stock voice)
    ),
}

# ElevenLabs' v3 and v4 models act out [audio tags]: this is how each line was performed. The tags go to the text-to-
# speech service only; the caption in the game is the plain line from js/lines.js. Lines not listed are read as written.
DIRECTION_JSON = os.path.join(ROOT, "tools", "voice_direction.json")


def load_direction():
    if not os.path.exists(DIRECTION_JSON):
        return {}
    with open(DIRECTION_JSON, encoding="utf-8") as f:
        return json.load(f)


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
    if not spk["elevenlabs"]["voice_id"]:
        sys.exit("No ElevenLabs voice for this speaker yet: set VOICE_<SPEAKER> (or edit SPEAKERS).")
    return post(
        "https://api.elevenlabs.io/v1/text-to-speech/" + spk["elevenlabs"]["voice_id"] + "?output_format=mp3_44100_128",
        {"xi-api-key": key, "Content-Type": "application/json"},
        {"text": text, "model_id": "eleven_v3"},
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
    ap.add_argument("--from-dir", help="encode <dir>/<id>.mp3 takes instead of calling a service")
    ap.add_argument("--index-only", action="store_true")
    args = ap.parse_args()
    lines = load_lines()
    direction = load_direction()
    os.makedirs(OUT, exist_ok=True)
    if not args.index_only:
        if not args.provider and not args.from_dir:
            ap.error("--provider or --from-dir is required (or pass --index-only)")
        if not shutil.which("ffmpeg"):
            sys.exit("ffmpeg is needed to trim and encode the lines")
        for k, (who, text) in lines.items():
            dest = os.path.join(OUT, k + ".mp3")
            if not k.startswith(args.only) or (os.path.exists(dest) and not args.force):
                continue
            if args.from_dir:
                take = os.path.join(args.from_dir, k + ".mp3")
                if not os.path.exists(take):
                    continue
                print(f"{k:24} {who:10} {take}")
                with open(take, "rb") as f:
                    encode(f.read(), dest)
            elif args.provider == "openai":
                print(f"{k:24} {who:10} {text}")
                encode(tts_openai(text, SPEAKERS[who]), dest)
            else:
                said = direction.get(k, text)
                print(f"{k:24} {who:10} {said}")
                encode(tts_elevenlabs(said, SPEAKERS[who]), dest)
    write_index(lines)


if __name__ == "__main__":
    main()

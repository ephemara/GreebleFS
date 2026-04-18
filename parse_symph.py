import re
with open('src-tauri/src/audio_engine.rs', 'r') as f:
    text = f.read()

match = re.search(r'fn decode_audio_file.*?Ok\(DecodedAudioData', text, re.DOTALL)
if match:
    print(match.group(0))

import logging
import subprocess
import os
from io import BytesIO
from os import getcwd
import torch

import torchaudio
from pyannote.audio import Pipeline

diar_pipeline = Pipeline.from_pretrained(
    "pyannote/speaker-diarization",
    use_auth_token=os.environ.get("HUGGINGFACE_TOKEN"),
    cache_dir=os.environ.get("HUGGINGFACE_CACHE_DIR", getcwd() + "/.cache"),
)


# UTILS
async def stream_chunks(bucket, file_id, chunk_duration_s, chunk_duration):
    grid_out = await bucket.open_download_stream(file_id)
    buf = bytearray()
    time_offset = 0.0

    while True:
        chunk = await grid_out.read(4096)
        if not chunk:
            break
        buf.extend(chunk)

        # check if enough for one chunk
        if len(buf) >= chunk_duration_s * 2:
            current_chunk = bytes(buf[: chunk_duration_s * 2])
            buf = buf[chunk_duration_s * 2 :]
            yield current_chunk, time_offset
            time_offset += chunk_duration

    # final chunk
    if buf:
        yield bytes(buf), time_offset


def bytes_to_waveform(raw_bytes, sample_rate):
    waveform, sr = decode_with_ffmpeg(raw_bytes, sample_rate)
    if sr != sample_rate:
        waveform = torchaudio.functional.resample(waveform, sr, sample_rate)
    return waveform.squeeze().numpy()


def match_speaker(diar_timeline, start, end):
    overlaps = []
    for d in diar_timeline:
        latest_start = max(start, d["start"])
        earliest_end = min(end, d["end"])
        overlap = max(0.0, earliest_end - latest_start)
        if overlap > 0:
            overlaps.append((overlap, d["speaker"]))
    return max(overlaps, default=(0, "UNKNOWN"))[1]


# MAIN PIPELINE
async def transcribe_from_gridfs(
    bucket, file_id, whisper_model, *, sample_rate, chunk_duration
):
    results = []

    async for raw_bytes, offset in stream_chunks(
        bucket, file_id, sample_rate * chunk_duration, chunk_duration
    ):
        logging.info(f"transcribing chunk of {len(raw_bytes)} bytes")
        waveform_np = bytes_to_waveform(raw_bytes, sample_rate)

        # Run diarization
        if waveform_np.ndim == 1:
            waveform_tensor = torch.from_numpy(waveform_np).unsqueeze(0)
        else:
            waveform_tensor = torch.from_numpy(waveform_np)

        diarization = diar_pipeline(
            {"waveform": waveform_tensor, "sample_rate": sample_rate}
        )

        diar_segments = [
            {"start": turn.start, "end": turn.end, "speaker": speaker}
            for turn, _, speaker in diarization.itertracks(yield_label=True)
        ]

        logging.info("diarization finished")

        # Run transcription
        segments, info = whisper_model.transcribe(waveform_np, task="translate")
        text_segments, _ = whisper_model.transcribe(waveform_np, task="transcribe")

        for seg, text in zip(segments, text_segments):
            speaker = match_speaker(diar_segments, seg.start, seg.end)
            results.append(
                {
                    "start": offset + seg.start,
                    "end": offset + seg.end,
                    "trans": seg.text.strip(),
                    "text": text.text.strip(),
                    "lang": info.language,
                    "speaker": speaker,
                }
            )

    logging.info("transcription is ready")
    return results


def decode_with_ffmpeg(raw_bytes, sample_rate=16000):
    process = subprocess.Popen(
        [
            "ffmpeg",
            "-f",
            "s16le",  # Format: 16-bit signed PCM
            "-ac",
            "1",  # Mono
            "-ar",
            str(sample_rate),  # Sampling rate
            "-i",
            "pipe:0",
            "-f",
            "wav",
            "pipe:1",
        ],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    wav_bytes, _ = process.communicate(input=raw_bytes)
    return torchaudio.load(BytesIO(wav_bytes))  # waveform, sr

import asyncio
import datetime
import logging
import queue
import struct
import threading
import time

import pyaudio
from bson import ObjectId
from faster_whisper import WhisperModel
from motor.motor_asyncio import AsyncIOMotorGridFSBucket

from scribe_agent.transcription import transcribe_from_gridfs
from scribe_config import create_mongo_connection


class Recorder:

    def __init__(self):
        self.mongo_client = create_mongo_connection()
        self.db = self.mongo_client["scribe"]
        self.fs_bucket = AsyncIOMotorGridFSBucket(self.db, bucket_name="scribe.audios")

        # Audio config
        self.format = pyaudio.paInt16
        self.channels = int(1)
        self.rate = int(16000)
        self.chunk = int(1024)
        self.sample_width = int(2)  # 16-bit = 2 bytes

        self.audio = pyaudio.PyAudio()
        self.stream = True
        self.recording = False

        self.audio_queue = queue.Queue()
        self.record_thread = None

        self.transcribe_model = WhisperModel("base", device="cpu", compute_type="int8")

        # self._loop = asyncio.get_running_loop()

    def create_wav_header(self, data_size=0):
        """Create WAV file header with placeholder or actual data size"""
        # For streaming, we'll use a large placeholder size that gets updated later
        if data_size == 0:
            data_size = 0xFFFFFFFF - 36  # Maximum size placeholder

        # Ensure all values are integers
        data_size = int(data_size)
        channels = int(self.channels)
        rate = int(self.rate)
        sample_width = int(self.sample_width)

        header = struct.pack("<4sL4s", b"RIFF", 36 + data_size, b"WAVE")
        header += struct.pack("<4sL", b"fmt ", 16)  # fmt chunk
        header += struct.pack(
            "<HHLLHH",
            1,  # audio format (PCM)
            channels,  # number of channels
            rate,  # sample rate
            rate * channels * sample_width,  # byte rate
            channels * sample_width,  # block align
            16,  # bits per sample
        )
        header += struct.pack("<4sL", b"data", data_size)

        return header

    def _audio_callback(self):
        while self.recording:
            try:
                data = self.stream.read(self.chunk, exception_on_overflow=False)
                timestamp = time.time()
                self.audio_queue.put((data, timestamp))
            except Exception as e:
                logging.error(f"audio recording error: {e}")
                break

    async def start_recording(self, meeting_id: str):

        if self.recording:
            logging.error("already recording")
            return False

        self.stream = self.audio.open(
            format=self.format,
            channels=self.channels,
            rate=self.rate,
            input=True,
            frames_per_buffer=self.chunk,
        )

        self.recording = True

        # start record thread
        self.record_thread = threading.Thread(target=self._audio_callback)
        self.record_thread.daemon = True
        self.record_thread.start()

        grid_in = self.fs_bucket.open_upload_stream(
            f"/recordings/meeting_{meeting_id}_{int(time.time())}.wav",
            metadata={
                "content_type": "audio/wav",
                "sample_rate": self.rate,
                "channels": self.channels,
                "format": "WAV",
                "streaming": True,
                "created_at": datetime.datetime.now(),
            },
        )

        try:
            wav_header = self.create_wav_header()
            await grid_in.write(wav_header)

            total_data_size = 0
            start_time = time.time()

            logging.info("recording...")

            while self.recording:
                try:
                    audio_data, timestamp = self.audio_queue.get(timeout=1)

                    await grid_in.write(audio_data)
                    total_data_size += len(audio_data)

                    if int(time.time() - start_time) % 5 == 0:
                        duration = time.time() - start_time
                        logging.info(
                            f"streaming: duration = {duration:.1f}s, size = {total_data_size} bytes"
                        )
                        await asyncio.sleep(1)  # prevent log spam

                    await asyncio.sleep(0.001)  # prevent CPU block

                except queue.Empty:
                    continue
                except Exception as e:
                    logging.error(f"exception in streaming: {e}")
                    break

        except Exception as error:
            logging.error(f"error in recording: {error}", exc_info=error)
            await grid_in.abort()
            return False

        # close stream
        await grid_in.close()
        file_id = grid_in._id

        logging.info(f"saving recording for meeting {meeting_id} ({file_id})")
        await self.db["meetings"].update_one(
            {"_id": ObjectId(meeting_id)},
            {
                "$set": {
                    "stoppedAt": datetime.datetime.utcnow(),
                    "recordingReady": True,
                    "recordingFile": file_id,
                }
            },
        )

        segments = await transcribe_from_gridfs(
            self.fs_bucket,
            file_id,
            self.transcribe_model,
            sample_rate=self.rate,
            chunk_duration=30,
        )

        await self.db["meetings"].update_one(
            {"_id": ObjectId(meeting_id)},
            {"$set": {"transcriptionSegments": segments, "transcriptionReady": True}},
        )

        return True

    async def stop_recording(self):
        if not self.recording:
            logging.info("recorder is already stopped")
            return False

        logging.info("stopping recording")
        self.recording = False

        return True

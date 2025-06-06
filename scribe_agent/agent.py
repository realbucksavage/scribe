import asyncio
import json
import logging
import signal

from aio_pika import IncomingMessage

from scribe_agent.recorder import Recorder
from scribe_config import create_rabbit_connection

logging.basicConfig(level=logging.INFO)


async def listen_for_commands():
    connection = await create_rabbit_connection()
    channel = await connection.channel()
    await channel.set_qos(prefetch_count=1)

    queue = await channel.declare_queue("scribe-agent", durable=True)
    exchange = await channel.get_exchange("scribe-commands")

    await queue.bind(exchange, "commands")

    recorder = Recorder()
    await queue.consume(_handle_message(recorder))

    logging.info("Waiting for messages. Press Ctrl+C to exit.")
    loop = asyncio.get_running_loop()

    stop_event = asyncio.Event()

    def stop_signal(*_):
        logging.info("Shutting down...")
        stop_event.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop_signal)
        except NotImplementedError:

            def windows_handler():
                logging.info("shutting down (windows fallback)")
                stop_event.set()

            signal.signal(sig, lambda *_: windows_handler())

    await stop_event.wait()
    await connection.close()


def _handle_message(recorder):
    async def _handle_message_internal(message: IncomingMessage):
        async with message.process():
            try:
                msg = json.loads(message.body.decode())
                command = msg.get("cmd")

                logging.info(f"handling command: {command}")
                match command:
                    case "start":
                        asyncio.create_task(
                            recorder.start_recording(msg.get("meeting_id"))
                        )
                    case "stop":
                        await recorder.stop_recording()
                    case "cancel":
                        pass

            except Exception as e:
                logging.error(f"message handling failed: {e}", exc_info=e)

    return _handle_message_internal


def main():
    asyncio.run(listen_for_commands())

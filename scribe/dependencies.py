import fastapi
from aio_pika.abc import AbstractRobustChannel
from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorGridFSBucket


def get_database(request: fastapi.Request) -> AsyncIOMotorDatabase:
    if not request.app.state.mongo_client:
        raise RuntimeError("MongoDB connection not established")

    return request.app.state.mongo_client["scribe"]


def get_rabbitmq_channel(request: fastapi.Request) -> AbstractRobustChannel:
    if not request.app.state.rabbitmq_chan:
        raise RuntimeError("RabbitMQ channel not established")

    return request.app.state.rabbitmq_chan


async def get_audio_bucket(db: AsyncIOMotorDatabase = Depends(get_database)):
    return AsyncIOMotorGridFSBucket(db, bucket_name="scribe.audios")

import logging
import os

from aio_pika import connect_robust
from motor.motor_asyncio import AsyncIOMotorClient


async def create_rabbit_connection():
    amqp_url = os.environ.get("AMQP_ADDRESS")

    logging.debug(f"connecting to AMQP URL {amqp_url}")
    return await connect_robust(amqp_url)

def create_mongo_connection() -> AsyncIOMotorClient:
    mongo_address = os.environ.get("MONGO_ADDRESS")

    logging.debug(f"connecting to MongoDB address {mongo_address}")
    return AsyncIOMotorClient(mongo_address)

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import FileResponse
from starlette.staticfiles import StaticFiles

from scribe_config import create_mongo_connection, create_rabbit_connection

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

exchange_name = "scribe-commands"


async def init_rabbitmq_connection(a: FastAPI):
    a.state.rabbitmq_conn = await create_rabbit_connection()
    a.state.rabbitmq_chan = await app.state.rabbitmq_conn.channel()

    logger.info("RabbitMQ connection established")
    await a.state.rabbitmq_chan.declare_exchange(
        exchange_name, "topic", durable=True, auto_delete=False
    )


async def init_mongodb_connection(a: FastAPI):
    try:
        mongo_client = create_mongo_connection()
        await mongo_client.admin.command("ping")

        logger.info("connected to mongodb")
        a.state.mongo_client = mongo_client
    except Exception as error:
        logger.error(f"mongodb connection failed: {error}")


async def close_connections(a: FastAPI):
    await a.state.rabbitmq_conn.close()
    a.state.mongo_client.close()


@asynccontextmanager
async def lifespan(a: FastAPI):
    await init_rabbitmq_connection(a)
    await init_mongodb_connection(a)
    yield

    await close_connections(a)


from scribe.meetings.api import router as meetings_router

app = FastAPI(title="Scribe Master Server", lifespan=lifespan, redirect_slashes=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(meetings_router)

frontend_path = os.path.join(os.path.dirname(__name__), "scribe-ui", "build")
app.mount(
    "/static",
    StaticFiles(directory=os.path.join(frontend_path, "static")),
    name="static",
)


@app.get("/{full_path:path}")
async def serve_index(full_path: str):
    return FileResponse(os.path.join(frontend_path, "index.html"))

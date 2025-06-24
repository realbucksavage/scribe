# Scribe

A live recoding translater/transcriber.

## Installing

### Dependencies

- Python >= 3.11
- NodeJS
- MongoDB
- RabbitMQ
- A microphone
- A Huggingface.co token - accepted Terms and Conditions of pyannote.audio.

After installing dependencies, either locally or on a Docker container,
run:

```sh
python -m venv .venv

# On windows:
.venv\bin\activate.ps1

# On *nix
. .venv/bin/activate

pip install -e .

cd scribe-ui

npm i && npm run build
```

## Running

The following environment variables are required for running:

- `AMQP_ADDRESS`: The URI of the RabbitMQ server. Example: `http://guest:guest@localhost:5672/`
- `MONGO_ADDRESS`: The URI of the MongoDB server. Example: `mongodb://sc:sc@localhost:27017/scribe`
- `HUGGINGFACE_TOKEN`: The Huggingface.co token.

### The Webserver

After setting up the environment variables and activating the virtual environment:

```sh
run-server
```

The server will be accessible at [http://localhost:8080](http://localhost:8080).

### `Agent`

After setting up the environment variables and activating the virtual environment:

```sh
run-agent
```

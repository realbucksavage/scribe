"""
The Scribe master server.
"""

__version__ = "1.0.0"

def run_server():
    """
    Starts the development server.
    """

    import scribe.server
    import uvicorn

    uvicorn.run(scribe.server.app, host="0.0.0.0", port=8080)

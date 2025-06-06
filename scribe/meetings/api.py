import json
import logging
import time
from datetime import datetime
from typing import List

import aio_pika
from aio_pika.abc import AbstractRobustChannel
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Depends, status
from motor.motor_asyncio import (
    AsyncIOMotorDatabase,
    AsyncIOMotorCollection,
    AsyncIOMotorGridFSBucket,
)
from starlette.responses import StreamingResponse

from scribe.dependencies import get_database, get_rabbitmq_channel, get_audio_bucket
from scribe.meetings.schema import MeetingResponse, MeetingCreate, MeetingModel

# Create router for meetings
router = APIRouter(
    prefix="/meetings",
    tags=["meetings"],
    responses={404: {"description": "Meeting not found"}},
)

# Database configuration
COLLECTION_NAME = "meetings"


# Dependency to get meetings collection
async def get_meetings_collection(db: AsyncIOMotorDatabase = Depends(get_database)):
    """Get meetings collection from database."""
    return db[COLLECTION_NAME]


# Helper function to convert MongoDB document to response model
def meeting_helper(meeting, full_model=False) -> MeetingResponse:
    """Convert MongoDB document to MeetingResponse model."""

    resp = MeetingResponse(
        id=str(meeting["_id"]),
        title=meeting["title"],
        startedAt=meeting["startedAt"],
        stoppedAt=meeting.get("stoppedAt"),
        recordingReady=meeting.get("recordingReady", False),
        transcriptionReady=meeting.get("transcriptionReady", False),
    )

    if full_model:
        resp.transcriptionSegments = meeting.get("transcriptionSegments", [])

    return resp


# Routes
@router.get("", response_model=List[MeetingResponse])
async def list_meetings(
    collection: AsyncIOMotorCollection = Depends(get_meetings_collection),
):
    """
    Get all meetings.

    Returns a list of all meetings in the database, ordered by startedAt descending.
    """
    try:
        cursor = collection.find().sort("startedAt", -1)
        meetings = await cursor.to_list(length=None)
        return [meeting_helper(meeting) for meeting in meetings]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve meetings: {str(e)}",
        )


@router.post("", response_model=MeetingResponse, status_code=status.HTTP_201_CREATED)
async def create_meeting(
    meeting_data: MeetingCreate,
    collection=Depends(get_meetings_collection),
    channel: AbstractRobustChannel = Depends(get_rabbitmq_channel),
):
    """
    Create a new meeting and start recording immediately.

    - **title**: The meeting title (required)
    - **startedAt**: Set to current time automatically
    - **stoppedAt**: Initially null (meeting is active)
    - **recordingReady**: Initially false
    - **transcriptionReady**: Initially false

    Returns the created meeting with its ID.
    """
    try:
        active_meeting = await collection.find_one({"stoppedAt": None})
        if active_meeting:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot start a new meeting while another meeting is in progress",
            )

        # Create meeting document
        meeting_dict = {
            "title": meeting_data.title,
            "startedAt": datetime.utcnow(),
            "stoppedAt": None,
            "recordingReady": False,
            "transcriptionReady": False,
        }

        # Insert into database
        result = await collection.insert_one(meeting_dict)

        # Get the created meeting
        created_meeting = await collection.find_one({"_id": result.inserted_id})

        if not created_meeting:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve created meeting",
            )

        new_meeting = meeting_helper(created_meeting)

        try:
            command = json.dumps({"meeting_id": new_meeting.id, "cmd": "start"})
            exchange = await channel.get_exchange("scribe-commands")
            await exchange.publish(
                aio_pika.Message(command.encode()),
                routing_key="commands",
            )
        except Exception as e:
            await collection.delete_one({"_id": new_meeting.id})
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
            )

        return new_meeting

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create meeting: {str(e)}",
        )


@router.post("/{meeting_id}/stop", response_model=MeetingResponse)
async def stop_meeting(
    meeting_id: str,
    collection=Depends(get_meetings_collection),
    channel: AbstractRobustChannel = Depends(get_rabbitmq_channel),
):
    """
    Stop a meeting recording.

    Sets the stoppedAt timestamp to the current time.
    The meeting must be currently active (stoppedAt is null).
    """
    # Validate ObjectId
    if not ObjectId.is_valid(meeting_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid meeting ID format"
        )

    try:
        # Check if meeting exists and is active
        meeting = await collection.find_one({"_id": ObjectId(meeting_id)})

        if not meeting:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found"
            )

        if meeting.get("stoppedAt") is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Meeting is already stopped",
            )

        meeting = meeting_helper(meeting)
        try:
            command = json.dumps({"meeting_id": meeting.id, "cmd": "stop"})
            exchange = await channel.get_exchange("scribe-commands")
            await exchange.publish(
                aio_pika.Message(command.encode()),
                routing_key="commands",
            )
        except Exception as e:
            logging.error(f"cannot emit stop command: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
            )

        return meeting

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to stop meeting: {str(e)}",
        )


@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meeting(meeting_id: str, collection=Depends(get_meetings_collection)):
    """
    Delete a meeting.

    Permanently removes the meeting from the database.
    This action cannot be undone.
    """
    # Validate ObjectId
    if not ObjectId.is_valid(meeting_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid meeting ID format"
        )

    try:
        # Delete the meeting
        result = await collection.delete_one({"_id": ObjectId(meeting_id)})

        if result.deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found"
            )

        # Return 204 No Content (successful deletion)
        return None

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete meeting: {str(e)}",
        )


# Additional utility endpoints
@router.get("/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(meeting_id: str, collection=Depends(get_meetings_collection)):
    """
    Get a specific meeting by ID.

    Returns the meeting details if found.
    """
    # Validate ObjectId
    if not ObjectId.is_valid(meeting_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid meeting ID format"
        )

    try:
        meeting = await collection.find_one({"_id": ObjectId(meeting_id)})

        if not meeting:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found"
            )

        return meeting_helper(meeting, full_model=True)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve meeting: {str(e)}",
        )


@router.get("/{meeting_id}/recording")
async def download_recording(
    meeting_id: str,
    bucket: AsyncIOMotorGridFSBucket = Depends(get_audio_bucket),
    collection=Depends(get_meetings_collection),
):

    meeting = await collection.find_one({"_id": ObjectId(meeting_id)})
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found"
        )

    meeting = MeetingModel.model_validate(meeting)
    if not meeting.recordingReady:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Meeting recording not found"
        )

    try:
        grid_out = await bucket.open_download_stream(meeting.recordingFile)
    except Exception as e:
        logging.error(f"failed to download recording: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR) from e

    headers = {
        "content-disposition": f'attachment; filename="meeting_{meeting.title}_{int(time.time())}.wav"',
        "content-type": "audio/wav",
    }

    return StreamingResponse(grid_out, headers=headers)

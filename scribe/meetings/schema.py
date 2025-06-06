from datetime import datetime
from typing import Optional, List

from bson import ObjectId
from pydantic import BaseModel, Field, GetJsonSchemaHandler
from pydantic.json_schema import JsonSchemaValue
from pydantic_core import core_schema


class PyObjectId(ObjectId):

    @classmethod
    def __get_pydantic_core_schema__(cls, source_type, handler):
        return core_schema.no_info_plain_validator_function(cls.validate)

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(
        cls, core_schema: core_schema.CoreSchema, handler: GetJsonSchemaHandler
    ) -> JsonSchemaValue:
        return {"type": "string", "format": "objectid"}


class MeetingModel(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    title: str
    startedAt: datetime
    stoppedAt: Optional[datetime] = None
    recordingReady: bool = False
    transcriptionReady: bool = False

    recordingFile: Optional[PyObjectId] = Field(default=None, exclude=True)
    transcriptionSegments: Optional[List[dict]] = Field(default=None, exclude=True)

    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
        schema_extra = {
            "example": {
                "id": "507f1f77bcf86cd799439011",
                "title": "Weekly Team Standup",
                "startedAt": "2024-01-15T10:00:00Z",
                "stoppedAt": "2024-01-15T10:30:00Z",
                "recordingReady": True,
                "transcriptionReady": False,
            }
        }


class MeetingCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)

    class Config:
        schema_extra = {"example": {"title": "Weekly Team Standup"}}


class MeetingResponse(BaseModel):
    id: str
    title: str
    startedAt: datetime
    stoppedAt: Optional[datetime] = None
    recordingReady: bool
    transcriptionReady: bool
    transcriptionSegments: Optional[List[dict]] = None

    class Config:
        schema_extra = {
            "example": {
                "id": "507f1f77bcf86cd799439011",
                "title": "Weekly Team Standup",
                "startedAt": "2024-01-15T10:00:00Z",
                "stoppedAt": "2024-01-15T10:30:00Z",
                "recordingReady": True,
                "transcriptionReady": False,
                "transcriptionSegments": [
                    {
                        "start": 0,
                        "end": 5.0,
                        "text": "Some Text",
                    },
                    {
                        "start": 5.0,
                        "end": 7.1,
                        "text": "Some Text",
                    },
                ],
            }
        }

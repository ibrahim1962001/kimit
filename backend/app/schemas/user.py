import datetime
from pydantic import BaseModel, EmailStr


class UserOut(BaseModel):
    id: int
    firebase_uid: str
    email: str
    display_name: str | None
    plan: str
    created_at: datetime.datetime

    model_config = {"from_attributes": True}

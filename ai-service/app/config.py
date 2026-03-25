from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    TESSERACT_CMD: str = "/usr/bin/tesseract"
    GOOGLE_VISION_API_KEY: str = ""
    MAX_FILE_SIZE_MB: int = 10
    CONFIDENCE_THRESHOLD: float = 0.7
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:5000",
        "http://127.0.0.1:5173"
    ]

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()

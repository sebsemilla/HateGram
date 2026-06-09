from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://hategram:hategram123@localhost:5432/hategram"
    SECRET_KEY: str = "supersecretkey_changeme_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    YOUTUBE_API_KEY: str = ""
    GEMINI_API_KEY: str = ""

    class Config:
        env_file = ".env"


settings = Settings()

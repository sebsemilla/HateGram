import time
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import OperationalError
from app.db.database import Base, engine
from app.routers import auth, profiles, upload, posts, preview, reports, admin, communities, facts, debates
from app.routers import bots
from app.routers import pins, follows, messages, stories, comments, reactions, notifications
from app.scheduler import scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Espera a que PostgreSQL esté listo (necesario con Podman/Docker)
    for attempt in range(10):
        try:
            Base.metadata.create_all(bind=engine)
            break
        except OperationalError:
            print(f"DB no lista, reintentando ({attempt + 1}/10)...")
            time.sleep(2)

    scheduler.start()
    print("Bot scheduler iniciado.")
    yield
    scheduler.shutdown()
    print("Bot scheduler detenido.")


app = FastAPI(title="HateGram API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(auth.router)
app.include_router(profiles.router)
app.include_router(upload.router)
app.include_router(posts.router)
app.include_router(preview.router)
app.include_router(reports.router)
app.include_router(admin.router)
app.include_router(communities.router)
app.include_router(facts.router)
app.include_router(debates.router)
app.include_router(bots.router)
app.include_router(pins.router)
app.include_router(follows.router)
app.include_router(messages.router)
app.include_router(stories.router)
app.include_router(comments.router)
app.include_router(reactions.router)
app.include_router(notifications.router)


@app.get("/")
def health():
    return {"status": "ok", "app": "HateGram API"}

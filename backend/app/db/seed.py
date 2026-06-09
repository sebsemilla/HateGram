"""
Ejecutar con: python -m app.db.seed
desde la carpeta /backend
"""
from app.db.database import SessionLocal, engine
from app.models import User, Profile
from app.db.database import Base
from app.core.security import hash_password

FICTITIOUS_USERS = [
    {
        "username": "toxicvibes99",
        "email": "toxicvibes99@hategram.io",
        "password": "password123",
        "display_name": "Toxic Vibes",
        "bio": "No filter. No apologies. Just truth.",
        "avatar_url": "https://api.dicebear.com/9.x/personas/svg?seed=toxicvibes99",
        "location": "Buenos Aires, AR",
        "website": "",
    },
    {
        "username": "anon_ghost",
        "email": "anon_ghost@hategram.io",
        "password": "password123",
        "display_name": "👻 Ghost",
        "bio": "Watching. Always watching.",
        "avatar_url": "https://api.dicebear.com/9.x/personas/svg?seed=anon_ghost",
        "location": "Unknown",
        "website": "",
    },
    {
        "username": "realtalkmx",
        "email": "realtalkmx@hategram.io",
        "password": "password123",
        "display_name": "Real Talk MX",
        "bio": "Decimos lo que nadie más se atreve. 🇲🇽",
        "avatar_url": "https://api.dicebear.com/9.x/personas/svg?seed=realtalkmx",
        "location": "Ciudad de México, MX",
        "website": "",
    },
    {
        "username": "chaoskween",
        "email": "chaoskween@hategram.io",
        "password": "password123",
        "display_name": "Chaos Kween ⚡",
        "bio": "Creating chaos one post at a time. Unbothered.",
        "avatar_url": "https://api.dicebear.com/9.x/personas/svg?seed=chaoskween",
        "location": "Bogotá, CO",
        "website": "",
    },
    {
        "username": "el_disidente",
        "email": "el_disidente@hategram.io",
        "password": "password123",
        "display_name": "El Disidente",
        "bio": "Contra el algoritmo. Contra la narrativa. A favor de la verdad.",
        "avatar_url": "https://api.dicebear.com/9.x/personas/svg?seed=el_disidente",
        "location": "Madrid, ES",
        "website": "https://eldisidente.blog",
    },
]


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        for data in FICTITIOUS_USERS:
            if db.query(User).filter(User.username == data["username"]).first():
                print(f"  [skip] {data['username']} ya existe")
                continue

            user = User(
                username=data["username"],
                email=data["email"],
                hashed_password=hash_password(data["password"]),
                is_fictitious=True,
            )
            db.add(user)
            db.flush()

            profile = Profile(
                user_id=user.id,
                display_name=data["display_name"],
                bio=data["bio"],
                avatar_url=data["avatar_url"],
                location=data["location"],
                website=data["website"],
            )
            db.add(profile)
            print(f"  [ok] {data['username']}")

        db.commit()
        print("\nSeed completado.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()

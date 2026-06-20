import httpx
from fastapi import APIRouter, HTTPException, Depends
from bs4 import BeautifulSoup
from app.core.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/preview", tags=["preview"])

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; feedpodBot/1.0)",
    "Accept": "text/html,application/xhtml+xml",
}


def _meta(soup: BeautifulSoup, *names: str) -> str:
    for name in names:
        tag = (
            soup.find("meta", property=name)
            or soup.find("meta", attrs={"name": name})
        )
        if tag and tag.get("content"):
            return tag["content"].strip()
    return ""


@router.get("/link")
async def link_preview(
    url: str,
    current_user: User = Depends(get_current_user),
):
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="URL inválida")

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=8) as client:
            res = await client.get(url, headers=HEADERS)
            res.raise_for_status()
    except Exception:
        raise HTTPException(status_code=422, detail="No se pudo acceder al link")

    soup = BeautifulSoup(res.text, "html.parser")

    title = (
        _meta(soup, "og:title", "twitter:title")
        or (soup.title.string.strip() if soup.title else "")
    )
    description = _meta(soup, "og:description", "twitter:description", "description")
    image = _meta(soup, "og:image", "twitter:image")

    # Si la imagen es relativa, la convertimos a absoluta
    if image and not image.startswith("http"):
        from urllib.parse import urljoin
        image = urljoin(url, image)

    return {
        "url": url,
        "title": title[:300],
        "description": description[:500],
        "image": image,
    }

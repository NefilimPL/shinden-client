from __future__ import annotations

import asyncio

from .api import (
    ShindenAPI,
    ShindenAPIError,
    get_cda_video,
    get_episodes,
    get_iframe,
    get_players,
    login,
    logout,
    search,
)
from .schemas import Anime, Episode, Player

try:  # Optional dependency for HTTP exposure
    from fastapi import FastAPI, HTTPException
    from pydantic import BaseModel
except ImportError:  # pragma: no cover - fastapi is optional
    FastAPI = None  # type: ignore
    HTTPException = Exception  # type: ignore
    BaseModel = object  # type: ignore


if FastAPI is not None:
    app = FastAPI(title="Shinden Client Backend", version="0.1.0")

    class SearchPayload(BaseModel):
        query: str

    class LoginPayload(BaseModel):
        username: str
        password: str

    async def _guard(coro):
        try:
            return await coro
        except ShindenAPIError as exc:  # pragma: no cover - runtime network errors
            raise HTTPException(status_code=502, detail=str(exc))

    @app.post("/search")
    async def http_search(payload: SearchPayload) -> list[Anime]:
        items = await _guard(search(payload.query))
        return [Anime(**item) for item in items]

    @app.post("/login")
    async def http_login(payload: LoginPayload) -> None:
        await _guard(login(payload.username, payload.password))

    @app.post("/logout")
    async def http_logout() -> None:
        await _guard(logout())

    @app.get("/episodes")
    async def http_episodes(url: str) -> list[Episode]:
        items = await _guard(get_episodes(url))
        return [Episode(**item) for item in items]

    @app.get("/players")
    async def http_players(url: str) -> list[Player]:
        items = await _guard(get_players(url))
        return [Player(**item) for item in items]

    @app.get("/iframe")
    async def http_iframe(online_id: str) -> str:
        return await _guard(get_iframe(online_id))

    @app.get("/cda")
    async def http_cda(url: str) -> str:
        return await _guard(get_cda_video(url))
else:
    app = None


ASYNC_SAMPLE_QUERY = "cowboy bebop"


async def demo() -> None:
    """Simple CLI demo when FastAPI is not installed."""
    async with ShindenAPI() as api:
        await api.test_connection()
        results = await api.search_anime(ASYNC_SAMPLE_QUERY)
        if results:
            first = results[0]
            print(f"Found {len(results)} results; first title: {first.name} -> {first.url}")
        else:
            print("No results returned from Shinden search")


if __name__ == "__main__":  # pragma: no cover
    if app is not None:
        try:
            import uvicorn
        except ImportError:
            raise RuntimeError("fastapi is installed but uvicorn is missing; install uvicorn to serve HTTP API")
        uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=False)
    else:
        asyncio.run(demo())

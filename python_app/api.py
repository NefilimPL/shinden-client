from __future__ import annotations

import asyncio
import logging
from dataclasses import asdict
from typing import Iterable, List, Optional

try:
    import httpx
except Exception:  # pragma: no cover - optional dependency
    httpx = None

from .models import Anime, Episode, Player, User

logger = logging.getLogger(__name__)


class ShindenClient:
    """Lightweight async client that mirrors the Rust commands.

    The real Rust app uses `shinden_pl_api` and `cda_dl`; here we provide a
    minimal HTTP-based replacement with mock data so that the Python GUI can be
    run immediately. The public methods intentionally mirror the command names
    exposed via Tauri so the rest of the codebase can stay aligned.
    """

    def __init__(self, base_url: str = "https://shinden.pl", use_mock: bool = True):
        self.base_url = base_url.rstrip("/")
        self.use_mock = use_mock
        self._client = (
            httpx.AsyncClient(base_url=self.base_url, headers={"User-Agent": "shinden-client-py/0.1"})
            if httpx
            else None
        )
        self._user: User = User(name=None, image_url=None)

    async def aclose(self) -> None:
        if self._client:
            await self._client.aclose()

    async def test_connection(self) -> None:
        if self.use_mock:
            logger.debug("Skipping network check (mock mode enabled)")
            return

        logger.debug("Testing connection to %s", self.base_url)
        try:
            if self._client:
                response = await self._client.get("/")
                response.raise_for_status()
            else:
                await asyncio.to_thread(_urllib_ping, self.base_url)
        except Exception as exc:  # noqa: BLE001 - surface original error message
            logger.exception("Connection failed")
            raise ConnectionError(f"Connection failed: {exc}") from exc

    async def search(self, query: str) -> List[Anime]:
        if self.use_mock:
            logger.info("Returning mock search results for query=%s", query)
            return list(_mock_anime_catalog(query))

        logger.info("Search with live mode is not implemented yet; returning empty list")
        return []

    async def login(self, username: str, password: str) -> None:
        # Real implementation should submit a form and store cookies.
        logger.info("Mock login as %s", username)
        self._user = User(name=username, image_url=None)

    async def logout(self) -> None:
        logger.info("Logging out user %s", self._user.name)
        self._user = User(name=None, image_url=None)

    async def get_user_name(self) -> Optional[str]:
        return self._user.name

    async def get_user_profile_image(self) -> Optional[str]:
        return self._user.image_url

    async def get_episodes(self, url: str) -> List[Episode]:
        if self.use_mock:
            return [Episode(title=f"Episode {i}", link=f"{url}/episodes/{i}") for i in range(1, 6)]
        return []

    async def get_players(self, url: str) -> List[Player]:
        if self.use_mock:
            return [
                Player(
                    player="mock-player",
                    max_res="1080p",
                    lang_audio="pl",
                    lang_subs="en",
                    online_id=f"player-{i}",
                )
                for i in range(1, 4)
            ]
        return []

    async def get_iframe(self, online_id: str) -> str:
        if self.use_mock:
            return f"https://example.com/embed/{online_id}"
        return ""

    async def get_cda_video(self, url: str) -> str:
        if self.use_mock:
            return f"https://cdn.example.com/stream/{url.split('/')[-1]}"
        return ""

    # Convenience synchronous wrappers
    def _run(self, coro):
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return asyncio.run(coro)
        else:
            return loop.create_task(coro)

    def test_connection_sync(self) -> None:
        return self._run(self.test_connection())

    def search_sync(self, query: str) -> List[Anime]:
        return self._run(self.search(query))

    def login_sync(self, username: str, password: str) -> None:
        return self._run(self.login(username, password))

    def logout_sync(self) -> None:
        return self._run(self.logout())

    def get_episodes_sync(self, url: str) -> List[Episode]:
        return self._run(self.get_episodes(url))

    def get_players_sync(self, url: str) -> List[Player]:
        return self._run(self.get_players(url))

    def get_iframe_sync(self, online_id: str) -> str:
        return self._run(self.get_iframe(online_id))

    def get_cda_video_sync(self, url: str) -> str:
        return self._run(self.get_cda_video(url))

    def to_dict(self) -> dict:
        return {"user": asdict(self._user), "base_url": self.base_url, "use_mock": self.use_mock}


def _mock_anime_catalog(query: str) -> Iterable[Anime]:
    sample = [
        Anime(
            name="Hunter x Hunter",
            url="https://shinden.pl/titles/450-hunter-x-hunter",
            image_url="https://i.example.com/hxh.jpg",
            anime_type="TV",
            rating="9.1",
            episodes="148",
            description="Classic shounen about hunters and Nen.",
        ),
        Anime(
            name="Fullmetal Alchemist: Brotherhood",
            url="https://shinden.pl/titles/121-fullmetal-alchemist-brotherhood",
            image_url="https://i.example.com/fmab.jpg",
            anime_type="TV",
            rating="9.2",
            episodes="64",
            description="Brothers on a quest to restore their bodies via alchemy.",
        ),
    ]
    query_lower = query.lower()
    for anime in sample:
        if query_lower in anime.name.lower():
            yield anime


def _urllib_ping(base_url: str) -> None:
    import urllib.request

    with urllib.request.urlopen(base_url, timeout=10) as response:  # noqa: S310 - intentional simple connectivity check
        if response.status >= 400:
            raise ConnectionError(f"Unexpected status {response.status}")


__all__ = [
    "Anime",
    "Episode",
    "Player",
    "ShindenClient",
    "User",
]

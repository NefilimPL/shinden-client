from __future__ import annotations

import re
from dataclasses import asdict
from html import unescape
from html.parser import HTMLParser
from typing import List, Optional

from .schemas import Anime, Episode, Player, User

try:
    import httpx
except ImportError as exc:  # pragma: no cover - helpful runtime message if dependency missing
    httpx = None
    _httpx_import_error = exc
else:
    _httpx_import_error = None


class ShindenAPIError(RuntimeError):
    """Generic error raised when the Shinden API cannot be queried."""


class _SearchParser(HTMLParser):
    """Very small HTML parser that tries to extract anime cards from search results."""

    def __init__(self) -> None:
        super().__init__()
        self.current: dict | None = None
        self.results: List[Anime] = []

    def handle_starttag(self, tag: str, attrs: List[tuple[str, str | None]]):
        attrs_dict = dict(attrs)
        if tag == "article" and "data-entry-type" in attrs_dict:
            self.current = {
                "name": "",
                "url": "",
                "image_url": "",
                "anime_type": attrs_dict.get("data-entry-type", "unknown"),
                "rating": attrs_dict.get("data-rating", "0"),
                "episodes": attrs_dict.get("data-episodes", "0"),
                "description": "",
            }
        if self.current is None:
            return
        if tag == "a" and not self.current.get("url"):
            href = attrs_dict.get("href")
            if href:
                self.current["url"] = href
        if tag == "img" and not self.current.get("image_url"):
            src = attrs_dict.get("src")
            if src:
                self.current["image_url"] = src

    def handle_endtag(self, tag: str):
        if tag == "article" and self.current:
            self.results.append(
                Anime(
                    name=self.current["name"],
                    url=self.current["url"],
                    image_url=self.current["image_url"],
                    anime_type=self.current["anime_type"],
                    rating=self.current["rating"],
                    episodes=self.current["episodes"],
                    description=self.current["description"],
                )
            )
            self.current = None

    def handle_data(self, data: str):
        if self.current is not None:
            data = data.strip()
            if data and not self.current.get("name"):
                self.current["name"] = unescape(data)


class _EpisodeParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_link = False
        self.current_link: Optional[str] = None
        self.buffer: List[str] = []
        self.results: List[Episode] = []

    def handle_starttag(self, tag: str, attrs: List[tuple[str, str | None]]):
        attrs_dict = dict(attrs)
        if tag == "a" and "episode" in attrs_dict.get("class", ""):
            self.in_link = True
            self.current_link = attrs_dict.get("href")

    def handle_endtag(self, tag: str):
        if tag == "a" and self.in_link:
            title = unescape(" ".join(self.buffer).strip())
            self.results.append(Episode(title=title, link=self.current_link or ""))
            self.buffer.clear()
            self.in_link = False
            self.current_link = None

    def handle_data(self, data: str):
        if self.in_link:
            self.buffer.append(data)


class _PlayersParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_row = False
        self.current: dict | None = None
        self.results: List[Player] = []

    def handle_starttag(self, tag: str, attrs: List[tuple[str, str | None]]):
        attrs_dict = dict(attrs)
        if tag == "tr" and "data-player" in attrs_dict:
            self.in_row = True
            self.current = {
                "player": attrs_dict.get("data-player", ""),
                "max_res": attrs_dict.get("data-resolution", ""),
                "lang_audio": attrs_dict.get("data-dubbing", ""),
                "lang_subs": attrs_dict.get("data-subs", ""),
                "online_id": attrs_dict.get("data-online-id", ""),
            }

    def handle_endtag(self, tag: str):
        if tag == "tr" and self.in_row and self.current is not None:
            self.results.append(
                Player(
                    player=self.current["player"],
                    max_res=self.current["max_res"],
                    lang_audio=self.current["lang_audio"],
                    lang_subs=self.current["lang_subs"],
                    online_id=self.current["online_id"],
                )
            )
            self.current = None
            self.in_row = False


class ShindenAPI:
    """Async client that mirrors the Rust `ShindenAPI` interface using httpx."""

    def __init__(self, base_url: str = "https://shinden.pl", *, timeout: float = 20.0):
        if _httpx_import_error:
            raise ImportError(
                "httpx is required to use ShindenAPI; install it with `pip install httpx`"
            ) from _httpx_import_error
        self.base_url = base_url.rstrip("/")
        self._timeout = timeout
        self._client = httpx.AsyncClient(base_url=self.base_url, timeout=self._timeout, headers={"User-Agent": "shinden-client-py"})
        self._user: User = User(name=None, image_url=None)

    async def close(self) -> None:
        await self._client.aclose()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        await self.close()

    async def _get(self, url: str, **kwargs) -> httpx.Response:
        try:
            resp = await self._client.get(url, **kwargs)
            resp.raise_for_status()
            return resp
        except Exception as exc:  # pragma: no cover - runtime networking issues
            raise ShindenAPIError(str(exc)) from exc

    async def _post(self, url: str, data: dict[str, str], **kwargs) -> httpx.Response:
        try:
            resp = await self._client.post(url, data=data, **kwargs)
            resp.raise_for_status()
            return resp
        except Exception as exc:  # pragma: no cover
            raise ShindenAPIError(str(exc)) from exc

    async def test_connection(self) -> None:
        await self._get("/")

    async def search_anime(self, query: str) -> List[Anime]:
        html = (await self._get("/titles", params={"search": query})).text
        parser = _SearchParser()
        parser.feed(html)
        results = parser.results
        if not results:
            # fallback for simplified listings using regex
            for match in re.finditer(r'<a[^>]+href="(?P<href>[^"]+)"[^>]*>(?P<name>[^<]+)</a>', html):
                href = match.group("href")
                if "titles" in href:
                    results.append(
                        Anime(
                            name=unescape(match.group("name")),
                            url=href,
                            image_url="",
                            anime_type="unknown",
                            rating="0",
                            episodes="0",
                            description="",
                        )
                    )
        return results

    async def login(self, username: str, password: str) -> None:
        await self._post(
            "/user/login",
            data={"login": username, "password": password, "remember": "1"},
        )
        self._user = User(name=username, image_url=None)

    async def logout(self) -> None:
        self._client.cookies.clear()
        self._user = User(name=None, image_url=None)

    async def get_user_name(self) -> Optional[str]:
        if self._user.name:
            return self._user.name
        try:
            html = (await self._get("/user/profile")).text
        except Exception:
            return None
        match = re.search(r"class=\"profile-name\"[^>]*>([^<]+)<", html)
        if match:
            self._user = User(name=unescape(match.group(1).strip()), image_url=self._user.image_url)
        return self._user.name

    async def get_user_profile_image(self) -> Optional[str]:
        if self._user.image_url:
            return self._user.image_url
        try:
            html = (await self._get("/user/profile")).text
        except Exception:
            return None
        match = re.search(r"<img[^>]+class=\"profile-avatar\"[^>]+src=\"([^\"]+)\"", html)
        if match:
            self._user = User(name=self._user.name, image_url=match.group(1))
        return self._user.image_url

    async def get_episodes(self, url: str) -> List[Episode]:
        html = (await self._get(url)).text
        parser = _EpisodeParser()
        parser.feed(html)
        return parser.results

    async def get_players(self, url: str) -> List[Player]:
        html = (await self._get(url)).text
        parser = _PlayersParser()
        parser.feed(html)
        return parser.results

    async def get_player_iframe(self, player_id: str) -> str:
        # player IDs are usually used as a query parameter
        resp = await self._get(f"/player?online_id={player_id}")
        return resp.text

    async def get_cda_video_url(self, url: str) -> str:
        # Best-effort: cda videos often expose a downloadable mp4 link in the HTML source
        resp = await self._get(url)
        match = re.search(r"(https?://[\w./-]+\.mp4)", resp.text)
        if match:
            return match.group(1)
        return url


async def search(query: str) -> List[dict]:
    async with ShindenAPI() as api:
        return [asdict(item) for item in await api.search_anime(query)]


async def login(username: str, password: str) -> None:
    async with ShindenAPI() as api:
        await api.login(username, password)


async def logout() -> None:
    async with ShindenAPI() as api:
        await api.logout()


async def get_user_name() -> Optional[str]:
    async with ShindenAPI() as api:
        return await api.get_user_name()


async def get_user_profile_image() -> Optional[str]:
    async with ShindenAPI() as api:
        return await api.get_user_profile_image()


async def get_episodes(url: str) -> List[dict]:
    async with ShindenAPI() as api:
        return [asdict(item) for item in await api.get_episodes(url)]


async def get_players(url: str) -> List[dict]:
    async with ShindenAPI() as api:
        return [asdict(item) for item in await api.get_players(url)]


async def get_iframe(player_id: str) -> str:
    async with ShindenAPI() as api:
        return await api.get_player_iframe(player_id)


async def get_cda_video(url: str) -> str:
    async with ShindenAPI() as api:
        return await api.get_cda_video_url(url)

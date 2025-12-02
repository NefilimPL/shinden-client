"""Backend logic replicating the former Tauri commands with plain Python."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional


class BackendError(RuntimeError):
    """Generic error raised when a backend action cannot be completed."""


@dataclass
class Anime:
    name: str
    rating: str
    anime_type: str
    image_url: str
    url: str


@dataclass
class Episode:
    title: str
    link: str


@dataclass
class Player:
    player: str
    quality: str
    url: str


@dataclass
class UserSession:
    name: Optional[str] = None
    image_url: Optional[str] = None
    remember: bool = False

    @property
    def is_authenticated(self) -> bool:
        return bool(self.name)


class ShindenBackend:
    """
    Minimal stand-in for the Tauri commands used by the old Svelte UI.

    The methods return lightweight dataclass instances so the GUI can bind
    directly to typed data rather than serialised JSON. All data is kept
    in-memory to keep the example self contained.
    """

    def __init__(self) -> None:
        self.session = UserSession()
        self._series_to_episodes: Dict[str, List[Episode]] = {
            "https://shinden.pl/titles/1": [
                Episode(title="Pierwsze spotkanie", link="https://example.com/series/1/player/a"),
                Episode(title="Turniej klanów", link="https://example.com/series/1/player/b"),
            ],
            "https://shinden.pl/titles/2": [
                Episode(title="Narodziny bohatera", link="https://example.com/series/2/player/a"),
                Episode(title="Moc przyjaźni", link="https://example.com/series/2/player/b"),
                Episode(title="Finałowa walka", link="https://example.com/series/2/player/c"),
            ],
        }
        self._player_map: Dict[str, List[Player]] = {
            "https://example.com/series/1/player/a": [
                Player(player="Internal CDA", quality="720p", url="https://example.com/embed/series1a"),
                Player(player="CDA", quality="1080p", url="https://example.com/embed/series1a-hd"),
            ],
            "https://example.com/series/1/player/b": [
                Player(player="CDA", quality="1080p", url="https://example.com/embed/series1b"),
                Player(player="Dailymotion", quality="720p", url="https://example.com/embed/series1b-dm"),
            ],
            "https://example.com/series/2/player/a": [
                Player(player="Internal CDA", quality="720p", url="https://example.com/embed/series2a"),
                Player(player="Mega", quality="480p", url="https://example.com/embed/series2a-mega"),
            ],
            "https://example.com/series/2/player/b": [
                Player(player="Mega", quality="1080p", url="https://example.com/embed/series2b"),
                Player(player="Dailymotion", quality="720p", url="https://example.com/embed/series2b-dm"),
            ],
            "https://example.com/series/2/player/c": [
                Player(player="MysteryHost", quality="720p", url="https://example.com/embed/series2c"),
            ],
        }

    # Session helpers -----------------------------------------------------
    def test_connection(self) -> None:
        """Pretend to ping shinden.pl."""
        # A real implementation would make a network request here. Keeping it
        # deterministic simplifies the example while preserving the control
        # flow expected by the UI.
        return None

    def login(self, username: str, password: str, remember: bool = False) -> UserSession:
        if not username or not password:
            raise BackendError("Brak danych logowania")

        self.session = UserSession(
            name=username,
            image_url="https://avatars.githubusercontent.com/u/9919?v=4",
            remember=remember,
        )
        return self.session

    def logout(self) -> None:
        self.session = UserSession()

    def get_user_name(self) -> Optional[str]:
        return self.session.name

    def get_user_profile_image(self) -> Optional[str]:
        return self.session.image_url

    # Content loading helpers ---------------------------------------------
    def search(self, query: str) -> List[Anime]:
        if not query:
            raise BackendError("Puste zapytanie wyszukiwania")

        catalogue = [
            Anime(
                name="Hunter x Hunter",
                rating="9,3",
                anime_type="TV",
                image_url="https://placehold.co/300x400?text=HxH",
                url="https://shinden.pl/titles/1",
            ),
            Anime(
                name="Fullmetal Alchemist: Brotherhood",
                rating="9,1",
                anime_type="TV",
                image_url="https://placehold.co/300x400?text=FMAB",
                url="https://shinden.pl/titles/2",
            ),
        ]

        filtered = [a for a in catalogue if query.lower() in a.name.lower()]
        return sorted(filtered, key=lambda a: float(a.rating.replace(",", ".")), reverse=True)

    def get_episodes(self, url: str) -> List[Episode]:
        if not url:
            raise BackendError("Brak adresu serii")
        try:
            return self._series_to_episodes[url]
        except KeyError as exc:
            raise BackendError("Nie znaleziono serii") from exc

    def get_players(self, url: str) -> List[Player]:
        if not url:
            raise BackendError("Brak adresu odcinka")
        try:
            return self._player_map[url]
        except KeyError as exc:
            raise BackendError("Brak dostępnych odtwarzaczy") from exc

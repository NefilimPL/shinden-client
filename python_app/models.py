from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass
class Anime:
    name: str
    url: str
    image_url: str
    anime_type: str
    rating: str
    episodes: str
    description: str


@dataclass
class Episode:
    title: str
    link: str


@dataclass
class Player:
    player: str
    max_res: str
    lang_audio: str
    lang_subs: str
    online_id: str


@dataclass
class User:
    name: Optional[str]
    image_url: Optional[str]

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
import tkinter as tk
from tkinter import messagebox, ttk

from .api import ShindenClient
from .models import Anime

logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")


def _format_anime(anime: Anime) -> str:
    return f"{anime.name} · {anime.anime_type} · {anime.episodes} odc. · ⭐ {anime.rating}"


class ShindenApp(tk.Tk):
    def __init__(self, client: ShindenClient):
        super().__init__()
        self.title("Shinden Client (Python preview)")
        self.geometry("720x480")
        self.client = client
        self._build_ui()

    def _build_ui(self) -> None:
        header = ttk.Frame(self, padding=12)
        header.pack(fill=tk.X)

        ttk.Label(header, text="Wyszukaj anime:", font=("Arial", 12, "bold")).pack(side=tk.LEFT)
        self.search_var = tk.StringVar()
        search_entry = ttk.Entry(header, textvariable=self.search_var)
        search_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=8)
        search_entry.bind("<Return>", lambda event: self.do_search())

        ttk.Button(header, text="Szukaj", command=self.do_search).pack(side=tk.LEFT)

        body = ttk.Frame(self, padding=12)
        body.pack(fill=tk.BOTH, expand=True)

        self.results = tk.Listbox(body)
        self.results.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        scrollbar = ttk.Scrollbar(body, orient=tk.VERTICAL, command=self.results.yview)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.results.config(yscrollcommand=scrollbar.set)

    def do_search(self) -> None:
        query = self.search_var.get().strip()
        if not query:
            messagebox.showinfo("Brak zapytania", "Wpisz tytuł anime, aby rozpocząć wyszukiwanie.")
            return

        async def _run_search() -> None:
            try:
                await self.client.test_connection()
                matches = await self.client.search(query)
            except Exception as exc:  # noqa: BLE001 - show error to user
                messagebox.showerror("Błąd", str(exc))
                return

            self.results.delete(0, tk.END)
            if not matches:
                self.results.insert(tk.END, "Brak wyników (tryb mock lub brak wsparcia live)")
                return

            for anime in matches:
                self.results.insert(tk.END, _format_anime(anime))

        asyncio.run(_run_search())


def run_cli(query: str | None) -> None:
    client = ShindenClient()

    async def _main() -> None:
        await client.test_connection()
        if query:
            results = await client.search(query)
            print("\n".join(_format_anime(anime) for anime in results) or "Brak wyników")
        else:
            print("Połączono z Shinden (tryb mock). Użyj --search, aby wyszukać tytuł.")

    asyncio.run(_main())


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Lekki launcher Python dla Shinden Client")
    parser.add_argument("--search", help="wyszukaj anime i zakończ (tryb CLI)")
    parser.add_argument("--cli", action="store_true", help="wymuś tryb CLI zamiast GUI")
    args = parser.parse_args(argv)

    if args.cli or args.search:
        run_cli(args.search)
        return 0

    app = ShindenApp(ShindenClient())
    app.mainloop()
    return 0


if __name__ == "__main__":
    sys.exit(main())

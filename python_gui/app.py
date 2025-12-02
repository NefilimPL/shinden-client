"""Qt GUI demonstrating the original Svelte layout in a desktop widget toolkit."""
from __future__ import annotations

import sys
from typing import Callable, Dict, Iterable, Optional

from PySide6 import QtCore, QtGui, QtWidgets

try:  # Optional web widget: falls back to a hyperlink if unavailable
    from PySide6.QtWebEngineWidgets import QWebEngineView
except Exception:  # pragma: no cover - optional dependency
    QWebEngineView = None

from .backend import Anime, BackendError, Episode, Player, ShindenBackend


class NavigationPanel(QtWidgets.QListWidget):
    """Simple vertical navigation for switching views."""

    def __init__(self, on_change: Callable[[int], None], parent: Optional[QtWidgets.QWidget] = None) -> None:
        super().__init__(parent)
        self.on_change = on_change
        self.setSelectionMode(self.SingleSelection)
        self.addItems([
            "Wyszukiwanie",
            "Wyniki",
            "Odcinki",
            "Odtwarzacze",
            "Konto",
        ])
        self.setFixedWidth(180)
        self.currentRowChanged.connect(self.on_change)
        self.setCurrentRow(0)


class PlayerViewer(QtWidgets.QWidget):
    """Widget capable of opening iframe/URL in a built-in web view."""

    def __init__(self, parent: Optional[QtWidgets.QWidget] = None) -> None:
        super().__init__(parent)
        self._url: Optional[str] = None

        layout = QtWidgets.QVBoxLayout(self)
        self.header = QtWidgets.QLabel("Wybierz odtwarzacz z listy po lewej")
        self.header.setWordWrap(True)
        layout.addWidget(self.header)

        if QWebEngineView:
            self.web_view = QWebEngineView()
            layout.addWidget(self.web_view, 1)
        else:
            self.web_view = None
            self.link_button = QtWidgets.QLabel()
            self.link_button.setOpenExternalLinks(True)
            layout.addWidget(self.link_button)

    def open_url(self, url: str) -> None:
        self._url = url
        self.header.setText(f"Otwarty odtwarzacz: {url}")
        if self.web_view:
            self.web_view.setUrl(QtCore.QUrl(url))
        elif self.link_button:
            self.link_button.setText(f"<a href='{url}'>Otwórz strumień w przeglądarce</a>")


class SearchForm(QtWidgets.QWidget):
    search_requested = QtCore.Signal(str)

    def __init__(self, parent: Optional[QtWidgets.QWidget] = None) -> None:
        super().__init__(parent)
        layout = QtWidgets.QFormLayout(self)
        layout.addRow(QtWidgets.QLabel("Podaj tytuł anime"))

        self.query = QtWidgets.QLineEdit()
        self.query.setPlaceholderText("np. Hunter x Hunter")
        layout.addRow(self.query)

        self.remember = QtWidgets.QCheckBox("Pamiętaj sesję")
        layout.addRow(self.remember)

        button = QtWidgets.QPushButton("Szukaj")
        button.clicked.connect(self._emit_search)
        layout.addRow(button)

    def _emit_search(self) -> None:
        self.search_requested.emit(self.query.text().strip())


class AnimeList(QtWidgets.QListWidget):
    anime_selected = QtCore.Signal(Anime)

    def __init__(self, parent: Optional[QtWidgets.QWidget] = None) -> None:
        super().__init__(parent)
        self.itemDoubleClicked.connect(self._emit_anime)
        self._anime_by_item: Dict[QtWidgets.QListWidgetItem, Anime] = {}

    def populate(self, items: Iterable[Anime]) -> None:
        self.clear()
        self._anime_by_item.clear()
        for anime in items:
            item = QtWidgets.QListWidgetItem(f"{anime.rating} · {anime.name} [{anime.anime_type}]")
            item.setToolTip(anime.url)
            self._anime_by_item[item] = anime
            self.addItem(item)

    def _emit_anime(self, item: QtWidgets.QListWidgetItem) -> None:
        self.anime_selected.emit(self._anime_by_item[item])


class EpisodeList(QtWidgets.QListWidget):
    episode_selected = QtCore.Signal(Episode)

    def __init__(self, parent: Optional[QtWidgets.QWidget] = None) -> None:
        super().__init__(parent)
        self.itemDoubleClicked.connect(self._emit_episode)
        self._episode_by_item: Dict[QtWidgets.QListWidgetItem, Episode] = {}

    def populate(self, episodes: Iterable[Episode]) -> None:
        self.clear()
        self._episode_by_item.clear()
        for i, episode in enumerate(episodes, start=1):
            label = episode.title or f"Odcinek {i}"
            item = QtWidgets.QListWidgetItem(f"{i:02d}. {label}")
            item.setToolTip(episode.link)
            self._episode_by_item[item] = episode
            self.addItem(item)

    def _emit_episode(self, item: QtWidgets.QListWidgetItem) -> None:
        self.episode_selected.emit(self._episode_by_item[item])


class PlayerList(QtWidgets.QListWidget):
    player_selected = QtCore.Signal(Player)

    SAFE = {"Internal CDA", "CDA", "Mega"}
    BUILTIN = {"Internal CDA"}
    DANGEROUS = {"MysteryHost"}

    def __init__(self, parent: Optional[QtWidgets.QWidget] = None) -> None:
        super().__init__(parent)
        self.itemClicked.connect(self._emit_player)
        self._player_by_item: Dict[QtWidgets.QListWidgetItem, Player] = {}

    def populate(self, players: Iterable[Player]) -> None:
        self.clear()
        self._player_by_item.clear()
        for player in players:
            label = f"{player.player} · {player.quality}"
            badge = self._badge_for(player.player)
            item = QtWidgets.QListWidgetItem(f"{badge} {label}")
            item.setToolTip(player.url)
            self._player_by_item[item] = player
            self.addItem(item)

    def _badge_for(self, name: str) -> str:
        if name in self.BUILTIN:
            return "[Wbudowany/Bezpieczny]"
        if name in self.SAFE:
            return "[Bezpieczny]"
        if name in self.DANGEROUS:
            return "[Niezaufany]"
        return "[Nieznany]"

    def _emit_player(self, item: QtWidgets.QListWidgetItem) -> None:
        self.player_selected.emit(self._player_by_item[item])


class LoginForm(QtWidgets.QWidget):
    logged_in = QtCore.Signal()
    logged_out = QtCore.Signal()

    def __init__(self, backend: ShindenBackend, parent: Optional[QtWidgets.QWidget] = None) -> None:
        super().__init__(parent)
        self.backend = backend

        self.layout = QtWidgets.QVBoxLayout(self)

        self.info = QtWidgets.QLabel("Zaloguj się aby oglądać treści wymagające konta")
        self.info.setWordWrap(True)
        self.layout.addWidget(self.info)

        form = QtWidgets.QFormLayout()
        self.email = QtWidgets.QLineEdit()
        self.password = QtWidgets.QLineEdit()
        self.password.setEchoMode(QtWidgets.QLineEdit.Password)
        self.remember = QtWidgets.QCheckBox("Pamiętaj sesję")

        form.addRow("Email", self.email)
        form.addRow("Hasło", self.password)
        form.addRow("", self.remember)
        self.layout.addLayout(form)

        self.actions = QtWidgets.QHBoxLayout()
        self.login_btn = QtWidgets.QPushButton("Zaloguj")
        self.logout_btn = QtWidgets.QPushButton("Wyloguj")
        self.actions.addWidget(self.login_btn)
        self.actions.addWidget(self.logout_btn)
        self.layout.addLayout(self.actions)

        self.login_btn.clicked.connect(self._handle_login)
        self.logout_btn.clicked.connect(self._handle_logout)
        self.refresh_state()

    def refresh_state(self) -> None:
        session = self.backend.session
        is_logged = session.is_authenticated
        self.logout_btn.setEnabled(is_logged)
        self.login_btn.setEnabled(not is_logged)
        if is_logged:
            avatar = session.image_url or "(brak avatara)"
            self.info.setText(f"Zalogowano jako {session.name}\nAvatar: {avatar}")
        else:
            self.info.setText("Zaloguj się aby oglądać treści wymagające konta")

    def _handle_login(self) -> None:
        try:
            self.backend.login(self.email.text().strip(), self.password.text().strip(), self.remember.isChecked())
        except BackendError as exc:
            QtWidgets.QMessageBox.warning(self, "Logowanie", str(exc))
            return
        self.refresh_state()
        self.logged_in.emit()

    def _handle_logout(self) -> None:
        self.backend.logout()
        self.refresh_state()
        self.logged_out.emit()


class MainWindow(QtWidgets.QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.backend = ShindenBackend()
        self.setWindowTitle("Shinden Client 4 — Qt Edition")
        self.resize(1200, 800)

        container = QtWidgets.QWidget()
        layout = QtWidgets.QHBoxLayout(container)
        self.setCentralWidget(container)

        self.nav = NavigationPanel(self._switch_view)
        layout.addWidget(self.nav)

        self.stack = QtWidgets.QStackedWidget()
        layout.addWidget(self.stack, 1)

        # Views -----------------------------------------------------------
        self.search_form = SearchForm()
        self.search_form.search_requested.connect(self._perform_search)
        self.stack.addWidget(self.search_form)

        self.anime_list = AnimeList()
        self.anime_list.anime_selected.connect(self._load_episodes)
        self.stack.addWidget(self.anime_list)

        self.episode_list = EpisodeList()
        self.episode_list.episode_selected.connect(self._load_players)
        self.stack.addWidget(self.episode_list)

        player_split = QtWidgets.QSplitter()
        player_split.setOrientation(QtCore.Qt.Horizontal)
        self.player_list = PlayerList()
        self.player_viewer = PlayerViewer()
        player_split.addWidget(self.player_list)
        player_split.addWidget(self.player_viewer)
        self.player_list.player_selected.connect(self._open_player)
        self.stack.addWidget(player_split)

        self.login_form = LoginForm(self.backend)
        self.stack.addWidget(self.login_form)

        # Status bar ------------------------------------------------------
        self.status = self.statusBar()
        self.status.showMessage("Gotowy")

        self.current_series_url: Optional[str] = None
        self.current_episode_url: Optional[str] = None

    # Navigation ---------------------------------------------------------
    def _switch_view(self, index: int) -> None:
        self.stack.setCurrentIndex(index)

    # Actions ------------------------------------------------------------
    def _perform_search(self, query: str) -> None:
        try:
            self.status.showMessage("Sprawdzam połączenie...")
            self.backend.test_connection()
            self.status.showMessage("Szukanie anime...")
            results = self.backend.search(query)
        except BackendError as exc:
            QtWidgets.QMessageBox.critical(self, "Błąd", str(exc))
            self.status.showMessage("Błąd wyszukiwania")
            return

        if not results:
            QtWidgets.QMessageBox.information(self, "Brak wyników", "Nie znaleziono anime dla podanego zapytania.")
        self.anime_list.populate(results)
        self.status.showMessage(f"Znaleziono {len(results)} wyników")
        self.nav.setCurrentRow(1)

    def _load_episodes(self, anime: Anime) -> None:
        try:
            episodes = self.backend.get_episodes(anime.url)
        except BackendError as exc:
            QtWidgets.QMessageBox.warning(self, "Odcinki", str(exc))
            return
        self.current_series_url = anime.url
        self.episode_list.populate(episodes)
        self.status.showMessage(f"Załadowano {len(episodes)} odcinków dla {anime.name}")
        self.nav.setCurrentRow(2)

    def _load_players(self, episode: Episode) -> None:
        try:
            players = self.backend.get_players(episode.link)
        except BackendError as exc:
            QtWidgets.QMessageBox.warning(self, "Odtwarzacze", str(exc))
            return
        self.current_episode_url = episode.link
        self.player_list.populate(players)
        self.status.showMessage(f"Dostępnych odtwarzaczy: {len(players)}")
        self.nav.setCurrentRow(3)

    def _open_player(self, player: Player) -> None:
        self.player_viewer.open_url(player.url)
        safety_hint = ""
        if player.player in PlayerList.DANGEROUS:
            safety_hint = " — ostrzeżenie: niezaufany host"
        elif player.player in PlayerList.BUILTIN:
            safety_hint = " — odtwarzacz wbudowany"
        self.status.showMessage(f"Otwarty {player.player}{safety_hint}")


def main() -> None:
    app = QtWidgets.QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()

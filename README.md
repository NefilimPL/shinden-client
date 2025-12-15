# 🚀 Shinden Client 4

> **Nowoczesna, szybka aplikacja desktopowa dla użytkowników Shinden.pl**  
> Stworzona z pasji do anime - oparta na **Rust + Tauri + SvelteKit**.

---

![logo](./src-tauri/icons/256.png)

## 🧩 Co to jest?

**Shinden Client** to natywna aplikacja do przeglądania i oglądania anime na Shinden.pl - bez reklam, śledzenia i zbędnych elementów.  
Zamiast przeglądarki, dostajesz lekki, szybki i skoncentrowany na treści interfejs, który po prostu działa.

## 🌟 Najważniejsze cechy

- ⚡ **Błyskawiczne działanie** - aplikacja startuje w mniej niż sekundę
- 🧼 **Czysty interfejs bez reklam i popupów**
- 🌗 **Motywy jasny / ciemny**
- 🪵 **Konsola błędów i logów** - pomocna przy zgłoszeniach
- 📺 **Wbudowany odtwarzacz dla treści z cda.pl bez reklam**

---
## 🖥️ Kompatybilność
| System operacyjny | Obsługa      |
|-------------------|--------------|
| 🪟 Windows        | ✅ Pełna      |
| 🍎 macOS          | ✅ Pełna      |
| 🐧 GNU/Linux      | ⚠️ Częściowa |

### Wsparcie Shinden Client na systemach GNU/Linux
Jeśli używasz protokołu Wayland na swojej dystrybucji Linuxa, aplikacja
prawdopodobnie nie będzie działać.

Zalecamy użycie X11 lub ustawienie zmiennej środowiskowej `WEBKIT_DISABLE_DMABUF_RENDERER=1`
podczas uruchamiania aplikacji.

Np.
```bash
WEBKIT_DISABLE_DMABUF_RENDERER=1 ./shinden-client.AppImage
```

Problem nie dotyczy bezpośrednio aplikacji Shinden Client, a jest związany z frameworkiem Tauri:
[dyskusja dotycząca problemu w repozytorium Tauri](https://github.com/tauri-apps/tauri/issues/10702).

---

# 🌠 Zrzuty ekranu
<img src="./screenshots/img.png" alt="Strona główna">
<img src="./screenshots/img_1.png" alt="Wyniki wyszukiwania">
<img src="./screenshots/img_2.png" alt="Lista odcinków">
<img src="./screenshots/img_4.png" alt="Lista odtwarzaczy">
<img src="./screenshots/img_3.png" alt="Anime Hunter x Hunter">

---

# LICENCJA

MIT © 2025 Błażej Drozd
This project is not affiliated with Shinden.pl. It does not host or redistribute any copyrighted content.

Projekt nie jest powiązany z Shinden.pl.
Nie hostuje ani nie rozpowszechnia treści objętych prawem autorskim.
Służy wyłącznie jako alternatywny interfejs do istniejącej strony.

# ❤️ Wesprzyj rozwój
- ⭐ Zostaw gwiazdkę, jeśli Ci się podoba
- 🐞 Zgłoś błąd lub otwórz dyskusję
- 🧪 Pomóż testować nowe funkcje
- 🔧 Pull Requesty mile widziane!

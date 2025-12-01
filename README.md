# 🚀 Shinden Client 4

> **Nowoczesna, szybka aplikacja desktopowa dla użytkowników Shinden.pl**  
> Stworzona z pasji do anime — oparta na **Rust + Tauri + SvelteKit**.

---

![logo](./src-tauri/icons/256.png)

## 🧩 Co to jest?

**Shinden Client** to natywna aplikacja do przeglądania i oglądania anime na Shinden.pl — bez reklam, śledzenia i zbędnych elementów.  
Zamiast przeglądarki, dostajesz lekki, szybki i skoncentrowany na treści interfejs, który po prostu działa.

## 🌟 Najważniejsze cechy

- ⚡ **Błyskawiczne działanie** – aplikacja startuje w mniej niż sekundę
- 💾 **Niskie zużycie zasobów** – mniej niż 10 MB RAM
- 🧼 **Czysty interfejs bez reklam i popupów**
- 🌗 **Motywy jasny / ciemny**
- 🪵 **Konsola błędów i logów** — pomocna przy zgłoszeniach
- 📺 **Wbudowany odtwarzacz dla treści z cda.pl bez reklam**

---
## 🖥️ Kompatybilność
| System operacyjny | Obsługa |
|-------------------| ------- |
| 🪟 Windows        | ✅ Pełna |
| 🍎 macOS          | ✅ Pełna |
| 🐧 GNU/Linux      | ✅ Pełna |

---

# 🌠 Zrzuty ekranu
<img src="./screenshots/img.png" alt="Strona główna" width="50%">
<img src="./screenshots/img_1.png" alt="Wyniki wyszukiwania" width="50%">
<img src="./screenshots/img_2.png" alt="Lista odcinków" width="50%">
<img src="./screenshots/img_4.png" alt="Lista odtwarzaczy" width="50%">
<img src="./screenshots/img_3.png" alt="Anime Hunter x Hunter" width="50%">

---

## 🧪 Pierwsze uruchomienie w trybie testowym (dev)

1. **Zainstaluj zależności frontendu**: `npm install` (w katalogu repozytorium).
2. **Upewnij się, że masz toolchain Rust + Tauri**:
   - Rust (stable) z `cargo` oraz narzędzia systemowe (na Windows: MSVC build tools + `winget install --id=Microsoft.VCRedist.2015+.x64` jeśli brak redystrybucji).
   - Tauri CLI jest w devDependencies (`@tauri-apps/cli`), więc nie musisz go instalować globalnie.
3. **Uruchom aplikację w trybie developerskim**: `npm run tauri dev`.
   - Komenda automatycznie podniesie `npm run dev` (SvelteKit na `http://localhost:1420`) zgodnie z `tauri.conf.json`, a następnie otworzy okno desktopowe Tauri z hot-reloadem.
4. (Opcjonalnie) **Uruchom sam frontend w przeglądarce**: `npm run dev`.

> Jeśli pierwsze uruchomienie trwa dłużej, to normalne — Tauri buduje binarkę Rust i cache’uje zależności.

---

## 📦 Budowa instalatora/EXE (Windows)

1. **Przygotuj środowisko**:
   - Zainstaluj Rust (stable) i MSVC build tools.
   - Zainstaluj zależności frontendu: `npm install`.
2. **Zbuduj aplikację**: `npm run tauri build`.
   - Tauri najpierw wykona `npm run build` i użyje artefaktów z katalogu `build` (patrz `frontendDist` w `tauri.conf.json`).
   - Końcowe pliki znajdziesz w `src-tauri/target/release/bundle/` (np. `.msi`, `.exe`, ewentualnie `.nsis`).
3. **Dystrybucja**: do użytkowników przekazujesz wygenerowany instalator `.exe` (lub `.msi`).

> Podczas budowania weryfikuj logi cargo; jeśli brakuje bibliotek systemowych (np. Visual C++ Redistributable), doinstaluj je i powtórz `npm run tauri build`.

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

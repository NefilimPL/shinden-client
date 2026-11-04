# Lokalna biblioteka i prywatność

Użytkownik wybrał SQLite: jeden plik w lokalnym katalogu danych aplikacji. Zmiany obejmują klienta oraz `F:/_Github/shinden-pl-api-rs`, którego klient używa przez zależność ścieżkową.

## Zachowanie

- Baza zawiera profile Guest oraz konta o nazwach odpowiadających nickom. Wewnętrzny identyfikator konta pochodzi z publicznego ID Shinden; nick jest etykietą, nigdy ścieżką ani SQL-em.
- Każdy profil ma własne anime, opisy, kategorie, adresy grafik, listy odcinków i postęp. Statusy Oglądam, Obejrzane, Planuję, Pomijam, Wstrzymane i Porzucone są logicznymi folderami. Liczniki wynikają z lokalnych danych.
- Zapis statusu, oceny i obejrzenia odcinka jest lokalny, również po zalogowaniu. Brak automatycznego wysyłania zmian na serwer.
- Każde uruchomienie korzysta początkowo z Guest, bez wznawiania konta. Można jawnie wybrać istniejący lokalny profil bez połączenia z serwisem. Wylogowanie wybiera Guest.
- Połączenia z Shinden są domyślnie wyłączone. Zapisane cookies nie są automatycznie używane. Publiczne pobieranie używa oddzielnej sesji bez cookies konta, a logowanie jest opcjonalne i jawne. Materiały wymagające konta mogą korzystać z sesji tylko po jawnym logowaniu.
- Ustawienia zawierają przełączniki połączeń i importu, wyszukiwarkę użytkowników oraz pole na bezpośredni URL profilu. Import kopiuje publicznie dostępne listy do profilu wybranego w chwili rozpoczęcia, bez logowania na konto źródłowe. Brak dostępu lub błąd nie usuwa danych lokalnych. Ponowny import dodaje brakujące pozycje, zachowując lokalne zmiany istniejących pozycji.
- Pobrane metadane, odcinki i grafiki są zapisywane lokalnie. W trybie offline brak danych daje czytelny komunikat; zapisany link nie gwarantuje odtwarzania filmu offline.
- Stary cache JSON pozostaje nietknięty: nie znamy właściciela, więc nie wolno automatycznie przypisać go Guest ani dowolnemu kontu.
- Operacje sieciowe zapamiętują profil docelowy przed oczekiwaniem. Zmiana profilu nie może przekierować wyniku do innego profilu. UI zamyka poprzednie karty i listy.
- Blokada dostępu nie wywołuje rotacji identyfikatorów, proxy ani automatycznego obchodzenia ograniczeń. Lokalna baza nie jest gwarancją anonimowości po włączeniu sieci.

## Rozważone rozwiązania

SQLite wybrane przez użytkownika zapewnia pojedynczy plik bez serwera. MySQL wymagałby osobnej usługi. Dotychczasowy JSON nie zapewnia transakcji ani wystarczającego rozdzielenia danych.

## Weryfikacja

Testy SQLite: trwałość, izolacja profili, przełączanie podczas pobierania, Guest i nick Guest jako osobne tożsamości, idempotentny zapis odcinków, zachowanie lokalnych zmian przy imporcie. Testy API: brak sieci przy starcie/offline/zapisie postępu, publiczny import bez cookies konta, walidacja URL i parser użytkowników, obsługa blokady. Klient: dostęp Guest do list, brak automatycznej synchronizacji, ustawienia i reset kart po zmianie profilu. Pełne testy Rust i Node, svelte-check oraz build.

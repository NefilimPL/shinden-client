# Wiarygodne nowości, pełne filtry i zamykanie kart anime

## Cel

Naprawić trzy widoczne regresje klienta: brak ocen przy nowościach na stronie
głównej, błędne kodowanie napisu `Otwórz w Shinden` oraz zawodną obsługę
przycisku zamykania kart anime. Rozszerzyć także wyszukiwanie na stronie
głównej o filtry kategorii zgodne z aktualną strukturą Shinden.

## Zakres

Zmiana obejmuje klienta `shinden-client` oraz lokalną zależność
`shinden-pl-api-rs` wskazaną przez `src-tauri/Cargo.toml`.

### Oceny nowości

`get_main_premieres` zwraca pozycje `DiscoveryAnime`, lecz parser aktualnie
rozpoznaje wyłącznie pojedynczy token w formacie `8,7`. Parser będzie
wyodrębniał ocenę z granic pojedynczej karty i obsłuży:

- wartości tekstowe z przecinkiem lub kropką;
- wartość zapisaną w atrybucie karty;
- brak oceny jako pusty tekst, który klient konsekwentnie pokaże jako `-`.

Parser nie może pobrać liczby z sąsiedniej karty. Testy backendu będą zawierać
fixture z co najmniej dwiema kartami, różnymi formatami ocen i kartą bez oceny.

### Napis szczegółów anime

Komponent szczegółów anime będzie przechowywany i zapisywany w UTF-8; przycisk
otwierający serię w przeglądarce ma dokładny tekst `Otwórz w Shinden`.

### Zamykanie kart anime

Przycisk X będzie niezależną kontrolką nad przyciskiem aktywującym kartę. Jego
obsługa musi wywołać `preventDefault` i `stopPropagation`, a następnie zamknąć
wyłącznie kartę o przekazanym `titleId`. Kontrolka otrzyma wyższy `z-index`, by
warstwa karty nie przechwytywała kliknięcia. Istniejąca logika wyboru następnej
karty albo trwałej karty bazowej pozostaje bez zmian.

Test jednostkowy potwierdzi skonsumowanie zdarzenia i pojedyncze wywołanie
zamykania; istniejące testy workspace nadal weryfikują zmianę aktywnej karty.

## Zaawansowane wyszukiwanie

### Kontrakt API

Backend udostępni dwa polecenia Tauri:

- `get_search_filter_catalog` — pobiera formularz wyszukiwania Shinden i
  zwraca jego grupy, opcje oraz dostępne tryby wyboru;
- `search_with_filters` — przyjmuje tytuł oraz wybrane filtry, wysyła je do
  Shinden zgodnie z formularzem i zwraca `SearchAnime` z dotychczasowym
  statusem użytkownika.

Katalog filtrów nie będzie zakodowany na sztywno w interfejsie. Backend
zachowa techniczne nazwy i wartości pól formularza, ale klient otrzyma tylko
etykiety oraz stabilne identyfikatory potrzebne do renderowania i wysłania
wyboru. Dzięki temu dodanie lub zmiana opcji po stronie Shinden nie wymaga
wydania klienta.

Każda opcja wspierająca trzy stany będzie miała wartość `include`, `exclude`
lub `neutral`. Opcje bez negacji będą używane jako proste zaznaczenie. Pusty
tytuł i brak filtrów nadal pozwalają przeglądać katalog.

### Interfejs klienta

Kliknięcie `Filtry` na stronie głównej ładuje katalog tylko raz na otwarcie
panelu i wyświetla zakładki pobrane z Shinden. Obsługiwane są grupy widoczne w
formularzu serwisu: alfabetycznie, gatunki, grupy docelowe, rodzaje postaci,
miejsce i czas, pozostałe tagi, typy produkcji, pierwowzór, sezony i inne.

Panel zachowuje pole tytułu oraz dotychczasowy filtr minimalnej oceny jako
lokalne ograniczenie wyników. Dla gatunków pokaże skróconą legendę i wybór
`chcę / nie chcę / obojętne`; inne grupy dostosują kontrolkę do możliwości
zwróconych przez katalog. Udane wyszukiwanie otworzy stronę wyników, która
wyświetli dokładnie zbiór zwrócony przez API oraz zastosuje minimalną ocenę.

Wybór filtrów wejdzie do `SearchFilters`, a więc do istniejącego zapisu stanu
karty bazowej. Powrót z karty anime do wyników odtwarza zapytanie, filtry,
tryb listy/siatki oraz pozycję przewinięcia.

### Odporność na błędy

Jeżeli katalog filtrów nie zostanie pobrany, panel pokaże komunikat i nadal
pozwoli korzystać z prostego wyszukiwania po tytule. Błąd wyszukiwania z
filtrami nie zastępuje poprzednich wyników częściowym wynikiem. Brak oceny lub
metadanych w pojedynczym wyniku nigdy nie przerywa renderowania listy.

## Architektura i pliki

W API powstaną modele katalogu filtrów i wyboru użytkownika, parser formularza
oraz generator żądania filtrowanego wyszukiwania. Parser wyników będzie
wspólny dla zwykłego i zaawansowanego wyszukiwania. Testy danych HTML pozostaną
całkowicie offline.

W kliencie moduł `searchFilters.ts` będzie właścicielem typów, wartości
domyślnych, serializowalnego wyboru oraz lokalnego progu oceny. Strona główna
wyświetli panel katalogu, a strona wyników wybierze zwykłe albo filtrowane
polecenie Tauri zależnie od aktywnych filtrów. Mały moduł interakcji zamykania
karty izoluje obsługę kliknięcia od komponentu Svelte.

## Testowanie i weryfikacja

- testy Rust dla parsera ocen, formularza filtrów i kodowania wyboru do
  żądania Shinden;
- test kontraktu JSON typów katalogu i wyszukiwania filtrowanego;
- testy Node dla stanu filtrów, zachowania lokalnego progu oceny i obsługi X;
- `npm run check` i wszystkie testy Node klienta;
- `cargo test --manifest-path src-tauri/Cargo.toml` oraz testy API Rust.

## Poza zakresem

Zmiana nie klonuje całej strony Shinden, nie dodaje filtrowania mang, novel ani
rankingu oraz nie zapisuje pełnego katalogu Shinden lokalnie. Nie zmienia też
istniejącego mechanizmu logowania lub statusów oglądania.

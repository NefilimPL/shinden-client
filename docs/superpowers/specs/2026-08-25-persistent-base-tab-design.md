# Trwała karta bazowa i nawigacja kart anime

## Cel

Obszar roboczy anime ma mieć zawsze widoczną, niezamykalną kartę nr 1. Jest
to karta bazowa aktualnie używanego widoku listy: `Oglądam`, `Moje listy
anime`, wyniki wyszukiwania albo przeglądarka sezonowa. Otwierane anime są
kolejnymi, zamykalnymi kartami. Zamknięcie ostatniej karty anime zawsze
przywraca kartę bazową wraz z jej stanem i pozycją przewinięcia.

Zmiana naprawia również regresje z obsługi kliknięć kart, niedostarczaną nazwę
anime przy pobieraniu odcinków, literówkę przy powrocie z odtwarzacza oraz
brak danych dla filtra kategorii wiekowej.

## Zachowanie użytkownika

### Karta bazowa

Karta nr 1 jest wyświetlana przed wszystkimi kartami anime, nie ma przycisku
zamknięcia i otrzymuje etykietę aktywnego widoku bazowego. Przełączenie między
widokami bazowymi nie tworzy nowych kart: zastępuje zawartość karty nr 1 i
zapamiętuje jej kontekst.

Do obsługiwanych widoków bazowych należą:

- `Oglądam`;
- `Moje listy anime`;
- wyniki wyszukiwania;
- przeglądarka sezonowa.

Kontekst sezonów zawiera wybrany rok, sezon i przewinięcie. Pozostałe widoki
zachowują parametry potrzebne do odtworzenia ich ekranu, takie jak zapytanie,
filtry, tryb prezentacji i przewinięcie. Jeśli przyszła przeglądarka sezonowa
otrzyma numerowaną paginację, jej numer strony będzie kolejnym polem tego
kontekstu; obecny widok sezonów takiej paginacji nie posiada.

### Otwieranie anime

Lewy klik otwiera anime w nowej karcie i natychmiast ją aktywuje. Przed
nawigacją zapisuje stan karty bazowej albo aktywnej karty anime. Środkowy klik
tworzy kartę anime w tle: nowa karta pojawia się na pasku, lecz aktualny widok
i przewinięcie pozostają bez zmian.

Jeśli anime ma już kartę, lewy klik aktywuje istniejącą kartę, a środkowy klik
pozostawia bieżącą kartę aktywną. Te same reguły obowiązują dla listy
oglądanych, list użytkownika, wyników wyszukiwania, sezonów, strony głównej i
serii powiązanych.

### Zamykanie kart i tryb bez kart

Zamknięcie aktywnej karty anime aktywuje jej najbliższą sąsiadkę. Zamknięcie
ostatniej karty anime aktywuje kartę bazową i przywraca jej widok oraz zapisane
przewinięcie. Karta bazowa nie może zostać zamknięta.

Wybranie `Bez kart` celowo usuwa wszystkie karty anime oraz ukrywa pasek kart.
Późniejsze lewe kliknięcie otwiera anime bez tworzenia sesji kart, a środkowy
klik nie wykonuje akcji. Powrót do układu pionowego lub poziomego zaczyna nowy
obszar kart od trwałej karty bazowej.

## Architektura

`titleWorkspace` pozostaje pojedynczym źródłem prawdy, ale stan będzie
modelował kartę bazową niezależnie od sesji anime. Karta bazowa będzie
zdefiniowaną sumą kontekstów dla czterech obsługiwanych widoków. Każdy
kontekst ma trwały identyfikator widoku, etykietę, pozycję przewinięcia oraz
parametry odtwarzania danego ekranu. Sesja anime zachowuje nazwę, URL,
identyfikator, podwidok odcinków/odtwarzaczy/odtwarzania i postęp odcinków.

Aktywna karta będzie opisana typem, a nie tylko opcjonalnym `titleId`. Dzięki
temu operacje otwarcia w tle, aktywowania, zamykania i przywracania mogą
jednoznacznie rozróżnić kartę bazową od anime.

Moduł `titleNavigation` otrzyma dwa jawne wejścia: otwarcie i aktywowanie oraz
otwarcie w tle. Zapisuje kontekst aktualnej karty przed zmianą stanu, a po
aktywacji odtwarza właściwy kontekst i wykonuje nawigację. Konwersja sesji
anime na globalny kontekst nawigacji będzie obejmować `animeName`; pobieranie
odcinków przestanie zatem przekazywać pustą nazwę do backendu.

Każdy widok bazowy udostępni swój kontener przewijania oraz kontekst do
zapisu i odtworzenia. `TitleTabs` wyrenderuje kartę bazową zawsze jako pierwszą
i bez przycisku zamknięcia. Karty anime zachowają istniejące zamykanie i stan
aktywny.

## Dane i odtwarzanie widoków

Przed wyjściem z widoku bazowego nawigacja zapisuje jego stan do obszaru kart.
Po aktywowaniu karty bazowej nawigacja najpierw przechodzi do właściwej trasy,
następnie przekazuje parametry widokowi i po jego wyrenderowaniu przewija jego
właściwy kontener. Pozwala to odtworzyć wybór roku/sezonu i pozycję listy,
a nie jedynie adres trasy.

W przypadku braku, starej wersji lub niepoprawnych pól zapisanego kontekstu
używane są bezpieczne wartości domyślne dla danego widoku. Karta bazowa nadal
pozostaje dostępna, a błąd odtworzenia nie blokuje zamykania ani przełączania
kart anime.

## Poprawki niezwiązane z układem kart

Przycisk w odtwarzaczu otrzyma tekst `Wróć do anime`.

Filtr kategorii wiekowej korzysta z danych cache list użytkownika. Backend
`shinden-pl-api-rs` rozszerzy parser metadanych szczegółów anime o etykietę
`MPAA` obok istniejących etykiet wieku. Odświeżenie cache list wypełni wtedy
`ageRating`, a selektor klienta pokaże dostępne wartości. Gdy cache naprawdę
nie zawiera żadnej kategorii wieku, selektor pozostaje nieaktywny i komunikuje
konieczność odświeżenia, zamiast obiecywać filtr bez danych.

## Testowanie

Testy klienta obejmą:

- trwałą kartę bazową, jej niezamykalność i kolejność przed kartami anime;
- zapisywanie i odtwarzanie kontekstu widoków bazowych, w tym sezonu i
  przewinięcia;
- lewy klik aktywujący kartę oraz środkowy klik tworzący kartę w tle;
- zachowanie istniejącej karty przy obu typach kliknięć;
- aktywowanie sąsiada po zamknięciu oraz powrót do karty bazowej po ostatnim
  zamknięciu;
- czyszczenie sesji w trybie `Bez kart` i brak akcji środkowego kliknięcia;
- przekazywanie `animeName` z sesji anime do pobierania odcinków;
- poprawny napis powrotu w odtwarzaczu.

Test backendu obejmie odczyt kategorii `MPAA` i zapis jej do danych list
użytkownika. Weryfikacja końcowa obejmie wybrane testy Node, pełne `npm run
check`, test backendu Cargo oraz testy klienta.

## Poza zakresem

Zmiana nie zapisuje otwartych kart anime po restarcie aplikacji i nie dodaje
numerowanej paginacji do przeglądarki sezonowej. Nie zmienia także reguł
filtrowania wieku: naprawia źródło danych wymaganych przez istniejący filtr.

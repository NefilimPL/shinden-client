# Powiadomienia o odcinkach anime z listy „Planuję”

## Cel

Użytkownik ma zobaczyć w aplikacji nowe dostępne odcinki anime oznaczonych
statusem „Planuję”, także gdy tytuł przez dłuższy czas nie miał odcinków.
Funkcja ma działać oszczędnie: nie może zakłócać ręcznych działań ani generować
dużego ruchu do Shinden.

## Zakres interfejsu

- W prawym obszarze paska nawigacji pojawia się przycisk dzwonka.
- Gdy istnieją nieprzeczytane wpisy, przycisk pokazuje licznik i subtelną
  animację drżenia/pulsowania. Użytkownik ma dostęp do animacji ograniczonej
  preferencją `prefers-reduced-motion`.
- Kliknięcie otwiera panel z ostatnimi 20 powiadomieniami, od najnowszego.
  Wpis zawiera obrazek, nazwę anime, numer/tytuł pierwszego dostępnego
  odcinka oraz czas wykrycia. Kliknięcie prowadzi do odcinków danego tytułu.
- Otwarcie panelu oznacza widoczne wpisy jako przeczytane. Kolejne wykryte
  pozycje ponownie aktywują wskaźnik na dzwonku.
- Ustawienia aplikacji otrzymają przełącznik „Zamykaj do zasobnika
  systemowego”. Domyślnie wyłączony: `X` kończy proces. Po włączeniu `X`
  ukrywa okno w trayu, gdzie użytkownik może je ponownie otworzyć lub
  zakończyć aplikację.

## Dane trwałe

Stan przechowywany lokalnie, niezależnie od sesji:

- historia maksymalnie 20 powiadomień i informacja, które są przeczytane;
- identyfikator ostatniego zgłoszonego odcinka dla tytułu, aby identyczny
  odcinek nie generował kolejnego alertu;
- pozycja w kolejce, harmonogram kolejnej próby i liczba kolejnych błędów;
- zapisana data najbliższej emisji, gdy Shinden ją udostępnia.

Zmiana statusu tytułu poza „Planuję” usuwa go z kolejki. Dodanie tytułu do
„Planuję” dodaje go bez historii alertów, aby pierwsza synchronizacja ustaliła
stan bazowy bez zgłaszania starych odcinków jako nowości.

## Pobieranie i harmonogram

1. Główne odświeżenie listy użytkownika dostarcza tytuły ze statusem
   „Planuję”. Dla tytułów wymagających odświeżenia metadanych menedżer może
   pobrać szczegóły i odczytać „Data emisji”.
2. W kolejce tytuł jest sprawdzany przez pobranie listy odcinków i ocenę
   wyłącznie pierwszego nieobejrzanego odcinka. Nie sprawdzamy playerów ani
   wszystkich odcinków.
3. Jeżeli data emisji istnieje i jest późniejsza niż bieżący lokalny dzień,
   tytuł jest pomijany bez żądania listy odcinków do tej daty.
4. Kolejka wysyła najwyżej jedno żądanie naraz, z bazowym odstępem pięciu
   sekund. Po pełnym obiegu czeka przed następnym obiegiem; wpisy z datą
   przyszłej emisji nadal są pomijane.
5. Priorytet mają działania użytkownika i istniejące odświeżanie „Oglądam”.
   W ich trakcie kolejka jest wstrzymana. Błąd sieci powoduje wykładnicze
   opóźnienie ponownej próby danego tytułu, nie szybkie powtarzanie żądań.
6. Kolejka zapisuje postęp po każdej pozycji. Przy następnym uruchomieniu,
   a także gdy okno jest schowane do trayu, wznawia się od tego miejsca.

## Granice implementacji

- Frontendowy menedżer powiadomień korzysta z istniejących wywołań Tauri do
  pobrania list użytkownika, szczegółów anime i odcinków. Nie rozszerza
  odświeżania „Oglądam” ani nie sprawdza dostępności playerów.
- Dane powiadomień i harmonogram są lokalne w `localStorage`; brak logowania
  albo chwilowa awaria nie usuwa historii ani nie blokuje interfejsu.
- Obsługa trayu i przechwycenia zamknięcia okna jest natywną częścią Tauri.
  Pełne zakończenie z menu trayu zatrzymuje kolejkę.

## Obsługa błędów

- Nieudane pojedyncze sprawdzenie zapisuje błąd diagnostyczny i wyznacza
  późniejszą próbę; nie tworzy powiadomienia.
- Nieprawidłowa/missing data emisji traktowana jest jak brak daty, więc nie
  blokuje tytułu na zawsze.
- Uszkodzone dane lokalne są ignorowane i zastępowane poprawnym pustym stanem.

## Weryfikacja

- Testy jednostkowe kolejki: wybór pierwszego nieobejrzanego odcinka,
  deduplikacja, limit historii, odroczenie względem daty emisji, odnowienie
  po błędach i priorytet wstrzymania.
- Testy komponentu dzwonka: licznik nieprzeczytanych, kolejność historii,
  oznaczanie jako przeczytane i link do tytułu.
- Testy Rust: domyślne faktyczne zamykanie, ukrycie do trayu po aktywowaniu
  ustawienia oraz akcje menu trayu.
- Przed przekazaniem: `npm run check`, testy JavaScript oraz odpowiednie testy
  Cargo.

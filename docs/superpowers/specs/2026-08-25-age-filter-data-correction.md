# Korekta specyfikacji: dane filtra kategorii wiekowej

## Ustalenie

Lokalny backend `shinden-pl-api-rs` już rozpoznaje etykietę `MPAA` podczas
odświeżania szczegółów anime, przypisuje wynik do `ageRating` i zawiera test
jednostkowy tej ścieżki. Nie wymaga zmiany parsera.

Pusty i nieaktywny selektor kategorii wiekowej oznacza, że bieżący cache list
użytkownika nie zawiera jeszcze pobranych metadanych szczegółów. Istniejące
odświeżenie cache uzupełnia te dane, ale obecny interfejs sygnalizuje je tylko
ogólną ikoną odświeżania poza filtrem.

## Zastępujące zachowanie

Gdy lista użytkownika nie ma żadnej wartości `ageRating`, przy selektorze
wieku będzie widoczny przycisk `Pobierz kategorie wiekowe`. Wywoła istniejące
odświeżenie cache list, pozostanie nieaktywny podczas trwającego odświeżenia,
a po jego zakończeniu selektor automatycznie otrzyma wartości z ponownie
wczytanych elementów. Nie powstaną nowe wywołania backendu ani równoległe
odświeżenia.

Test klienta sprawdzi decyzję o pokazaniu tej akcji dla aktywnej listy bez
kategorii wieku i jej ukrycie, gdy cache ma co najmniej jedną kategorię.
Test Cargo dla `MPAA` będzie uruchomiony wyłącznie jako kontrola istniejącej
zależności.

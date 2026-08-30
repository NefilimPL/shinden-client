# Niezawodne zamykanie kart anime

## Cel

Kliknięcie przycisku zamknięcia zawsze usuwa wskazaną kartę dokładnie raz.
Zamknięcie aktywnej karty przenosi użytkownika na ostatnio oglądaną kartę,
która nadal jest otwarta; po zamknięciu ostatniej karty tytułowej wraca do
karty bazowej.

## Problem

Obecny przepływ rozdziela usunięcie karty, wybór następnej karty i nawigację.
Wybiera on sąsiada w kolejności paska, a przycisk X przekazuje zamykanie przez
asynchroniczną ścieżkę zdarzeń komponentu. W praktyce kliknięcie może zostać
przechwycone przez aktywację karty lub kolejny klik może uruchomić drugi,
niespójny przebieg nawigacji.

## Projekt

### Stan workspace'u

`TitleWorkspaceState` otrzyma listę identyfikatorów ostatnio oglądanych kart
tytułowych (MRU). Lista zawiera każdy aktualnie otwarty `titleId` najwyżej raz,
a jej pierwszy element jest najnowszy.

Włączenie istniejącej karty, otwarcie nowej aktywnej karty i przywrócenie
karty jako aktywnej aktualizują MRU. Otwarcie karty w tle nie zmienia historii.
Karta bazowa nie jest wpisywana do MRU.

### Atomowe zamknięcie

Nowa czysta operacja stanu zwraca rezultat zamknięcia: nowy stan workspace'u,
informację, czy zamknięta karta była aktywna, oraz docelową sesję albo kartę
bazową. Operacja:

1. ignoruje brakujący `titleId`, bez zmiany stanu;
2. usuwa kartę z `tabs` i z MRU;
3. przy zamknięciu nieaktywnej karty zachowuje bieżącą aktywną kartę;
4. przy zamknięciu aktywnej karty wybiera pierwsze `titleId` z pozostałego MRU,
   które nadal ma sesję;
5. wybiera kartę bazową, gdy nie ma już dostępnej karty tytułowej.

Warstwa reaktywna zastosuje rezultat stanu przed rozpoczęciem nawigacji.
Warstwa nawigacji użyje wskazanego przez rezultat celu, zamiast odczytywać
ponownie aktywną sesję po usunięciu. Dzięki temu wybór następnej karty jest
jednoznaczny i niezależny od kolejności odświeżeń Svelte lub `goto`.

### Kontrolka X

Kontrolka zamknięcia pozostanie osobnym elementem interaktywnym, poza
kontrolką aktywacji karty. Dostanie czytelny obszar trafienia oraz obsługę
wskaźnika blokującą domyślne zachowanie i propagację zanim uruchomi pojedyncze
żądanie zamknięcia. Komponent będzie śledził identyfikatory kart, których
zamknięcie jest w toku, aby dodatkowe kliknięcia tej samej kontrolki nie
uruchamiały równoległej nawigacji.

Po skutecznym domknięciu karty identyfikator znika z blokady. Jeżeli karta
została już usunięta przez pierwszy klik, kolejne żądanie pozostaje
idempotentne i nie zmienia aktywnego widoku.

## Granice odpowiedzialności

| Moduł | Odpowiedzialność |
| --- | --- |
| `titleWorkspace.ts` | Niezmiennicze reguły MRU i atomowy wynik zamknięcia. |
| `titleWorkspace.svelte.ts` | Reaktywny właściciel stanu oraz udostępnienie wyniku zamknięcia. |
| `titleNavigation.ts` | Zapis bieżącego kontekstu, zastosowanie wyniku i nawigacja do jego celu. |
| `TitleTabs.svelte` | Dostępna kontrolka X, izolacja zdarzenia i blokada podwójnego żądania. |
| testy Node | Kontrakt MRU, wyboru celu, idempotencji i interakcji kontrolki. |

## Obsługa błędów i niezmienniki

- `activeTab` po każdej operacji wskazuje kartę bazową albo istniejącą sesję.
- MRU nie zawiera duplikatów ani zamkniętych kart.
- Nieudana lub opóźniona nawigacja nie przywraca zamkniętej karty.
- Zamykanie nieaktywnej karty nie zmienia aktualnego widoku.
- Zamknięcie ostatniej karty zachowuje kontekst karty bazowej.

## Testowanie

- aktywowanie kart buduje kolejność MRU niezależnie od ich kolejności na pasku;
- zamknięcie aktywnej karty wybiera ostatnio oglądaną, nadal otwartą kartę;
- zamknięcie karty usuniętej wcześniej jest bezpieczne i nie zmienia stanu;
- zamknięcie nieaktywnej karty nie przełącza widoku;
- ostatnia karta tytułowa prowadzi do karty bazowej z zachowanym kontekstem;
- zdarzenie z X jest konsumowane i tylko raz inicjuje zamykanie, również przy
  szybkim wielokrotnym kliknięciu;
- `npm run check` i cały zestaw testów Node przechodzą bez błędów.

## Poza zakresem

Zmiana nie zapisuje otwartych kart ani historii MRU między uruchomieniami, nie
zmienia układu paska kart i nie zmienia zachowania otwierania kart w tle poza
tym, że nie wpływają one na MRU.

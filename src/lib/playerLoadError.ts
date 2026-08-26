export function playerLoadErrorMessage(error: unknown): string {
    const detail = String(error);
    if (/\b403\b|forbidden/i.test(detail)) {
        return "Shinden odmówił dostępu do odtwarzacza. Wybierz inny serwer lub spróbuj ponownie za chwilę.";
    }

    return "Nie udało się załadować odtwarzacza. Spróbuj ponownie lub wybierz inny serwer.";
}

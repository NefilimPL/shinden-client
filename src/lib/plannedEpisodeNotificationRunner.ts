export type PlannedCheckConditions = {
    watchingRefreshRunning: boolean;
    userListRefreshRunning: boolean;
    userLoggedIn: boolean;
};

export function shouldRunPlannedCheck(conditions: PlannedCheckConditions): boolean {
    return conditions.userLoggedIn
        && !conditions.watchingRefreshRunning
        && !conditions.userListRefreshRunning;
}

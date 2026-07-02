package io.muzoo.ic.gloria.leaderboard;

/** One leaderboard row; bestTimeMs is null until the user has a victory. */
public record LeaderboardEntry(String username, int wins, int points, Long bestTimeMs) {
}

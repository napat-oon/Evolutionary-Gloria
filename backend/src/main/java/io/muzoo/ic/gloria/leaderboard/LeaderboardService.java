package io.muzoo.ic.gloria.leaderboard;

import java.util.List;

public interface LeaderboardService {

    List<LeaderboardEntry> topPlayers(int page, int size);
}

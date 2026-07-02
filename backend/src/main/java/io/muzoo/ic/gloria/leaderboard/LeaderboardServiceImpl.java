package io.muzoo.ic.gloria.leaderboard;

import io.muzoo.ic.gloria.user.UserRepository;
import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

@Service
public class LeaderboardServiceImpl implements LeaderboardService {

    private final UserRepository userRepository;

    public LeaderboardServiceImpl(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public List<LeaderboardEntry> topPlayers(int page, int size) {
        return userRepository.findLeaderboard(PageRequest.of(page, size));
    }
}

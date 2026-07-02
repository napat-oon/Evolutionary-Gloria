package io.muzoo.ic.gloria.match;

import io.muzoo.ic.gloria.common.ApiException;
import io.muzoo.ic.gloria.user.User;
import io.muzoo.ic.gloria.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MatchServiceImpl implements MatchService {

    public static final int VICTORY_POINTS = 150;
    public static final int DEFEAT_POINTS = 30;

    private final MatchResultRepository matchRepository;
    private final UserRepository userRepository;

    public MatchServiceImpl(MatchResultRepository matchRepository, UserRepository userRepository) {
        this.matchRepository = matchRepository;
        this.userRepository = userRepository;
    }

    @Override
    @Transactional
    public long startMatch(long userId, String boss) {
        return matchRepository.save(new MatchResult(userId, boss)).getId();
    }

    @Override
    @Transactional
    public MatchResult completeMatch(long userId, long matchId, boolean victory) {
        MatchResult match = matchRepository.findByIdAndUserId(matchId, userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Match not found"));
        if (match.isCompleted()) {
            throw new ApiException(HttpStatus.CONFLICT, "Match already completed");
        }
        int points = victory ? VICTORY_POINTS : DEFEAT_POINTS;
        match.complete(victory, points);
        matchRepository.save(match);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));
        user.setPoints(user.getPoints() + points);
        if (victory) {
            user.setWins(user.getWins() + 1);
        }
        userRepository.save(user);
        return match;
    }
}

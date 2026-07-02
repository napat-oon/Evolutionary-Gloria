package io.muzoo.ic.gloria.user;

import io.muzoo.ic.gloria.leaderboard.LeaderboardEntry;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface UserRepository extends JpaRepository<User, Long> {

    @Query("""
            SELECT new io.muzoo.ic.gloria.leaderboard.LeaderboardEntry(
                u.username, u.wins, u.points,
                (SELECT MIN(m.durationMs) FROM MatchResult m
                 WHERE m.userId = u.id AND m.victory = TRUE))
            FROM User u
            ORDER BY u.wins DESC, u.points DESC, u.username ASC
            """)
    List<LeaderboardEntry> findLeaderboard(Pageable pageable);

    Optional<User> findByUsernameIgnoreCase(String username);

    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByUsernameIgnoreCase(String username);

    boolean existsByEmailIgnoreCase(String email);
}

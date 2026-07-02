package io.muzoo.ic.gloria.match;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Duration;
import java.time.LocalDateTime;

@Entity
@Table(name = "match_results")
public class MatchResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 64)
    private String boss;

    @Column(nullable = false)
    private boolean victory;

    @Column(name = "duration_ms")
    private Long durationMs;

    @Column(name = "points_earned", nullable = false)
    private int pointsEarned;

    @Column(name = "started_at", nullable = false, updatable = false)
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    protected MatchResult() {
        // for JPA
    }

    public MatchResult(Long userId, String boss) {
        this.userId = userId;
        this.boss = boss;
        this.startedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public String getBoss() {
        return boss;
    }

    public boolean isVictory() {
        return victory;
    }

    public Long getDurationMs() {
        return durationMs;
    }

    public int getPointsEarned() {
        return pointsEarned;
    }

    public LocalDateTime getStartedAt() {
        return startedAt;
    }

    public boolean isCompleted() {
        return completedAt != null;
    }

    /** Marks the match finished, deriving the duration from the server-side start time. */
    public void complete(boolean victory, int pointsEarned) {
        this.completedAt = LocalDateTime.now();
        this.victory = victory;
        this.pointsEarned = pointsEarned;
        this.durationMs = Duration.between(startedAt, completedAt).toMillis();
    }
}

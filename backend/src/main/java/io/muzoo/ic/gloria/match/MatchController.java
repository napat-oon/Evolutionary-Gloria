package io.muzoo.ic.gloria.match;

import io.muzoo.ic.gloria.auth.AuthenticatedUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/match")
public class MatchController {

    /** The only boss fight for now. */
    private static final String BOSS_SIRIUS_ORION = "sirius-orion";

    private final MatchService matchService;

    public MatchController(MatchService matchService) {
        this.matchService = matchService;
    }

    public record StartResponse(long matchId) {
    }

    public record CompleteRequest(@NotNull Long matchId, @NotNull Boolean victory) {
    }

    public record CompleteResponse(long matchId, boolean victory, long durationMs, int pointsEarned) {
    }

    @PostMapping("/start")
    public StartResponse start(@AuthenticationPrincipal AuthenticatedUser user) {
        return new StartResponse(matchService.startMatch(user.id(), BOSS_SIRIUS_ORION));
    }

    @PostMapping("/complete")
    public CompleteResponse complete(@AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody CompleteRequest request) {
        MatchResult match = matchService.completeMatch(user.id(), request.matchId(), request.victory());
        return new CompleteResponse(match.getId(), match.isVictory(),
                match.getDurationMs(), match.getPointsEarned());
    }
}

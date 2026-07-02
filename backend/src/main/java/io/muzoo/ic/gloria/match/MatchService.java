package io.muzoo.ic.gloria.match;

public interface MatchService {

    /** Starts a match for the user and returns the match id. */
    long startMatch(long userId, String boss);

    /**
     * Completes a previously started match. The server derives duration and
     * points; the client only reports the outcome.
     *
     * @return the completed match including points earned
     */
    MatchResult completeMatch(long userId, long matchId, boolean victory);
}

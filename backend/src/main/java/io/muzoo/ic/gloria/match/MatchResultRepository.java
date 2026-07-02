package io.muzoo.ic.gloria.match;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MatchResultRepository extends JpaRepository<MatchResult, Long> {

    Optional<MatchResult> findByIdAndUserId(Long id, Long userId);
}

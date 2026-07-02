package io.muzoo.ic.gloria.user;

import java.util.Optional;

public interface UserService {

    User register(String username, String email, String rawPassword);

    Optional<User> findById(long id);

    /** Finds by username or email, case-insensitive. */
    Optional<User> findByLogin(String usernameOrEmail);

    void changePassword(User user, String rawPassword);
}

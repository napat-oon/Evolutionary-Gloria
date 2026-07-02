package io.muzoo.ic.gloria.user;

import io.muzoo.ic.gloria.common.ApiException;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserServiceImpl(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public User register(String username, String email, String rawPassword) {
        if (userRepository.existsByUsernameIgnoreCase(username)) {
            throw new ApiException(HttpStatus.CONFLICT, "Username is already taken");
        }
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new ApiException(HttpStatus.CONFLICT, "Email is already registered");
        }
        User user = new User(username, email, passwordEncoder.encode(rawPassword));
        return userRepository.save(user);
    }

    @Override
    public Optional<User> findById(long id) {
        return userRepository.findById(id);
    }

    @Override
    public Optional<User> findByLogin(String usernameOrEmail) {
        return userRepository.findByUsernameIgnoreCase(usernameOrEmail)
                .or(() -> userRepository.findByEmailIgnoreCase(usernameOrEmail));
    }

    @Override
    @Transactional
    public void changePassword(User user, String rawPassword) {
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        userRepository.save(user);
    }
}

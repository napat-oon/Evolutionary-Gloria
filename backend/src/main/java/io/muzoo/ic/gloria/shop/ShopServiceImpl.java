package io.muzoo.ic.gloria.shop;

import io.muzoo.ic.gloria.common.ApiException;
import io.muzoo.ic.gloria.user.User;
import io.muzoo.ic.gloria.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ShopServiceImpl implements ShopService {

    public static final int POTION_PRICE = 50;
    public static final int MAX_POTIONS = 9;

    private final UserRepository userRepository;

    public ShopServiceImpl(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public int potionPrice() {
        return POTION_PRICE;
    }

    @Override
    public int maxPotions() {
        return MAX_POTIONS;
    }

    @Override
    @Transactional
    public User buyPotions(long userId, int quantity) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));
        if (user.getPotions() + quantity > MAX_POTIONS) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "You can carry at most " + MAX_POTIONS + " potions");
        }
        int cost = POTION_PRICE * quantity;
        if (user.getPoints() < cost) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Not enough points");
        }
        user.setPoints(user.getPoints() - cost);
        user.setPotions(user.getPotions() + quantity);
        return userRepository.save(user);
    }
}

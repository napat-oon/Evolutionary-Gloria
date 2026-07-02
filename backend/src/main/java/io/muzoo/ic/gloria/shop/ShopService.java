package io.muzoo.ic.gloria.shop;

import io.muzoo.ic.gloria.user.User;

public interface ShopService {

    int potionPrice();

    int maxPotions();

    /**
     * Buys {@code quantity} potions, deducting points.
     *
     * @return the updated user
     * @throws io.muzoo.ic.gloria.common.ApiException when points are
     *         insufficient or the potion cap would be exceeded
     */
    User buyPotions(long userId, int quantity);
}

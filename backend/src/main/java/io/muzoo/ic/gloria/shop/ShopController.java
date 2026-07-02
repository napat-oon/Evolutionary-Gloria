package io.muzoo.ic.gloria.shop;

import io.muzoo.ic.gloria.auth.AuthenticatedUser;
import io.muzoo.ic.gloria.auth.dto.AuthDtos.UserResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/shop")
public class ShopController {

    private final ShopService shopService;

    public ShopController(ShopService shopService) {
        this.shopService = shopService;
    }

    public record BuyPotionsRequest(@NotNull @Min(1) @Max(9) Integer quantity) {
    }

    public record ShopInfoResponse(int potionPrice, int maxPotions) {
    }

    @GetMapping
    public ShopInfoResponse info() {
        return new ShopInfoResponse(shopService.potionPrice(), shopService.maxPotions());
    }

    @PostMapping("/potions")
    public UserResponse buyPotions(@AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody BuyPotionsRequest request) {
        return UserResponse.from(shopService.buyPotions(user.id(), request.quantity()));
    }
}

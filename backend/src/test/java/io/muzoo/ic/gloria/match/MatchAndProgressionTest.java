package io.muzoo.ic.gloria.match;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import io.muzoo.ic.gloria.auth.AuthCookies;
import io.muzoo.ic.gloria.shop.ShopServiceImpl;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MatchAndProgressionTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private Cookie registerAndGetCookie(String username) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"%s","email":"%s@example.com","password":"password123"}
                                """.formatted(username, username)))
                .andExpect(status().isCreated())
                .andReturn();
        return result.getResponse().getCookie(AuthCookies.ACCESS_COOKIE);
    }

    private long startMatch(Cookie auth) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/match/start").cookie(auth))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString())
                .get("matchId").asLong();
    }

    private JsonNode completeMatch(Cookie auth, long matchId, boolean victory) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/match/complete").cookie(auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"matchId":%d,"victory":%s}
                                """.formatted(matchId, victory)))
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    @Test
    void matchStartRequiresAuth() throws Exception {
        mockMvc.perform(post("/api/match/start")).andExpect(status().isUnauthorized());
    }

    @Test
    void victoryAwardsPointsAndWin() throws Exception {
        Cookie auth = registerAndGetCookie("winner");
        long matchId = startMatch(auth);
        JsonNode completed = completeMatch(auth, matchId, true);
        assertThat(completed.get("pointsEarned").asInt()).isEqualTo(MatchServiceImpl.VICTORY_POINTS);

        mockMvc.perform(get("/api/auth/me").cookie(auth))
                .andExpect(jsonPath("$.wins").value(1))
                .andExpect(jsonPath("$.points").value(MatchServiceImpl.VICTORY_POINTS));
    }

    @Test
    void defeatAwardsConsolationPointsAndNoWin() throws Exception {
        Cookie auth = registerAndGetCookie("loser");
        long matchId = startMatch(auth);
        completeMatch(auth, matchId, false);

        mockMvc.perform(get("/api/auth/me").cookie(auth))
                .andExpect(jsonPath("$.wins").value(0))
                .andExpect(jsonPath("$.points").value(MatchServiceImpl.DEFEAT_POINTS));
    }

    @Test
    void completingTwiceIsConflict() throws Exception {
        Cookie auth = registerAndGetCookie("repeater");
        long matchId = startMatch(auth);
        completeMatch(auth, matchId, true);

        mockMvc.perform(post("/api/match/complete").cookie(auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"matchId":%d,"victory":true}
                                """.formatted(matchId)))
                .andExpect(status().isConflict());
    }

    @Test
    void cannotCompleteSomeoneElsesMatch() throws Exception {
        Cookie alice = registerAndGetCookie("alice");
        Cookie bob = registerAndGetCookie("bob");
        long aliceMatch = startMatch(alice);

        mockMvc.perform(post("/api/match/complete").cookie(bob)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"matchId":%d,"victory":true}
                                """.formatted(aliceMatch)))
                .andExpect(status().isNotFound());
    }

    @Test
    void buyingPotionsDeductsPoints() throws Exception {
        Cookie auth = registerAndGetCookie("shopper");
        long matchId = startMatch(auth);
        completeMatch(auth, matchId, true); // 150 points

        mockMvc.perform(post("/api/shop/potions").cookie(auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"quantity":2}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.potions").value(2))
                .andExpect(jsonPath("$.points").value(
                        MatchServiceImpl.VICTORY_POINTS - 2 * ShopServiceImpl.POTION_PRICE));
    }

    @Test
    void buyingPotionsWithoutPointsFails() throws Exception {
        Cookie auth = registerAndGetCookie("broke");
        mockMvc.perform(post("/api/shop/potions").cookie(auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"quantity":1}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void leaderboardOrdersByWinsAndShowsBestTime() throws Exception {
        Cookie strong = registerAndGetCookie("champion");
        Cookie weak = registerAndGetCookie("challenger");

        completeMatch(strong, startMatch(strong), true);
        completeMatch(strong, startMatch(strong), true);
        completeMatch(weak, startMatch(weak), false);

        mockMvc.perform(get("/api/leaderboard").cookie(strong))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].username").value("champion"))
                .andExpect(jsonPath("$[0].wins").value(2))
                .andExpect(jsonPath("$[0].bestTimeMs").isNumber());
    }
}

package io.muzoo.ic.gloria.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
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
class AuthFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private MvcResult register(String username, String email, String password) throws Exception {
        return mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"%s","email":"%s","password":"%s"}
                                """.formatted(username, email, password)))
                .andReturn();
    }

    @Test
    void registerIssuesAuthCookiesAndAllowsMe() throws Exception {
        MvcResult result = register("eevee", "eevee@example.com", "flowertail123");
        assertThat(result.getResponse().getStatus()).isEqualTo(201);

        Cookie access = result.getResponse().getCookie(AuthCookies.ACCESS_COOKIE);
        assertThat(access).isNotNull();
        assertThat(access.isHttpOnly()).isTrue();

        mockMvc.perform(get("/api/auth/me").cookie(access))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("eevee"))
                .andExpect(jsonPath("$.wins").value(0))
                .andExpect(jsonPath("$.points").value(0));
    }

    @Test
    void meWithoutCookieIsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void duplicateUsernameIsConflict() throws Exception {
        register("sirius", "sirius@example.com", "scythe-wave-7");
        MvcResult duplicate = register("SIRIUS", "other@example.com", "scythe-wave-7");
        assertThat(duplicate.getResponse().getStatus()).isEqualTo(409);
    }

    @Test
    void loginWithWrongPasswordIsUnauthorized() throws Exception {
        register("orion", "orion@example.com", "blackhole99");
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"usernameOrEmail":"orion","password":"wrong-password"}
                                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void loginByEmailWorks() throws Exception {
        register("gloria", "gloria@example.com", "evolution1st");
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"usernameOrEmail":"gloria@example.com","password":"evolution1st"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("gloria"))
                .andExpect(cookie().exists(AuthCookies.ACCESS_COOKIE));
    }

    @Test
    void forgotAndResetPasswordFlow() throws Exception {
        register("luna", "luna@example.com", "oldpassword1");

        MvcResult forgot = mockMvc.perform(post("/api/auth/forgot")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"usernameOrEmail":"luna"}
                                """))
                .andExpect(status().isOk())
                .andReturn();
        String token = objectMapper.readTree(forgot.getResponse().getContentAsString())
                .get("resetToken").asText();
        assertThat(token).isNotBlank();

        mockMvc.perform(post("/api/auth/reset")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"token":"%s","newPassword":"newpassword1"}
                                """.formatted(token)))
                .andExpect(status().isOk());

        // Token is single-use.
        mockMvc.perform(post("/api/auth/reset")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"token":"%s","newPassword":"anotherpass1"}
                                """.formatted(token)))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"usernameOrEmail":"luna","password":"newpassword1"}
                                """))
                .andExpect(status().isOk());
    }

    @Test
    void forgotForUnknownAccountStillSucceeds() throws Exception {
        mockMvc.perform(post("/api/auth/forgot")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"usernameOrEmail":"nobody-here"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resetToken").doesNotExist());
    }

    @Test
    void refreshRotatesCookies() throws Exception {
        MvcResult result = register("umbreon", "umbreon@example.com", "moonlight77");
        Cookie refresh = result.getResponse().getCookie(AuthCookies.REFRESH_COOKIE);
        assertThat(refresh).isNotNull();

        mockMvc.perform(post("/api/auth/refresh").cookie(refresh))
                .andExpect(status().isOk())
                .andExpect(cookie().exists(AuthCookies.ACCESS_COOKIE))
                .andExpect(jsonPath("$.username").value("umbreon"));
    }
}

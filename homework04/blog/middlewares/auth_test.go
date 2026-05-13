package middlewares_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"nadaona.com/web3-homework/blog/middlewares"
	"nadaona.com/web3-homework/blog/response"
)

func newTestAuth() *middlewares.Auth {
	return middlewares.NewAuth("test-secret-key", 24*time.Hour)
}

func parseAuthBody(t *testing.T, w *httptest.ResponseRecorder) response.Body {
	var body response.Body
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	return body
}

func TestAuthMiddleware_NoHeader(t *testing.T) {
	gin.SetMode(gin.TestMode)
	auth := newTestAuth()

	r := gin.New()
	r.Use(auth.Middleware())
	r.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthMiddleware_InvalidFormat(t *testing.T) {
	gin.SetMode(gin.TestMode)
	auth := newTestAuth()

	r := gin.New()
	r.Use(auth.Middleware())
	r.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "InvalidFormat")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthMiddleware_InvalidToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	auth := newTestAuth()

	r := gin.New()
	r.Use(auth.Middleware())
	r.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer invalid.token.here")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthMiddleware_ValidToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	auth := newTestAuth()

	r := gin.New()
	r.Use(auth.Middleware())
	r.GET("/protected", func(c *gin.Context) {
		response.OK(c, gin.H{"userID": c.GetInt("userID")})
	})

	token, err := auth.GenerateToken(1, "testuser")
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	resp := parseAuthBody(t, w)
	assert.Equal(t, 0, resp.Code)
}

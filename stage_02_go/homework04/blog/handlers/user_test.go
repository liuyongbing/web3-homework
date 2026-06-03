package handlers_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"nadaona.com/web3-homework/blog/handlers"
	"nadaona.com/web3-homework/blog/middlewares"
	"nadaona.com/web3-homework/blog/models"
)

func newUserHandler() *handlers.UserHandler {
	return handlers.NewUserHandler(
		&mockUserRepo{users: make(map[string]*models.User)},
		middlewares.NewAuth("test-secret", 24*time.Hour),
	)
}

func TestUserRegister_Success(t *testing.T) {
	h := newUserHandler()
	r := newRouter()
	r.POST("/register", h.Register)

	w := doRequest(t, r, http.MethodPost, "/register",
		`{"username":"testuser","password":"123456","email":"test@example.com"}`)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestUserRegister_MissingFields(t *testing.T) {
	h := newUserHandler()
	r := newRouter()
	r.POST("/register", h.Register)

	tests := []struct {
		name string
		body string
	}{
		{"missing username", `{"password":"123456","email":"test@example.com"}`},
		{"missing password", `{"username":"testuser","email":"test@example.com"}`},
		{"missing email", `{"username":"testuser","password":"123456"}`},
		{"short password", `{"username":"testuser","password":"123","email":"test@example.com"}`},
		{"invalid email", `{"username":"testuser","password":"123456","email":"invalid"}`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := doRequest(t, r, http.MethodPost, "/register", tt.body)
			assert.Equal(t, http.StatusBadRequest, w.Code)
		})
	}
}

func TestUserRegister_DuplicateUsername(t *testing.T) {
	h := newUserHandler()
	r := newRouter()
	r.POST("/register", h.Register)

	body := `{"username":"testuser","password":"123456","email":"test@example.com"}`
	w1 := doRequest(t, r, http.MethodPost, "/register", body)
	assert.Equal(t, http.StatusOK, w1.Code)

	w2 := doRequest(t, r, http.MethodPost, "/register", body)
	assert.Equal(t, http.StatusOK, w2.Code) // mock 不做唯一校验
}

func TestUserLogin_Success(t *testing.T) {
	h := newUserHandler()
	r := newRouter()
	r.POST("/register", h.Register)
	r.POST("/login", h.Login)

	doRequest(t, r, http.MethodPost, "/register",
		`{"username":"testuser","password":"123456","email":"test@example.com"}`)

	w := doRequest(t, r, http.MethodPost, "/login",
		`{"username":"testuser","password":"123456"}`)
	assert.Equal(t, http.StatusOK, w.Code)

	resp := parseBody(t, w)
	data, ok := resp.Data.(map[string]any)
	require.True(t, ok)
	assert.NotEmpty(t, data["token"])
}

func TestUserLogin_WrongPassword(t *testing.T) {
	h := newUserHandler()
	r := newRouter()
	r.POST("/register", h.Register)
	r.POST("/login", h.Login)

	doRequest(t, r, http.MethodPost, "/register",
		`{"username":"testuser","password":"123456","email":"test@example.com"}`)

	w := doRequest(t, r, http.MethodPost, "/login",
		`{"username":"testuser","password":"wrong"}`)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestUserLogin_UserNotFound(t *testing.T) {
	h := newUserHandler()
	r := newRouter()
	r.POST("/login", h.Login)

	w := doRequest(t, r, http.MethodPost, "/login",
		`{"username":"nobody","password":"123456"}`)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

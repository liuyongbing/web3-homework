package handlers

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"

	"nadaona.com/web3-homework/blog/models"
	"nadaona.com/web3-homework/blog/requests"
	"nadaona.com/web3-homework/blog/response"
)

func (h *UserHandler) Register(c *gin.Context) {
	var req requests.UserRegister
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		slog.Error("failed to hash password", "username", req.Username, "error", err)
		response.Error(c, http.StatusInternalServerError, "Failed to hash password")
		return
	}
	user := models.User{Username: req.Username, Password: string(hashedPassword), Email: req.Email}
	if err := h.users.Create(&user); err != nil {
		slog.Error("failed to create user", "username", req.Username, "error", err)
		response.Error(c, http.StatusInternalServerError, "Failed to create user")
		return
	}
	slog.Info("user registered", "username", user.Username, "user_id", user.ID)
	response.OK(c, nil)
}

func (h *UserHandler) Login(c *gin.Context) {
	var req requests.UserLogin
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	storedUser, err := h.users.FindByUsername(req.Username)
	if err != nil {
		slog.Warn("login failed: user not found", "username", req.Username)
		response.Error(c, http.StatusUnauthorized, "Invalid username or password")
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(storedUser.Password), []byte(req.Password)); err != nil {
		slog.Warn("login failed: wrong password", "username", req.Username)
		response.Error(c, http.StatusUnauthorized, "Invalid username or password")
		return
	}
	tokenString, err := h.auth.GenerateToken(int(storedUser.ID), storedUser.Username)
	if err != nil {
		slog.Error("failed to generate token", "username", req.Username, "error", err)
		response.Error(c, http.StatusInternalServerError, "Failed to generate token")
		return
	}
	slog.Info("user logged in", "username", req.Username, "user_id", storedUser.ID)
	response.OK(c, gin.H{"token": tokenString})
}

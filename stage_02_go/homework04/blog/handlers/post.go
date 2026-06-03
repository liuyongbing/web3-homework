package handlers

import (
	"log/slog"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"nadaona.com/web3-homework/blog/models"
	"nadaona.com/web3-homework/blog/requests"
	"nadaona.com/web3-homework/blog/response"
)

func (h *PostHandler) Create(c *gin.Context) {
	var req requests.Post
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	userID := c.GetInt("userID")
	post := models.Post{Title: req.Title, Content: req.Content, UserID: uint(userID)}
	if err := h.posts.Create(&post); err != nil {
		slog.Error("failed to create post", "user_id", userID, "error", err)
		response.Error(c, http.StatusInternalServerError, "Failed to create post")
		return
	}
	slog.Info("post created", "post_id", post.ID, "user_id", userID, "title", req.Title)
	response.OK(c, nil)
}

func (h *PostHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	userID := c.GetInt("userID")
	rowsAffected, err := h.posts.DeleteByIDAndUserID(id, userID)
	if err != nil {
		slog.Error("failed to delete post", "post_id", id, "user_id", userID, "error", err)
		response.Error(c, http.StatusInternalServerError, "Failed to delete post")
		return
	}
	if rowsAffected == 0 {
		slog.Warn("delete post denied: not owner or not found", "post_id", id, "user_id", userID)
		response.Error(c, http.StatusForbidden, "No permission to delete")
		return
	}
	slog.Info("post deleted", "post_id", id, "user_id", userID)
	response.OK(c, nil)
}

func (h *PostHandler) Update(c *gin.Context) {
	var req requests.Post
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	id := c.Param("id")
	storedPost, err := h.posts.FindByID(id)
	if err != nil {
		response.Error(c, http.StatusNotFound, "Post not found")
		return
	}
	userID := c.GetInt("userID")
	if storedPost.UserID != uint(userID) {
		slog.Warn("update post denied: not owner", "post_id", id, "user_id", userID)
		response.Error(c, http.StatusForbidden, "No permission to edit")
		return
	}
	storedPost.Title = req.Title
	storedPost.Content = req.Content
	if err := h.posts.Update(storedPost); err != nil {
		slog.Error("failed to update post", "post_id", id, "user_id", userID, "error", err)
		response.Error(c, http.StatusInternalServerError, "Failed to update post")
		return
	}
	slog.Info("post updated", "post_id", id, "user_id", userID)
	response.OK(c, nil)
}

func (h *PostHandler) Detail(c *gin.Context) {
	id := c.Param("id")
	post, err := h.posts.FindByID(id)
	if err != nil {
		response.Error(c, http.StatusNotFound, "Post not found")
		return
	}
	response.OK(c, response.NewPostRes(post))
}

func (h *PostHandler) List(c *gin.Context) {
	p, err := strconv.Atoi(c.DefaultQuery("page", "1"))
	if err != nil {
		response.Error(c, http.StatusBadRequest, "param page is not a number")
		return
	}
	limit, err := strconv.Atoi(c.DefaultQuery("size", "10"))
	if err != nil {
		response.Error(c, http.StatusBadRequest, "param size is not a number")
		return
	}
	if p < 1 {
		p = 1
	}
	if limit < 1 {
		limit = 10
	}
	if limit > 100 {
		limit = 100
	}
	posts, err := h.posts.FindList((p-1)*limit, limit)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "Failed to list posts")
		return
	}
	response.OK(c, response.NewPostResList(posts))
}

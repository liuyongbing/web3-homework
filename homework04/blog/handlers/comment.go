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

func (h *CommentHandler) Create(c *gin.Context) {
	var req requests.Comment
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	if _, err := h.posts.FindByID(strconv.Itoa(int(req.PostID))); err != nil {
		response.Error(c, http.StatusNotFound, "Post not found")
		return
	}
	userID := c.GetInt("userID")
	comment := models.Comment{PostID: req.PostID, Content: req.Content, UserID: uint(userID)}
	if err := h.comments.Create(&comment); err != nil {
		slog.Error("failed to create comment", "user_id", userID, "post_id", req.PostID, "error", err)
		response.Error(c, http.StatusInternalServerError, "Failed to create comment")
		return
	}
	slog.Info("comment created", "comment_id", comment.ID, "user_id", userID, "post_id", req.PostID)
	response.OK(c, nil)
}

func (h *CommentHandler) List(c *gin.Context) {
	postID, err := strconv.Atoi(c.Param("post_id"))
	if err != nil {
		response.Error(c, http.StatusBadRequest, "invalid post_id")
		return
	}
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
	comments, err := h.comments.FindList(uint(postID), (p-1)*limit, limit)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "Failed to list comments")
		return
	}
	response.OK(c, response.NewCommentResList(comments))
}

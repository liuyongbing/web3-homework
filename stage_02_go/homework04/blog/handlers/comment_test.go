package handlers_test

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"nadaona.com/web3-homework/blog/handlers"
	"nadaona.com/web3-homework/blog/models"
)

func newCommentHandler(repo handlers.CommentRepository, posts handlers.PostRepository) *handlers.CommentHandler {
	return handlers.NewCommentHandler(repo, posts)
}

func TestCreateComment_Success(t *testing.T) {
	posts := &mockPostRepo{posts: map[uint]*models.Post{1: {Model: gorm.Model{ID: 1}, Title: "Test", UserID: 1}}}
	h := newCommentHandler(&mockCommentRepo{comments: make(map[uint]*models.Comment)}, posts)
	r := newRouter()
	r.POST("/comments", authMiddleware(), h.Create)

	w := doRequestAuth(t, r, http.MethodPost, "/comments",
		`{"post_id":1,"content":"Great post!"}`, generateToken(t))
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestCreateComment_MissingFields(t *testing.T) {
	posts := &mockPostRepo{posts: map[uint]*models.Post{1: {Model: gorm.Model{ID: 1}}}}
	h := newCommentHandler(&mockCommentRepo{comments: make(map[uint]*models.Comment)}, posts)
	r := newRouter()
	r.POST("/comments", authMiddleware(), h.Create)

	w := doRequestAuth(t, r, http.MethodPost, "/comments", `{"post_id":1}`, generateToken(t))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCommentList_Success(t *testing.T) {
	repo := &mockCommentRepo{comments: make(map[uint]*models.Comment)}
	for range 3 {
		repo.Create(&models.Comment{Content: "Comment", UserID: 1, PostID: 1})
	}
	posts := &mockPostRepo{posts: map[uint]*models.Post{}}
	h := newCommentHandler(repo, posts)
	r := newRouter()
	r.GET("/comments/post/:post_id", h.List)

	w := doRequest(t, r, http.MethodGet, "/comments/post/1?page=1&size=2", "")
	assert.Equal(t, http.StatusOK, w.Code)
	resp := parseBody(t, w)
	data, ok := resp.Data.([]any)
	require.True(t, ok)
	assert.Len(t, data, 2)
}

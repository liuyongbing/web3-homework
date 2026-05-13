package handlers_test

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"nadaona.com/web3-homework/blog/handlers"
	"nadaona.com/web3-homework/blog/models"
)

func newPostHandler(repo handlers.PostRepository) *handlers.PostHandler {
	return handlers.NewPostHandler(repo)
}

func TestCreatePost_Success(t *testing.T) {
	h := newPostHandler(&mockPostRepo{posts: make(map[uint]*models.Post)})
	r := newRouter()
	r.POST("/posts", authMiddleware(), h.Create)

	w := doRequestAuth(t, r, http.MethodPost, "/posts",
		`{"title":"My Post","content":"Hello World"}`, generateToken(t))
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestCreatePost_MissingFields(t *testing.T) {
	h := newPostHandler(&mockPostRepo{posts: make(map[uint]*models.Post)})
	r := newRouter()
	r.POST("/posts", authMiddleware(), h.Create)

	w := doRequestAuth(t, r, http.MethodPost, "/posts", `{"title":"only title"}`, generateToken(t))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestPostDetail_Success(t *testing.T) {
	repo := &mockPostRepo{posts: make(map[uint]*models.Post)}
	repo.Create(&models.Post{Title: "Test", Content: "C", UserID: 1})

	h := newPostHandler(repo)
	r := newRouter()
	r.GET("/posts/:id", h.Detail)

	w := doRequest(t, r, http.MethodGet, "/posts/1", "")
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestPostDetail_NotFound(t *testing.T) {
	h := newPostHandler(&mockPostRepo{posts: make(map[uint]*models.Post)})
	r := newRouter()
	r.GET("/posts/:id", h.Detail)

	w := doRequest(t, r, http.MethodGet, "/posts/999", "")
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestPostList_Success(t *testing.T) {
	repo := &mockPostRepo{posts: make(map[uint]*models.Post)}
	for range 3 {
		repo.Create(&models.Post{Title: "Post", Content: "C", UserID: 1})
	}
	h := newPostHandler(repo)
	r := newRouter()
	r.GET("/posts", h.List)

	w := doRequest(t, r, http.MethodGet, "/posts?page=1&size=2", "")
	assert.Equal(t, http.StatusOK, w.Code)
	resp := parseBody(t, w)
	data, ok := resp.Data.([]any)
	require.True(t, ok)
	assert.Len(t, data, 2)
}

func TestPostList_InvalidPage(t *testing.T) {
	h := newPostHandler(&mockPostRepo{posts: make(map[uint]*models.Post)})
	r := newRouter()
	r.GET("/posts", h.List)

	w := doRequest(t, r, http.MethodGet, "/posts?page=abc", "")
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestUpdatePost_Success(t *testing.T) {
	repo := &mockPostRepo{posts: make(map[uint]*models.Post)}
	repo.Create(&models.Post{Title: "Old", Content: "Old", UserID: 1})
	h := newPostHandler(repo)
	r := newRouter()
	r.PUT("/posts/:id", authMiddleware(), h.Update)

	w := doRequestAuth(t, r, http.MethodPut, "/posts/1",
		`{"title":"New","content":"New Content"}`, generateToken(t))
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestUpdatePost_NotOwner(t *testing.T) {
	repo := &mockPostRepo{posts: make(map[uint]*models.Post)}
	repo.Create(&models.Post{Title: "Old", Content: "Old", UserID: 1})
	h := newPostHandler(repo)
	r := newRouter()
	r.PUT("/posts/:id", authMiddleware(), h.Update)

	w := doRequestAuth(t, r, http.MethodPut, "/posts/1",
		`{"title":"New","content":"New Content"}`, generateTokenWithUser(2, "other"))
	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestDeletePost_Success(t *testing.T) {
	repo := &mockPostRepo{posts: make(map[uint]*models.Post)}
	repo.Create(&models.Post{Title: "ToDelete", Content: "C", UserID: 1})
	h := newPostHandler(repo)
	r := newRouter()
	r.DELETE("/posts/:id", authMiddleware(), h.Delete)

	w := doRequestAuth(t, r, http.MethodDelete, "/posts/1", "", generateToken(t))
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestDeletePost_NotOwner(t *testing.T) {
	repo := &mockPostRepo{posts: make(map[uint]*models.Post)}
	repo.Create(&models.Post{Title: "ToDelete", Content: "C", UserID: 1})
	h := newPostHandler(repo)
	r := newRouter()
	r.DELETE("/posts/:id", authMiddleware(), h.Delete)

	w := doRequestAuth(t, r, http.MethodDelete, "/posts/1", "", generateTokenWithUser(2, "other"))
	assert.Equal(t, http.StatusForbidden, w.Code)
}

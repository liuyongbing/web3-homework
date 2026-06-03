package handlers_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"nadaona.com/web3-homework/blog/middlewares"
	"nadaona.com/web3-homework/blog/models"
	"nadaona.com/web3-homework/blog/response"
)

// ==================== Mock ====================

type mockUserRepo struct {
	users  map[string]*models.User
	nextID uint
}

func (m *mockUserRepo) Create(user *models.User) error {
	m.nextID++
	user.ID = m.nextID
	m.users[user.Username] = user
	return nil
}

func (m *mockUserRepo) FindByUsername(username string) (*models.User, error) {
	u, ok := m.users[username]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return u, nil
}

type mockPostRepo struct {
	posts  map[uint]*models.Post
	nextID uint
}

func (m *mockPostRepo) Create(post *models.Post) error {
	m.nextID++
	post.ID = m.nextID
	m.posts[post.ID] = post
	return nil
}

func (m *mockPostRepo) FindByID(id string) (*models.Post, error) {
	for _, p := range m.posts {
		if fmt.Sprintf("%d", p.ID) == id {
			return p, nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}

func (m *mockPostRepo) FindList(offset, limit int) ([]models.Post, error) {
	var result []models.Post
	i := 0
	for _, p := range m.posts {
		if i >= offset && len(result) < limit {
			result = append(result, *p)
		}
		i++
	}
	return result, nil
}

func (m *mockPostRepo) Update(post *models.Post) error {
	m.posts[post.ID] = post
	return nil
}

func (m *mockPostRepo) DeleteByIDAndUserID(id string, userID int) (int64, error) {
	for _, p := range m.posts {
		if fmt.Sprintf("%d", p.ID) == id && int(p.UserID) == userID {
			delete(m.posts, p.ID)
			return 1, nil
		}
	}
	return 0, nil
}

type mockCommentRepo struct {
	comments map[uint]*models.Comment
	nextID   uint
}

func (m *mockCommentRepo) Create(comment *models.Comment) error {
	m.nextID++
	comment.ID = m.nextID
	m.comments[comment.ID] = comment
	return nil
}

func (m *mockCommentRepo) FindList(postID uint, offset, limit int) ([]models.Comment, error) {
	var result []models.Comment
	i := 0
	for _, c := range m.comments {
		if c.PostID == postID && i >= offset && len(result) < limit {
			result = append(result, *c)
		}
		i++
	}
	return result, nil
}

// ==================== 工具函数 ====================

func newRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	return gin.New()
}

func parseBody(t *testing.T, w *httptest.ResponseRecorder) response.Body {
	var body response.Body
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	return body
}

func doRequest(t *testing.T, r *gin.Engine, method, path, body string) *httptest.ResponseRecorder {
	var req *http.Request
	if body != "" {
		req = httptest.NewRequest(method, path, bytes.NewBufferString(body))
	} else {
		req = httptest.NewRequest(method, path, nil)
	}
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func doRequestAuth(t *testing.T, r *gin.Engine, method, path, body, token string) *httptest.ResponseRecorder {
	var req *http.Request
	if body != "" {
		req = httptest.NewRequest(method, path, bytes.NewBufferString(body))
	} else {
		req = httptest.NewRequest(method, path, nil)
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func generateToken(t *testing.T) string {
	token, err := middlewares.NewAuth("test-secret", 24*time.Hour).GenerateToken(1, "author")
	require.NoError(t, err)
	return token
}

func generateTokenWithUser(userID int, username string) string {
	token, _ := middlewares.NewAuth("test-secret", 24*time.Hour).GenerateToken(userID, username)
	return token
}

func authMiddleware() gin.HandlerFunc {
	return middlewares.NewAuth("test-secret", 24*time.Hour).Middleware()
}

package handlers

import (
	"nadaona.com/web3-homework/blog/models"
)

type UserRepository interface {
	Create(user *models.User) error
	FindByUsername(username string) (*models.User, error)
}

type PostRepository interface {
	Create(post *models.Post) error
	FindByID(id string) (*models.Post, error)
	FindList(offset, limit int) ([]models.Post, error)
	Update(post *models.Post) error
	DeleteByIDAndUserID(id string, userID int) (int64, error)
}

type CommentRepository interface {
	Create(comment *models.Comment) error
	FindList(postID uint, offset, limit int) ([]models.Comment, error)
}

type TokenGenerator interface {
	GenerateToken(userID int, username string) (string, error)
}

// Repos holds all repository interfaces.
// Add fields as the project grows — callers stay unchanged.
type Repos struct {
	Users    UserRepository
	Posts    PostRepository
	Comments CommentRepository
}

type UserHandler struct {
	users UserRepository
	auth  TokenGenerator
}

func NewUserHandler(users UserRepository, auth TokenGenerator) *UserHandler {
	return &UserHandler{users: users, auth: auth}
}

type PostHandler struct {
	posts PostRepository
}

func NewPostHandler(posts PostRepository) *PostHandler {
	return &PostHandler{posts: posts}
}

type CommentHandler struct {
	comments CommentRepository
	posts    PostRepository
}

func NewCommentHandler(comments CommentRepository, posts PostRepository) *CommentHandler {
	return &CommentHandler{comments: comments, posts: posts}
}

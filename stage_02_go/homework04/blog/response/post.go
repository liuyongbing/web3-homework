package response

import (
	"time"

	"nadaona.com/web3-homework/blog/models"
)

type PostRes struct {
	ID        uint      `json:"id"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	UserID    uint      `json:"user_id"`
	Author    string    `json:"author"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func NewPostRes(p *models.Post) PostRes {
	return PostRes{
		ID:        p.ID,
		Title:     p.Title,
		Content:   p.Content,
		UserID:    p.UserID,
		Author:    p.User.Username,
		CreatedAt: p.CreatedAt,
		UpdatedAt: p.UpdatedAt,
	}
}

func NewPostResList(posts []models.Post) []PostRes {
	result := make([]PostRes, len(posts))
	for i := range posts {
		result[i] = NewPostRes(&posts[i])
	}
	return result
}

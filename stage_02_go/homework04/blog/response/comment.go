package response

import (
	"time"

	"nadaona.com/web3-homework/blog/models"
)

type CommentRes struct {
	ID        uint      `json:"id"`
	Content   string    `json:"content"`
	PostID    uint      `json:"post_id"`
	UserID    uint      `json:"user_id"`
	Author    string    `json:"author"`
	CreatedAt time.Time `json:"created_at"`
}

func NewCommentRes(c *models.Comment) CommentRes {
	return CommentRes{
		ID:        c.ID,
		Content:   c.Content,
		PostID:    c.PostID,
		UserID:    c.UserID,
		Author:    c.User.Username,
		CreatedAt: c.CreatedAt,
	}
}

func NewCommentResList(comments []models.Comment) []CommentRes {
	result := make([]CommentRes, len(comments))
	for i := range comments {
		result[i] = NewCommentRes(&comments[i])
	}
	return result
}

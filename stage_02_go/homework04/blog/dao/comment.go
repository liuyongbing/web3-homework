package dao

import (
	"gorm.io/gorm"

	"nadaona.com/web3-homework/blog/models"
)

type CommentDao struct {
	db *gorm.DB
}

func NewCommentDao(db *gorm.DB) *CommentDao {
	return &CommentDao{db: db}
}

func (d *CommentDao) Create(comment *models.Comment) error {
	return d.db.Create(comment).Error
}

func (d *CommentDao) FindList(postID uint, offset, limit int) ([]models.Comment, error) {
	var comments []models.Comment
	if err := d.db.Where("post_id = ?", postID).Limit(limit).Offset(offset).Find(&comments).Error; err != nil {
		return nil, err
	}
	return comments, nil
}

package dao

import (
	"gorm.io/gorm"
	"nadaona.com/web3-homework/blog/models"
)

type PostDao struct {
	db *gorm.DB
}

func NewPostDao(db *gorm.DB) *PostDao {
	return &PostDao{db: db}
}

func (d *PostDao) Create(post *models.Post) error {
	return d.db.Create(post).Error
}

func (d *PostDao) FindByID(id string) (*models.Post, error) {
	var post models.Post
	if err := d.db.Where("id = ?", id).First(&post).Error; err != nil {
		return nil, err
	}
	return &post, nil
}

func (d *PostDao) FindList(offset, limit int) ([]models.Post, error) {
	var posts []models.Post
	if err := d.db.Limit(limit).Offset(offset).Find(&posts).Error; err != nil {
		return nil, err
	}
	return posts, nil
}

func (d *PostDao) Update(post *models.Post) error {
	return d.db.Save(post).Error
}

func (d *PostDao) DeleteByIDAndUserID(id string, userID int) (int64, error) {
	result := d.db.Where("id = ? AND user_id = ?", id, userID).Delete(&models.Post{})
	return result.RowsAffected, result.Error
}

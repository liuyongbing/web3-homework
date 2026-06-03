package dao

import (
	"gorm.io/gorm"

	"nadaona.com/web3-homework/blog/models"
)

type UserDao struct {
	db *gorm.DB
}

func NewUserDao(db *gorm.DB) *UserDao {
	return &UserDao{db: db}
}

func (d *UserDao) Create(user *models.User) error {
	return d.db.Create(user).Error
}

func (d *UserDao) FindByUsername(username string) (*models.User, error) {
	var user models.User
	if err := d.db.Where("username = ?", username).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

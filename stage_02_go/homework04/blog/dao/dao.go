package dao

import (
	"gorm.io/gorm"

	"nadaona.com/web3-homework/blog/handlers"
)

func NewRepos(db *gorm.DB) handlers.Repos {
	return handlers.Repos{
		Users:    NewUserDao(db),
		Posts:    NewPostDao(db),
		Comments: NewCommentDao(db),
	}
}

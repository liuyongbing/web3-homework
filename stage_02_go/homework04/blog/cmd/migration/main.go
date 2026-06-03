package main

import (
	"nadaona.com/web3-homework/blog/initialize"
	"nadaona.com/web3-homework/blog/models"
)

func main() {
	initialize.LoadConfig()
	db := initialize.DB()

	// 自动迁移模型
	db.AutoMigrate(
		&models.User{},
		&models.Post{},
		&models.Comment{},
	)
}
